const raydiumService = require("../services/raydiumService");

async function pools(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize) || 50, 100);
    const sortBy = req.query.sortBy || "volume24h";
    const sortOrder = req.query.sortOrder || "desc";
    const data = await raydiumService.getPools(page, pageSize, sortBy, sortOrder);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function newPools(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const pools = await raydiumService.getNewPools(limit);
    res.json({ pools });
  } catch (err) {
    next(err);
  }
}

async function poolsByMint(req, res, next) {
  try {
    const { mint } = req.params;
    if (!mint) return res.status(400).json({ error: "mint param required" });
    const pools = await raydiumService.getPoolsByMint(mint);
    res.json({ pools });
  } catch (err) {
    next(err);
  }
}

async function tokenByMint(req, res, next) {
  try {
    const { mint } = req.params;
    if (!mint) return res.status(400).json({ error: "mint param required" });
    const token = await raydiumService.getTokenByMint(mint);
    if (!token) return res.status(404).json({ error: "Token not found" });
    res.json(token);
  } catch (err) {
    next(err);
  }
}

async function launchlab(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const tokens = await raydiumService.getLaunchLabTokens(limit);
    res.json({ tokens });
  } catch (err) {
    next(err);
  }
}

module.exports = { pools, newPools, poolsByMint, tokenByMint, launchlab };
