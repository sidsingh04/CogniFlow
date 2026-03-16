const Tag = require("../models/Tags");
const { isSimilar } = require("../services/tagging");
const { generateEmbedding, cosineSimilarity } = require("../services/embedding");

/**
 * Processes an array of tag strings through the insertion pipeline:
 * 1. Normalize
 * 2. Exact Match Check
 * 3. Levenshtein Similarity (>0.85)
 * 4. Semantic Embedding Similarity (>0.80)
 * 5. Create new tag if no match else push into aliases
 * 
 * Returns an array of resolved canonical tags to attach to the KB entry.
 */
exports.processAndInsertTags = async (tagsArray, session) => {
    if (!tagsArray || !Array.isArray(tagsArray) || tagsArray.length === 0) {
        return [];
    }

    const resolvedTags = [];

    // Pre-fetch all tags once for similarity checks (to avoid querying per tag)
    // In a massive system, this might need an optimized vector search DB, 
    const allTags = await Tag.find({}).session(session);

    for (const rawTag of tagsArray) {
        const cleanTag = rawTag.trim().toLowerCase();
        if (!cleanTag) continue;

        let matchedExistingTag = null;
        let matchStrategy = "none";

        // 1. Exact Match Check
        matchedExistingTag = allTags.find(t => 
            t.canonicalTag === cleanTag || t.aliases.includes(cleanTag)
        );
        if (matchedExistingTag) matchStrategy = "exact";

        // 2. Levenshtein Similarity (Threshold > 0.85)
        if (!matchedExistingTag) {
            let maxSimilarity = -1;
            for (const existingTag of allTags) {
                // Check against canonical
                let sim = isSimilar(cleanTag, existingTag.canonicalTag, 0.85) ? 1.0 : 0; 
                
                // Let's manually calculate score to find the maximum if isSimilar just returns bool.
                // Looking at tagging.js, it returns a boolean. So we just take the first one that matches.
                // To be precise with > 0.85:
                if (isSimilar(cleanTag, existingTag.canonicalTag, 0.85)) {
                    matchedExistingTag = existingTag;
                    matchStrategy = "levenshtein";
                    break;
                }
                
                // Check against aliases
                for (const alias of existingTag.aliases) {
                    if (isSimilar(cleanTag, alias, 0.85)) {
                        matchedExistingTag = existingTag;
                        matchStrategy = "levenshtein";
                        break;
                    }
                }
                if (matchedExistingTag) break;
            }
        }

        // 3. Embedding Similarity (Threshold > 0.8)
        if (!matchedExistingTag) {
            const newTagEmbedding = await generateEmbedding(cleanTag);
            
            if (newTagEmbedding && newTagEmbedding.length > 0) {
                let maxSimilarity = -1;
                let bestMatch = null;
                
                for (const existingTag of allTags) {
                    if (existingTag.embedding && existingTag.embedding.length > 0) {
                        const similarity = cosineSimilarity(newTagEmbedding, existingTag.embedding);
                        if (similarity > maxSimilarity) {
                            maxSimilarity = similarity;
                            bestMatch = existingTag;
                        }
                    }
                }
                
                if (maxSimilarity > 0.8 && bestMatch) {
                    matchedExistingTag = bestMatch;
                    matchStrategy = "embedding";
                }
            }
        }

        // Apply results
        if (matchedExistingTag) {
            // Update usage count and status
            matchedExistingTag.usageCount += 1;
            if (matchedExistingTag.usageCount > 5 && matchedExistingTag.status === "pending") {
                matchedExistingTag.status = "approved";
            }
            
            // If it matched via similarity (not exact), add to aliases if not there
            if (matchStrategy !== "exact" && 
                cleanTag !== matchedExistingTag.canonicalTag && 
                !matchedExistingTag.aliases.includes(cleanTag)) {
                matchedExistingTag.aliases.push(cleanTag);
            }
            
            await matchedExistingTag.save({ session });
            resolvedTags.push(matchedExistingTag.canonicalTag);
        } else {
            // 4. Create New Tag
            const newTagEmbedding = await generateEmbedding(cleanTag);
            const newTag = new Tag({
                canonicalTag: cleanTag,
                status: "pending",
                usageCount: 1,
                embedding: newTagEmbedding || []
            });
            await newTag.save({ session });
            
            // Add to our local allTags cache so subsequent tags in the same array can match against it
            allTags.push(newTag);
            
            resolvedTags.push(newTag.canonicalTag);
        }
    }

    // Return unique resolved tags
    return [...new Set(resolvedTags)];
};