const Comic      = require("../models/comicModel.js");
const ComicView  = require("../models/comicViewModel.js");
const mongoose   = require("mongoose");
const cloudinary = require("../cloudinary/cloudinary.js");

const ALLOWED_UPDATE_FIELDS = [
  "comicName","authorName","genre",
  "chapterNumber","totalChapter","description",
];

// ─── Backward-compat helpers ──────────────────────────────────────────────
const getCoverUrl = (ci) => {
  if (!ci) return null;
  if (typeof ci === "string") return ci;
  return ci.url || null;
};
const getCoverId = (ci) => {
  if (!ci || typeof ci === "string") return null;
  return ci.public_id || null;
};
const normalisePages = (imgs) => {
  if (!Array.isArray(imgs)) return [];
  return imgs.map((img) =>
    typeof img === "string"
      ? { public_id: null, url: img }
      : { public_id: img.public_id || null, url: img.url || null }
  );
};
const serialise = (c) => ({
  ...c,
  coverImage:       { public_id: getCoverId(c.coverImage), url: getCoverUrl(c.coverImage) },
  comicImages:      normalisePages(c.comicImages),
  clickCount:       c.clickCount       || 0,
  weeklyClickCount: c.weeklyClickCount || 0,
});

// ─── GET ALL (paginated) ──────────────────────────────────────────────────
const getComics = async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const skip  = (page - 1) * limit;
  const filter = req.query.genre ? { genre: req.query.genre } : {};
  const sortMap = {
    weekly:  { weeklyClickCount: -1, createdAt: -1 },
    popular: { clickCount: -1,       createdAt: -1 },
    recent:  { createdAt: -1 },
  };
  const sort = sortMap[req.query.sort] || { createdAt: -1 };

  const [comics, total] = await Promise.all([
    Comic.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Comic.countDocuments(filter),
  ]);

  res.status(200).json({
    comics: comics.map(serialise),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

// ─── GET SINGLE ───────────────────────────────────────────────────────────
const getComic = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(404).json({ error: "No such comic" });

  const comic = await Comic.findById(id).lean();
  if (!comic) return res.status(404).json({ error: "Comic not found" });

  res.status(200).json(serialise(comic));
};

// ─── CREATE ───────────────────────────────────────────────────────────────
const createComic = async (req, res) => {
  const {
    coverImage, carouselImage, comicImages,
    comicName, authorName, genre,
    chapterNumber, totalChapter, description, email,
  } = req.body;

  if (!coverImage?.url)
    return res.status(400).json({ error: "Cover image is required." });

  const comic = await Comic.create({
    coverImage:    { public_id: coverImage.public_id || null, url: coverImage.url },
    carouselImage: { public_id: carouselImage?.public_id || null, url: carouselImage?.url || null },
    comicName:     comicName?.trim(),
    authorName:    authorName?.trim() || "Anonymous",
    genre:         Array.isArray(genre) ? genre : [genre].filter(Boolean),
    comicImages:   Array.isArray(comicImages) ? comicImages : [],
    chapterNumber: Number(chapterNumber),
    totalChapter:  totalChapter ? Number(totalChapter) : undefined,
    description:   description?.trim(),
    email,
    clickCount:       0,
    weeklyClickCount: 0,
    weeklyClickReset: new Date(),
  });

  res.status(201).json(serialise(comic.toObject()));
};

// ─── DELETE ───────────────────────────────────────────────────────────────
const deleteComic = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(404).json({ error: "No such comic" });

  const comic = await Comic.findByIdAndDelete(id).lean();
  if (!comic) return res.status(404).json({ error: "Comic not found" });

  try {
    const coverId = getCoverId(comic.coverImage);
    if (coverId) await cloudinary.uploader.destroy(coverId);
    if (comic.carouselImage?.public_id)
      await cloudinary.uploader.destroy(comic.carouselImage.public_id);
    for (const p of normalisePages(comic.comicImages)) {
      if (p.public_id) await cloudinary.uploader.destroy(p.public_id);
    }
  } catch (e) { console.error("Cloudinary cleanup:", e.message); }

  // Clean up associated view records
  await ComicView.deleteMany({ comicId: id }).catch(() => {});

  res.status(200).json({ message: "Comic deleted", id });
};

// ─── UPDATE ───────────────────────────────────────────────────────────────
const updateComic = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(404).json({ error: "No such comic" });

  const updates = {};
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const comic = await Comic.findByIdAndUpdate(id, updates, {
    new: true, runValidators: false,
  }).lean();
  if (!comic) return res.status(404).json({ error: "Comic not found" });

  res.status(200).json(serialise(comic));
};

// ─── SEARCH ───────────────────────────────────────────────────────────────
const search = async (req, res) => {
  const query = (req.params.query || "").trim();
  if (!query) return res.status(200).json({ status: "Success", data: [] });

  const results = await Comic.find({
    $or: [
      { comicName:   { $regex: query, $options: "i" } },
      { authorName:  { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
      { genre:       { $regex: query, $options: "i" } },
    ],
  }).limit(10).lean();

  res.status(200).json({ status: "Success", data: results.map(serialise) });
};

// ─── TRACK VIEW (IP-based dedup) ──────────────────────────────────────────
const trackView = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(404).json({ error: "No such comic" });

  // Extract real IP — works behind Render/Nginx proxies
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.ip ||
    "unknown";

  const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
  const now       = new Date();

  // Try to find an existing view record for this (comic, ip) pair
  const existing = await ComicView.findOne({ comicId: id, ip }).lean();

  if (existing) {
    const age = now - new Date(existing.viewedAt);
    if (age < WINDOW_MS) {
      // Seen within 24h — don't count again
      return res.status(204).end();
    }
    // Older than 24h — update timestamp and count the view
    await ComicView.updateOne({ comicId: id, ip }, { $set: { viewedAt: now } });
  } else {
    // First ever view from this IP — insert record
    await ComicView.create({ comicId: id, ip, viewedAt: now });
  }

  // Increment counts; reset weekly count if >7 days since last reset
  const comic = await Comic.findById(id).lean();
  if (!comic) return res.status(404).json({ error: "Comic not found" });

  const resetDate    = comic.weeklyClickReset ? new Date(comic.weeklyClickReset) : new Date(0);
  const daysSinceReset = (now - resetDate) / (1000 * 60 * 60 * 24);

  const update = daysSinceReset >= 7
    ? { $inc: { clickCount: 1 }, $set: { weeklyClickCount: 1, weeklyClickReset: now } }
    : { $inc: { clickCount: 1, weeklyClickCount: 1 } };

  await Comic.findByIdAndUpdate(id, update);
  res.status(204).end();
};

// ─── CAROUSEL ─────────────────────────────────────────────────────────────
const getCarousel = async (req, res) => {
  const withCarousel = await Comic.find({ "carouselImage.url": { $ne: null } })
    .sort({ createdAt: -1 }).limit(10).lean();

  const images = withCarousel
    .filter((c) => c.carouselImage?.url)
    .map((c) => ({ url: c.carouselImage.url, comicId: c._id, comicName: c.comicName }));

  if (images.length < 5) {
    const recent = await Comic.find({}).sort({ createdAt: -1 }).limit(10).lean();
    const seen   = new Set(images.map((i) => String(i.comicId)));
    for (const c of recent) {
      if (images.length >= 5) break;
      if (seen.has(String(c._id))) continue;
      const url = getCoverUrl(c.coverImage);
      if (!url || url.startsWith("data:")) continue;
      images.push({ url, comicId: c._id, comicName: c.comicName });
      seen.add(String(c._id));
    }
  }

  res.status(200).json(images);
};

// ─── GENRES ───────────────────────────────────────────────────────────────
const getGenres = async (req, res) => {
  const genres  = await Comic.distinct("genre");
  const cleaned = [...new Set(genres.map((g) => g.trim()).filter(Boolean))];
  res.status(200).json(cleaned.sort());
};

module.exports = {
  getComics, getComic, createComic, deleteComic,
  updateComic, search, trackView, getCarousel, getGenres,
};
