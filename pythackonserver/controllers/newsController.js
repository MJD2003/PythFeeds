const { getCryptoNews, getStockNews } = require("../services/newsService");

/**
 * GET /api/news/crypto?symbols=BTC,ETH&limit=10
 */
async function crypto(req, res, next) {
  try {
    const symbols = req.query.symbols ? req.query.symbols.split(",") : [];
    const limit = parseInt(req.query.limit) || 10;
    const articles = await getCryptoNews(symbols, limit);
    res.json(articles);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/news/stock/:ticker?limit=10
 */
async function stock(req, res, next) {
  try {
    const { ticker } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const articles = await getStockNews(ticker, limit);
    res.json(articles);
  } catch (err) {
    next(err);
  }
}

module.exports = { crypto, stock };
