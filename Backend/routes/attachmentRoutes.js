const express = require("express");

const { upload } =
  require("../middleware/upload");

const {
  uploadFile,
  getFile,
  deleteFile,
  getFileByTicketId
} = require("../controllers/s3Controller");

const idempotencyMiddleware = require("../middleware/idempotencyMiddleware");

const router = express.Router();

router.post(
  "/upload",
  upload.single("file"),
  idempotencyMiddleware,
  uploadFile
);

router.get("/:id", getFile);

router.get("/ticket/:ticketId", getFileByTicketId);

router.delete("/:id", deleteFile);

module.exports = router;