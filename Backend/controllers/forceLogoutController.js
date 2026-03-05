const { SendMessageCommand } = require("@aws-sdk/client-sqs");
const sqs = require("../config/sqs");
const Agent = require("../models/Agent");
const { getIO } = require("../socket");


/**
 * API handler — Supervisor sends force-logout command.
 * Pushes a message onto the force-logout SQS queue.
 */
exports.sendForceLogout = async (req, res) => {
    try {
        const { agentId } = req.body;

        if (!agentId) {
            return res.status(400).json({ success: false, message: "agentId is required" });
        }

        const command = new SendMessageCommand({
            QueueUrl: process.env.FORCE_LOGOUT_QUEUE_URL,
            MessageBody: JSON.stringify({
                eventType: "FORCE_LOGOUT",
                agentId: agentId
            })
        });

        await sqs.send(command);

        console.log(`[ForceLogout] Queued force-logout for agent ${agentId}`);

        return res.json({ success: true, message: "Force logout command queued" });

    } catch (error) {
        console.error("[ForceLogout] Failed to queue message:", error);
        return res.status(500).json({ success: false, message: "Failed to send force logout command" });
    }
};


/**
 * Consumer handler — Called by the force-logout worker when
 * a message is received from the SQS queue.
 */
exports.processForceLogout = async (message) => {
    const { eventType, agentId } = message;

    if (eventType !== "FORCE_LOGOUT") {
        console.log("[ForceLogout] Unknown event type:", eventType);
        return;
    }

    // Update agent status to Offline in the database
    const agent = await Agent.findOneAndUpdate(
        { agentId },
        { $set: { status: "Offline" } },
        { new: true }
    );

    if (!agent) {
        console.log(`[ForceLogout] Agent ${agentId} not found`);
        return;
    }

    // Emit socket event so the agent's browser gets notified
    try {
        getIO().emit("forceLogout", {
            agentId: agentId,
            timestamp: new Date().toISOString()
        });
    } catch (socketErr) {
        console.error("[ForceLogout] Socket emit error:", socketErr);
    }

    // Also broadcast the status change so supervisor dashboards update
    try {
        getIO().emit("agentStatusUpdated", {
            agentId: agent.agentId,
            name: agent.name,
            oldStatus: agent.status,
            status: "Offline",
            timestamp: new Date().toISOString()
        });
    } catch (socketErr) {
        console.error("[ForceLogout] Socket emit error (status):", socketErr);
    }

    console.log(`[ForceLogout] Agent ${agentId} has been force-logged out`);
};
