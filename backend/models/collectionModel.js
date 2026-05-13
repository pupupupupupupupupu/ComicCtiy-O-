const mongoose = require("mongoose");

const collectionSchema = new mongoose.Schema(
  {
    userId:    { type: String, required: true, index: true },
    name:      { type: String, required: true, trim: true, maxlength: 60 },
    isDefault: { type: Boolean, default: false },
    isPublic:  { type: Boolean, default: true },
  },
  { timestamps: true }
);

collectionSchema.index({ userId: 1, name: 1 }, { unique: true });
module.exports = mongoose.model("Collection", collectionSchema);
