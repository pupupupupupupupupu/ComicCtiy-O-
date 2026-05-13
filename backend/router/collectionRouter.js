const express = require("express");
const { getCollections, createCollection, deleteCollection, toggleCollectionPrivacy } = require("../controllers/collectionController");
const router = express.Router();

router.get("/:userId",                    getCollections);
router.post("/",                          createCollection);
router.delete("/:collectionId",           deleteCollection);
router.patch("/:collectionId/privacy",    toggleCollectionPrivacy);

module.exports = router;
