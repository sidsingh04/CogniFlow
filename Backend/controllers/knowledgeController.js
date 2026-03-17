const KnowledgeBase = require("../models/KnowledgeBase");
const Ticket = require("../models/Tickets");
const Tag = require("../models/Tags");
const IdempotencyKey = require("../models/IdempotencyKey");
const mongoose = require("mongoose");
const { NlpManager } = require("node-nlp");
const { isSimilar, jaccardSimilarity, } = require("../services/tagging");
const { calculateConfidence } = require("../services/confidence");
const { processAndInsertTags } = require("./tagController");

// Initialize NLP manager for English
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
            solution: solution ? [solution] : ["Pending AI/Agent Response"], // Array initialization
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

//Customer Query Search
exports.searchKnowledgeBase = async (req, res) => {
    try {
        const { title, description } = req.body;

        if (!title || !description) {
            return res.status(400).json({ message: "Title and description are required" });
        }

        // Use node-nlp to process the description
        const result = await manager.process("en", description);
        let tags = [];

        // 1. Keep meaningful built-in NLP entities like emails and URLs
        if (result && result.entities && result.entities.length > 0) {
            result.entities.forEach(e => {
                if (['email', 'url'].includes(e.entity)) {
                    tags.push(e.sourceText || e.entity);
                }
            });
        }

        // 2. Tokenize text to find other potential tags
        const words = description.split(/\s+/)
            .map(w => w.replace(/^[.,;:!?()]+|[.,;:!?()]+$/g, '').toLowerCase())
            .filter(Boolean);

        if (words.length > 0) {
            // Fetch matching tags from database (canonical or aliases)
            const matchedTagsDocs = await Tag.find({
                $or: [
                    { canonicalTag: { $in: words } },
                    { aliases: { $in: words } }
                ]
            });

            const resolvedTags = new Set();

            // Add DB-matched canonical tags
            words.forEach(word => {
                const matchedDoc = matchedTagsDocs.find(doc =>
                    doc.canonicalTag === word || doc.aliases.includes(word)
                );

                if (matchedDoc) {
                    resolvedTags.add(matchedDoc.canonicalTag);
                }
            });

            // Add DB tags to the array alongside NLP entities
            tags = [...tags, ...Array.from(resolvedTags)];
        }

        tags = [...new Set(tags)].filter(Boolean);

        // Build search query based on user inputs and extracted tags
        const searchQuery = `${title} ${description} ${tags.join(' ')}`.trim();

        // Perform Atlas Search using Field Boosting
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
                                    score: { boost: { value: 3 } } // Secondary Priority
                                }
                            },
                            {
                                text: {
                                    query: searchQuery,
                                    path: "tags",
                                    score: { boost: { value: 4 } } // Highest Priority
                                }
                            },
                            {
                                text: {
                                    query: searchQuery,
                                    path: "description",
                                    score: { boost: { value: 1 } } // Base Priority
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
                // Project search score into a real field so we can filter on it
                $addFields: { score: { $meta: "searchScore" } }
            },
            {
                // Gate 1: Only keep documents with relevance score >= 6
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
                    score: 1
                }
            }
        ]);

        const filteredSolutions = tags.length > 0
            ? topSolutions.filter(doc => jaccardSimilarity(tags, doc.tags || []) >= 0.3)
            : topSolutions; // If no user tags were extracted, skip Jaccard filter

        let finalSolutions = [];

        if (filteredSolutions && filteredSolutions.length > 0) {
            const maxRelevanceScore = filteredSolutions[0].score || 1; // Prevent division by zero

            // Calculate confidence score for each document
            const scoredSolutions = filteredSolutions.map(doc => {
                const normalizedRelevance = doc.score / maxRelevanceScore;
                const confidenceScore = calculateConfidence(normalizedRelevance, doc);
                return {
                    ...doc,
                    confidenceScore
                };
            });

            // Sort by confidence score descending
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
    // Placeholder functionality, not fully implemented for this workflow
    res.status(200).json({ message: "Update KB endpoint" });
};

exports.deleteKnowledgeBase = async (req, res) => {
    // Placeholder functionality, not fully implemented for this workflow
    res.status(200).json({ message: "Delete KB endpoint" });
};

exports.submitClosingReview = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { issueId, title, description, solution, tags } = req.body;

        if (!issueId || !title || !description || !solution) {
            return res.status(400).json({ message: "issueId, title, description, and solution are required" });
        }

        const providedTags = Array.isArray(tags) ? tags : [];

        // 1. Process tags through insertion pipeline
        const resolvedTags = await processAndInsertTags(providedTags, session);

        // 2. Smart KB Integration Check via Atlas Search
        let kbActionTaken = "INSERT";
        let targetKB = null;

        // Build search query using the original attributes and resolved tags
        const searchQuery = `${title} ${description} ${resolvedTags.join(' ')}`.trim();

        // Perform Atlas Search using Field Boosting (Same as searchKnowledgeBase)
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
                // Gate 1: Relevance must be >= 5
                $match: { score: { $gte: 5 } }
            },
            {
                $limit: 1 // We only need the top absolute match to make a decision
            }
        ]); 

        if (topSolutions && topSolutions.length > 0) {
            const topDoc = topSolutions[0];

            const MAX_EXPECTED_SCORE = 20.0;
            const normalizedScore = Math.min(topDoc.score / MAX_EXPECTED_SCORE, 1.0);

            const overlap = jaccardSimilarity(resolvedTags, topDoc.tags || []);

            const combinedTags = [...new Set([...(topDoc.tags || []), ...resolvedTags])];
            const tagsChanged = combinedTags.length !== (topDoc.tags || []).length;

            if (normalizedScore > 0.85 && overlap >= 0.4) {
                // Highly confident match overall. Ignore the text, but sync the tags.
                kbActionTaken = "IGNORE";

                if (tagsChanged) {
                    targetKB = await KnowledgeBase.findByIdAndUpdate(
                        topDoc._id,
                        { $set: { tags: combinedTags } },
                        { new: true, session }
                    );
                } else {
                    targetKB = topDoc;
                }
            } else if (normalizedScore >= 0.55 || (normalizedScore > 0.4 && overlap >= 0.25)) {
                // Moderate confidence match. Either the semantic text was similar enough (>0.55) 
                // OR the text wasn't overwhelmingly strong (>0.4) but it shared a solid tag base (>=0.25).
                kbActionTaken = "APPEND";

                targetKB = await KnowledgeBase.findByIdAndUpdate(
                    topDoc._id,
                    {
                        $push: { solution: solution }, // Push the new solution string to the array
                        $set: { tags: combinedTags }
                    },
                    { new: true, session }
                );
            }
        }

        // 3. Fallback: Create new entry if no suitable match found
        if (kbActionTaken === "INSERT") {
            const newKB = new KnowledgeBase({
                title,
                description,
                solution: [solution],
                tags: resolvedTags
            });
            await newKB.save({ session });
            targetKB = newKB;
        }

        // 4. Update the ticket's reviewGiven flag
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
        console.error("Error submitting closing review:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Handle Upvote / Downvote Feedback on Search Solutions
exports.feedbackKnowledgeBase = async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'upvote' or 'downvote'

        if (!['upvote', 'downvote'].includes(action)) {
            return res.status(400).json({ message: "Invalid action. Use 'upvote' or 'downvote'." });
        }

        let updateQuery = {};

        if (action === 'upvote') {
            // Atomically increment successCount and usageCount
            updateQuery = { $inc: { successCount: 1, usageCount: 1 } };
        } else if (action === 'downvote') {
            // Atomically increment usageCount only
            updateQuery = { $inc: { usageCount: 1 } };
        }

        const updatedKb = await KnowledgeBase.findByIdAndUpdate(
            id,
            updateQuery,
            {
                new: true,  // Return the updated document
                timestamps: false  //prevent the updatedAt field from being changed
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
