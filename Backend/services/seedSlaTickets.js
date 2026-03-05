require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const Ticket = require("../models/Tickets");
const Agent = require("../models/Agent");

const MONGO_URI = process.env.MONGO_URI;
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);


const seedSlaTickets = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGO_URI);
        console.log("Connected successfully.");

        // Fetch an agent to assign the dummy tickets to
        const agent = await Agent.findOne({});
        if (!agent) {
            console.error("No Agent found in the database. Please create an Agent first.");
            process.exit(1);
        }

        console.log(`Seeding SLA breached tickets for Agent: ${agent.name} (${agent.agentId})`);

        // Generate 5 dummy resolved tickets that breached their SLA
        const dummyTickets = [];
        const now = new Date();

        for (let i = 1; i <= 5; i++) {
            // Set issue date to 4 days ago
            const issueDate = new Date(now.getTime() - (4 * 24 * 60 * 60 * 1000));
            // Set SLA deadline strictly 24 hours after issueDate
            const slaDeadline = new Date(issueDate.getTime() + (24 * 60 * 60 * 1000));
            // Set resolved date to today (well past 24 hrs SLA)
            const resolvedDate = new Date(now.getTime() - (i * 60 * 60 * 1000)); // Stagger identical resolutions slightly

            dummyTickets.push({
                issueId: `SLA-SEED-${Math.floor(1000 + Math.random() * 9000)}-${i}`,
                code: `ERR-${Math.floor(100 + Math.random() * 900)}`,
                description: `This is an auto-generated dummy ticket. Issue simulation ${i}.`,
                callDuration: Math.floor(Math.random() * 60) + 15,
                agent: agent._id,
                agentId: agent.agentId,
                issueDate: issueDate,
                approvalDate: new Date(issueDate.getTime() + (2 * 60 * 60 * 1000)), // Approved 2 hrs later
                resolvedDate: resolvedDate, // Resolved 4 days later
                remarks: "Simulated resolution taking exceptionally long. Breached.",
                status: "resolved",
                slaBreached: true,
                slaDeadline: slaDeadline
            });
        }

        console.log("Inserting tickets...");
        await Ticket.insertMany(dummyTickets);

        console.log(`Successfully seeded ${dummyTickets.length} breached tickets.`);

        // Update the Agent's resolved counts to match the generated data
        await Agent.findByIdAndUpdate(agent._id, {
            $inc: { totalResolved: dummyTickets.length }
        });

        console.log(`Agent ${agent.agentId} totalResolved updated.`);

        process.exit(0);

    } catch (error) {
        console.error("Seeding error:", error);
        process.exit(1);
    }
};

seedSlaTickets();
