const mongoose = require("mongoose");

const collabMessageSchema = new mongoose.Schema(
  {
    chatId:     { type: mongoose.Schema.Types.ObjectId, ref: "CollabChat", required: true },
    senderEmail:{ type: String, required: true }, // "system" for system messages
    senderName: { type: String, default: "" },
    senderPic:  { type: String, default: "" },
    type:       { type: String, enum: ["text", "image", "system"], default: "text" },
    content:    { type: String, required: true },
    readBy:     [{ type: String }], // array of emails that have read this message
  },
  { timestamps: true }
);

collabMessageSchema.index({ chatId: 1, createdAt: 1 });

module.exports = mongoose.model("CollabMessage", collabMessageSchema);
