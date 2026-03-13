// API's related to Tickets
const mongoose = require("mongoose");
const Ticket = require("../models/Tickets");
const Agent = require("../models/Agent");
const IdempotencyKey = require("../models/IdempotencyKey");
const { getIO } = require("../socket");
const { scheduleSLACheck, scheduleSLAWarning, cancelSLASchedules } = require("./sqsController");

async function createTicket(req, res) {
    try {
        const { issueId, code, title, description, agentId, status, issueDate } = req.body;

        // Find the agent to get their ObjectId
        const agent = await Agent.findOne({ agentId });
        if (!agent) {
            return res.status(404).json({ success: false, message: "Agent not found" });
        }

        const ticket = new Ticket({
            issueId,
            code,
            title,
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

            // If moving from pending to approval, track it in the new history array
            if (previousStatus === 'pending' && updateFields.status === 'approval') {
                updateObj.$push = updateObj.$push || {};
                updateObj.$push.approvalHistory = {
                    date: new Date(updateFields.approvalDate || Date.now()),
                    callDuration: updateFields.callDuration || 0,
                    remarks: updateFields.remarks || ''
                };

                // Accumulate the callDuration instead of overwriting it
                if (updateFields.callDuration !== undefined) {
                    delete updateObj.$set.callDuration;
                    const parsedDuration = Number(updateFields.callDuration);
                    updateObj.$inc = { callDuration: isNaN(parsedDuration) ? 0 : parsedDuration };
                }
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
                        totalPending: Number(stats.totalPending) || 0,
                        pendingApprovals: Number(stats.pendingApprovals) || 0,
                        totalResolved: Number(stats.totalResolved) || 0,
                        successfulCalls: Number(stats.successfulCalls) || 0,
                        failedCalls: Number(stats.failedCalls) || 0,
                        totalCallDuration: Number(stats.totalCallDuration) || 0,
                        status: (Number(stats.totalPending) || 0) > 0 ? "Busy" : "Available"
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

async function getAuditTrail(req, res) {
    try {
        const { issueId } = req.params;

        if (!issueId) {
            return res.status(400).json({ success: false, message: "issueId parameter is required" });
        }

        const ticket = await Ticket.findOne({ issueId });
        if (!ticket) {
            return res.status(404).json({ success: false, message: "Ticket not found" });
        }

        // We need to fetch attachments for this ticket.
        const Attachment = require("../models/Attachment");
        const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
        const { GetObjectCommand } = require("@aws-sdk/client-s3");
        const { s3 } = require("../config/s3");

        const attachments = await Attachment.find({ ticket: ticket._id }).sort({ createdAt: 1 });

        // Let's build the timeline events
        let events = [];

        // 1. Creation event
        events.push({
            type: 'CREATED',
            timestamp: new Date(ticket.issueDate),
            message: `Ticket created and assigned to agent ${ticket.agentId}`,
            agentId: ticket.agentId
        });

        // 2. Approval Requests (from approvalHistory array or fallback to approvalDate)
        const approvalHistoryList = ticket.approvalHistory && ticket.approvalHistory.length > 0
            ? ticket.approvalHistory
            : (ticket.approvalDate ? [ticket.approvalDate] : []);

        approvalHistoryList.forEach(approval => {
            const isObj = typeof approval === 'object' && approval.date !== undefined;
            const date = isObj ? approval.date : approval;

            events.push({
                type: 'APPROVAL_REQUEST',
                timestamp: new Date(date),
                message: 'Sent for supervisor approval',
                remarks: isObj && approval.remarks ? approval.remarks : ticket.remarks,
                callDuration: isObj && approval.callDuration !== undefined ? approval.callDuration : undefined
            });
        });

        // 3. Rejections
        if (ticket.rejectionHistory && ticket.rejectionHistory.length > 0) {
            ticket.rejectionHistory.forEach(date => {
                events.push({
                    type: 'REJECTED',
                    timestamp: new Date(date),
                    message: 'Approval rejected by supervisor'
                });
            });
        }

        // 4. Resolution
        if (ticket.status === 'resolved' && ticket.resolvedDate) {

            // Dynamically calculate the total duration from the approval history to be perfectly flawless
            let computedTotalDuration = 0;
            if (ticket.approvalHistory && ticket.approvalHistory.length > 0) {
                ticket.approvalHistory.forEach(approval => {
                    if (typeof approval === 'object' && typeof approval.callDuration === 'number') {
                        computedTotalDuration += approval.callDuration;
                    }
                });
            }

            // Fallback to the root ticket field for older tickets
            const finalDuration = computedTotalDuration > 0 ? computedTotalDuration : (ticket.callDuration || 0);

            events.push({
                type: 'RESOLVED',
                timestamp: new Date(ticket.resolvedDate),
                message: 'Ticket approved and marked as resolved',
                callDuration: finalDuration
            });
        }

        // Now process attachments and interleave them as distinct events OR attach them to the nearest approval request
        // Let's add them as distinct attachment events for precision
        for (const att of attachments) {
            try {
                const command = new GetObjectCommand({
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: att.fileKey
                });
                const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

                events.push({
                    type: 'ATTACHMENT',
                    timestamp: new Date(att.createdAt),
                    message: `Agent uploaded an ${att.fileType.startsWith('image') ? 'image' : 'audio'} attachment`,
                    mediaUrl: url,
                    fileType: att.fileType
                });
            } catch (err) {
                console.error(`Failed to generate signed url for attachment ${att._id}`, err);
            }
        }

        // Sort all events chronologically (oldest first)
        events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        return res.json({
            success: true,
            ticketId: ticket.issueId,
            events
        });

    } catch (error) {
        console.error("Error generating audit trail:", error);
        return res.status(500).json({ success: false, message: "Internal server error generating audit trail" });
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
    getFilteredTickets,
    getAuditTrail
};