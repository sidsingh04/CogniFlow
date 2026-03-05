const {
    ReceiveMessageCommand,
    DeleteMessageCommand
} = require("@aws-sdk/client-sqs");

const sqs = require("../config/sqs");
const { processForceLogout } = require("../controllers/forceLogoutController");


async function pollForceLogoutQueue() {
    try {
        const response = await sqs.send(
            new ReceiveMessageCommand({
                QueueUrl: process.env.FORCE_LOGOUT_QUEUE_URL,
                MaxNumberOfMessages: 1,
                WaitTimeSeconds: 20
            })
        );

        if (!response.Messages) return;

        for (const message of response.Messages) {
            const body = JSON.parse(message.Body);

            try {
                await processForceLogout(body);

                await sqs.send(
                    new DeleteMessageCommand({
                        QueueUrl: process.env.FORCE_LOGOUT_QUEUE_URL,
                        ReceiptHandle: message.ReceiptHandle
                    })
                );
            } catch (err) {
                console.error("[ForceLogoutWorker] Processing failed:", err);
            }
        }
    } catch (err) {
        console.error("[ForceLogoutWorker] Poll error:", err);
    }
}


function startForceLogoutWorker() {
    console.log("[ForceLogoutWorker] Started polling force-logout queue");

    (async () => {
        while (true) {
            await pollForceLogoutQueue();
        }
    })();
}

module.exports = { startForceLogoutWorker };
