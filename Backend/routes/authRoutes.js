const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController.js");

router.post("/agent", authController.agentLogin);
router.post("/supervisor", authController.supervisorLogin);
router.post("/refresh", authController.refreshAccessToken);
router.post("/logout", authController.logout);

module.exports = router;