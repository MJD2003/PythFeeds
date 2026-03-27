const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/priceController");

router.get("/pyth", ctrl.pythPrices);
router.get("/feeds", ctrl.feeds);

module.exports = router;
