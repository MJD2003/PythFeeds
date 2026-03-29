const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/coinController");

router.get("/global", ctrl.global);
router.get("/trending", ctrl.trending);
router.get("/exchanges", ctrl.exchanges);
router.get("/exchanges/:exchangeId", ctrl.exchangeById);
router.get("/categories", ctrl.categories);
router.get("/stream/sse", ctrl.stream);
router.get("/fear-greed", ctrl.fearGreed);
router.get("/gas", ctrl.gas);
router.get("/simple-prices", ctrl.simplePrices);
router.get("/by-ids", ctrl.coinsByIds);
router.get("/new-listings", ctrl.newListings);
router.get("/movers", ctrl.marketMovers);
router.get("/meme-bubbles", ctrl.memeBubbles);
router.get("/", ctrl.list);
router.get("/:id/pyth-history", ctrl.pythHistory);
router.get("/:id/ohlc", ctrl.ohlc);
router.get("/:id/chart", ctrl.chart);
router.get("/:id", ctrl.detail);

module.exports = router;
