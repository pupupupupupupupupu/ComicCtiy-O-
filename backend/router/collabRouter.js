const express = require("express");
const router  = express.Router();
const c       = require("../controllers/collabController");

// ─── Requests ─────────────────────────────────────────────────────────────
router.post("/request",                      c.sendRequest);
router.get ("/requests/:email",              c.getRequests);
router.patch("/request/:id/accept",          c.acceptRequest);
router.patch("/request/:id/decline",         c.declineRequest);
router.delete("/request/:id",                c.cancelRequest);

// ─── Chats ────────────────────────────────────────────────────────────────
router.get  ("/chats/:email",                c.getChats);
router.get  ("/chat/:chatId",                c.getChat);
router.post ("/chat/:chatId/message",        c.sendMessage);
router.patch("/chat/:chatId/read",           c.markRead);
router.patch("/chat/:chatId/status",         c.updateStatus);
router.patch("/chat/:chatId/mute",           c.toggleMute);
router.post ("/chat/:chatId/block",          c.blockUser);

module.exports = router;
