const Tag = require("../models/Tags");
const { generateEmbedding } = require("../services/embedding");

/**
 * Processes an array of tag strings through the insertion pipeline:
 * 1. Normalize
 * 2. Exact Match         — two queries: approved first, then pending
 *                          (pending check prevents E11000 duplicate key when a tag
 *                           exists as pending and is submitted again before approval)
 * 3. Fuzzy Match         — Atlas Search (NO session — cannot run inside a transaction)
 * 4. Vector Similarity   — Atlas Vector Search (NO session — same restriction)
 * 5. Create new tag if no match, else push into aliases
 *
 * NOTE: Tag.aggregate() returns plain POJOs, not Mongoose documents — they have no
 * .save() method. After a fuzzy or vector match we re-fetch by _id using findById()
 * so the apply block always works with a proper Mongoose document instance.
 *
 * Returns an array of resolved canonical tags to attach to the KB entry.
 */
exports.processAndInsertTags = async (tagsArray, session) => {
    if (!tagsArray || !Array.isArray(tagsArray) || tagsArray.length === 0) {
        return [];
    }

    const resolvedTags = [];

    for (const rawTag of tagsArray) {
        const cleanTag = rawTag.trim().toLowerCase();
        if (!cleanTag) continue;

        let matchedExistingTag = null;
        let matchStrategy = "none";
        let newTagEmbedding = null;

        // 1a. Exact Match — approved tags (findOne returns a Mongoose document)
        matchedExistingTag = await Tag.findOne({
            status: "approved",
            $or: [{ canonicalTag: cleanTag }, { aliases: cleanTag }]
        }).session(session);

        if (matchedExistingTag) matchStrategy = "exact";

        // 1b. Exact Match — pending tags fallback
        //     Prevents E11000 when the tag exists as pending but hasn't been approved yet.
        if (!matchedExistingTag) {
            matchedExistingTag = await Tag.findOne({
                status: "pending",
                $or: [{ canonicalTag: cleanTag }, { aliases: cleanTag }]
            }).session(session);

            if (matchedExistingTag) matchStrategy = "exact";
        }

        // 2. Fuzzy Match — Atlas Search
        //    aggregate() returns plain POJOs — re-fetch by _id afterwards to get a
        //    proper Mongoose document with .save()
        if (!matchedExistingTag) {
            const fuzzyResults = await Tag.aggregate([
                {
                    $search: {
                        index: "tags_search",
                        text: {
                            query: cleanTag,
                            path: ["canonicalTag", "aliases"],
                            fuzzy: { maxEdits: 1, prefixLength: 2 }
                        }
                    }
                },
                { $match: { status: "approved" } },
                { $limit: 1 }
            ]);

            if (fuzzyResults.length > 0) {
                // Re-fetch as a proper Mongoose document so .save({ session }) works
                const refetched = await Tag.findById(fuzzyResults[0]._id).session(session);
                if (refetched) {
                    matchedExistingTag = refetched;
                    matchStrategy = "levenshtein";
                }
            }
        }

        // 3. Vector Similarity — Atlas Vector Search
        //    Same issue — aggregate() returns plain POJOs, re-fetch by _id
        if (!matchedExistingTag) {
            newTagEmbedding = await generateEmbedding(cleanTag);

            if (newTagEmbedding?.length > 0) {
                const vectorResults = await Tag.aggregate([
                    {
                        $vectorSearch: {
                            index: "tags_vector_index",
                            path: "embedding",
                            queryVector: newTagEmbedding,
                            numCandidates: 20,
                            limit: 1,
                            filter: { status: "approved" }
                        }
                    },
                    { $addFields: { vectorScore: { $meta: "vectorSearchScore" } } },
                    { $match: { vectorScore: { $gte: 0.8 } } }
                ]);

                if (vectorResults.length > 0) {
                    // Re-fetch as a proper Mongoose document so .save({ session }) works
                    const refetched = await Tag.findById(vectorResults[0]._id).session(session);
                    if (refetched) {
                        matchedExistingTag = refetched;
                        matchStrategy = "embedding";
                    }
                }
            }
        }

        // 4. Apply results — all writes go through session (safe inside transaction)
        if (matchedExistingTag) {
            matchedExistingTag.usageCount += 1;

            // Auto-promote pending tag to approved once it has been used enough times
            if (matchedExistingTag.usageCount > 5 && matchedExistingTag.status === "pending") {
                matchedExistingTag.status = "approved";
            }

            if (
                matchStrategy !== "exact" &&
                cleanTag !== matchedExistingTag.canonicalTag &&
                !matchedExistingTag.aliases.includes(cleanTag)
            ) {
                matchedExistingTag.aliases.push(cleanTag);
            }

            await matchedExistingTag.save({ session });
            resolvedTags.push(matchedExistingTag.canonicalTag);

        } else {
            // 5. Create New Tag — reuse embedding if already fetched in Stage 3
            if (!newTagEmbedding) newTagEmbedding = await generateEmbedding(cleanTag);

            const newTag = new Tag({
                canonicalTag: cleanTag,
                status: "pending",
                usageCount: 1,
                embedding: newTagEmbedding || []
            });

            await newTag.save({ session });
            resolvedTags.push(newTag.canonicalTag);
        }
    }

    return [...new Set(resolvedTags)];
};
