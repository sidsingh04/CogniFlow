const mongoose = require("mongoose");
const dotenv = require("dotenv");

const KnowledgeBase = require("../models/KnowledgeBase");

dotenv.config({ path: __dirname + "/../.env" });

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB connected");

        const collection = mongoose.connection.collection("knowledgebases");

        // Find documents where solution is still a string
        const docs = await collection.find({
            solution: { $type: "string" }
        }).toArray();

        console.log(`Found ${docs.length} documents to migrate`);

        for (const doc of docs) {
            await collection.updateOne(
                { _id: doc._id },
                {
                    $set: {
                        solution: [doc.solution],
                        updatedAt: new Date()
                    }
                }
            );
        }

        console.log("Migration completed successfully");
        process.exit(0);

    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

migrate();