const mongoose = require("mongoose");

// Tracks how many comment-management actions a comic owner has used
// in the current 24-hour window.
const commentAllowanceSchema = new mongoose.Schema({
  comicId:         { type: mongoose.Schema.Types.ObjectId, ref: "Comic", required: true },
  ownerId:         { type: String, required: true },   // Auth0 sub of uploader
  actionsUsedToday:{ type: Number, default: 0 },
  windowStart:     { type: Date,   default: Date.now },
});

commentAllowanceSchema.index({ comicId: 1, ownerId: 1 }, { unique: true });
module.exports = mongoose.model("CommentAllowance", commentAllowanceSchema);
