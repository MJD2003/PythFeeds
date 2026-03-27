const pumpfunService = require("../services/pumpfunService");

async function latest(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const sort = req.query.sort || "creation_time";
    const tokens = await pumpfunService.getLatestTokens(limit, offset, sort);
    res.json({ tokens });
  } catch (err) {
    next(err);
  }
}

async function graduated(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const tokens = await pumpfunService.getGraduatedTokens(limit);
    res.json({ tokens });
  } catch (err) {
    next(err);
  }
}

async function tokenByMint(req, res, next) {
  try {
    const { mint } = req.params;
    if (!mint) return res.status(400).json({ error: "mint param required" });
    const token = await pumpfunService.getTokenByMint(mint);
    if (!token) return res.status(404).json({ error: "Token not found on Pump.fun" });
    res.json(token);
  } catch (err) {
    next(err);
  }
}

async function trending(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 60);
    const tokens = await pumpfunService.getTrendingTokens(limit);
    res.json({ tokens });
  } catch (err) {
    next(err);
  }
}

async function aboutToGraduate(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 60);
    const tokens = await pumpfunService.getAboutToGraduate(limit);
    res.json({ tokens });
  } catch (err) {
    next(err);
  }
}

module.exports = { latest, graduated, tokenByMint, trending, aboutToGraduate };
