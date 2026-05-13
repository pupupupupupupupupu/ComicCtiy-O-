const Comment          = require("../models/commentModel");
const CommentAllowance = require("../models/commentAllowanceModel");
const Comic            = require("../models/comicModel");
const mongoose         = require("mongoose");

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Allowance helpers ────────────────────────────────────────────────────
async function getOrResetAllowance(comicId, ownerId) {
  const totalComments = await Comment.countDocuments({ comicId, hidden: { $ne: true } });
  const maxActions    = Math.max(1, Math.floor(totalComments * 0.20));

  let doc = await CommentAllowance.findOne({ comicId, ownerId });
  if (!doc) {
    doc = await CommentAllowance.create({ comicId, ownerId, actionsUsedToday: 0, windowStart: new Date() });
  } else {
    const age = Date.now() - new Date(doc.windowStart).getTime();
    if (age >= WINDOW_MS) {
      doc.actionsUsedToday = 0;
      doc.windowStart      = new Date();
      await doc.save();
    }
  }

  const remaining = Math.max(0, maxActions - doc.actionsUsedToday);
  return { doc, maxActions, remaining, totalComments };
}

async function consumeAction(doc) {
  doc.actionsUsedToday += 1;
  await doc.save();
}

// ── GET comments (filtered hidden for non-owners) ─────────────────────────
const getComments = async (req, res) => {
  const { comicId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(comicId))
    return res.status(404).json({ error: "Comic not found" });

  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const skip  = (page - 1) * limit;
  const requesterId = req.query.requesterId || "";

  // Get comic owner
  const comic = await Comic.findById(comicId).select("email").lean();
  const isOwner = comic && requesterId && comic.email === req.query.requesterEmail;

  // Non-owners don't see hidden comments
  const filter = isOwner ? { comicId } : { comicId, hidden: { $ne: true } };

  const [comments, total] = await Promise.all([
    Comment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Comment.countDocuments(filter),
  ]);

  res.status(200).json({
    comments,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

// ── GET owner allowance ───────────────────────────────────────────────────
const getOwnerAllowance = async (req, res) => {
  const { comicId } = req.params;
  const { ownerId } = req.query;
  if (!ownerId) return res.status(400).json({ error: "ownerId required" });

  const { maxActions, remaining, totalComments } = await getOrResetAllowance(comicId, ownerId);
  res.status(200).json({ maxActions, remaining, totalComments });
};

// ── POST comment ──────────────────────────────────────────────────────────
const postComment = async (req, res) => {
  const { comicId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(comicId))
    return res.status(404).json({ error: "Comic not found" });

  const { userId, userName, userPicture, userEmail, text } = req.body;
  if (!userId || !userName)
    return res.status(401).json({ error: "Sign in to post a comment." });
  if (!text?.trim())
    return res.status(400).json({ error: "Comment text is required." });
  if (text.trim().length > 2000)
    return res.status(400).json({ error: "Comment too long (max 2000 chars)." });

  const comment = await Comment.create({
    comicId, userId, userName,
    userPicture: userPicture || "",
    userEmail:   userEmail   || "",
    text:        text.trim(),
  });
  res.status(201).json(comment);
};

// ── PATCH edit comment (author only) ─────────────────────────────────────
const editComment = async (req, res) => {
  const { comicId, commentId } = req.params;
  const { userId, text }       = req.body;

  if (!mongoose.Types.ObjectId.isValid(commentId))
    return res.status(404).json({ error: "Comment not found" });
  if (!text?.trim())
    return res.status(400).json({ error: "Text is required." });
  if (text.trim().length > 2000)
    return res.status(400).json({ error: "Too long (max 2000 chars)." });

  const comment = await Comment.findOne({ _id: commentId, comicId });
  if (!comment) return res.status(404).json({ error: "Comment not found" });
  if (comment.userId !== userId)
    return res.status(403).json({ error: "You can only edit your own comments." });

  comment.text   = text.trim();
  comment.edited = true;
  await comment.save();
  res.status(200).json(comment);
};

// ── DELETE comment (author) ───────────────────────────────────────────────
const deleteComment = async (req, res) => {
  const { comicId, commentId } = req.params;
  const { userId }             = req.body;

  const comment = await Comment.findOne({ _id: commentId, comicId });
  if (!comment) return res.status(404).json({ error: "Comment not found" });
  if (comment.userId !== userId)
    return res.status(403).json({ error: "You can only delete your own comments." });

  await Comment.findByIdAndDelete(commentId);
  res.status(200).json({ message: "Comment deleted" });
};

// ── PATCH hide comment (comic owner, uses allowance) ─────────────────────
const hideComment = async (req, res) => {
  const { comicId, commentId } = req.params;
  const { ownerId }            = req.body;

  const comic = await Comic.findById(comicId).select("email").lean();
  if (!comic) return res.status(404).json({ error: "Comic not found" });

  // Verify owner by userId stored in request
  const { doc, remaining } = await getOrResetAllowance(comicId, ownerId);
  if (remaining <= 0)
    return res.status(429).json({ error: "Daily comment management limit reached. Resets in 24h." });

  const comment = await Comment.findOne({ _id: commentId, comicId });
  if (!comment) return res.status(404).json({ error: "Comment not found" });

  comment.hidden = !comment.hidden; // toggle
  await comment.save();
  await consumeAction(doc);

  const { remaining: newRemaining, maxActions } = await getOrResetAllowance(comicId, ownerId);
  res.status(200).json({ comment, remaining: newRemaining, maxActions });
};

// ── DELETE comment as owner (uses allowance) ──────────────────────────────
const deleteCommentAsOwner = async (req, res) => {
  const { comicId, commentId } = req.params;
  const { ownerId }            = req.body;

  const comic = await Comic.findById(comicId).select("email").lean();
  if (!comic) return res.status(404).json({ error: "Comic not found" });

  const { doc, remaining } = await getOrResetAllowance(comicId, ownerId);
  if (remaining <= 0)
    return res.status(429).json({ error: "Daily comment management limit reached. Resets in 24h." });

  const comment = await Comment.findOne({ _id: commentId, comicId });
  if (!comment) return res.status(404).json({ error: "Comment not found" });

  await Comment.findByIdAndDelete(commentId);
  await consumeAction(doc);

  const { remaining: newRemaining, maxActions } = await getOrResetAllowance(comicId, ownerId);
  res.status(200).json({ message: "Comment deleted", remaining: newRemaining, maxActions });
};

// ── POST reply ────────────────────────────────────────────────────────────
const postReply = async (req, res) => {
  const { comicId, commentId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(commentId))
    return res.status(404).json({ error: "Comment not found" });

  const { userId, userName, userPicture, text } = req.body;
  if (!userId || !userName) return res.status(401).json({ error: "Sign in to reply." });
  if (!text?.trim())         return res.status(400).json({ error: "Reply text required." });

  const comment = await Comment.findOneAndUpdate(
    { _id: commentId, comicId },
    { $push: { replies: { userId, userName, userPicture: userPicture || "", text: text.trim(), createdAt: new Date() } } },
    { new: true }
  );
  if (!comment) return res.status(404).json({ error: "Comment not found" });
  res.status(201).json(comment);
};

// ── PATCH edit reply (author only) ────────────────────────────────────────
const editReply = async (req, res) => {
  const { comicId, commentId, replyIndex } = req.params;
  const { userId, text } = req.body;

  const comment = await Comment.findOne({ _id: commentId, comicId });
  if (!comment) return res.status(404).json({ error: "Comment not found" });

  const idx = parseInt(replyIndex);
  const reply = comment.replies[idx];
  if (!reply) return res.status(404).json({ error: "Reply not found" });
  if (reply.userId !== userId) return res.status(403).json({ error: "You can only edit your own replies." });

  comment.replies[idx].text   = text.trim();
  comment.replies[idx].edited = true;
  comment.markModified("replies");
  await comment.save();
  res.status(200).json(comment);
};

// ── DELETE reply (author only) ────────────────────────────────────────────
const deleteReply = async (req, res) => {
  const { comicId, commentId, replyIndex } = req.params;
  const { userId } = req.body;

  const comment = await Comment.findOne({ _id: commentId, comicId });
  if (!comment) return res.status(404).json({ error: "Comment not found" });

  const idx   = parseInt(replyIndex);
  const reply = comment.replies[idx];
  if (!reply) return res.status(404).json({ error: "Reply not found" });
  if (reply.userId !== userId) return res.status(403).json({ error: "You can only delete your own replies." });

  comment.replies.splice(idx, 1);
  comment.markModified("replies");
  await comment.save();
  res.status(200).json(comment);
};

module.exports = {
  getComments, getOwnerAllowance,
  postComment, editComment, deleteComment,
  hideComment, deleteCommentAsOwner,
  postReply, editReply, deleteReply,
};
