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

// Named caches with longer TTLs to minimize CoinGecko 429s.
// Live prices come from Pyth (10s), so CoinGecko data (mcap, volume, sparklines) can be staler.
const CACHE_TTL = {
  PYTH_PRICES: 10,        // 10s — real-time from Pyth
  COIN_LIST: 600,         // 10 min
  COIN_DETAIL: 600,       // 10 min — Pyth provides live price overlay
  COIN_MARKETS: 600,      // 10 min — main list, Pyth overlays live prices
  SEARCH: 600,            // 10 min
  NEWS: 600,              // 10 min
  GLOBAL: 600,            // 10 min
  TRENDING: 600,          // 10 min
  EXCHANGES: 1800,        // 30 min — rarely changes
  OHLC: 1800,             // 30 min — historical data
};

module.exports = { cache, staleCache, CACHE_TTL };
