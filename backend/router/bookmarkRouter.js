const express = require("express");
const { getBookmarks, addBookmark, removeBookmark, getBookmarkStatus } = require("../controllers/bookmarkController");
const router = express.Router();

router.get("/status",   getBookmarkStatus);  // ?userId=&comicId=
router.get("/:userId",  getBookmarks);
router.post("/",        addBookmark);
router.delete("/",      removeBookmark);

module.exports = router;
