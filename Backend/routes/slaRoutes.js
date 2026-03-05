const router = require("express").Router();
const sla = require("../controllers/slaAnalyticsControllers");

router.post(
    "/scan-breaches",
    sla.updateSlaBreachedTickets
);

router.get(
    "/dashboard-metrics",
    sla.getSlaDashboardMetrics
);

router.get(
    "/breached-tickets",
    sla.getBreachedTicketsList
);

router.get(
    "/breached-agents",
    sla.getBreachedAgentsList
);

router.get(
    "/total-breached",
    sla.getTotalSlaBreaches
);

router.get(
    "/average-resolution-time",
    sla.getAverageResolutionTime
);

router.get(
    "/average-resolution-time/:agentId",
    sla.getAverageResolutionTimeByAgent
);

router.get(
    "/total-agents-breached",
    sla.getTotalAgentsWithBreaches
);

router.get(
    "/agent/:agentId",
    sla.getAgentSlaAnalytics
);

module.exports = router;