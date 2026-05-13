const express = require("express");
const { getHistory, upsertVisit } = require("../controllers/historyController");

const router = express.Router();

router.get("/:userId",  getHistory);
router.post("/",        upsertVisit);

module.exports = router;
