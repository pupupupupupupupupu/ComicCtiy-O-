const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema(
  {
    email:   { type: String, required: true },
    userId:  { type: String, default: "" },  // Auth0 sub (may be empty for legacy)
    name:    { type: String, default: "" },
    pic:     { type: String, default: "" },
    role:    { type: String, default: "collaborator" }, // 'owner' | the requested role
    muted:   { type: Boolean, default: false },
    blocked: { type: Boolean, default: false },
  },
  { _id: false }
);

const collabChatSchema = new mongoose.Schema(
  {
    comicId:      { type: mongoose.Schema.Types.ObjectId, ref: "Comic", required: true },
    requestId:    { type: mongoose.Schema.Types.ObjectId, ref: "CollabRequest", required: true },
    participants: [participantSchema],

    collabStatus: {
      type: String,
      enum: ["active", "paused", "completed", "ended"],
      default: "active",
    },

    chapterScope: {
      all:      { type: Boolean, default: true },
      chapters: { type: [Number], default: [] },
    },

    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

collabChatSchema.index({ "participants.email": 1, lastMessageAt: -1 });

module.exports = mongoose.model("CollabChat", collabChatSchema);
