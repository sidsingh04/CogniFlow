const mongoose = require("mongoose");

const refreshTokenSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    role: { type: String, required: true, enum: ["agent", "supervisor"] },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });

// TTL index — MongoDB automatically deletes expired documents
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for fast lookups during refresh/logout
refreshTokenSchema.index({ userId: 1, role: 1 });

const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);

module.exports = RefreshToken;
