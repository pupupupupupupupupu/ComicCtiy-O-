const Notification = require("../models/notificationModel");

// ─── GET all notifications for user (paginated) ───────────────────────────
const getNotifications = async (req, res) => {
  const { email } = req.params;
  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 20;
  const skip  = (page - 1) * limit;

  const [notifications, total, unread] = await Promise.all([
    Notification.find({ recipientEmail: email })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ recipientEmail: email }),
    Notification.countDocuments({ recipientEmail: email, read: false }),
  ]);

  res.json({
    notifications,
    unread,
    pagination: { page, pages: Math.ceil(total / limit), total },
  });
};

// ─── GET unread count only (for badge polling) ────────────────────────────
const getUnreadCount = async (req, res) => {
  const { email } = req.params;
  const count = await Notification.countDocuments({ recipientEmail: email, read: false });
  res.json({ count });
};

// ─── MARK one notification as read ───────────────────────────────────────
const markOneRead = async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, { read: true });
  res.json({ success: true });
};

// ─── MARK all notifications as read ──────────────────────────────────────
const markAllRead = async (req, res) => {
  const { email } = req.params;
  await Notification.updateMany({ recipientEmail: email, read: false }, { read: true });
  res.json({ success: true });
};

module.exports = { getNotifications, getUnreadCount, markOneRead, markAllRead };
