const mongoose = require("mongoose");

const savedArtistSchema = new mongoose.Schema(
  {
    userId:     { type: String, required: true },
    artistName: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

savedArtistSchema.index({ userId: 1, artistName: 1 }, { unique: true });
savedArtistSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("SavedArtist", savedArtistSchema);
