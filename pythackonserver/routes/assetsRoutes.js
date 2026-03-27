const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/assetsController");

router.get("/equities", ctrl.equities);
router.get("/metals", ctrl.metals);
router.get("/commodities", ctrl.commodities);
router.get("/fx", ctrl.fx);
router.get("/all", ctrl.all);

module.exports = router;
