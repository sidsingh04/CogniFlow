const express = require("express");
const router = express.Router();
const { sendForceLogout } = require("../controllers/forceLogoutController");

router.post("/force-logout", sendForceLogout);

module.exports = router;
