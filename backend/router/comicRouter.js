const express = require("express");
const {
  getComics, getComic, createComic, deleteComic,
  updateComic, search, trackView, getCarousel, getGenres,
} = require("../controllers/comicController");
const { getArtistComics } = require("../controllers/savedArtistController");

const router = express.Router();

// Static routes first
router.get("/carousel",           getCarousel);
router.get("/genres",             getGenres);
router.get("/search/:query",      search);
router.get("/artist/:name",       getArtistComics);

// Collection
router.get("/",    getComics);
router.post("/",   createComic);

// Document
router.get("/:id",            getComic);
router.delete("/:id",         deleteComic);
router.patch("/:id",          updateComic);
router.patch("/:id/view",     trackView);   // renamed from /click

module.exports = router;
