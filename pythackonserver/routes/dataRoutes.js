const router = require("express").Router();
const ctrl = require("../controllers/dataController");

router.get("/protocols", ctrl.protocols);
router.get("/chains", ctrl.chainsTVL);
router.get("/tvl-history", ctrl.tvlHistory);
router.get("/stablecoins", ctrl.stablecoins);
router.get("/yields", ctrl.yields);
router.get("/bridges", ctrl.bridges);
router.get("/whales", ctrl.whaleAlerts);
router.get("/calendar", ctrl.economicCalendar);

module.exports = router;
