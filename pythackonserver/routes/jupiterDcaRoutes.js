const express = require("express");
const router = express.Router();
const dcaService = require("../services/jupiterDcaService");

// POST /api/jup/dca/create — create a DCA position (returns tx to sign)
router.post("/create", async (req, res, next) => {
  try {
    const data = await dcaService.createDca(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/jup/dca/positions/:wallet — active DCA positions
router.get("/positions/:wallet", async (req, res, next) => {
  try {
    const positions = await dcaService.getDcaPositions(req.params.wallet);
    res.json(positions);
  } catch (err) {
    next(err);
  }
});

// POST /api/jup/dca/close — close/withdraw a DCA (returns tx to sign)
router.post("/close", async (req, res, next) => {
  try {
    const { user, orderKey } = req.body;
    const data = await dcaService.closeDca(user, orderKey);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
