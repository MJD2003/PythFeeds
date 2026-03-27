const express = require("express");
const router = express.Router();
const limitService = require("../services/jupiterLimitService");

// POST /api/jup/limit/create — create a limit order (returns tx to sign)
router.post("/create", async (req, res, next) => {
  try {
    const data = await limitService.createOrder(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/jup/limit/orders/:wallet — open orders
router.get("/orders/:wallet", async (req, res, next) => {
  try {
    const orders = await limitService.getOpenOrders(req.params.wallet);
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

// GET /api/jup/limit/history/:wallet — order history
router.get("/history/:wallet", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const data = await limitService.getOrderHistory(req.params.wallet, page);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/jup/limit/cancel — cancel orders (returns tx to sign)
router.post("/cancel", async (req, res, next) => {
  try {
    const { maker, orders } = req.body;
    const data = await limitService.cancelOrders(maker, orders);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
