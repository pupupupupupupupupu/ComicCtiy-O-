const express = require("express");
const {
  getComments, getOwnerAllowance,
  postComment, editComment, deleteComment,
  hideComment, deleteCommentAsOwner,
  postReply, editReply, deleteReply,
} = require("../controllers/commentController");

const router = express.Router({ mergeParams: true });

router.get("/",                              getComments);
router.get("/allowance",                     getOwnerAllowance);      // ?ownerId=
router.post("/",                             postComment);
router.patch("/:commentId",                  editComment);             // author edit
router.delete("/:commentId",                 deleteComment);           // author delete
router.patch("/:commentId/hide",             hideComment);             // owner hide/unhide
router.delete("/:commentId/owner",           deleteCommentAsOwner);   // owner delete
router.post("/:commentId/reply",             postReply);
router.patch("/:commentId/reply/:replyIndex", editReply);
router.delete("/:commentId/reply/:replyIndex", deleteReply);

module.exports = router;
