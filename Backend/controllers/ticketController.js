// API's related to Tickets
const mongoose = require("mongoose");
const Ticket = require("../models/Tickets");
const Agent = require("../models/Agent");
const IdempotencyKey = require("../models/IdempotencyKey");
const { getIO } = require("../socket");
const { scheduleSLACheck, scheduleSLAWarning, cancelSLASchedules } = require("./sqsController");

async function createTicket(req, res) {
    try {
        const { issueId, code, description, agentId, status, issueDate } = req.body;

        // Find the agent to get their ObjectId
        const agent = await Agent.findOne({ agentId });
        if (!agent) {
            return res.status(404).json({ success: false, message: "Agent not found" });
        }

        const ticket = new Ticket({
            issueId,
            code,
            description,
            agentId,
            agent: agent._id,
            slaBreached: false,
            slaDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
            status: status || 'pending',
            issueDate: issueDate || new Date(),
            remarks: req.body.remarks || "Initial ticket creation"
        });

        await ticket.save();

        // Schedule SLA check and warning via EventBridge
        scheduleSLACheck(ticket._id, ticket.slaDeadline);
        scheduleSLAWarning(ticket._id, ticket.slaDeadline);

        // Update agent status to 'Busy' if they aren't 'Offline', and increment totalPending
        agent.totalPending += 1;
        if (agent.status !== 'Offline') {
            agent.status = 'Busy';
        }
        await agent.save();

        try {
            getIO().emit("ticketAssigned", {
                ticket: ticket,
                agentId: agent.agentId,
                timestamp: new Date().toISOString()
            });
        } catch (socketErr) {
            console.error("Socket emit error:", socketErr);
        }

        return res.json({ success: true, message: "Ticket created successfully" });
    } catch (error) {
        console.error("Error creating ticket:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

async function getTicketById(req, res) {
    try {
        const { issueId } = req.query;
        const ticket = await Ticket.findOne({ issueId });
        if (!ticket) {
            return res.status(404).json({ success: false, message: "Ticket not found" });
        }
        return res.json({ success: true, ticket });
    } catch (error) {
        console.error("Error getting ticket:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}



async function updateTicket(req, res) {

    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {

        const session = await mongoose.startSession();

        try {

            session.startTransaction();

            const { issueId, rejectedDate, ...updateFields } =
                req.body;

            const existingTicket =
                await Ticket.findOne({ issueId })
                    .session(session);

            if (!existingTicket)
                throw new Error("Ticket not found");

            const previousStatus =
                existingTicket.status;

            // Prepare update object containing $set
            const updateObj = { $set: updateFields };

            // If the fronted sent a rejection date, push it into the array
            if (rejectedDate) {
                updateObj.$push = { rejectionHistory: new Date(rejectedDate) };
            }

            const ticket =
                await Ticket.findOneAndUpdate(
                    {
                        issueId,
                        status: previousStatus
                    },
                    updateObj,
                    {
                        new: true,
                        session
                    }
                );

            if (!ticket) {
                await session.abortTransaction();
                session.endSession();

                return res.json({
                    success: true,
                    message:
                        "Already processed"
                });
            }

            /* ===== Aggregation Pipeline (Absolute Truth) ===== */
            const aggregateStats = await Ticket.aggregate([
                { $match: { agentId: ticket.agentId } },
                {
                    $group: {
                        _id: null,
                        totalPending: {
                            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
                        },
                        pendingApprovals: {
                            $sum: { $cond: [{ $eq: ["$status", "approval"] }, 1, 0] }
                        },
                        totalResolved: {
                            $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] }
                        },
                        successfulCalls: {
                            $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] }
                        },
                        failedCalls: {
                            $sum: { $size: { $ifNull: ["$rejectionHistory", []] } }
                        },
                        totalCallDuration: {
                            $sum: "$callDuration"
                        }
                    }
                }
            ]).session(session);

            const stats = aggregateStats[0] || {
                totalPending: 0,
                pendingApprovals: 0,
                totalResolved: 0,
                successfulCalls: 0,
                failedCalls: 0,
                totalCallDuration: 0
            };

            await Agent.findOneAndUpdate(
                { agentId: ticket.agentId },
                {
                    $set: {
                        totalPending: stats.totalPending,
                        pendingApprovals: stats.pendingApprovals,
                        totalResolved: stats.totalResolved,
                        successfulCalls: stats.successfulCalls,
                        failedCalls: stats.failedCalls,
                        totalCallDuration: stats.totalCallDuration,
                        status: stats.totalPending > 0 ? "Busy" : "Available"
                    }
                },
                { session }
            );

            await session.commitTransaction();
            session.endSession();

            const io = getIO();

            if (io) {
                const payload = {
                    ticket: ticket.toObject(),
                    agentId: ticket.agentId,
                    timestamp: new Date().toISOString()
                };

                if (previousStatus === 'pending' && ticket.status === 'approval') {
                    io.emit("ticketApprovalSent", payload);
                } else if (previousStatus === 'approval' && ticket.status === 'resolved') {
                    io.emit("ticketResolved", payload);
                    // Cancel pending SLA schedules since ticket is resolved
                    cancelSLASchedules(ticket._id);
                } else if (previousStatus === 'approval' && ticket.status === 'pending') {
                    io.emit("ticketRejected", payload);
                } else {
                    io.emit("ticketUpdated", payload);
                }
            }

            const response = {
                success: true,
                message:
                    "Ticket updated successfully"
            };

            if (req.idempotencyKey) {
                await IdempotencyKey.create({
                    key: req.idempotencyKey,
                    response
                });
            }

            return res.json(response);

        } catch (err) {

            await session.abortTransaction();
            session.endSession();

            if (
                err.errorLabelSet?.has(
                    "TransientTransactionError"
                ) &&
                attempt < MAX_RETRIES - 1
            ) {
                continue;
            }

            console.error(err);

            return res.status(500).json({
                success: false
            });
        }
    }
}

async function getTicketsByStatus(req, res) {
    try {
        const { status } = req.query;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: "Status query parameter is required"
            });
        }

        const tickets = await Ticket.find({ status });

        return res.json({
            success: true,
            tickets
        });

    } catch (error) {
        console.error("Error getting tickets:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}

async function getTicketsByAgentId(req, res) {
    try {
        const { agentId } = req.query;

        if (!agentId) {
            return res.status(400).json({
                success: false,
                message: "agentId query parameter is required"
            });
        }

        const tickets = await Ticket.find({ agentId });

        return res.json({
            success: true,
            tickets
        });

    } catch (error) {
        console.error("Error getting tickets:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}

async function getAllTickets(req, res) {
    try {
        const tickets = await Ticket.find();
        return res.json({
            success: true,
            tickets
        });
    } catch (error) {
        console.error("Error getting tickets:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}

async function getPaginatedHistory(req, res) {
    try {
        const agentId = req.query.agentId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const search = req.query.search || "";

        if (!agentId) {
            return res.status(400).json({
                success: false,
                message: "agentId query parameter is required"
            });
        }

        const skip = (page - 1) * limit;

        let query = { agentId };
        if (search) {
            query.$or = [
                { issueId: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } },
                { status: { $regex: search, $options: 'i' } }
            ];
        }

        // Fetch tickets, sorted by issueDate (newest first)
        const tickets = await Ticket.find(query)
            .sort({ issueDate: -1 })
            .skip(skip)
            .limit(limit);

        // Get total count for this agent to calculate total pages
        const totalTickets = await Ticket.countDocuments(query);
        const totalPages = Math.ceil(totalTickets / limit);

        return res.json({
            success: true,
            tickets,
            pagination: {
                total: totalTickets,
                page,
                totalPages,
                limit
            }
        });
    } catch (error) {
        console.error("Error getting paginated tickets:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}

async function getFilteredTickets(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const { agentId, code, status, issueDate, resolvedDate, sortField, sortOrder } = req.query;

        // Build query dynamically
        const query = {};

        if (agentId && agentId.trim()) {
            query.agentId = { $regex: agentId.trim(), $options: 'i' };
        }

        if (code && code.trim()) {
            query.code = { $regex: code.trim(), $options: 'i' };
        }

        if (status && status !== 'All') {
            query.status = status.toLowerCase();
        }

        if (issueDate) {
            const start = new Date(issueDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(issueDate);
            end.setHours(23, 59, 59, 999);
            query.issueDate = { $gte: start, $lte: end };
        }

        if (resolvedDate) {
            const start = new Date(resolvedDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(resolvedDate);
            end.setHours(23, 59, 59, 999);
            query.resolvedDate = { $gte: start, $lte: end };
        }

        // Build sort object
        const validSortFields = ['issueDate', 'approvalDate', 'resolvedDate'];
        const field = validSortFields.includes(sortField) ? sortField : 'issueDate';
        const order = sortOrder === 'asc' ? 1 : -1;

        const [tickets, total] = await Promise.all([
            Ticket.find(query)
                .sort({ [field]: order })
                .skip(skip)
                .limit(limit),
            Ticket.countDocuments(query)
        ]);

        return res.json({
            success: true,
            tickets,
            pagination: {
                total,
                page,
                totalPages: Math.ceil(total / limit),
                limit
            }
        });
    } catch (error) {
        console.error("Error getting filtered tickets:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

module.exports = {
    createTicket,
    getTicketById,
    updateTicket,
    getTicketsByStatus,
    getTicketsByAgentId,
    getAllTickets,
    getPaginatedHistory,
    getFilteredTickets
};