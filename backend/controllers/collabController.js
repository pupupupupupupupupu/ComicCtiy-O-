const CollabRequest = require("../models/collabRequestModel");
const CollabChat    = require("../models/collabChatModel");
const CollabMessage = require("../models/collabMessageModel");
const Notification  = require("../models/notificationModel");
const Comic         = require("../models/comicModel");
const { getIO }     = require("../socket");

// ─── Helper: create notification + push via socket ───────────────────────
const pushNotification = async (data) => {
  const notif = await Notification.create(data);
  const io = getIO();
  if (io) {
    const ns = io.of("/collab");
    const unread = await Notification.countDocuments({
      recipientEmail: data.recipientEmail, read: false,
    });
    ns.to(`user_email:${data.recipientEmail}`).emit("notification", {
      unreadCount: unread,
      notification: notif,
    });
  }
  return notif;
};

// ─── POST /api/collab/request ─────────────────────────────────────────────
const sendRequest = async (req, res) => {
  const {
    comicId, requesterId, requesterEmail, requesterName, requesterPic,
    role, pitch, portfolioUrl, chapterScope,
  } = req.body;

  if (!comicId || !requesterId || !requesterEmail || !role || !pitch) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const comic = await Comic.findById(comicId).lean();
  if (!comic) return res.status(404).json({ error: "Comic not found" });
  if (!comic.collabOpen) return res.status(403).json({ error: "This comic is not open for collaboration" });
  if (comic.email === requesterEmail) return res.status(400).json({ error: "You cannot request to collab on your own comic" });

  // One active request per comic per user
  const existing = await CollabRequest.findOne({ comicId, requesterId, status: "pending" });
  if (existing) return res.status(409).json({ error: "You already have a pending request for this comic" });

  const request = await CollabRequest.create({
    comicId,
    requesterId,
    requesterEmail,
    requesterName,
    requesterPic: requesterPic || "",
    ownerEmail: comic.email,
    role,
    pitch,
    portfolioUrl: portfolioUrl || "",
    chapterScope: chapterScope || { all: true, chapters: [] },
  });

  await pushNotification({
    recipientEmail: comic.email,
    type: "collab_request",
    refId: request._id,
    refModel: "CollabRequest",
    fromUserId: requesterId,
    fromName: requesterName,
    fromPic: requesterPic || "",
    message: `${requesterName} wants to collab on "${comic.comicName}" as ${role}`,
    meta: {
      comicId:    String(comic._id),
      comicName:  comic.comicName,
      coverUrl:   comic.coverImage?.url || null,
      requestId:  String(request._id),
      role,
    },
  });

  res.status(201).json(request);
};

// ─── GET /api/collab/requests/:email ─────────────────────────────────────
const getRequests = async (req, res) => {
  const { email } = req.params;
  const now = new Date();

  const [received, sent] = await Promise.all([
    CollabRequest.find({ ownerEmail: email })
      .populate("comicId", "comicName coverImage")
      .sort({ createdAt: -1 })
      .lean(),
    CollabRequest.find({ requesterEmail: email })
      .populate("comicId", "comicName coverImage")
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const markExpired = (list) =>
    list.map((r) => ({
      ...r,
      status: r.status === "pending" && r.expiresAt < now ? "expired" : r.status,
    }));

  res.json({ received: markExpired(received), sent: markExpired(sent) });
};

// ─── PATCH /api/collab/request/:id/accept ────────────────────────────────
const acceptRequest = async (req, res) => {
  const { ownerEmail, ownerName, ownerPic, ownerUserId } = req.body;

  const request = await CollabRequest.findById(req.params.id)
    .populate("comicId", "comicName coverImage email");
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.ownerEmail !== ownerEmail) return res.status(403).json({ error: "Not authorized" });
  if (request.status !== "pending") return res.status(400).json({ error: "Request is no longer pending" });

  request.status = "accepted";
  await request.save();

  const chat = await CollabChat.create({
    comicId:  request.comicId._id,
    requestId: request._id,
    participants: [
      { email: ownerEmail, userId: ownerUserId || "", name: ownerName || "", pic: ownerPic || "", role: "owner" },
      { email: request.requesterEmail, userId: request.requesterId, name: request.requesterName, pic: request.requesterPic, role: request.role },
    ],
    chapterScope: request.chapterScope,
    collabStatus: "active",
  });

  await CollabMessage.create({
    chatId:      chat._id,
    senderEmail: "system",
    type:        "system",
    content:     `Collaboration started! ${request.requesterName} joins as ${request.role} on "${request.comicId.comicName}". Say hello 👋`,
    readBy:      [],
  });

  await pushNotification({
    recipientEmail: request.requesterEmail,
    type: "collab_accepted",
    refId: chat._id,
    refModel: "CollabChat",
    fromUserId: ownerUserId || "",
    fromName:   ownerName || "Comic owner",
    fromPic:    ownerPic  || "",
    message: `Your collab request on "${request.comicId.comicName}" was accepted! Open your chat to get started.`,
    meta: {
      chatId:    String(chat._id),
      comicId:   String(request.comicId._id),
      comicName: request.comicId.comicName,
      coverUrl:  request.comicId.coverImage?.url || null,
    },
  });

  res.json({ request: request.toObject(), chatId: chat._id });
};

// ─── PATCH /api/collab/request/:id/decline ───────────────────────────────
const declineRequest = async (req, res) => {
  const { ownerEmail, ownerName } = req.body;

  const request = await CollabRequest.findById(req.params.id)
    .populate("comicId", "comicName coverImage");
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.ownerEmail !== ownerEmail) return res.status(403).json({ error: "Not authorized" });
  if (request.status !== "pending") return res.status(400).json({ error: "Request is no longer pending" });

  request.status = "declined";
  await request.save();

  await pushNotification({
    recipientEmail: request.requesterEmail,
    type: "collab_declined",
    refId: request._id,
    refModel: "CollabRequest",
    fromName: ownerName || "Comic owner",
    message: `Your collab request on "${request.comicId.comicName}" was not accepted this time.`,
    meta: {
      comicId:   String(request.comicId._id),
      comicName: request.comicId.comicName,
      coverUrl:  request.comicId.coverImage?.url || null,
    },
  });

  res.json(request.toObject());
};

// ─── DELETE /api/collab/request/:id ─── cancel by requester ─────────────
const cancelRequest = async (req, res) => {
  const { requesterEmail } = req.body;
  const request = await CollabRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.requesterEmail !== requesterEmail) return res.status(403).json({ error: "Not authorized" });
  if (request.status !== "pending") return res.status(400).json({ error: "Only pending requests can be cancelled" });

  request.status = "cancelled";
  await request.save();
  res.json({ success: true });
};

// ─── GET /api/collab/chats/:email ─────────────────────────────────────────
const getChats = async (req, res) => {
  const { email } = req.params;

  const chats = await CollabChat.find({ "participants.email": email })
    .populate("comicId", "comicName coverImage")
    .sort({ lastMessageAt: -1 })
    .lean();

  const enriched = await Promise.all(
    chats.map(async (chat) => {
      const partner   = chat.participants.find((p) => p.email !== email);
      const lastMsg   = await CollabMessage.findOne({ chatId: chat._id })
        .sort({ createdAt: -1 }).lean();
      const unread    = await CollabMessage.countDocuments({
        chatId: chat._id,
        senderEmail: { $ne: email },
        readBy: { $nin: [email] },
        type: { $ne: "system" },
      });
      return { ...chat, partner, lastMessage: lastMsg, unreadCount: unread };
    })
  );

  res.json(enriched);
};

// ─── GET /api/collab/chat/:chatId?page=1 ─────────────────────────────────
const getChat = async (req, res) => {
  const { chatId } = req.params;
  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 40;
  const skip  = (page - 1) * limit;

  const chat = await CollabChat.findById(chatId)
    .populate("comicId", "comicName coverImage collabOpen description")
    .lean();
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  const [messages, total] = await Promise.all([
    CollabMessage.find({ chatId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CollabMessage.countDocuments({ chatId }),
  ]);

  res.json({
    chat,
    messages: messages.reverse(), // chronological order
    pagination: { page, pages: Math.ceil(total / limit), total },
  });
};

// ─── POST /api/collab/chat/:chatId/message ────────────────────────────────
const sendMessage = async (req, res) => {
  const { chatId } = req.params;
  const { senderEmail, senderName, senderPic, content, type } = req.body;

  if (!content?.trim()) return res.status(400).json({ error: "Message cannot be empty" });

  const chat = await CollabChat.findById(chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  if (chat.collabStatus !== "active") return res.status(400).json({ error: "This collaboration is not active" });

  const isParticipant = chat.participants.some((p) => p.email === senderEmail);
  if (!isParticipant) return res.status(403).json({ error: "Not a participant" });

  const message = await CollabMessage.create({
    chatId,
    senderEmail,
    senderName:  senderName || "",
    senderPic:   senderPic  || "",
    type:        type || "text",
    content:     content.trim(),
    readBy:      [senderEmail],
  });

  chat.lastMessageAt = new Date();
  await chat.save();

  const io = getIO();
  if (io) {
    const ns = io.of("/collab");
    ns.to(`chat:${chatId}`).emit("message_received", message.toObject());
    const partner = chat.participants.find((p) => p.email !== senderEmail && !p.muted && !p.blocked);
    if (partner) {
      ns.to(`user_email:${partner.email}`).emit("chat_notification", {
        chatId,
        senderName: senderName || senderEmail,
        preview:    content.substring(0, 80),
      });
    }
  }

  res.status(201).json(message.toObject());
};

// ─── PATCH /api/collab/chat/:chatId/read ─── mark messages read ──────────
const markRead = async (req, res) => {
  const { chatId } = req.params;
  const { email }  = req.body;

  await CollabMessage.updateMany(
    { chatId, senderEmail: { $ne: email }, readBy: { $nin: [email] } },
    { $addToSet: { readBy: email } }
  );

  const io = getIO();
  if (io) io.of("/collab").to(`chat:${chatId}`).emit("read_receipt", { chatId, email });

  res.json({ success: true });
};

// ─── PATCH /api/collab/chat/:chatId/status ────────────────────────────────
const updateStatus = async (req, res) => {
  const { chatId } = req.params;
  const { email, collabStatus } = req.body;

  const validStatuses = ["active", "paused", "completed", "ended"];
  if (!validStatuses.includes(collabStatus))
    return res.status(400).json({ error: "Invalid status" });

  const chat = await CollabChat.findById(chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  if (!chat.participants.some((p) => p.email === email))
    return res.status(403).json({ error: "Not a participant" });

  chat.collabStatus = collabStatus;
  await chat.save();

  const statusLabels = { active: "Active", paused: "Paused", completed: "Completed ✅", ended: "Ended" };
  const sysMsg = await CollabMessage.create({
    chatId,
    senderEmail: "system",
    type:   "system",
    content: `Collaboration status changed to ${statusLabels[collabStatus]}.`,
    readBy:  [],
  });

  const io = getIO();
  if (io) {
    const ns = io.of("/collab");
    ns.to(`chat:${chatId}`).emit("status_changed", { collabStatus });
    ns.to(`chat:${chatId}`).emit("message_received", sysMsg.toObject());
  }

  res.json({ collabStatus });
};

// ─── PATCH /api/collab/chat/:chatId/mute ──────────────────────────────────
const toggleMute = async (req, res) => {
  const { chatId } = req.params;
  const { email }  = req.body;

  const chat = await CollabChat.findById(chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });

  const participant = chat.participants.find((p) => p.email === email);
  if (!participant) return res.status(403).json({ error: "Not a participant" });

  participant.muted = !participant.muted;
  await chat.save();

  res.json({ muted: participant.muted });
};

// ─── POST /api/collab/chat/:chatId/block ──────────────────────────────────
const blockUser = async (req, res) => {
  const { chatId } = req.params;
  const { email, targetEmail } = req.body;

  const chat = await CollabChat.findById(chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  if (!chat.participants.some((p) => p.email === email))
    return res.status(403).json({ error: "Not authorized" });

  const target = chat.participants.find((p) => p.email === targetEmail);
  if (target) target.blocked = true;
  chat.collabStatus = "ended";
  await chat.save();

  const sysMsg = await CollabMessage.create({
    chatId,
    senderEmail: "system",
    type:   "system",
    content: "Collaboration has ended.",
    readBy: [],
  });

  const io = getIO();
  if (io) {
    const ns = io.of("/collab");
    ns.to(`chat:${chatId}`).emit("collab_ended", { chatId });
    ns.to(`chat:${chatId}`).emit("message_received", sysMsg.toObject());
  }

  res.json({ success: true });
};

// ─── PATCH /api/comics/:id/collab-toggle ─── owner toggles collabOpen ────
const toggleCollabOpen = async (req, res) => {
  const { email } = req.body;
  const comic = await Comic.findById(req.params.id);
  if (!comic) return res.status(404).json({ error: "Comic not found" });
  if (comic.email !== email) return res.status(403).json({ error: "Not authorized" });

  comic.collabOpen = !comic.collabOpen;
  await comic.save();

  res.json({ collabOpen: comic.collabOpen });
};

module.exports = {
  sendRequest, getRequests, acceptRequest, declineRequest, cancelRequest,
  getChats, getChat, sendMessage, markRead, updateStatus, toggleMute, blockUser,
  toggleCollabOpen,
};
