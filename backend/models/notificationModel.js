const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    // recipientEmail: the email of the user who receives the notification.
    // We key on email (matches comic.email) rather than Auth0 sub to stay
    // consistent with the existing Comic model identifier.
    recipientEmail: { type: String, required: true, index: true },

    type: {
      type: String,
      enum: ["collab_request", "collab_accepted", "collab_declined", "collab_cancelled", "reply", "follow"],
      required: true,
    },

    refId:    { type: mongoose.Schema.Types.ObjectId },
    refModel: { type: String }, // 'CollabRequest' | 'CollabChat'

    fromUserId: { type: String, default: "" },
    fromName:   { type: String, default: "" },
    fromPic:    { type: String, default: "" },

    message: { type: String, required: true },
    read:    { type: Boolean, default: false },

    // Flexible extra data: comicId, comicName, coverUrl, chatId, etc.
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientEmail: 1, createdAt: -1 });
notificationSchema.index({ recipientEmail: 1, read: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
