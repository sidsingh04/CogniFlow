const {
    ReceiveMessageCommand,
    DeleteMessageCommand
} = require("@aws-sdk/client-sqs");

const sqs = require("../config/sqs");
const { processMessage } = require("../controllers/sqsController");
const { getIO } = require("../socket");

async function pollSLAQueue() {
    try {
        const response = await sqs.send(
            new ReceiveMessageCommand({
                QueueUrl: process.env.SLS_QUEUE_URL,
                MaxNumberOfMessages: 5,
                WaitTimeSeconds: 20
            })
        );

        if (!response.Messages) return;

        for (const message of response.Messages) {
            const body = JSON.parse(message.Body);
            try {
                const result = await processMessage(body);

                // Emit socket events if processing returned data
                if (result) {
                    const io = getIO();

                    if (result.eventType === "SLA_CHECK") {
                        io.emit("slaBreach", {
                            agentId: result.agentId,
                            issueId: result.issueId
                        });
                        console.log(`[SLA Worker] Emitted slaBreach for ${result.issueId}`);
                    } else if (result.eventType === "SLA_WARNING") {
                        io.emit("slaWarning", {
                            agentId: result.agentId,
                            issueId: result.issueId,
                            hoursRemaining: 2
                        });
                        console.log(`[SLA Worker] Emitted slaWarning for ${result.issueId}`);
                    }
                }

                // Delete processed message
                await sqs.send(
                    new DeleteMessageCommand({
                        QueueUrl: process.env.SLS_QUEUE_URL,
                        ReceiptHandle: message.ReceiptHandle
                    })
                );
            } catch (err) {
                console.error("[SLA Worker] Processing failed:", err.message);
            }
        }
    } catch (err) {
        console.error("[SLA Worker] Poll error:", err.message);
    }
}

function startSLAWorker() {
    console.log("[SLA Worker] Started polling ticket-sla-queue...");

    async function loop() {
        while (true) {
            await pollSLAQueue();
        }
    }

    loop().catch(err => {
        console.error("[SLA Worker] Fatal error:", err);
    });
}

module.exports = { startSLAWorker };
