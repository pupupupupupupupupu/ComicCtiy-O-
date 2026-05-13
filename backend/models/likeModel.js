const mongoose = require("mongoose");

const likeSchema = new mongoose.Schema(
  {
    userId:  { type: String, required: true },
    comicId: { type: mongoose.Schema.Types.ObjectId, ref: "Comic", required: true },
  },
  { timestamps: true }
);

likeSchema.index({ userId: 1, comicId: 1 }, { unique: true });
likeSchema.index({ userId: 1, createdAt: -1 });
likeSchema.index({ comicId: 1 });

module.exports = mongoose.model("Like", likeSchema);
