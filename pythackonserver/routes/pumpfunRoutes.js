const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/pumpfunController");

router.get("/latest", ctrl.latest);
router.get("/graduated", ctrl.graduated);
router.get("/trending", ctrl.trending);
router.get("/about-to-graduate", ctrl.aboutToGraduate);
router.get("/token/:mint", ctrl.tokenByMint);

module.exports = router;
