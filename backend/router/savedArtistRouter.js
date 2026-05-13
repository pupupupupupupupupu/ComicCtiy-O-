const express = require("express");
const { getSavedArtists, saveArtist, unsaveArtist, getFollowStatus } = require("../controllers/savedArtistController");
const router = express.Router();

router.get("/status",   getFollowStatus);  // ?userId=&artistName=
router.get("/:userId",  getSavedArtists);
router.post("/",        saveArtist);
router.delete("/",      unsaveArtist);

module.exports = router;
