const Like    = require("../models/likeModel");
const Comic   = require("../models/comicModel");
const mongoose = require("mongoose");

const getCoverUrl = (ci) => {
  if (!ci) return null;
  if (typeof ci === "string") return ci;
  return ci.url || null;
};

// GET like status for a comic
const getLikeStatus = async (req, res) => {
  const { userId, comicId } = req.query;
  const count = await Like.countDocuments({ comicId });
  if (!userId) return res.status(200).json({ liked: false, count });
  const liked = !!(await Like.findOne({ userId, comicId }));
  res.status(200).json({ liked, count });
};

// POST toggle like
const toggleLike = async (req, res) => {
  const { userId, comicId } = req.body;
  if (!userId) return res.status(401).json({ error: "Sign in to like." });
  if (!mongoose.Types.ObjectId.isValid(comicId))
    return res.status(400).json({ error: "Invalid comicId." });

  const existing = await Like.findOne({ userId, comicId });
  if (existing) {
    await Like.findByIdAndDelete(existing._id);
  } else {
    await Like.create({ userId, comicId });
  }

  const count = await Like.countDocuments({ comicId });
  res.status(200).json({ liked: !existing, count });
};

// GET all likes for a user (with comic details)
const getUserLikes = async (req, res) => {
  const { userId } = req.params;
  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 20;
  const skip  = (page - 1) * limit;

  const [likes, total] = await Promise.all([
    Like.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Like.countDocuments({ userId }),
  ]);

  const comicIds = likes.map((l) => l.comicId);
  const comics   = await Comic.find({ _id: { $in: comicIds } })
    .select("comicName coverImage genre").lean();
  const comicMap = Object.fromEntries(comics.map((c) => [String(c._id), {
    ...c,
    coverImage: { url: getCoverUrl(c.coverImage), public_id: c.coverImage?.public_id || null }
  }]));

  res.status(200).json({
    likes: likes.map((l) => ({ ...l, comic: comicMap[String(l.comicId)] || null })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

module.exports = { getLikeStatus, toggleLike, getUserLikes };
