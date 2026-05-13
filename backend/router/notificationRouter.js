const express = require("express");
const router  = express.Router();
const c       = require("../controllers/notificationController");

router.get  ("/:email",          c.getNotifications);
router.get  ("/:email/unread",   c.getUnreadCount);
router.patch("/:email/read-all", c.markAllRead);
router.patch("/:id/read",        c.markOneRead);

module.exports = router;
