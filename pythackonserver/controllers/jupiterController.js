const jupiterService = require("../services/jupiterService");

async function trending(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const tokens = await jupiterService.getTrendingTokens(limit);
    res.json({ tokens });
  } catch (err) {
    next(err);
  }
}

async function verified(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const tokens = await jupiterService.getVerifiedTokens(limit);
    res.json({ tokens });
  } catch (err) {
    next(err);
  }
}

async function prices(req, res, next) {
  try {
    const ids = req.query.ids;
    if (!ids) return res.status(400).json({ error: "ids query param required" });
    const mints = ids.split(",").slice(0, 100);
    const data = await jupiterService.getPrices(mints);
    res.json({ prices: data });
  } catch (err) {
    next(err);
  }
}

async function tokenByMint(req, res, next) {
  try {
    const { mint } = req.params;
    if (!mint) return res.status(400).json({ error: "mint param required" });
    const token = await jupiterService.getTokenByMint(mint);
    if (!token) return res.status(404).json({ error: "Token not found" });
    res.json(token);
  } catch (err) {
    next(err);
  }
}

async function search(req, res, next) {
  try {
    const q = req.query.q || "";
    const limit = parseInt(req.query.limit) || 20;
    if (!q || q.length < 2) return res.json({ tokens: [] });
    const tokens = await jupiterService.searchTokens(q, limit);
    res.json({ tokens });
  } catch (err) {
    next(err);
  }
}

module.exports = { trending, verified, prices, tokenByMint, search };
