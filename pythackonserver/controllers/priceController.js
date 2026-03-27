const { getPythPrices, getAvailableFeeds } = require("../services/pythService");

/**
 * GET /api/prices/pyth?symbols=BTC,ETH,SOL
 * Returns real-time Pyth prices for specified symbols
 */
async function pythPrices(req, res, next) {
  try {
    const symbols = req.query.symbols ? req.query.symbols.split(",") : [];
    if (symbols.length === 0) {
      return res.status(400).json({ error: true, message: "Provide ?symbols=BTC,ETH" });
    }
    const prices = await getPythPrices(symbols);
    res.json(prices);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/prices/feeds
 * Returns all available Pyth feed symbols
 */
async function feeds(req, res) {
  res.json(getAvailableFeeds());
}

module.exports = { pythPrices, feeds };
