const axios = require("axios");
const { cache, staleCache, CACHE_TTL } = require("../config/cache");

const CG_FREE = "https://api.coingecko.com/api/v3";
const CG_PRO = "https://pro-api.coingecko.com/api/v3";

/** Read at use-time so the key is correct after dotenv loads (avoid frozen empty module state). */
function getCgKey() {
  return (process.env.COINGECKO_API_KEY || "").trim();
}

/** Pro host + `x-cg-pro-api-key`, or public API when no key */
function getBaseUrl() {
  const override = (process.env.COINGECKO_API_URL || "").trim();
  if (override) return override.replace(/\/$/, "");
  return getCgKey() ? CG_PRO : CG_FREE;
}

function cgHeaders() {
  const h = { Accept: "application/json" };
  const key = getCgKey();
  if (key) h["x-cg-pro-api-key"] = key;
  return h;
}

// Global throttle: free tier ~10/min; Pro allows much higher — tune with COINGECKO_MIN_GAP_MS
function getMinRequestGap() {
  const n = Number(process.env.COINGECKO_MIN_GAP_MS);
  if (n > 0) return n;
  return getCgKey() ? 120 : 2500;
}

let _cgBootLogged = false;
function logCgBootOnce() {
  if (_cgBootLogged) return;
  _cgBootLogged = true;
  const key = getCgKey();
  const base = getBaseUrl();
  const gap = getMinRequestGap();
  console.log(`[CoinGecko] ${key ? "Pro API" : "public API"} · base ${base} · min gap ${gap}ms`);
  if (!key) {
    console.log(
      "[CoinGecko] /coins/list/new is Pro-only — skipping that call; “New” tab uses small-cap markets fallback (set COINGECKO_API_KEY for true new listings)"
    );
  }
  if (!key && base.includes("pro-api.coingecko.com")) {
    console.warn(
      "[CoinGecko] Pro API URL is set but COINGECKO_API_KEY is empty — every request returns 401. Use server.js from pythackonserver/ or dotenv path fixed to load .env"
    );
  }
}
let lastRequestTime = 0;
const requestQueue = [];
let queueRunning = false;

async function runQueue() {
  if (queueRunning) return;
  queueRunning = true;
  while (requestQueue.length > 0) {
    const { resolve, reject, fn } = requestQueue.shift();
    const gap = getMinRequestGap();
    const elapsed = Date.now() - lastRequestTime;
    if (elapsed < gap) {
      await new Promise(r => setTimeout(r, gap - elapsed));
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
  // Pro-only new listings — [] so callers can fall back (never cache as {})
  if (url.includes("/coins/list/new")) return [];
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

/** Top coins by market cap with sparkline + % changes (optional `order`, e.g. market_cap_asc for small-cap / “new” fallback) */
async function getCoinsMarkets(page = 1, perPage = 100, currency = "usd", category = "", options = {}) {
  const order = options.order || "market_cap_desc";
  const params = {
    vs_currency: currency,
    order,
    per_page: perPage,
    page,
    sparkline: true,
    price_change_percentage: "1h,24h,7d",
  };
  if (category) params.category = category;
  const cacheKey = `cg_markets_${currency}_${page}_${perPage}_${category || "all"}_${order}`;
  return fetchWithCache(cacheKey, `${getBaseUrl()}/coins/markets`, CACHE_TTL.COIN_MARKETS, params);
}

/** Full coin detail by ID */
async function getCoinDetail(id) {
  return fetchWithCache(
    `cg_detail_${id}`,
    `${getBaseUrl()}/coins/${id}`,
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
    `${getBaseUrl()}/coins/${id}/ohlc`,
    CACHE_TTL.OHLC,
    { vs_currency: currency, days }
  );
}

/** Search coins, exchanges, categories */
async function search(query) {
  return fetchWithCache(
    `cg_search_${query.toLowerCase()}`,
    `${getBaseUrl()}/search`,
    CACHE_TTL.SEARCH,
    { query }
  );
}

/** Trending coins */
async function getTrending() {
  return fetchWithCache(
    "cg_trending",
    `${getBaseUrl()}/search/trending`,
    CACHE_TTL.TRENDING
  );
}

/** Global market data */
async function getGlobal() {
  return fetchWithCache(
    "cg_global",
    `${getBaseUrl()}/global`,
    CACHE_TTL.GLOBAL
  );
}

/** Exchange list */
async function getExchanges(page = 1, perPage = 100) {
  return fetchWithCache(
    `cg_exchanges_${page}_${perPage}`,
    `${getBaseUrl()}/exchanges`,
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
    `${getBaseUrl()}/exchanges/${encodeURIComponent(clean)}`,
    CACHE_TTL.EXCHANGES,
    {}
  );
}

/** Market chart (price history) */
async function getMarketChart(id, days = 7, currency = "usd") {
  return fetchWithCache(
    `cg_chart_${id}_${days}_${currency}`,
    `${getBaseUrl()}/coins/${id}/market_chart`,
    CACHE_TTL.OHLC,
    { vs_currency: currency, days }
  );
}

/** Coin categories with market data */
async function getCategories() {
  return fetchWithCache(
    "cg_categories",
    `${getBaseUrl()}/coins/categories`,
    CACHE_TTL.TRENDING,
    {}
  );
}

/** Simple prices by IDs (lightweight, no sparkline) */
async function getSimplePrices(ids, currency = "usd") {
  const sorted = ids.slice().sort().join(",");
  return fetchWithCache(
    `cg_simple_${sorted}_${currency}`,
    `${getBaseUrl()}/simple/price`,
    CACHE_TTL.COIN_MARKETS,
    { ids: sorted, vs_currencies: currency }
  );
}

/** Coins markets by specific IDs (for unlocks page: prices + images) */
async function getCoinsByIds(ids, currency = "usd", options = {}) {
  const { sparkline = false } = options;
  if (!ids.length) return [];
  const sorted = ids.slice().sort().join(",");
  const n = Math.min(ids.length, 250);
  const params = {
    vs_currency: currency,
    ids: sorted,
    sparkline,
    per_page: n,
    page: 1,
  };
  if (sparkline) params.price_change_percentage = "1h,24h,7d";
  return fetchWithCache(
    `cg_byids_${sorted}_${currency}_sp${sparkline ? 1 : 0}`,
    `${getBaseUrl()}/coins/markets`,
    CACHE_TTL.COIN_MARKETS,
    params
  );
}

/**
 * Pro-only: latest ~200 coins added on CoinGecko (see /coins/list/new).
 * Without COINGECKO_API_KEY we skip the HTTP call (free/public tier gets 401).
 */
async function getCoinsListNew() {
  if (!getCgKey()) return [];
  return fetchWithCache("cg_coins_list_new_v1", `${getBaseUrl()}/coins/list/new`, 120, {});
}

/**
 * Recently activated coins with full market rows, ordered by activated_at (newest first).
 */
async function getNewListingsMarkets(limit = 60) {
  let list;
  try {
    list = await getCoinsListNew();
  } catch (e) {
    console.warn("[CoinGecko] coins/list/new unavailable:", e.message);
    return null;
  }
  if (!Array.isArray(list) || list.length === 0) return null;
  const ordered = [...list].sort((a, b) => (b.activated_at || 0) - (a.activated_at || 0));
  const ids = ordered.slice(0, Math.min(limit, 120)).map((r) => r.id).filter(Boolean);
  if (!ids.length) return null;
  const markets = await getCoinsByIds(ids, "usd", { sparkline: true });
  const byId = new Map(markets.map((m) => [m.id, m]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

/** Top gainers/losers by 24h % among the top ~250 coins by market cap (widest sample CG allows per page). */
async function getMarketMovers(type = "gainers", limit = 50) {
  const coins = await getCoinsMarkets(1, 250, "usd", "");
  const pct = (c) =>
    c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? 0;
  const sorted = [...coins].sort((a, b) =>
    type === "losers" ? pct(a) - pct(b) : pct(b) - pct(a)
  );
  return sorted.slice(0, limit);
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
  getNewListingsMarkets,
  getMarketMovers,
};
