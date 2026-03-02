const express = require("express");

const { upload } =
  require("../middleware/upload");

const {
  uploadFile,
  getFile,
  deleteFile,
  getFileByTicketId
} = require("../controllers/s3Controller");

const router = express.Router();

router.post(
  "/upload",
  upload.single("file"),
  uploadFile
);

router.get("/:id", getFile);

router.get("/ticket/:ticketId", getFileByTicketId);

router.delete("/:id", deleteFile);

module.exports = router;