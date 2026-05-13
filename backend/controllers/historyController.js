const UserHistory = require("../models/userHistoryModel");
const mongoose    = require("mongoose");

// ─── GET history for a signed-in user ────────────────────────────────────
const getHistory = async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: "userId required" });

  const history = await UserHistory.find({ userId })
    .sort({ visitedAt: -1 })
    .limit(20)
    .lean();

  res.status(200).json(history);
};

// ─── UPSERT a visit (called from frontend when chapter is opened) ─────────
const upsertVisit = async (req, res) => {
  const { userId, comicId, comicName, coverUrl, chapterNumber, chapterId } = req.body;

  if (!userId || !comicId)
    return res.status(400).json({ error: "userId and comicId required" });

  if (!mongoose.Types.ObjectId.isValid(comicId))
    return res.status(400).json({ error: "Invalid comicId" });

  const record = await UserHistory.findOneAndUpdate(
    { userId, comicId },
    {
      userId,
      comicId,
      comicName,
      coverUrl,
      chapterNumber,
      chapterId: chapterId || null,
      visitedAt: new Date(),
    },
    { upsert: true, new: true }
  ).lean();

  res.status(200).json(record);
};

module.exports = { getHistory, upsertVisit };
