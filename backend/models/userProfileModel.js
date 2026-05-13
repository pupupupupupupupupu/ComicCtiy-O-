const mongoose = require("mongoose");

const userProfileSchema = new mongoose.Schema(
  {
    userId:           { type: String, required: true, unique: true },
    username:         { type: String, unique: true, sparse: true, trim: true, minlength: 3, maxlength: 30 },
    displayNamePref:  { type: String, enum: ["account", "username"], default: "account" },
    lastCollectionId: { type: mongoose.Schema.Types.ObjectId, ref: "Collection", default: null },
    bio:              { type: String, maxlength: 300, default: "" },
    customPicture:    {
      public_id: { type: String, default: null },
      url:       { type: String, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserProfile", userProfileSchema);
