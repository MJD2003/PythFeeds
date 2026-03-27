const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/raydiumController");

router.get("/pools", ctrl.pools);
router.get("/new-pools", ctrl.newPools);
router.get("/launchlab", ctrl.launchlab);
router.get("/pools/mint/:mint", ctrl.poolsByMint);
router.get("/token/:mint", ctrl.tokenByMint);

module.exports = router;
