const KnowledgeBase = require("../models/KnowledgeBase");
const Ticket = require("../models/Tickets");
const Tag = require("../models/Tags");
const IdempotencyKey = require("../models/IdempotencyKey");
const mongoose = require("mongoose");
const { NlpManager } = require("node-nlp");
const { jaccardSimilarity } = require("../services/tagging");
const { generateEmbedding, cosineSimilarity } = require("../services/embedding");
const { calculateConfidence } = require("../services/confidence");
const { processAndInsertTags } = require("./tagController");
const keywordExtractor = require("keyword-extractor");

// Initialize NLP manager for English — used only for email/url entity extraction
const manager = new NlpManager({ languages: ['en'], forceNER: true });

/* 
exports.createKnowledgeBase = async (req, res) => {
    try {
        const { title, description, solution, tags } = req.body;

        if (!title || !description) {
            return res.status(400).json({ message: "Title and description are required" });
        }

        const newKB = new KnowledgeBase({
            title,
            description,
            solution: solution ? [solution] : ["Pending AI/Agent Response"],
            tags: tags || []
        });

        await newKB.save();

        res.status(201).json({
            message: "Query stored in knowledge base",
            kb: newKB
        });
    } catch (error) {
        console.error("Error creating knowledge base entry:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
*/

// ─── Customer Query Search ────────────────────────────────────────────────────
exports.searchKnowledgeBase = async (req, res) => {
    try {
        const { title, description } = req.body;

        if (!title || !description) {
            return res.status(400).json({ message: "Title and description are required" });
        }

        // 1. Extract email/url entities via node-nlp
        const result = await manager.process("en", description);
        let tags = [];

        if (result && result.entities && result.entities.length > 0) {
            result.entities.forEach(e => {
                if (['email', 'url'].includes(e.entity)) {
                    tags.push(e.sourceText || e.entity);
                }
            });
        }

        // 2. Extract meaningful keywords from description (stop words removed)
        const keywords = keywordExtractor.extract(description, {
            language: "english",
            remove_digits: false,
            return_changed_case: true,
            remove_duplicates: true
        });

        if (keywords.length > 0) {
            const matchedTagsDocs = await Tag.find({
                status: "approved",
                $or: [
                    { canonicalTag: { $in: keywords } },
                    { aliases: { $in: keywords } }
                ]
            });

            const resolvedTags = new Set();

            keywords.forEach(word => {
                const matchedDoc = matchedTagsDocs.find(doc =>
                    doc.canonicalTag === word || doc.aliases.includes(word)
                );
                if (matchedDoc) {
                    resolvedTags.add(matchedDoc.canonicalTag);
                }
            });

            tags = [...tags, ...Array.from(resolvedTags)];
        }

        tags = [...new Set(tags)].filter(Boolean);

        // 3. Build clean search query
        const cleanKeywords = keywords.join(' ');
        const searchQuery = `${title} ${cleanKeywords} ${tags.join(' ')}`.trim();

        // 4. Atlas Search — no session, never inside a transaction
        const topSolutions = await KnowledgeBase.aggregate([
            {
                $search: {
                    index: "knowledgebase_search",
                    compound: {
                        should: [
                            {
                                text: {
                                    query: searchQuery,
                                    path: "title",
                                    score: { boost: { value: 3 } }
                                }
                            },
                            {
                                text: {
                                    query: searchQuery,
                                    path: "tags",
                                    score: { boost: { value: 4 } }
                                }
                            },
                            {
                                text: {
                                    query: searchQuery,
                                    path: "description",
                                    score: { boost: { value: 1 } }
                                }
                            }
                        ]
                    }
                }
            },
            {
                $match: {
                    solution: { $ne: "Pending AI/Agent Response" }
                }
            },
            {
                $addFields: { score: { $meta: "searchScore" } }
            },
            {
                $match: { score: { $gte: 6 } }
            },
            {
                $limit: 50
            },
            {
                $project: {
                    title: 1,
                    description: 1,
                    solution: 1,
                    tags: 1,
                    usageCount: 1,
                    successCount: 1,
                    updatedAt: 1,
                    score: 1,
                    embedding: 1
                }
            }
        ]);

        // 5. Jaccard filter
        const filteredSolutions = tags.length > 0
            ? topSolutions.filter(doc => jaccardSimilarity(tags, doc.tags || []) >= 0.3)
            : topSolutions.filter(doc => doc.score >= 10);

        let finalSolutions = [];

        if (filteredSolutions && filteredSolutions.length > 0) {
            const maxRelevanceScore = filteredSolutions[0].score || 1;

            // 6. One Gemini call for semantic re-ranking
            const queryEmbedding = await generateEmbedding(`${title} ${description}`);

            const scoredSolutions = filteredSolutions.map(doc => {
                const normalizedRelevance = doc.score / maxRelevanceScore;

                let semanticBoost = 0;
                if (queryEmbedding.length > 0 && doc.embedding?.length > 0) {
                    semanticBoost = cosineSimilarity(queryEmbedding, doc.embedding);
                }

                const blendedRelevance = normalizedRelevance * 0.8 + semanticBoost * 0.2;
                const confidenceScore = calculateConfidence(blendedRelevance, doc);

                return { ...doc, confidenceScore };
            });

            scoredSolutions.sort((a, b) => b.confidenceScore - a.confidenceScore);

            const topScore = scoredSolutions[0].confidenceScore;

            if (topScore > 0.75) {
                finalSolutions = scoredSolutions.filter(doc => doc.confidenceScore > 0.75).slice(0, 2);
            } else if (topScore >= 0.5 && topScore <= 0.75) {
                finalSolutions = scoredSolutions.filter(doc => doc.confidenceScore >= 0.5 && doc.confidenceScore <= 0.75).slice(0, 5);
            } else {
                finalSolutions = [];
            }
        }

        res.status(200).json({
            message: finalSolutions.length === 0 ? "Direct to helpline" : "Search complete",
            tags: tags,
            solutions: finalSolutions
        });
    } catch (error) {
        console.error("Error searching knowledge base:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getKnowledgeBase = async (req, res) => {
    try {
        const kb = await KnowledgeBase.find().sort({ createdAt: -1 });
        res.status(200).json(kb);
    } catch (error) {
        console.error("Error fetching knowledge base:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getKnowledgeBaseById = async (req, res) => {
    try {
        const kb = await KnowledgeBase.findById(req.params.id);
        if (!kb) {
            return res.status(404).json({ message: "Knowledge base entry not found" });
        }
        res.status(200).json(kb);
    } catch (error) {
        console.error("Error fetching knowledge base by ID:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updateKnowledgeBase = async (req, res) => {
    res.status(200).json({ message: "Update KB endpoint" });
};

exports.deleteKnowledgeBase = async (req, res) => {
    res.status(200).json({ message: "Delete KB endpoint" });
};

// ─── Agent Closing Review ─────────────────────────────────────────────────────
exports.submitClosingReview = async (req, res) => {
    try {
        const { issueId, title, description, solution, tags } = req.body;

        if (!issueId || !title || !description || !solution) {
            return res.status(400).json({ message: "issueId, title, description, and solution are required" });
        }

        const providedTags = Array.isArray(tags) ? tags : [];

        // ── PRE-TRANSACTION PHASE ─────────────────────────────────────────────
        // All reads that use Atlas Search MUST happen before the transaction opens.
        // $search and $vectorSearch cannot run inside a MongoDB transaction.

        // 1. Generate KB embedding (Gemini API call — outside transaction)
        const kbEmbedding = await generateEmbedding(`${title} ${description}`);

        // 2. Atlas Search KB duplicate check — outside transaction, read-only
        //    We find the best candidate now and pass it into the transaction as data.
        const searchQuery = `${title} ${description} ${providedTags.join(' ')}`.trim();

        const topSolutions = await KnowledgeBase.aggregate([
            {
                $search: {
                    index: "knowledgebase_search",
                    compound: {
                        should: [
                            {
                                text: {
                                    query: searchQuery,
                                    path: "title",
                                    score: { boost: { value: 3 } }
                                }
                            },
                            {
                                text: {
                                    query: searchQuery,
                                    path: "tags",
                                    score: { boost: { value: 4 } }
                                }
                            },
                            {
                                text: {
                                    query: searchQuery,
                                    path: "description",
                                    score: { boost: { value: 1 } }
                                }
                            }
                        ]
                    }
                }
            },
            {
                $addFields: { score: { $meta: "searchScore" } }
            },
            {
                $match: { score: { $gte: 5 } }
            },
            {
                $limit: 1
            }
        ]);

        // topCandidate is now available as plain data — no session needed
        const topCandidate = topSolutions?.[0] || null;

        // ── TRANSACTION PHASE ─────────────────────────────────────────────────
        // Only standard Mongoose reads/writes go inside the transaction.
        // No $search or $vectorSearch here.

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 3. Process tags — Atlas Search aggregates inside processAndInsertTags
            //    now run without .session() so they won't throw.
            //    Tag writes (save) still use the session correctly.
            const resolvedTags = await processAndInsertTags(providedTags, session);

            // 4. KB decision using the pre-fetched candidate
            let kbActionTaken = "INSERT";
            let targetKB = null;

            if (topCandidate) {
                const rawScore = topCandidate.score;
                const overlap = jaccardSimilarity(resolvedTags, topCandidate.tags || []);
                const combinedTags = [...new Set([...(topCandidate.tags || []), ...resolvedTags])];
                const tagsChanged = combinedTags.length !== (topCandidate.tags || []).length;

                if (rawScore >= 17 && overlap >= 0.4) {
                    // High confidence — IGNORE, only sync tags
                    kbActionTaken = "IGNORE";

                    if (tagsChanged) {
                        targetKB = await KnowledgeBase.findByIdAndUpdate(
                            topCandidate._id,
                            { $set: { tags: combinedTags } },
                            { new: true, session }
                        );
                    } else {
                        targetKB = topCandidate;
                    }

                } else if (rawScore >= 10 || (rawScore > 7 && overlap >= 0.25)) {
                    // Moderate confidence — APPEND if not duplicate
                    kbActionTaken = "APPEND";

                    const isDuplicate = Array.isArray(topCandidate.solution) &&
                        topCandidate.solution.includes(solution);

                    if (!isDuplicate) {
                        targetKB = await KnowledgeBase.findByIdAndUpdate(
                            topCandidate._id,
                            {
                                $push: {
                                    solution: {
                                        $each: [solution],
                                        $slice: -10
                                    }
                                },
                                $set: {
                                    tags: combinedTags,
                                    embedding: kbEmbedding.length > 0
                                        ? kbEmbedding
                                        : topCandidate.embedding || []
                                }
                            },
                            { new: true, session }
                        );
                    } else {
                        // Duplicate solution — sync tags only
                        targetKB = await KnowledgeBase.findByIdAndUpdate(
                            topCandidate._id,
                            { $set: { tags: combinedTags } },
                            { new: true, session }
                        );
                    }
                }
            }

            // 5. INSERT fallback — create new KB entry
            if (kbActionTaken === "INSERT") {
                const newKB = new KnowledgeBase({
                    title,
                    description,
                    solution: [solution],
                    tags: resolvedTags,
                    embedding: kbEmbedding
                });
                await newKB.save({ session });
                targetKB = newKB;
            }

            // 6. Mark ticket as reviewed
            const updatedTicket = await Ticket.findOneAndUpdate(
                { issueId },
                { $set: { reviewGiven: true } },
                { new: true, session }
            );

            if (!updatedTicket) {
                throw new Error(`Ticket with issueId ${issueId} not found`);
            }

            await session.commitTransaction();
            session.endSession();

            const response = {
                message: `Review submitted. KB Action: ${kbActionTaken}`,
                kb: targetKB,
                ticket: updatedTicket
            };

            if (req.idempotencyKey) {
                await IdempotencyKey.create({
                    key: req.idempotencyKey,
                    response
                });
            }

            res.status(201).json(response);

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error; // re-throw to outer catch
        }

    } catch (error) {
        console.error("Error submitting closing review:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// ─── Upvote / Downvote Feedback ───────────────────────────────────────────────
exports.feedbackKnowledgeBase = async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body;

        if (!['upvote', 'downvote'].includes(action)) {
            return res.status(400).json({ message: "Invalid action. Use 'upvote' or 'downvote'." });
        }

        let updateQuery = {};

        if (action === 'upvote') {
            updateQuery = { $inc: { successCount: 1, usageCount: 1 } };
        } else if (action === 'downvote') {
            updateQuery = { $inc: { usageCount: 1 } };
        }

        const updatedKb = await KnowledgeBase.findByIdAndUpdate(
            id,
            updateQuery,
            {
                new: true,
                timestamps: false
            }
        );

        if (!updatedKb) {
            return res.status(404).json({ message: "Knowledge Base entry not found" });
        }

        res.status(200).json({
            message: `Feedback recorded successfully as ${action}`,
            successCount: updatedKb.successCount,
            usageCount: updatedKb.usageCount
        });
    } catch (error) {
        console.error("Error updating knowledge base feedback:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
