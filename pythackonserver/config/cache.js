const NodeCache = require("node-cache");

// Primary cache — short TTLs for fresh data
const cache = new NodeCache({
  stdTTL: 30,
  checkperiod: 10,
});

// Stale cache — keeps old data for 2 hours as fallback when APIs are down / rate-limited
const staleCache = new NodeCache({
  stdTTL: 21600, // 6 hours
  checkperiod: 120,
});

// Named caches with different TTLs
const CACHE_TTL = {
  PYTH_PRICES: 10,        // 10s — real-time
  COIN_LIST: 300,         // 5 min
  COIN_DETAIL: 120,       // 2 min
  COIN_MARKETS: 180,      // 3 min — reduces CG rate-limit hits
  SEARCH: 300,            // 5 min
  NEWS: 300,              // 5 min
  GLOBAL: 180,            // 3 min
  TRENDING: 300,          // 5 min
  EXCHANGES: 600,         // 10 min
  OHLC: 600,              // 10 min
};

module.exports = { cache, staleCache, CACHE_TTL };
