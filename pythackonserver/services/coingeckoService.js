const axios = require("axios");
const { cache, staleCache, CACHE_TTL } = require("../config/cache");

const CG_KEY = (process.env.COINGECKO_API_KEY || "").trim();
const CG_FREE = "https://api.coingecko.com/api/v3";
const CG_PRO = "https://pro-api.coingecko.com/api/v3";

/** Pro keys use pro-api host + x-cg-pro-api-key; free/demo uses public api host. */
const BASE_URL = process.env.COINGECKO_API_URL || (CG_KEY ? CG_PRO : CG_FREE);

function cgHeaders() {
  const h = { Accept: "application/json" };
  if (CG_KEY) h["x-cg-pro-api-key"] = CG_KEY;
  return h;
}

// Global throttle: free tier ~10/min; Pro allows much higher — tune with COINGECKO_MIN_GAP_MS
const MIN_REQUEST_GAP =
  Number(process.env.COINGECKO_MIN_GAP_MS) > 0
    ? Number(process.env.COINGECKO_MIN_GAP_MS)
    : CG_KEY
      ? 120
      : 2500;

let _cgBootLogged = false;
function logCgBootOnce() {
  if (_cgBootLogged) return;
  _cgBootLogged = true;
  console.log(`[CoinGecko] ${CG_KEY ? "Pro API" : "public API"} · base ${BASE_URL} · min gap ${MIN_REQUEST_GAP}ms`);
}
let lastRequestTime = 0;
const requestQueue = [];
let queueRunning = false;

async function runQueue() {
  if (queueRunning) return;
  queueRunning = true;
  while (requestQueue.length > 0) {
    const { resolve, reject, fn } = requestQueue.shift();
    const elapsed = Date.now() - lastRequestTime;
    if (elapsed < MIN_REQUEST_GAP) {
      await new Promise(r => setTimeout(r, MIN_REQUEST_GAP - elapsed));
    }
    try {
      lastRequestTime = Date.now();
      resolve(await fn());
    } catch (err) {
      reject(err);
    }
  }
  queueRunning = false;
}

function enqueue(fn) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ resolve, reject, fn });
    runQueue();
  });
}

// In-flight request deduplication — prevents concurrent identical requests
const inFlight = new Map();

async function fetchWithCache(key, url, ttl, params = {}) {
  logCgBootOnce();
  // 1. Fresh cache hit
  const cached = cache.get(key);
  if (cached) return cached;

  // 1.5 Deduplicate: if an identical request is already in-flight, wait for it
  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const promise = _fetchWithCacheInner(key, url, ttl, params);
  inFlight.set(key, promise);
  try {
    const result = await promise;
    return result;
  } finally {
    inFlight.delete(key);
  }
}

async function _fetchWithCacheInner(key, url, ttl, params) {
  // 2. Try network via throttled queue with retry
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data } = await enqueue(() =>
        axios.get(url, { params, headers: cgHeaders(), timeout: 15000 })
      );
      cache.set(key, data, ttl);
      staleCache.set(key, data);
      return data;
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      if (status === 429) {
        const wait = Math.min(3000 * Math.pow(2, attempt), 15000);
        console.warn(`[CoinGecko] 429 rate-limited on ${key}, waiting ${wait}ms (attempt ${attempt + 1})`);
        await new Promise((r) => setTimeout(r, wait));
      } else if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }

  // 3. Fallback to stale cache if network fails
  const stale = staleCache.get(key);
  if (stale) {
    console.warn(`[CoinGecko] Serving stale cache for ${key}`);
    stale.__stale = true;
    return stale;
  }

  // 4. Return empty data instead of crashing with 500 -- pages handle empty arrays gracefully
  const status = lastErr?.response?.status;
  console.error(`[CoinGecko] All retries failed for ${key} (last status: ${status || "network error"}), returning empty data`);
  // Single exchange detail: /exchanges/{id} — must be {} not []
  if (url.includes("/exchanges/")) return {};
  return url.includes("/coins/markets") || url.includes("/exchanges") || url.includes("/coins/categories")
    ? []
    : url.includes("/search")
    ? { coins: [], exchanges: [], categories: [] }
    : url.includes("/search/trending")
    ? { coins: [] }
    : url.includes("/global")
    ? { data: {} }
    : {};
}

/** Top coins by market cap with sparkline + % changes */
async function getCoinsMarkets(page = 1, perPage = 100, currency = "usd", category = "") {
  const params = {
    vs_currency: currency,
    order: "market_cap_desc",
    per_page: perPage,
    page,
    sparkline: true,
    price_change_percentage: "1h,24h,7d",
  };
  if (category) params.category = category;
  const cacheKey = `cg_markets_${currency}_${page}_${perPage}_${category || "all"}`;
  return fetchWithCache(cacheKey, `${BASE_URL}/coins/markets`, CACHE_TTL.COIN_MARKETS, params);
}

/** Full coin detail by ID */
async function getCoinDetail(id) {
  return fetchWithCache(
    `cg_detail_${id}`,
    `${BASE_URL}/coins/${id}`,
    CACHE_TTL.COIN_DETAIL,
    {
      localization: false,
      tickers: true,
      market_data: true,
      community_data: true,
      developer_data: false,
      sparkline: true,
    }
  );
}

/** OHLC data for charts */
async function getOHLC(id, days = 7, currency = "usd") {
  return fetchWithCache(
    `cg_ohlc_${id}_${days}_${currency}`,
    `${BASE_URL}/coins/${id}/ohlc`,
    CACHE_TTL.OHLC,
    { vs_currency: currency, days }
  );
}

/** Search coins, exchanges, categories */
async function search(query) {
  return fetchWithCache(
    `cg_search_${query.toLowerCase()}`,
    `${BASE_URL}/search`,
    CACHE_TTL.SEARCH,
    { query }
  );
}

/** Trending coins */
async function getTrending() {
  return fetchWithCache(
    "cg_trending",
    `${BASE_URL}/search/trending`,
    CACHE_TTL.TRENDING
  );
}

/** Global market data */
async function getGlobal() {
  return fetchWithCache(
    "cg_global",
    `${BASE_URL}/global`,
    CACHE_TTL.GLOBAL
  );
}

/** Exchange list */
async function getExchanges(page = 1, perPage = 100) {
  return fetchWithCache(
    `cg_exchanges_${page}_${perPage}`,
    `${BASE_URL}/exchanges`,
    CACHE_TTL.EXCHANGES,
    { per_page: perPage, page }
  );
}

/** Single exchange by id (e.g. binance) */
async function getExchangeById(id) {
  const clean = String(id || "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!clean) return {};
  return fetchWithCache(
    `cg_exchange_${clean}`,
    `${BASE_URL}/exchanges/${encodeURIComponent(clean)}`,
    CACHE_TTL.EXCHANGES,
    {}
  );
}

/** Market chart (price history) */
async function getMarketChart(id, days = 7, currency = "usd") {
  return fetchWithCache(
    `cg_chart_${id}_${days}_${currency}`,
    `${BASE_URL}/coins/${id}/market_chart`,
    CACHE_TTL.OHLC,
    { vs_currency: currency, days }
  );
}

/** Coin categories with market data */
async function getCategories() {
  return fetchWithCache(
    "cg_categories",
    `${BASE_URL}/coins/categories`,
    CACHE_TTL.TRENDING,
    {}
  );
}

/** Simple prices by IDs (lightweight, no sparkline) */
async function getSimplePrices(ids, currency = "usd") {
  const sorted = ids.slice().sort().join(",");
  return fetchWithCache(
    `cg_simple_${sorted}_${currency}`,
    `${BASE_URL}/simple/price`,
    CACHE_TTL.COIN_MARKETS,
    { ids: sorted, vs_currencies: currency }
  );
}

/** Coins markets by specific IDs (for unlocks page: prices + images) */
async function getCoinsByIds(ids, currency = "usd") {
  const sorted = ids.slice().sort().join(",");
  return fetchWithCache(
    `cg_byids_${sorted}_${currency}`,
    `${BASE_URL}/coins/markets`,
    CACHE_TTL.COIN_MARKETS,
    { vs_currency: currency, ids: sorted, sparkline: false, per_page: ids.length, page: 1 }
  );
}

module.exports = {
  getCoinsMarkets,
  getCoinDetail,
  getOHLC,
  search,
  getTrending,
  getGlobal,
  getExchanges,
  getExchangeById,
  getMarketChart,
  getCategories,
  getSimplePrices,
  getCoinsByIds,
};
