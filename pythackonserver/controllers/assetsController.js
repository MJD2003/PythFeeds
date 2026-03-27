const { HermesClient } = require("@pythnetwork/hermes-client");
const { cache, CACHE_TTL } = require("../config/cache");
const { getMetals, getFX, getUSEquities } = require("../services/feedDiscovery");

const HERMES_URL = process.env.PYTH_HERMES_URL || "https://hermes.pyth.network";
const PYTH_API_KEY = process.env.PYTH_API_KEY || "";
let hermesClient = null;
function getClient() {
  if (!hermesClient) {
    const opts = { timeout: 15000 };
    if (PYTH_API_KEY) opts.headers = { "x-api-key": PYTH_API_KEY };
    hermesClient = new HermesClient(HERMES_URL, opts);
  }
  return hermesClient;
}

const lastKnown = {};

// Reference prices for change calculation (approximate previous close)
const REFERENCE_PRICES = {
  // Metals (USD per troy oz / lb)
  XAU: 2650, XAG: 31.5, XPT: 1020, XPD: 1050, XCU: 4.2, XAL: 2500,
  // Commodities
  USOILSPOT: 70, UKOILSPOT: 74,
  // FX
  "EUR/USD": 1.08, "GBP/USD": 1.27, "USD/JPY": 148,
};

/**
 * Fetch prices for a dynamic feed map { SYMBOL: { id, name, ... } }
 * Returns array of asset objects with live prices
 */
async function fetchDynamicPrices(feedMap, assetClass) {
  const entries = Object.entries(feedMap);
  if (entries.length === 0) return [];

  const feedIds = entries.map(([, info]) => info.id);
  const feedToSymbol = {};
  for (const [sym, info] of entries) feedToSymbol[info.id] = sym;

  const hermes = getClient();
  const results = [];

  // Batch in chunks of 10
  for (let i = 0; i < feedIds.length; i += 10) {
    const chunk = feedIds.slice(i, i + 10);
    try {
      const response = await hermes.getLatestPriceUpdates(chunk);
      if (!response?.parsed) continue;
      for (const feed of response.parsed) {
        const parsed = feed.price;
        if (!parsed) continue;
        const expo = Number(parsed.expo);
        const price = Number(parsed.price) * Math.pow(10, expo);
        const confidence = Number(parsed.conf) * Math.pow(10, expo);
        const feedId = "0x" + feed.id;
        const sym = feedToSymbol[feedId];
        if (!sym) continue;
        const meta = feedMap[sym];
        // Only count as live if price is actually non-zero
        if (price > 0) {
          lastKnown[sym] = price;
        }
        const finalPrice = price > 0 ? price : (lastKnown[sym] || 0);
        const refPrice = REFERENCE_PRICES[sym] || 0;
        const change = refPrice > 0 ? Math.round(((finalPrice - refPrice) / refPrice) * 10000) / 100 : 0;
        results.push({
          ticker: sym,
          name: meta.name || sym,
          symbol: meta.displaySymbol || sym,
          price: finalPrice,
          change,
          confidence,
          publishTime: Number(parsed.publish_time),
          source: price > 0 ? "pyth" : (lastKnown[sym] ? "cached" : "no_data"),
          description: meta.name || "",
          assetClass,
          quoteCurrency: meta.quoteCurrency || "USD",
        });
      }
    } catch (err) {
      console.warn(`[Assets] Chunk failed for ${assetClass}:`, err.message?.slice(0, 80));
    }
  }

  // Add entries that didn't get a price (market closed) with cached/reference
  for (const [sym, meta] of entries) {
    if (results.find((r) => r.ticker === sym)) continue;
    const fallbackPrice = lastKnown[sym] || 0;
    const refPrice = REFERENCE_PRICES[sym] || 0;
    const change = refPrice > 0 && fallbackPrice > 0 ? Math.round(((fallbackPrice - refPrice) / refPrice) * 10000) / 100 : 0;
    results.push({
      ticker: sym,
      name: meta.name || sym,
      symbol: meta.displaySymbol || sym,
      price: fallbackPrice,
      change,
      confidence: 0,
      publishTime: 0,
      source: lastKnown[sym] ? "cached" : "unavailable",
      description: meta.name || "",
      assetClass,
      quoteCurrency: meta.quoteCurrency || "USD",
    });
  }

  return results.sort((a, b) => b.price - a.price); // sort by price desc
}

/** GET /api/assets/metals */
async function metals(req, res, next) {
  try {
    const cacheKey = "assets_metals_prices";
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const feedMap = await getMetals();
    const items = await fetchDynamicPrices(feedMap, "metal");
    if (items.length > 0) cache.set(cacheKey, items, 30);
    res.json(items);
  } catch (err) { next(err); }
}

/** GET /api/assets/commodities */
async function commodities(req, res, next) {
  try {
    // Commodities: use the hardcoded USOILSPOT/UKOILSPOT from pythService
    const { getPythPrices, COMMODITY_FEEDS } = require("../services/pythService");
    const symbols = Object.keys(COMMODITY_FEEDS);
    const pythPrices = await getPythPrices(symbols);

    const COMMODITY_META = {
      USOILSPOT: { name: "WTI Crude Oil", symbol: "USOILSPOT/USD", unit: "bbl" },
      UKOILSPOT: { name: "Brent Crude Oil", symbol: "UKOILSPOT/USD", unit: "bbl" },
    };

    const items = symbols.map((sym) => {
      const pyth = pythPrices[sym];
      const meta = COMMODITY_META[sym] || { name: sym, symbol: sym };
      const finalPrice = pyth?.price || lastKnown[sym] || 0;
      const refPrice = REFERENCE_PRICES[sym] || 0;
      const change = refPrice > 0 && finalPrice > 0 ? Math.round(((finalPrice - refPrice) / refPrice) * 10000) / 100 : 0;
      return {
        ticker: sym,
        name: meta.name,
        symbol: meta.symbol,
        price: finalPrice,
        change,
        confidence: pyth?.confidence || 0,
        publishTime: pyth?.publishTime || 0,
        source: pyth?.price > 0 ? "pyth" : lastKnown[sym] ? "cached" : "unavailable",
        description: meta.name,
        assetClass: "commodity",
        unit: meta.unit || "",
      };
    });
    res.json(items);
  } catch (err) { next(err); }
}

/** GET /api/assets/fx */
async function fx(req, res, next) {
  try {
    const cacheKey = "assets_fx_prices";
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const feedMap = await getFX();
    const items = await fetchDynamicPrices(feedMap, "fx");
    if (items.length > 0) cache.set(cacheKey, items, 30);
    res.json(items);
  } catch (err) { next(err); }
}

/** GET /api/assets/equities — dynamically discovered US equities */
async function equities(req, res, next) {
  try {
    const cacheKey = "assets_equities_prices";
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const feedMap = await getUSEquities();
    const items = await fetchDynamicPrices(feedMap, "equity");
    if (items.length > 0) cache.set(cacheKey, items, 30);
    res.json(items);
  } catch (err) { next(err); }
}

/** GET /api/assets/all */
async function all(req, res, next) {
  try {
    const [metalItems, fxItems] = await Promise.all([
      getMetals().then((m) => fetchDynamicPrices(m, "metal")),
      getFX().then((m) => fetchDynamicPrices(m, "fx")),
    ]);
    res.json({ metals: metalItems, fx: fxItems });
  } catch (err) { next(err); }
}

module.exports = { metals, commodities, fx, equities, all };
