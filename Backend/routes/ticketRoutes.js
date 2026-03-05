const express = require("express");
const router = express.Router();
const ticketController = require("../controllers/ticketController");
const idempotencyMiddleware = require("../middleware/idempotencyMiddleware");

router.post("/create", ticketController.createTicket);
router.get("/get", ticketController.getTicketById);
router.put("/update", idempotencyMiddleware, ticketController.updateTicket);
router.get("/get-by-status", ticketController.getTicketsByStatus);
router.get("/get-by-agentId", ticketController.getTicketsByAgentId);
router.get("/get-all", ticketController.getAllTickets);
router.get("/get-paginated-history", ticketController.getPaginatedHistory)
router.get("/get-filtered", ticketController.getFilteredTickets)

module.exports = router;