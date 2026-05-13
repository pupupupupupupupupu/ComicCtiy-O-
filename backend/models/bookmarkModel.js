const mongoose = require("mongoose");

const bookmarkSchema = new mongoose.Schema(
  {
    userId:       { type: String, required: true },
    comicId:      { type: mongoose.Schema.Types.ObjectId, ref: "Comic", required: true },
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: "Collection", required: true },
  },
  { timestamps: true }
);

// Same comic cannot be in the same collection twice
bookmarkSchema.index({ userId: 1, comicId: 1, collectionId: 1 }, { unique: true });
bookmarkSchema.index({ userId: 1, comicId: 1 });
bookmarkSchema.index({ userId: 1, collectionId: 1 });

module.exports = mongoose.model("Bookmark", bookmarkSchema);
