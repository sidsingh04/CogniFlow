const Ticket = require("../models/Tickets");
const Agent = require("../models/Agent");

async function updateSlaBreachedTickets(req, res) {
  try {
    const query = {
      slaBreached: false,
      $expr: {
        $or: [
          { $and: [{ $eq: ["$resolvedDate", null] }, { $gt: [new Date(), "$slaDeadline"] }] },
          { $gt: ["$resolvedDate", "$slaDeadline"] }
        ]
      }
    };
    await Ticket.updateMany(query, { $set: { slaBreached: true } });
    return res.status(200).json({ success: true, message: "SLA breaches updated successfully" });
  } catch (error) {
    console.error("Error updating SLA breached tickets:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
}

async function getAgentSlaAnalytics(req, res) {
  try {
    const { agentId } = req.params;


    // Calculate analytics using aggregation pipeline
    const analytics = await Ticket.aggregate([
      { $match: { agentId: agentId } },
      {
        $group: {
          _id: "$agentId",
          totalTickets: { $sum: 1 },
          breachedTickets: {
            $sum: { $cond: [{ $eq: ["$slaBreached", true] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          agentId: "$_id",
          totalTickets: 1,
          breachedTickets: 1,
          complianceRate: {
            $cond: [
              { $eq: ["$totalTickets", 0] },
              100,
              {
                $round: [
                  {
                    $multiply: [
                      {
                        $divide: [
                          { $subtract: ["$totalTickets", "$breachedTickets"] },
                          "$totalTickets"
                        ]
                      },
                      100
                    ]
                  },
                  2
                ]
              }
            ]
          }
        }
      }
    ]);

    const result = analytics.length > 0 ? analytics[0] : {
      agentId,
      totalTickets: 0,
      breachedTickets: 0,
      complianceRate: 100
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error calculating SLA analytics:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

async function getTotalSlaBreaches(req, res) {
  try {

    const totalBreached = await Ticket.countDocuments({ slaBreached: true });
    return res.status(200).json({ totalBreachedTickets: totalBreached });

  } catch (error) {
    console.error("Error calculating total SLA breaches:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};



async function getTotalAgentsWithBreaches(req, res) {
  try {

    const agentsWithBreaches = await Ticket.distinct("agentId", { slaBreached: true });
    return res.status(200).json({ totalAgentsWithBreaches: agentsWithBreaches.length });

  } catch (error) {
    console.error("Error calculating total agents with breaches:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

async function getAverageResolutionTime(req, res) {
  try {
    const aggregationResult = await Ticket.aggregate([
      {
        $match: {
          status: "resolved",
          resolvedDate: { $ne: null },
          issueDate: { $ne: null }
        }
      },
      {
        $project: {
          resolutionTimeMs: { $subtract: ["$resolvedDate", "$issueDate"] }
        }
      },
      {
        $group: {
          _id: null,
          averageResolutionTimeMs: { $avg: "$resolutionTimeMs" },
          totalResolvedTickets: { $sum: 1 }
        }
      }
    ]);

    if (aggregationResult.length === 0) {
      return res.status(200).json({
        averageResolutionHours: 0,
        totalResolvedTickets: 0
      });
    }

    const { averageResolutionTimeMs, totalResolvedTickets } = aggregationResult[0];

    // Convert MS to Hours (rounded to 2 decimal places)
    const avgHours = (averageResolutionTimeMs / (1000 * 60 * 60)).toFixed(2);

    return res.status(200).json({
      averageResolutionHours: parseFloat(avgHours),
      totalResolvedTickets
    });

  } catch (error) {
    console.error("Error calculating average resolution time:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
}

async function getAverageResolutionTimeByAgent(req, res) {
  try {
    const { agentId } = req.params;
    const aggregationResult = await Ticket.aggregate([
      {
        $match: {
          agentId: agentId,
          status: "resolved",
          resolvedDate: { $ne: null },
          issueDate: { $ne: null }
        }
      },
      {
        $project: {
          resolutionTimeMs: { $subtract: ["$resolvedDate", "$issueDate"] }
        }
      },
      {
        $group: {
          _id: null,
          averageResolutionTimeMs: { $avg: "$resolutionTimeMs" },
          totalResolvedTickets: { $sum: 1 }
        }
      }
    ]);

    if (aggregationResult.length === 0) {
      return res.status(200).json({
        agentId: agentId,
        averageResolutionHours: 0,
        totalResolvedTickets: 0
      });
    }

    const { averageResolutionTimeMs, totalResolvedTickets } = aggregationResult[0];

    // Convert MS to Hours (rounded to 2 decimal places)
    const avgHours = (averageResolutionTimeMs / (1000 * 60 * 60)).toFixed(2);

    return res.status(200).json({
      agentId: agentId,
      averageResolutionHours: parseFloat(avgHours),
      totalResolvedTickets
    });

  } catch (error) {
    console.error("Error calculating average resolution time by agent:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
}

async function getSlaDashboardMetrics(req, res) {
  try {
    // 1. Total SLA Breaches
    const totalBreaches = await Ticket.countDocuments({ slaBreached: true });

    // 2. Total Agents with Breaches
    const agentsWithBreaches = await Ticket.distinct("agentId", { slaBreached: true });
    const totalAgentsWithBreaches = agentsWithBreaches.length;

    // 3. Percent of Agents with Breaches
    const totalAgents = await Agent.countDocuments();
    let percentOfAgentsWithBreaches = 0;
    if (totalAgents > 0) {
      percentOfAgentsWithBreaches = Number(((totalAgentsWithBreaches / totalAgents) * 100).toFixed(2));
    }

    // 4. Percent of Tickets with Breaches
    const totalTickets = await Ticket.countDocuments();
    let percentOfTicketsWithBreaches = 0;
    if (totalTickets > 0) {
      percentOfTicketsWithBreaches = Number(((totalBreaches / totalTickets) * 100).toFixed(2));
    }

    // 5. Average Ticket Resolution Time (in Hours)
    // Reuse logic from getAverageResolutionTime
    const aggregationResult = await Ticket.aggregate([
      {
        $match: {
          status: "resolved",
          resolvedDate: { $ne: null },
          issueDate: { $ne: null }
        }
      },
      {
        $project: {
          resolutionTimeMs: { $subtract: ["$resolvedDate", "$issueDate"] }
        }
      },
      {
        $group: {
          _id: null,
          averageResolutionTimeMs: { $avg: "$resolutionTimeMs" }
        }
      }
    ]);

    let averageResolutionHours = 0;
    if (aggregationResult.length > 0) {
      const avgMs = aggregationResult[0].averageResolutionTimeMs;
      averageResolutionHours = Number((avgMs / (1000 * 60 * 60)).toFixed(2));
    }

    return res.status(200).json({
      success: true,
      data: {
        totalBreaches,
        totalAgentsWithBreaches,
        percentOfAgentsWithBreaches,
        percentOfTicketsWithBreaches,
        averageResolutionHours
      }
    });

  } catch (error) {
    console.error("Error calculating SLA dashboard metrics:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
}

async function getBreachedTicketsList(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [breachedTickets, totalItems] = await Promise.all([
      Ticket.find({ slaBreached: true })
        .select({
          _id: 0,
          issueId: 1,
          code: 1,
          agentId: 1,
          issueDate: 1,
          slaDeadline: 1,
          status: 1
        })
        .sort({ slaDeadline: -1 })
        .skip(skip)
        .limit(limit),
      Ticket.countDocuments({ slaBreached: true })
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return res.status(200).json({
      success: true,
      data: breachedTickets,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error("Error fetching breached tickets list:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
}

async function getBreachedAgentsList(req, res) {
  try {
    const agentsAggregation = await Ticket.aggregate([
      // 1. Only look at breached tickets
      { $match: { slaBreached: true } },

      // 2. Group by agent
      {
        $group: {
          _id: "$agentId",
          incidentsCount: { $sum: 1 },

          // To calculate averge resolution time of breached tickets (only if they are resolved)
          // we store the timestamps to process in the next step
          resolvedTicketsTimes: {
            $push: {
              $cond: [
                { $and: [{ $eq: ["$status", "resolved"] }, { $ne: ["$resolvedDate", null] }] },
                { $subtract: ["$resolvedDate", "$issueDate"] },
                null
              ]
            }
          }
        }
      },

      // 3. Project and transform
      {
        $project: {
          _id: 0,
          agentId: "$_id",
          incidentsCount: 1,

          // Filter out nulls (unresolved tickets)
          validTimes: {
            $filter: {
              input: "$resolvedTicketsTimes",
              as: "time",
              cond: { $ne: ["$$time", null] }
            }
          }
        }
      },

      // 4. Calculate Final average resolution time in hours
      {
        $project: {
          agentId: 1,
          incidentsCount: 1,
          averageResolutionHours: {
            $cond: [
              { $gt: [{ $size: "$validTimes" }, 0] },
              { $round: [{ $divide: [{ $avg: "$validTimes" }, 3600000] }, 2] }, // 3600000 ms in an hour
              0
            ]
          }
        }
      },
      { $sort: { incidentsCount: -1 } } // Sort by highest offenders first
    ]);

    return res.status(200).json({
      success: true,
      data: agentsAggregation
    });

  } catch (error) {
    console.error("Error fetching breached agents list:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
}

module.exports = {
  updateSlaBreachedTickets,
  getAgentSlaAnalytics,
  getTotalSlaBreaches,
  getTotalAgentsWithBreaches,
  getAverageResolutionTime,
  getAverageResolutionTimeByAgent,
  getSlaDashboardMetrics,
  getBreachedTicketsList,
  getBreachedAgentsList
};
