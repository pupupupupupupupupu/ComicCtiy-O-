const express = require("express");
const { getChapters, getChapter, addChapter, deleteChapter } = require("../controllers/chapterController");

// Mounted at /api/comics/:comicId/chapters
const router = express.Router({ mergeParams: true });

router.get("/",                  getChapters);
router.post("/",                 addChapter);
router.get("/:chapterId",        getChapter);
router.delete("/:chapterId",     deleteChapter);

module.exports = router;
