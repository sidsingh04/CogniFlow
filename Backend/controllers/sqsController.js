const { CreateScheduleCommand, DeleteScheduleCommand } = require("@aws-sdk/client-scheduler");
const schedulerClient = require("../config/eventBridgeScheduler");
const Ticket = require("../models/Tickets");
const Agent = require("../models/Agent");

/**
 * Create a one-time EventBridge schedule that sends an SLA_CHECK message
 * to the SQS queue at the exact slaDeadline.
 */
async function scheduleSLACheck(ticketId, slaDeadline) {
    try {
        const scheduleTime = new Date(slaDeadline);
        // EventBridge expects: at(yyyy-MM-ddTHH:mm:ss)
        const expression = `at(${scheduleTime.toISOString().replace(/\.\d{3}Z$/, '')})`;

        const command = new CreateScheduleCommand({
            Name: `sla-check-${ticketId}`,
            ScheduleExpression: expression,
            ScheduleExpressionTimezone: "UTC",
            FlexibleTimeWindow: { Mode: "OFF" },
            ActionAfterCompletion: "DELETE",
            Target: {
                Arn: process.env.SLS_QUEUE_ARN,
                RoleArn: process.env.SCHEDULER_ROLE_ARN,
                Input: JSON.stringify({
                    eventType: "SLA_CHECK",
                    ticketId: ticketId.toString()
                })
            }
        });

        await schedulerClient.send(command);
        console.log(`[SLA] Breach check scheduled for ticket ${ticketId} at ${scheduleTime.toISOString()}`);
    } catch (error) {
        console.error(`[SLA] Failed to schedule breach check for ticket ${ticketId}:`, error.message);
    }
}

/**
 * Create a one-time EventBridge schedule that sends an SLA_WARNING message
 * to the SQS queue 2 hours before the slaDeadline.
 */
async function scheduleSLAWarning(ticketId, slaDeadline) {
    try {
        const warningTime = new Date(new Date(slaDeadline).getTime() - 2 * 60 * 60 * 1000);

        // If warning time is already in the past, skip
        if (warningTime <= new Date()) {
            console.log(`[SLA] Warning time already passed for ticket ${ticketId}, skipping warning schedule`);
            return;
        }

        const expression = `at(${warningTime.toISOString().replace(/\.\d{3}Z$/, '')})`;

        const command = new CreateScheduleCommand({
            Name: `sla-warning-${ticketId}`,
            ScheduleExpression: expression,
            ScheduleExpressionTimezone: "UTC",
            FlexibleTimeWindow: { Mode: "OFF" },
            ActionAfterCompletion: "DELETE",
            Target: {
                Arn: process.env.SLS_QUEUE_ARN,
                RoleArn: process.env.SCHEDULER_ROLE_ARN,
                Input: JSON.stringify({
                    eventType: "SLA_WARNING",
                    ticketId: ticketId.toString()
                })
            }
        });

        await schedulerClient.send(command);
        console.log(`[SLA] Warning scheduled for ticket ${ticketId} at ${warningTime.toISOString()}`);
    } catch (error) {
        console.error(`[SLA] Failed to schedule warning for ticket ${ticketId}:`, error.message);
    }
}

/**
 * Cancel both SLA schedules when a ticket is resolved before the deadline.
 * Silently ignores ResourceNotFoundException (schedule already fired/deleted).
 */
async function cancelSLASchedules(ticketId) {
    const names = [`sla-check-${ticketId}`, `sla-warning-${ticketId}`];

    for (const name of names) {
        try {
            await schedulerClient.send(new DeleteScheduleCommand({ Name: name }));
            console.log(`[SLA] Cancelled schedule: ${name}`);
        } catch (error) {
            if (error.name === "ResourceNotFoundException") {
                console.log(`[SLA] Schedule ${name} already fired or not found, skipping`);
            } else {
                console.error(`[SLA] Failed to cancel schedule ${name}:`, error.message);
            }
        }
    }
}

/**
 * Process an SQS message from the SLA queue.
 * Returns { eventType, ticketId, agentId, issueId } for the worker to emit socket events.
 */
async function processMessage(message) {
    const { eventType, ticketId } = message;

    switch (eventType) {
        case "SLA_CHECK":
            return await handleSLABreach(ticketId);
        case "SLA_WARNING":
            return await handleSLAWarning(ticketId);
        default:
            console.log(`[SLA] Unknown event type: ${eventType}`);
            return null;
    }
}

async function handleSLABreach(ticketId) {
    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
        console.log(`[SLA] Ticket ${ticketId} not found`);
        return null;
    }

    if (ticket.status === "resolved") {
        console.log(`[SLA] Ticket ${ticketId} already resolved, skipping breach`);
        return null;
    }

    if (ticket.slaBreached) {
        console.log(`[SLA] Ticket ${ticketId} already breached, skipping`);
        return null;
    }

    ticket.slaBreached = true;
    await ticket.save();

    console.log(`[SLA] BREACHED: ticket ${ticketId} (${ticket.issueId})`);

    return {
        eventType: "SLA_CHECK",
        agentId: ticket.agentId,
        issueId: ticket.issueId,
        ticketId: ticketId.toString()
    };
}

async function handleSLAWarning(ticketId) {
    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
        console.log(`[SLA] Ticket ${ticketId} not found`);
        return null;
    }

    if (ticket.status === "resolved") {
        console.log(`[SLA] Ticket ${ticketId} already resolved, skipping warning`);
        return null;
    }

    console.log(`[SLA] WARNING: ticket ${ticketId} (${ticket.issueId}) - 2h until breach`);

    return {
        eventType: "SLA_WARNING",
        agentId: ticket.agentId,
        issueId: ticket.issueId,
        ticketId: ticketId.toString()
    };
}

module.exports = {
    scheduleSLACheck,
    scheduleSLAWarning,
    cancelSLASchedules,
    processMessage
};