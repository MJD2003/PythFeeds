const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/portfolioController");

router.get("/snapshots", ctrl.listSnapshots);
router.post("/snapshot", ctrl.saveSnapshot);

module.exports = router;
