// Main Server File
const express = require("express");
const path = require("path");
const http = require("http");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const passport = require("passport");
const { authenticateJwt } = require("./middleware/authMiddleware");

dotenv.config();

// Initialize passport strategy
require("./config/passport")(passport);

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const app = express();
const PORT = 3000;


const server = http.createServer(app);

// Initialize Socket.io
const { initSocket } = require("./socket");
initSocket(server);

app.use(express.json());
app.use(cors({
  exposedHeaders: ['x-idempotency-key'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-idempotency-key']
}));
app.use(passport.initialize());

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
})
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => {
    console.error("MongoDB Connection Error:", err.message);
    // process.exit(1);
  });


const authRoutes = require("./routes/authRoutes.js");
app.use("/api/login", authRoutes);

const agentRoutes = require("./routes/agentRoutes.js");
app.use("/api/agent", authenticateJwt, agentRoutes);

const ticketRoutes = require("./routes/ticketRoutes.js");
app.use("/api/ticket", authenticateJwt, ticketRoutes);

const analyticsRoutes = require("./routes/analyticsRoutes.js");
app.use("/api/analytics", authenticateJwt, analyticsRoutes);

const attachmentRoutes = require("./routes/attachmentRoutes");
app.use("/api/attachments", authenticateJwt, attachmentRoutes);

const slaRoutes = require("./routes/slaRoutes");
app.use("/api/sla", authenticateJwt, slaRoutes);

const forceLogoutRoutes = require("./routes/forceLogoutRoutes");
app.use("/api/agent", authenticateJwt, forceLogoutRoutes);


server.listen(PORT, () => {
  console.log(`HTTP server running at http://localhost:${PORT}`);

  // Start the force-logout SQS worker in-process
  const { startForceLogoutWorker } = require("./worker/forceLogoutWorker");
  startForceLogoutWorker();
});
