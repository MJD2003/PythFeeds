const coingecko = require("../services/coingeckoService");

/**
 * GET /api/search?q=bitcoin
 * Searches coins, exchanges via CoinGecko
 */
async function search(req, res, next) {
  try {
    const q = req.query.q || "";
    if (q.length < 2) {
      return res.json({ coins: [], exchanges: [] });
    }
    const data = await coingecko.search(q);
    res.json({
      coins: (data.coins || []).slice(0, 10),
      exchanges: (data.exchanges || []).slice(0, 5),
      categories: (data.categories || []).slice(0, 5),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { search };
