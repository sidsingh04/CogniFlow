const mongoose=require("mongoose");

const attachmentSchema = new mongoose.Schema({
  fileKey: String,
  fileType: String,

  ticket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ticket"
  },

  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Agent"
  }
}, { timestamps: true });

module.exports = mongoose.model(
  "Attachment",
  attachmentSchema
);