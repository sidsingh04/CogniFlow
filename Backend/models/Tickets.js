const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({

    issueId: {
        type: String,
        required: true,
        unique: true,
    },

    code: {
        type: String,
        required: true,
        trim: true
    },

    description: {
        type: String,
        required: true,
        trim: true
    },

    callDuration: {
        type: Number,
        default: 0,
        min: 0
    },

    //for internal queries (DB Relationship)
    agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Agent",
        required: true,
    },

    //for business logic (showing in frontend)
    agentId: {
        type: String,
        required: true,
    },

    issueDate: {
        type: Date,
        default: Date.now
    },

    approvalDate: {
        type: Date
    },

    resolvedDate: {
        type: Date
    },

    remarks: {
        type: String,
        required: true,
        trim: true
    },

    status: {
        type: String,
        enum: ["pending", "approval", "resolved"],
        default: "pending"
    },

    rejectionHistory: [{
        type: Date
    }],

    approvalHistory: [{
        date: Date,
        callDuration: Number,
        remarks: String
    }],

    slaBreached: {
        type: Boolean,
        default: false
    },

    slaDeadline: {
        type: Date
    }

}, { timestamps: true });

// ticketSchema.index({ issueId: 1 });
ticketSchema.index({ agentId: 1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ issueDate: 1 });
ticketSchema.index({ resolvedDate: 1 });
ticketSchema.index({ code: 1 });
ticketSchema.index({ status: 1, resolvedDate: 1 });

module.exports = mongoose.model("Ticket", ticketSchema);