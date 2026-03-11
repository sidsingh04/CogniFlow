const express = require("express");
const router = express.Router();
const { createKnowledgeBase, searchKnowledgeBase, feedbackKnowledgeBase, getKnowledgeBase, getKnowledgeBaseById, updateKnowledgeBase, deleteKnowledgeBase } = require("../controllers/knowledgeController.js");

router.post("/create-kb", createKnowledgeBase);
router.post("/search-kb", searchKnowledgeBase);
router.put("/feedback-kb/:id", feedbackKnowledgeBase);
router.get("/get-kb", getKnowledgeBase);
router.get("/get-kb/:id", getKnowledgeBaseById);
router.put("/update-kb/:id", updateKnowledgeBase);
router.delete("/delete-kb/:id", deleteKnowledgeBase);

module.exports = router;