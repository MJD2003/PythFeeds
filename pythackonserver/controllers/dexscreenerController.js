const dexService = require("../services/dexscreenerService");

async function search(req, res, next) {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Missing query parameter 'q'" });
    const pairs = await dexService.searchPairs(q);
    res.json({ pairs });
  } catch (err) {
    next(err);
  }
}

async function tokenPairs(req, res, next) {
  try {
    const { chain, tokenAddress } = req.params;
    if (!chain || !tokenAddress) return res.status(400).json({ error: "Missing chain or tokenAddress" });
    const pairs = await dexService.getTokenPairs(chain, tokenAddress);
    res.json({ pairs });
  } catch (err) {
    next(err);
  }
}

async function trending(req, res, next) {
  try {
    const tokens = await dexService.getEnrichedTrending();
    res.json({ tokens });
  } catch (err) {
    next(err);
  }
}

async function topBoosted(req, res, next) {
  try {
    const tokens = await dexService.getTopBoosted();
    res.json({ tokens });
  } catch (err) {
    next(err);
  }
}

async function latestProfiles(req, res, next) {
  try {
    const profiles = await dexService.getEnrichedNewPairs();
    res.json({ profiles });
  } catch (err) {
    next(err);
  }
}

async function tokenPools(req, res, next) {
  try {
    const { chain, tokenAddress } = req.params;
    if (!chain || !tokenAddress) return res.status(400).json({ error: "Missing chain or tokenAddress" });
    const pairs = await dexService.getTokenPools(chain, tokenAddress);
    res.json({ pairs });
  } catch (err) {
    next(err);
  }
}

async function freshSolanaPairs(req, res, next) {
  try {
    const pairs = await dexService.getFreshSolanaPairs();
    res.json({ pairs });
  } catch (err) {
    next(err);
  }
}

async function gainersLosers(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const data = await dexService.getTopGainersLosers(limit);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { search, tokenPairs, trending, topBoosted, latestProfiles, tokenPools, freshSolanaPairs, gainersLosers };
