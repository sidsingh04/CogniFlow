const KnowledgeBase = require("../models/KnowledgeBase");
const Ticket = require("../models/Tickets");
const Tag = require("../models/Tags");
const mongoose = require("mongoose");
const { NlpManager } = require("node-nlp");
const { isSimilar } = require("../services/tagging");
const { calculateConfidence } = require("../services/confidence");
const { processAndInsertTags } = require("./tagController");

// Initialize NLP manager for English
const manager = new NlpManager({ languages: ['en'], forceNER: true });

// Jaccard similarity helper = |intersection| / |union|
function jaccardSimilarity(setA, setB) {
    if (!setA || !setB) return 0;
    const a = new Set(setA.map(t => t.toLowerCase()));
    const b = new Set(setB.map(t => t.toLowerCase()));
    if (a.size === 0 && b.size === 0) return 1; // both empty = perfect match
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    for (const item of a) {
        if (b.has(item)) intersection++;
    }
    const union = new Set([...a, ...b]).size;
    return intersection / union;
}

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

//Customer Query Search
exports.searchKnowledgeBase = async (req, res) => {
    try {
        const { title, description } = req.body;

        if (!title || !description) {
            return res.status(400).json({ message: "Title and description are required" });
        }

        // Use node-nlp to process the description
        const result = await manager.process("en", description);
        const TECH_TERMS = new Set([
            // Authentication & Access
            "login", "signin", "signup", "email", "password", "profile", "account", "auth",
            "authentication", "authorization", "token", "session", "access",

            // Generic Tech & Errors
            "bug", "issue", "error", "crash", "crashing", "latency", "timeout", "api", "database",
            "downtime", "network", "connection", "server", "sync", "syncing", "unhandled", "exception", "glitch", "performance",
            "slow", "lagging", "freeze", "frozen", "update", "upgrade", "install", "uninstall",
            "offline", "loading", "failure", "fail", "missing", "configuration", "settings", "setup",
            "down", "buggy", "broken", "disconnect", "disconnected", "latency", "lag", "offline",

            // Core Restaurant POS & Hardware
            "pos", "kiosk", "terminal", "register", "ipad", "tablet", "printer", "printing",
            "receipt", "receipts", "kitchen", "kds", "display", "screen", "menu", "modifier",
            "modifiers", "inventory", "stock", "recipe", "order", "orders", "checkout", "payment",
            "payments", "card", "reader", "swipe", "chip", "nfc", "tap", "cash", "drawer",
            "refund", "void", "discount", "comp", "split", "bill", "check", "tip", "gratuity",
            "table", "floorplan", "seating", "reservation", "reservations", "waitlist",
            "delivery", "takeout", "pickup", "online", "integration", "doordash", "ubereats",
            "grubhub", "third-party", "loyalty", "rewards", "giftcard", "giftcards", "promo",
            "code", "clock", "timesheet", "shift", "shifts", "payroll", "manager", "override",
            "pin", "passcode", "swipe", "scanner", "barcode", "qr", "menu", "sync",

            // Cloud, SaaS, Platform & Architecture
            "cloud", "saas", "platform", "suite", "unified", "scalable", "scalability", "efficiency",
            "aws", "hosting", "azure", "tenant", "multitenant", "deployment", "infrastructure",
            "uptime", "sla", "migration", "onboarding",

            // Business & Formats
            "qsr", "fsr", "finedining", "fine-dining", "cloudkitchen", "cloud-kitchen", "ghostkitchen",
            "ghost-kitchen", "darkkitchen", "hotel", "chain", "chains", "franchise", "enterprise",
            "smb", "bms", "cafe", "bakery", "bar", "brewery", "foodtruck",

            // Specialized Modules (FOH, BOH, Analytics, CRM)
            "foh", "front-of-house", "boh", "back-of-house", "analytics", "reporting", "reports",
            "dashboard", "metrics", "crm", "customer", "guests", "feedback", "digital", "ordering",
            "omnichannel", "marketing", "campaign", "campaigns", "sms", "push", "notification"
        ]);

        let tags = [];

        // 1. Keep meaningful built-in NLP entities like emails and URLs
        if (result && result.entities && result.entities.length > 0) {
            result.entities.forEach(e => {
                if (['email', 'url'].includes(e.entity)) {
                    tags.push(e.sourceText || e.entity);
                }
            });
        }

        // 2. Extract strict technical keywords
        const words = description.split(/\s+/);
        for (let word of words) {
            let cleanWord = word.replace(/^[.,;:!?()]+|[.,;:!?()]+$/g, '');
            let lowerWord = cleanWord.toLowerCase();

            if (!lowerWord) continue;

            let matchedTerm = null;

            // 1. Fast O(1) verify for perfectly spelled words
            if (TECH_TERMS.has(lowerWord)) {
                matchedTerm = lowerWord;
            } else {
                // 2. Fallback O(N) fuzzy scan for typographical errors
                for (const term of TECH_TERMS) {
                    if (isSimilar(lowerWord, term)) {
                        matchedTerm = term;
                        break;
                    }
                }
            }

            if (matchedTerm) {
                tags.push(matchedTerm);
            }
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

// It directly write, It would later go through the pipeline and
// then the decision be made how to handle knowledge-base
// and tags collection.

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
        ]); // Removed .session(session) because $search cannot run in a transaction

        if (topSolutions && topSolutions.length > 0) {
            const topDoc = topSolutions[0];

            // Normalize Top Document's score by dividing by a heuristic max threshold (e.g. max theoretical expected ~ 25.0) 
            // NOTE: The user explicitly requested >0.85 and [0.55, 0.85] logic natively. Maxing to 25 to approximate 0-1 bounds for search score.
            // Adjust the denominator according to typical Atlas Search score magnitude bounds in your dataset.
            const MAX_EXPECTED_SCORE = 20.0;
            const normalizedScore = Math.min(topDoc.score / MAX_EXPECTED_SCORE, 1.0);

            const overlap = jaccardSimilarity(resolvedTags, topDoc.tags || []);

            if (normalizedScore > 0.85 && overlap >= 0.4) {
                // Highly confident match. Ignore KB insertion/append.
                kbActionTaken = "IGNORE";
                targetKB = topDoc;
            } else if (normalizedScore >= 0.55 && normalizedScore <= 0.85 && overlap >= 0.25 && overlap <= 0.4) {
                // Moderate confidence match. Append the new solution context gracefully.
                kbActionTaken = "APPEND";

                const combinedTags = [...new Set([...(topDoc.tags || []), ...resolvedTags])];

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
                solution: [solution], // Wrap in array
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

        res.status(201).json({
            message: `Review submitted. KB Action: ${kbActionTaken}`,
            kb: targetKB,
            ticket: updatedTicket
        });
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
