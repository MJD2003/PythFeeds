const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/pollController");

router.get("/results", ctrl.results);
router.get("/batch-results", ctrl.batchResults);
router.post("/vote", ctrl.vote);

module.exports = router;
