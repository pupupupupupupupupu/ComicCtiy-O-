const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const comicSchema = new Schema(
  {
    // coverImage: supports both old format (base64 string) and new format ({ public_id, url })
    // Using Mixed so existing documents don't fail validation on read
    coverImage: {
      type: Schema.Types.Mixed,
      required: true,
    },

    comicName: {
      type: String,
      required: [true, "A name for the comic is required"],
    },
    authorName: {
      type: String,
      default: "Anonymous",
    },
    genre: {
      type: [String],
      default: [],
    },
    // comicImages: old docs have base64 strings[], new docs have [{ public_id, url }]
    comicImages: {
      type: Schema.Types.Mixed,
      default: [],
    },
    // Carousel image — new field, absent on old docs
    carouselImage: {
      public_id: { type: String, default: null },
      url:       { type: String, default: null },
    },
    chapterNumber: {
      type: Number,
      required: true,
    },
    totalChapter: {
      type: Number,
    },
    description: {
      type: String,
      required: [true, "A description is needed"],
    },
    email: {
      type: String,
    },
    // Click tracking — absent on old docs, defaults handle it
    clickCount: {
      type: Number,
      default: 0,
    },
    weeklyClickCount: {
      type: Number,
      default: 0,
    },
    weeklyClickReset: {
      type: Date,
      default: Date.now,
    },
    // Collaboration — owner can open/close their comic to collab requests
    collabOpen: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true, strict: false } // strict:false lets old-format fields survive reads
);

// Indexes
comicSchema.index({ createdAt: -1 });
comicSchema.index({ weeklyClickCount: -1 });
comicSchema.index({ genre: 1 });

module.exports = mongoose.model("Comic", comicSchema);
