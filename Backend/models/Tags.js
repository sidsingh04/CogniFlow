const mongoose = require("mongoose");

const tagSchema = new mongoose.Schema({
    canonicalTag: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    aliases: {
        type: [{
            type: String,
            lowercase: true,
            trim: true
        }],
        default: []
    },
    //status would be approved automatically when usageCount>5
    status: {
        type: String,
        enum: ["pending", "approved"],
        default: "pending"
    },
    usageCount: {
        type: Number,
        default: 1
    },
    embedding: {
        type: [Number],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }

}, { timestamps: true });

// fast canonical lookup
// tagSchema.index({ canonicalTag: 1 });

// fast alias lookup
tagSchema.index({ aliases: 1 });

module.exports = mongoose.model("Tag", tagSchema);
