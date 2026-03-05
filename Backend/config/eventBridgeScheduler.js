const { SchedulerClient } = require("@aws-sdk/client-scheduler");

const schedulerClient = new SchedulerClient({
    region: process.env.AWS_REGION
});

module.exports = schedulerClient;
