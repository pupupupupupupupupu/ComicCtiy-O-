const Chapter = require("../models/chapterModel");
const Comic   = require("../models/comicModel");
const cloudinary = require("../cloudinary/cloudinary");
const mongoose   = require("mongoose");

// ─── GET all chapters for a comic ─────────────────────────────────────────
const getChapters = async (req, res) => {
  const { comicId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(comicId))
    return res.status(404).json({ error: "Comic not found" });

  const chapters = await Chapter.find({ comicId })
    .sort({ chapterNumber: 1 })
    .lean();

  res.status(200).json(chapters);
};

// ─── GET single chapter ────────────────────────────────────────────────────
const getChapter = async (req, res) => {
  const { comicId, chapterId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(chapterId))
    return res.status(404).json({ error: "Chapter not found" });

  const chapter = await Chapter.findOne({ _id: chapterId, comicId }).lean();
  if (!chapter) return res.status(404).json({ error: "Chapter not found" });

  res.status(200).json(chapter);
};

// ─── ADD a new chapter ────────────────────────────────────────────────────
// Images are pre-uploaded to Cloudinary by the browser.
// Payload: { chapterNumber, title, comicImages: [{public_id, url}], email }
const addChapter = async (req, res) => {
  const { comicId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(comicId))
    return res.status(404).json({ error: "Comic not found" });

  const comic = await Comic.findById(comicId).lean();
  if (!comic) return res.status(404).json({ error: "Comic not found" });

  // Ownership check (email-based, consistent with rest of app)
  const { email, chapterNumber, title, comicImages } = req.body;
  if (comic.email !== email)
    return res.status(403).json({ error: "Only the uploader can add chapters." });

  if (!chapterNumber)
    return res.status(400).json({ error: "Chapter number is required." });

  // Check for duplicate chapter number
  const existing = await Chapter.findOne({ comicId, chapterNumber: Number(chapterNumber) });
  if (existing)
    return res.status(409).json({ error: `Chapter ${chapterNumber} already exists.` });

  const chapter = await Chapter.create({
    comicId,
    chapterNumber: Number(chapterNumber),
    title: (title || "").trim(),
    comicImages: Array.isArray(comicImages) ? comicImages : [],
  });

  res.status(201).json(chapter);
};

// ─── DELETE a chapter ─────────────────────────────────────────────────────
const deleteChapter = async (req, res) => {
  const { comicId, chapterId } = req.params;
  const { email } = req.body;

  const comic = await Comic.findById(comicId).lean();
  if (!comic) return res.status(404).json({ error: "Comic not found" });
  if (comic.email !== email)
    return res.status(403).json({ error: "Only the uploader can delete chapters." });

  const chapter = await Chapter.findOneAndDelete({ _id: chapterId, comicId }).lean();
  if (!chapter) return res.status(404).json({ error: "Chapter not found" });

  // Clean up Cloudinary assets
  try {
    for (const img of chapter.comicImages || []) {
      if (img.public_id) await cloudinary.uploader.destroy(img.public_id);
    }
  } catch (e) {
    console.error("Cloudinary chapter cleanup error:", e.message);
  }

  res.status(200).json({ message: "Chapter deleted", id: chapterId });
};

module.exports = { getChapters, getChapter, addChapter, deleteChapter };
