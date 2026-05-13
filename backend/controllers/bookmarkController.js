const Bookmark    = require("../models/bookmarkModel");
const Comic       = require("../models/comicModel");
const Collection  = require("../models/collectionModel");
const UserProfile = require("../models/userProfileModel");
const mongoose    = require("mongoose");

const getCoverUrl = (ci) => {
  if (!ci) return null;
  if (typeof ci === "string") return ci;
  return ci.url || null;
};

// GET all bookmarks for a user, grouped by collection
const getBookmarks = async (req, res) => {
  const { userId } = req.params;

  const bookmarks = await Bookmark.find({ userId }).sort({ createdAt: -1 }).lean();
  if (!bookmarks.length) return res.status(200).json([]);

  // Get comic details
  const comicIds = [...new Set(bookmarks.map((b) => String(b.comicId)))];
  const comics   = await Comic.find({ _id: { $in: comicIds } })
    .select("comicName coverImage genre").lean();
  const comicMap = Object.fromEntries(comics.map((c) => [String(c._id), {
    ...c,
    coverImage: { url: getCoverUrl(c.coverImage), public_id: c.coverImage?.public_id || null }
  }]));

  // Get collection names
  const colIds  = [...new Set(bookmarks.map((b) => String(b.collectionId)))];
  const cols    = await Collection.find({ _id: { $in: colIds } }).lean();
  const colMap  = Object.fromEntries(cols.map((c) => [String(c._id), c]));

  // Group by collection
  const groups = {};
  for (const bm of bookmarks) {
    const colId  = String(bm.collectionId);
    const col    = colMap[colId] || { _id: bm.collectionId, name: "Unknown", isDefault: false };
    const comic  = comicMap[String(bm.comicId)];
    if (!comic) continue;
    if (!groups[colId]) groups[colId] = { collection: col, comics: [] };
    groups[colId].comics.push({ bookmarkId: bm._id, ...comic });
  }

  res.status(200).json(Object.values(groups));
};

// POST add bookmark
const addBookmark = async (req, res) => {
  const { userId, comicId, collectionId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(comicId) || !mongoose.Types.ObjectId.isValid(collectionId))
    return res.status(400).json({ error: "Invalid comicId or collectionId." });

  // Verify collection belongs to user
  const col = await Collection.findById(collectionId);
  if (!col || col.userId !== userId)
    return res.status(404).json({ error: "Collection not found." });

  const bookmark = await Bookmark.findOneAndUpdate(
    { userId, comicId, collectionId },
    { userId, comicId, collectionId },
    { upsert: true, new: true }
  );

  // Update lastCollectionId on profile
  await UserProfile.findOneAndUpdate(
    { userId },
    { $set: { lastCollectionId: collectionId } },
    { upsert: true }
  );

  res.status(201).json(bookmark);
};

// DELETE remove bookmark from a specific collection
const removeBookmark = async (req, res) => {
  const { userId, comicId, collectionId } = req.body;

  await Bookmark.deleteOne({ userId, comicId, collectionId });
  res.status(200).json({ message: "Removed from collection." });
};

// GET check bookmark status for a comic (which collections it's in)
const getBookmarkStatus = async (req, res) => {
  const { userId, comicId } = req.query;
  if (!userId || !comicId) return res.status(200).json({ bookmarked: false, collectionIds: [] });

  const bookmarks = await Bookmark.find({ userId, comicId }).lean();
  res.status(200).json({
    bookmarked:    bookmarks.length > 0,
    collectionIds: bookmarks.map((b) => String(b.collectionId)),
  });
};

module.exports = { getBookmarks, addBookmark, removeBookmark, getBookmarkStatus };
