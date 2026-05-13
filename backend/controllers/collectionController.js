const Collection  = require("../models/collectionModel");
const Bookmark    = require("../models/bookmarkModel");
const UserProfile = require("../models/userProfileModel");

const getCollections = async (req, res) => {
  const { userId } = req.params;
  let collections = await Collection.find({ userId }).sort({ isDefault: -1, createdAt: 1 }).lean();

  if (!collections.find((c) => c.isDefault)) {
    const gen = await Collection.create({ userId, name: "General", isDefault: true });
    collections = [gen.toObject(), ...collections];
  }

  const counts = await Bookmark.aggregate([
    { $match: { userId } },
    { $group: { _id: "$collectionId", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));

  res.status(200).json(
    collections.map((c) => ({ ...c, comicCount: countMap[String(c._id)] || 0 }))
  );
};

const createCollection = async (req, res) => {
  const { userId, name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Collection name is required." });

  const exists = await Collection.findOne({ userId, name: name.trim() });
  if (exists) return res.status(409).json({ error: "A collection with that name already exists." });

  const collection = await Collection.create({ userId, name: name.trim() });
  res.status(201).json({ ...collection.toObject(), comicCount: 0 });
};

const deleteCollection = async (req, res) => {
  const { collectionId } = req.params;
  const { userId }       = req.body;

  const col = await Collection.findById(collectionId);
  if (!col || col.userId !== userId) return res.status(404).json({ error: "Collection not found." });
  if (col.isDefault)                 return res.status(400).json({ error: "Cannot delete your default collection." });

  await Collection.findByIdAndDelete(collectionId);
  await Bookmark.deleteMany({ userId, collectionId });
  await UserProfile.updateOne(
    { userId, lastCollectionId: collectionId },
    { $set: { lastCollectionId: null } }
  );

  res.status(200).json({ message: "Collection deleted." });
};

// PATCH toggle public/private
const toggleCollectionPrivacy = async (req, res) => {
  const { collectionId } = req.params;
  const { userId }       = req.body;

  const col = await Collection.findById(collectionId);
  if (!col || col.userId !== userId) return res.status(404).json({ error: "Collection not found." });

  col.isPublic = !col.isPublic;
  await col.save();
  res.status(200).json(col);
};

module.exports = { getCollections, createCollection, deleteCollection, toggleCollectionPrivacy };
