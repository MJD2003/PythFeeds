const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/jupiterController");

router.get("/trending", ctrl.trending);
router.get("/verified", ctrl.verified);
router.get("/prices", ctrl.prices);
router.get("/search", ctrl.search);
router.get("/token/:mint", ctrl.tokenByMint);

module.exports = router;
