const mongoose = require("mongoose");

// Stores "last visited chapter" per user per comic.
// Upserted on every chapter read — keeps only the latest visit per comic.

const userHistorySchema = new mongoose.Schema(
  {
    userId:        { type: String, required: true },   // Auth0 user sub
    comicId:       { type: mongoose.Schema.Types.ObjectId, ref: "Comic", required: true },
    comicName:     { type: String },
    coverUrl:      { type: String },
    chapterNumber: { type: Number },
    // null = the comic's own pages (original chapter); ObjectId = a Chapter doc
    chapterId:     { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", default: null },
    visitedAt:     { type: Date, default: Date.now },
  }
);

// One record per (user, comic)
userHistorySchema.index({ userId: 1, comicId: 1 }, { unique: true });
userHistorySchema.index({ userId: 1, visitedAt: -1 });

module.exports = mongoose.model("UserHistory", userHistorySchema);
