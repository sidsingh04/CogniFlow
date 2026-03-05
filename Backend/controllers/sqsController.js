const { SendMessageCommand } = require("@aws-sdk/client-sqs");

const sqs = require("../config/sqs");

const Ticket = require("../models/Ticket");
const Agent = require("../models/Agent");


exports.sendSLACheckJob = async (ticketId) => {

    try {

        const command = new SendMessageCommand({
            QueueUrl: process.env.SQS_QUEUE_URL,

            MessageBody: JSON.stringify({
                eventType: "SLA_CHECK",
                ticketId: ticketId
            }),

            // 24 hours delay
            DelaySeconds: 86400
        });

        await sqs.send(command);

        console.log(`SLA job scheduled for ticket ${ticketId}`);

    } catch (error) {
        console.error("Failed to send SQS message", error);
    }
};


exports.processMessage = async (message) => {

    const { eventType, ticketId } = message;

    switch (eventType) {

        case "SLA_CHECK":
            await handleSLABreach(ticketId);
            break;

        default:
            console.log("Unknown event type");
    }
};


async function handleSLABreach(ticketId) {

    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
        console.log("Ticket not found");
        return;
    }

    // already resolved
    if (ticket.status === "RESOLVED") {
        console.log("Ticket already resolved");
        return;
    }


    if (ticket.slaBreached) {
        console.log("SLA already processed");
        return;
    }

    // mark breach
    ticket.slaBreached = true;
    await ticket.save();

    // increment agent SLA breach counter
    await Agent.updateOne(
        { _id: ticket.agentId },
        { $inc: { slaBreaches: 1 } }
    );


    console.log(`SLA BREACHED for ticket ${ticketId}`);
}