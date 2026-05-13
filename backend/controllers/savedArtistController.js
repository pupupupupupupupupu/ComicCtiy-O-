const SavedArtist = require("../models/savedArtistModel");
const Comic       = require("../models/comicModel");

// GET all saved artists for a user
const getSavedArtists = async (req, res) => {
  const userId = decodeURIComponent(req.params.userId || "");
  const artists = await SavedArtist.find({ userId }).sort({ createdAt: -1 }).lean();
  res.status(200).json(artists);
};

// POST save/follow an artist
const saveArtist = async (req, res) => {
  const { userId, artistName } = req.body;
  if (!userId || !artistName?.trim())
    return res.status(400).json({ error: "userId and artistName required." });

  const saved = await SavedArtist.findOneAndUpdate(
    { userId, artistName: artistName.trim() },
    { userId, artistName: artistName.trim() },
    { upsert: true, new: true }
  );
  res.status(201).json(saved);
};

// DELETE unsave/unfollow an artist
const unsaveArtist = async (req, res) => {
  const { userId, artistName } = req.body;
  await SavedArtist.deleteOne({ userId, artistName });
  res.status(200).json({ message: "Unfollowed artist." });
};

// GET check follow status for current user + artist
const getFollowStatus = async (req, res) => {
  const userId     = decodeURIComponent(req.query.userId     || "");
  const artistName = decodeURIComponent(req.query.artistName || "");
  if (!userId || !artistName) return res.status(200).json({ following: false });
  const exists = await SavedArtist.findOne({ userId, artistName });
  res.status(200).json({ following: !!exists });
};

// GET all comics by artist name (case-insensitive exact match)
const getArtistComics = async (req, res) => {
  const name = decodeURIComponent(req.params.name || "").trim();
  if (!name) return res.status(200).json({ artist: "", comics: [] });

  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(40, parseInt(req.query.limit) || 20);
  const skip  = (page - 1) * limit;

  const filter = { authorName: { $regex: `^${name}$`, $options: "i" } };

  const [comics, total] = await Promise.all([
    Comic.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Comic.countDocuments(filter),
  ]);

  // Normalise cover images for old docs
  const normalised = comics.map((c) => ({
    ...c,
    coverImage: {
      url: typeof c.coverImage === "string" ? c.coverImage : c.coverImage?.url,
      public_id: c.coverImage?.public_id || null,
    },
  }));

  res.status(200).json({
    artist: name,
    comics: normalised,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

module.exports = { getSavedArtists, saveArtist, unsaveArtist, getFollowStatus, getArtistComics };
