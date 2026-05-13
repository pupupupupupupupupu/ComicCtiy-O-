const UserProfile = require("../models/userProfileModel");
const Collection  = require("../models/collectionModel");
const Comic       = require("../models/comicModel");
const Comment     = require("../models/commentModel");
const Like        = require("../models/likeModel");
const Bookmark    = require("../models/bookmarkModel");
const cloudinary  = require("../cloudinary/cloudinary");

// ── GET or create own profile ─────────────────────────────────────────────
const getProfile = async (req, res) => {
  const { userId } = req.params;
  let profile = await UserProfile.findOne({ userId }).lean();

  if (!profile) {
    const col = await Collection.create({ userId, name: "General", isDefault: true });
    profile   = (await UserProfile.create({ userId, lastCollectionId: col._id })).toObject();
  }

  const [comicsUploaded, commentsCount, likesCount, bookmarksCount] = await Promise.all([
    Comic.countDocuments({ email: req.query.email || "" }),
    Comment.countDocuments({ userId }),
    Like.countDocuments({ userId }),
    Bookmark.countDocuments({ userId }),
  ]);

  res.status(200).json({ ...profile, stats: { comicsUploaded, commentsCount, likesCount, bookmarksCount } });
};

// ── GET public profile (for other users to view) ──────────────────────────
const getPublicProfile = async (req, res) => {
  const { userId } = req.params;
  const profile    = await UserProfile.findOne({ userId })
    .select("username displayNamePref bio customPicture createdAt")
    .lean();

  if (!profile) return res.status(404).json({ error: "User not found" });

  // Only return public collections
  const collections = await Collection.find({ userId, isPublic: true })
    .sort({ isDefault: -1, createdAt: 1 }).lean();

  res.status(200).json({ profile, collections });
};

// ── PATCH update profile settings ────────────────────────────────────────
const updateProfile = async (req, res) => {
  const { userId } = req.params;
  const { username, displayNamePref, bio, accountName } = req.body;

  const updates = {};
  if (username !== undefined)        updates.username        = username.trim() || undefined;
  if (displayNamePref !== undefined) updates.displayNamePref = displayNamePref;
  if (bio !== undefined)             updates.bio             = bio.trim();

  if (updates.username) {
    const taken = await UserProfile.findOne({ username: updates.username, userId: { $ne: userId } });
    if (taken) return res.status(409).json({ error: "Username already taken." });
  }

  const profile = await UserProfile.findOneAndUpdate(
    { userId }, updates, { new: true, upsert: true, runValidators: true }
  ).lean();

  // Sync display name in all comments posted by this user
  const newDisplayName = displayNamePref === "username" && (updates.username || profile.username)
    ? (updates.username || profile.username)
    : accountName || profile.username;

  if (newDisplayName) {
    await Comment.updateMany({ userId }, { $set: { userName: newDisplayName } });
  }

  res.status(200).json(profile);
};

// ── PATCH update profile picture ──────────────────────────────────────────
const updateProfilePicture = async (req, res) => {
  const { userId }  = req.params;
  const { imageBase64 } = req.body;  // base64 data URL from frontend

  if (!imageBase64) return res.status(400).json({ error: "No image provided." });

  // Get existing profile to delete old picture
  const existing = await UserProfile.findOne({ userId }).select("customPicture").lean();
  if (existing?.customPicture?.public_id) {
    await cloudinary.uploader.destroy(existing.customPicture.public_id).catch(() => {});
  }

  // Upload new picture - small size for avatar
  const result = await cloudinary.uploader.upload(imageBase64, {
    folder:         "comic-city/avatars",
    transformation: [{ width: 200, height: 200, crop: "fill", gravity: "face" }],
  });

  const profile = await UserProfile.findOneAndUpdate(
    { userId },
    { $set: { customPicture: { public_id: result.public_id, url: result.secure_url } } },
    { new: true, upsert: true }
  ).lean();

  res.status(200).json(profile);
};

// ── GET comment history for own profile ───────────────────────────────────
const getCommentHistory = async (req, res) => {
  const { userId } = req.params;
  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 15;
  const skip  = (page - 1) * limit;

  const [comments, total] = await Promise.all([
    Comment.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Comment.countDocuments({ userId }),
  ]);

  const comicIds = [...new Set(comments.map((c) => String(c.comicId)))];
  const comics   = await Comic.find({ _id: { $in: comicIds } }).select("comicName coverImage").lean();
  const comicMap = Object.fromEntries(comics.map((c) => [String(c._id), c]));

  res.status(200).json({
    comments: comments.map((c) => ({ ...c, comic: comicMap[String(c.comicId)] || null })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

module.exports = { getProfile, getPublicProfile, updateProfile, updateProfilePicture, getCommentHistory };
