const axios = require("axios");
const { HermesClient } = require("@pythnetwork/hermes-client");
const { cache } = require("../config/cache");

const HERMES_URL = process.env.PYTH_HERMES_URL || "https://hermes.pyth.network";
const DISCOVERY_CACHE_TTL = 1800; // 30 minutes

let _hermes = null;
function hermes() {
  if (!_hermes) _hermes = new HermesClient(HERMES_URL);
  return _hermes;
}

/**
 * Fetch all price feeds of a given asset type from Pyth Hermes
 */
async function fetchFeedsByType(assetType) {
  const cacheKey = `hermes_feeds_${assetType}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await axios.get(`${HERMES_URL}/v2/price_feeds`, {
      params: { asset_type: assetType },
      timeout: 15000,
    });
    if (Array.isArray(data)) {
      cache.set(cacheKey, data, DISCOVERY_CACHE_TTL);
      return data;
    }
  } catch (err) {
    console.warn(`[FeedDiscovery] Failed to fetch ${assetType} feeds:`, err.message?.slice(0, 100));
  }
  return [];
}

/**
 * Filter feeds: no .PRE/.POST/.ON, no DEPRECATED
 */
function filterRegularHours(feeds) {
  return feeds.filter((f) => {
    const sym = f.attributes?.symbol || "";
    const desc = f.attributes?.description || "";
    if (desc.includes("DEPRECATED")) return false;
    if (sym.endsWith(".PRE") || sym.endsWith(".POST") || sym.endsWith(".ON")) return false;
    return true;
  });
}

/**
 * Build initial feed map from Hermes metadata
 */
function buildRawMap(feeds, { countryFilter, currencyFilter } = {}) {
  const filtered = filterRegularHours(feeds);
  const map = {};
  for (const f of filtered) {
    const attrs = f.attributes || {};
    if (countryFilter && attrs.country !== countryFilter) continue;
    if (currencyFilter && attrs.quote_currency !== currencyFilter) continue;
    const base = attrs.base || attrs.generic_symbol;
    if (!base || map[base]) continue;
    map[base] = {
      id: "0x" + f.id,
      name: attrs.description || base,
      displaySymbol: attrs.display_symbol || base,
      country: attrs.country || "",
      quoteCurrency: attrs.quote_currency || "USD",
    };
  }
  return map;
}

/**
 * Pre-validate a feed map by fetching latest prices and removing feeds with price=0.
 * This ensures we only return feeds that have active publishers.
 */
async function validateFeeds(feedMap) {
  const entries = Object.entries(feedMap);
  if (entries.length === 0) return feedMap;

  const feedIds = entries.map(([, info]) => info.id);
  const feedToSymbol = {};
  for (const [sym, info] of entries) feedToSymbol[info.id] = sym;

  const liveSymbols = new Set();

  // Batch check prices in chunks of 20
  for (let i = 0; i < feedIds.length; i += 20) {
    const chunk = feedIds.slice(i, i + 20);
    try {
      const response = await hermes().getLatestPriceUpdates(chunk);
      if (!response?.parsed) continue;
      for (const feed of response.parsed) {
        const parsed = feed.price;
        if (!parsed) continue;
        const price = Number(parsed.price) * Math.pow(10, Number(parsed.expo));
        if (price > 0) {
          const feedId = "0x" + feed.id;
          const sym = feedToSymbol[feedId];
          if (sym) liveSymbols.add(sym);
        }
      }
    } catch (err) {
      // If a chunk fails, include those feeds anyway (might be temporary)
      for (const fid of chunk) {
        const sym = feedToSymbol[fid];
        if (sym) liveSymbols.add(sym);
      }
    }
  }

  // Filter map to only live feeds
  const validated = {};
  for (const sym of liveSymbols) {
    if (feedMap[sym]) validated[sym] = feedMap[sym];
  }

  console.log(`[FeedDiscovery] Validated ${Object.keys(validated).length}/${entries.length} feeds with live data`);
  return validated;
}

/**
 * Get all discovered US equity feeds (cached, pre-validated)
 */
async function getUSEquities() {
  const cacheKey = "discovered_us_equities_v2";
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const feeds = await fetchFeedsByType("equity");
  const raw = buildRawMap(feeds, { countryFilter: "US", currencyFilter: "USD" });
  const validated = await validateFeeds(raw);
  cache.set(cacheKey, validated, DISCOVERY_CACHE_TTL);
  console.log(`[FeedDiscovery] ${Object.keys(validated).length} US equities with live data`);
  return validated;
}

/**
 * Get all discovered metal feeds (cached, pre-validated)
 */
async function getMetals() {
  const cacheKey = "discovered_metals_v2";
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const feeds = await fetchFeedsByType("metal");
  const raw = buildRawMap(feeds);
  const validated = await validateFeeds(raw);
  cache.set(cacheKey, validated, DISCOVERY_CACHE_TTL);
  console.log(`[FeedDiscovery] ${Object.keys(validated).length} metals with live data`);
  return validated;
}

/**
 * Get all discovered FX feeds (cached, pre-validated)
 */
async function getFX() {
  const cacheKey = "discovered_fx_v2";
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const feeds = await fetchFeedsByType("fx");
  const raw = buildRawMap(feeds);
  const validated = await validateFeeds(raw);
  cache.set(cacheKey, validated, DISCOVERY_CACHE_TTL);
  console.log(`[FeedDiscovery] ${Object.keys(validated).length} FX pairs with live data`);
  return validated;
}

module.exports = { getUSEquities, getMetals, getFX, fetchFeedsByType, buildRawMap, filterRegularHours, validateFeeds };
