const mongoose = require("mongoose");

// Tracks unique IP views per comic.
// We use upsert on { comicId, ip } — if the record is older than 24h we
// update it and count the view; if it's fresh we skip counting.

const comicViewSchema = new mongoose.Schema({
  comicId:  { type: mongoose.Schema.Types.ObjectId, ref: "Comic", required: true },
  ip:       { type: String, required: true },
  viewedAt: { type: Date, default: Date.now },
});

// Compound unique index — one record per (comic, IP)
comicViewSchema.index({ comicId: 1, ip: 1 }, { unique: true });

module.exports = mongoose.model("ComicView", comicViewSchema);
