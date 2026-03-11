const KnowledgeBase = require("../models/KnowledgeBase");
const { NlpManager } = require("node-nlp");
const { isSimilar } = require("../services/tagging");
const { calculateConfidence } = require("../services/confidence");

// Initialize NLP manager for English
const manager = new NlpManager({ languages: ['en'], forceNER: true });

exports.createKnowledgeBase = async (req, res) => {
    try {
        const { title, description, solution, tags } = req.body;

        if (!title || !description) {
            return res.status(400).json({ message: "Title and description are required" });
        }

        const newKB = new KnowledgeBase({
            title,
            description,
            solution: solution || "Pending AI/Agent Response", // Default placeholder
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
                                    score: { boost: { value: 3 } } // Highest Priority
                                }
                            },
                            {
                                text: {
                                    query: searchQuery,
                                    path: "tags",
                                    score: { boost: { value: 2 } } // Secondary Priority
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
                    score: { $meta: "searchScore" }
                }
            }
        ]);

        let finalSolutions = [];

        if (topSolutions && topSolutions.length > 0) {
            const maxRelevanceScore = topSolutions[0].score || 1; // Prevent division by zero

            // Calculate confidence score for each document
            const scoredSolutions = topSolutions.map(doc => {
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
