const mongoose = require("mongoose");

const knowledgeBaseSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    solution: {
        type: [String],
        required: true,
        trim: true
    },
    //Metrics
    usageCount: {
        type: Number,
        default: 0
    },
    successCount: {
        type: Number,
        default: 0
    },
    tags: {
        type: [String],
        default: []
    },
    //Time metadata
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model("KnowledgeBase", knowledgeBaseSchema);