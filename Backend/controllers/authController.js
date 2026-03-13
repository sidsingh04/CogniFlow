const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { agentCredentials, superCredentials } = require("../models/Credentials.js");
const RefreshToken = require("../models/RefreshToken.js");
const dotenv = require("dotenv");

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// Cookie options for refresh token
const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/login',          // only sent to auth routes
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
};

function generateAccessToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function generateRefreshToken(payload) {
    // Add a unique JWT ID to payload so concurrent requests in the same second produce distinct tokens
    const uniquePayload = { ...payload, jti: crypto.randomBytes(16).toString('hex') };
    return jwt.sign(uniquePayload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

async function saveRefreshToken(token, userId, role) {
    await RefreshToken.create({
        token,
        userId,
        role,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    });
}


async function agentLogin(req, res) {
    try {
        const { userId, password } = req.body;

        const user = await agentCredentials.findOne({ agentId: userId });

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const payload = { id: user.agentId, role: 'agent' };
        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);

        // Persist refresh token in DB
        await saveRefreshToken(refreshToken, user.agentId, 'agent');

        // Set refresh token as httpOnly cookie
        res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

        return res.status(200).json({ message: "Login successful", token: accessToken });

    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ message: "Server error" });
    }
}

async function supervisorLogin(req, res) {
    try {
        const { userId, password } = req.body;

        const user = await superCredentials.findOne({ superId: userId });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const payload = { id: user.superId, role: 'supervisor' };
        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);

        // Persist refresh token in DB
        await saveRefreshToken(refreshToken, user.superId, 'supervisor');

        // Set refresh token as httpOnly cookie
        res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            supervisorId: user.superId,
            token: accessToken
        });

    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ message: "Server error" });
    }
}

async function refreshAccessToken(req, res) {
    try {
        const incomingToken = req.cookies?.refreshToken;

        if (!incomingToken) {
            return res.status(401).json({ message: "No refresh token provided" });
        }

        // Verify JWT signature
        let decoded;
        try {
            decoded = jwt.verify(incomingToken, JWT_REFRESH_SECRET);
        } catch (err) {
            // Token expired or invalid — clear the cookie
            res.clearCookie('refreshToken', { path: '/api/login' });
            return res.status(401).json({ message: "Invalid or expired refresh token" });
        }

        // Check token exists in DB (not revoked)
        const storedToken = await RefreshToken.findOne({ token: incomingToken });
        if (!storedToken) {
            // Possible token reuse — clear cookie for safety
            res.clearCookie('refreshToken', { path: '/api/login' });
            return res.status(401).json({ message: "Refresh token revoked or not found" });
        }

        // --- Refresh token rotation ---
        // Delete old token
        await RefreshToken.deleteOne({ _id: storedToken._id });

        // Issue new tokens
        const payload = { id: decoded.id, role: decoded.role };
        const newAccessToken = generateAccessToken(payload);
        const newRefreshToken = generateRefreshToken(payload);

        // Save new refresh token
        await saveRefreshToken(newRefreshToken, decoded.id, decoded.role);

        // Set new refresh token cookie
        res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);

        return res.status(200).json({ token: newAccessToken });

    } catch (error) {
        console.error("Refresh token error:", error);
        return res.status(500).json({ message: "Server error" });
    }
}

async function logout(req, res) {
    try {
        const incomingToken = req.cookies?.refreshToken;

        if (incomingToken) {
            // Remove from DB
            await RefreshToken.deleteOne({ token: incomingToken });
        }

        // Clear cookie
        res.clearCookie('refreshToken', { path: '/api/login' });

        return res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        console.error("Logout error:", error);
        return res.status(500).json({ message: "Server error" });
    }
}

module.exports = {
    agentLogin,
    supervisorLogin,
    refreshAccessToken,
    logout
};