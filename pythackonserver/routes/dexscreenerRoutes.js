const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/dexscreenerController");

router.get("/search", ctrl.search);
router.get("/trending", ctrl.trending);
router.get("/top-boosted", ctrl.topBoosted);
router.get("/new-pairs", ctrl.latestProfiles);
router.get("/pairs/:chain/:tokenAddress", ctrl.tokenPairs);
router.get("/pools/:chain/:tokenAddress", ctrl.tokenPools);
router.get("/fresh-solana-pairs", ctrl.freshSolanaPairs);
router.get("/gainers-losers", ctrl.gainersLosers);

module.exports = router;
