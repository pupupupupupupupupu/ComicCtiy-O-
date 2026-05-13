const mongoose = require("mongoose");

const collabRequestSchema = new mongoose.Schema(
  {
    comicId:       { type: mongoose.Schema.Types.ObjectId, ref: "Comic", required: true },

    // Requester (the person asking to collaborate)
    requesterId:   { type: String, required: true },  // Auth0 sub
    requesterEmail:{ type: String, required: true },
    requesterName: { type: String, required: true },
    requesterPic:  { type: String, default: "" },

    // Owner of the comic
    ownerEmail:    { type: String, required: true },  // matches comic.email

    role: {
      type: String,
      enum: ["writer", "artist", "colorist", "letterer", "editor", "other"],
      required: true,
    },
    pitch:        { type: String, required: true, maxlength: 300 },
    portfolioUrl: { type: String, default: "" },

    chapterScope: {
      all:      { type: Boolean, default: true },
      chapters: { type: [Number], default: [] },
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "cancelled"],
      default: "pending",
    },

    // Requests expire after 7 days — UI shows "expired", no hard delete
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

collabRequestSchema.index({ comicId: 1, requesterId: 1, status: 1 });
collabRequestSchema.index({ ownerEmail: 1, status: 1 });
collabRequestSchema.index({ requesterId: 1, status: 1 });

module.exports = mongoose.model("CollabRequest", collabRequestSchema);
