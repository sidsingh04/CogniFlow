const cron = require("node-cron");
const Tag = require("../models/Tags");

function startTagCleanupCron() {
    // Schedule a weekly job (Sunday at midnight)
    console.log("[Tag Cleanup Worker] Initializing weekly cron job to run at 00:00 every Sunday.");

    cron.schedule("0 0 * * 0", async () => {
        try {
            console.log("[Tag Cleanup Worker] Starting weekly tag cleanup task...");

            // Calculate the date for 2 days ago
            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

            // Find and delete pending tags that are at least 2 days old
            // We ensure usageCount is <= 5 because > 5 triggers approval based on comments in Tag.js
            const deleteResult = await Tag.deleteMany({
                status: "pending",
                usageCount: { $lte: 5 },
                createdAt: { $lte: twoDaysAgo }
            });

            console.log(`[Tag Cleanup Worker] Cleanup complete. Deleted ${deleteResult.deletedCount} noisy tags.`);
        } catch (error) {
            console.error("[Tag Cleanup Worker] Error during tag cleanup:", error.message);
        }
    });
}

module.exports = { startTagCleanupCron };
