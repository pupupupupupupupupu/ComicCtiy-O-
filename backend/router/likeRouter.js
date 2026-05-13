const express = require("express");
const { getLikeStatus, toggleLike, getUserLikes } = require("../controllers/likeController");
const router = express.Router();

router.get("/status",  getLikeStatus);   // ?userId=&comicId=
router.post("/toggle", toggleLike);
router.get("/:userId", getUserLikes);

module.exports = router;
