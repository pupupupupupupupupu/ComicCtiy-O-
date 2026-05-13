const express = require("express");
const {
  getProfile, getPublicProfile, updateProfile,
  updateProfilePicture, getCommentHistory,
} = require("../controllers/profileController");
const router = express.Router();

router.get("/public/:userId",    getPublicProfile);
router.get("/:userId",           getProfile);
router.patch("/:userId",         updateProfile);
router.patch("/:userId/picture", updateProfilePicture);
router.get("/:userId/comments",  getCommentHistory);

module.exports = router;
