const express = require("express");
const router = express.Router();
const { /* createKnowledgeBase, */ searchKnowledgeBase, feedbackKnowledgeBase, getKnowledgeBase, getKnowledgeBaseById, updateKnowledgeBase, deleteKnowledgeBase, submitClosingReview } = require("../controllers/knowledgeController.js");
const { authenticateJwt } = require("../middleware/authMiddleware");

const idempotencyMiddleware = require("../middleware/idempotencyMiddleware");

// router.post("/create-kb", createKnowledgeBase);
router.post("/search-kb", searchKnowledgeBase);
router.post("/submit-review", authenticateJwt, idempotencyMiddleware, submitClosingReview);
router.put("/feedback-kb/:id", feedbackKnowledgeBase);
router.get("/get-kb", getKnowledgeBase);
router.get("/get-kb/:id", getKnowledgeBaseById);
router.put("/update-kb/:id", updateKnowledgeBase);
router.delete("/delete-kb/:id", deleteKnowledgeBase);

module.exports = router;