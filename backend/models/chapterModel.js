const mongoose = require("mongoose");

// Each comic's additional chapters live here.
// The original upload (comicImages on the Comic doc) is treated as Chapter 1
// and does NOT get a Chapter document — it's read directly from Comic.
// All subsequent chapters added via "Add Chapter" are stored here.

const chapterSchema = new mongoose.Schema(
  {
    comicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comic",
      required: true,
      index: true,
    },
    chapterNumber: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
    },
    comicImages: [
      {
        public_id: { type: String },
        url:       { type: String },
      },
    ],
  },
  { timestamps: true }
);

// Prevent duplicate chapter numbers for the same comic
chapterSchema.index({ comicId: 1, chapterNumber: 1 }, { unique: true });

module.exports = mongoose.model("Chapter", chapterSchema);
