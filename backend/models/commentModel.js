const mongoose = require("mongoose");

const replySchema = new mongoose.Schema(
  {
    userId:      { type: String, required: true },
    userName:    { type: String, required: true },
    userPicture: { type: String, default: "" },
    text:        { type: String, required: true, maxlength: 1000, trim: true },
    edited:      { type: Boolean, default: false },
  },
  { timestamps: true }
);

const commentSchema = new mongoose.Schema(
  {
    comicId:     { type: mongoose.Schema.Types.ObjectId, ref: "Comic", required: true, index: true },
    userId:      { type: String, required: true },
    userName:    { type: String, required: true },
    userPicture: { type: String, default: "" },
    userEmail:   { type: String, default: "" },
    text:        { type: String, required: true, maxlength: 2000, trim: true },
    replies:     [replySchema],
    hidden:      { type: Boolean, default: false },  // hidden by comic owner
    edited:      { type: Boolean, default: false },  // edited by author
  },
  { timestamps: true }
);

commentSchema.index({ comicId: 1, createdAt: -1 });
commentSchema.index({ userId: 1, createdAt: -1 });
module.exports = mongoose.model("Comment", commentSchema);
