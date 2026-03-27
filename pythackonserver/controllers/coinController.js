const coingecko = require("../services/coingeckoService");
const { getPythPrices, CRYPTO_FEEDS } = require("../services/pythService");
const axios = require("axios");
const { cache, CACHE_TTL } = require("../config/cache");

/**
 * GET /api/coins
 * Returns top coins with real-time Pyth price overlay on CoinGecko market data
 */
async function list(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 100;
    const currency = req.query.currency || "usd";
    const category = req.query.category || "";

    // Fetch CoinGecko market data
    const coins = await coingecko.getCoinsMarkets(page, perPage, currency, category);

    // Overlay Pyth real-time prices for supported coins
    const pythSymbols = Object.keys(CRYPTO_FEEDS);
    const pythPrices = await getPythPrices(pythSymbols);

    const enriched = coins.map((coin) => {
      const sym = coin.symbol.toUpperCase();
      const pyth = pythPrices[sym];
      if (pyth) {
        return {
          ...coin,
          current_price: pyth.price,
          pyth_price: pyth.price,
          pyth_confidence: pyth.confidence,
          pyth_publish_time: pyth.publishTime,
          price_source: "pyth",
        };
      }
      return { ...coin, price_source: "coingecko" };
    });

    res.json(enriched);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/coins/:id
 * Returns full coin detail with Pyth price overlay
 */
async function detail(req, res, next) {
  try {
    const { id } = req.params;
    const info = await coingecko.getCoinDetail(id);

    // Try Pyth overlay
    const sym = info.symbol?.toUpperCase();
    if (CRYPTO_FEEDS[sym]) {
      const pythPrices = await getPythPrices([sym]);
      const pyth = pythPrices[sym];
      if (pyth && info.market_data) {
        info.market_data.current_price.usd = pyth.price;
        info.pyth_price = pyth.price;
        info.pyth_confidence = pyth.confidence;
        info.pyth_publish_time = pyth.publishTime;
        info.price_source = "pyth";
      }
    }

    if (!info.price_source) info.price_source = "coingecko";

    res.json(info);
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({ error: true, message: "Coin not found" });
    }
    next(err);
  }
}

/**
 * GET /api/coins/:id/ohlc
 */
async function ohlc(req, res, next) {
  try {
    const { id } = req.params;
    const days = parseInt(req.query.days) || 7;
    const data = await coingecko.getOHLC(id, days);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/coins/:id/chart
 */
async function chart(req, res, next) {
  try {
    const { id } = req.params;
    const rawDays = req.query.days;
    const days = rawDays === "max" ? "max" : (parseInt(rawDays) || 7);
    const data = await coingecko.getMarketChart(id, days);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/coins/global
 */
async function global(req, res, next) {
  try {
    const data = await coingecko.getGlobal();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/coins/trending
 */
async function trending(req, res, next) {
  try {
    const data = await coingecko.getTrending();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/coins/stream/sse
 * Server-Sent Events — streams Pyth crypto prices every 5s
 */
const MAX_SSE_CLIENTS = 100;
let cryptoSseClients = [];
async function stream(req, res) {
  if (cryptoSseClients.length >= MAX_SSE_CLIENTS) {
    return res.status(503).json({ error: "Too many SSE connections" });
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write(":\n\n");

  cryptoSseClients.push(res);
  req.on("close", () => {
    cryptoSseClients = cryptoSseClients.filter((c) => c !== res);
  });
}

// Periodic cleanup of stale SSE connections
setInterval(() => {
  const before = cryptoSseClients.length;
  cryptoSseClients = cryptoSseClients.filter((client) => {
    try { client.write(":\n\n"); return true; } catch { return false; }
  });
  const removed = before - cryptoSseClients.length;
  if (removed > 0) console.log(`[CryptoSSE] Cleaned ${removed} stale clients`);
}, 30000);

setInterval(async () => {
  if (cryptoSseClients.length === 0) return;
  try {
    const symbols = Object.keys(CRYPTO_FEEDS);
    const pythPrices = await getPythPrices(symbols);
    const prices = symbols.map((sym) => {
      const p = pythPrices[sym];
      return {
        symbol: sym,
        price: p?.price || 0,
        confidence: p?.confidence || 0,
        publishTime: p?.publishTime || 0,
        source: p ? "pyth" : "unavailable",
      };
    }).filter((p) => p.price > 0);
    if (prices.length > 0) {
      const data = `data: ${JSON.stringify(prices)}\n\n`;
      cryptoSseClients.forEach((client) => {
        try { client.write(data); } catch { /* gone */ }
      });
    }
  } catch (err) {
    console.warn("[CryptoSSE] error:", err.message);
  }
}, 5000);

/**
 * GET /api/coins/fear-greed
 * Proxies the Fear & Greed Index from alternative.me (free, no key)
 */
async function fearGreed(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 1, 60);
    const cacheKey = `fear_greed_${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const { data } = await axios.get(`https://api.alternative.me/fng/?limit=${limit}&format=json`, { timeout: 5000 });
    const entries = (data?.data || []).map((d) => ({
      value: parseInt(d.value) || 50,
      classification: d.value_classification || "Neutral",
      timestamp: d.timestamp || String(Math.floor(Date.now() / 1000)),
    }));

    // If only 1 entry requested, return flat object for backwards compatibility
    if (limit === 1) {
      const result = entries[0] || { value: 50, classification: "Neutral", timestamp: String(Math.floor(Date.now() / 1000)) };
      cache.set(cacheKey, result, CACHE_TTL.GLOBAL);
      return res.json(result);
    }

    // Return full array for history requests
    cache.set(cacheKey, entries, CACHE_TTL.GLOBAL);
    res.json(entries);
  } catch (err) {
    const fallback = { value: 50, classification: "Neutral", timestamp: String(Math.floor(Date.now() / 1000)) };
    res.json(parseInt(req.query.limit) > 1 ? [fallback] : fallback);
  }
}

/**
 * GET /api/coins/exchanges
 */
async function exchanges(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 100;
    const data = await coingecko.getExchanges(page, perPage);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/coins/exchanges/:exchangeId
 */
async function exchangeById(req, res, next) {
  try {
    const id = req.params.exchangeId;
    const data = await coingecko.getExchangeById(id);
    if (!data || !data.name) {
      return res.status(404).json({ error: "Exchange not found" });
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/coins/categories
 */
async function categories(req, res, next) {
  try {
    const data = await coingecko.getCategories();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/coins/gas
 * Returns Solana priority fees + Ethereum gas from public APIs
 */
async function gas(req, res, next) {
  try {
    const cached = cache.get("gas_tracker");
    if (cached) return res.json(cached);

    // Fetch Ethereum gas from etherscan-style public API
    let ethGas = { low: 0, average: 0, high: 0 };
    try {
      const { data } = await axios.get("https://api.etherscan.io/api?module=gastracker&action=gasoracle", { timeout: 5000 });
      if (data?.result) {
        ethGas = {
          low: parseInt(data.result.SafeGasPrice) || 0,
          average: parseInt(data.result.ProposeGasPrice) || 0,
          high: parseInt(data.result.FastGasPrice) || 0,
        };
      }
    } catch {}

    // Solana: use recent priority fee from public RPC
    let solFee = { low: 0, medium: 0, high: 0 };
    try {
      const { data: rpcData } = await axios.post("https://api.mainnet-beta.solana.com", {
        jsonrpc: "2.0", id: 1,
        method: "getRecentPrioritizationFees",
        params: [],
      }, { timeout: 5000 });
      if (rpcData?.result?.length) {
        const fees = rpcData.result.map((f) => f.prioritizationFee).filter((f) => f > 0);
        if (fees.length) {
          fees.sort((a, b) => a - b);
          solFee = {
            low: fees[Math.floor(fees.length * 0.25)] || 0,
            medium: fees[Math.floor(fees.length * 0.5)] || 0,
            high: fees[Math.floor(fees.length * 0.75)] || 0,
          };
        }
      }
    } catch {}

    const result = { ethereum: ethGas, solana: solFee, timestamp: Date.now() };
    cache.set("gas_tracker", result, 30); // 30 second cache
    res.json(result);
  } catch (err) {
    res.json({ ethereum: { low: 0, average: 0, high: 0 }, solana: { low: 0, medium: 0, high: 0 }, timestamp: Date.now() });
  }
}

/**
 * GET /api/coins/simple-prices?ids=bitcoin,solana&currency=usd
 * Lightweight price lookup by CoinGecko IDs
 */
async function simplePrices(req, res, next) {
  try {
    const ids = (req.query.ids || "").split(",").filter(Boolean);
    if (!ids.length) return res.json({});
    const currency = req.query.currency || "usd";
    const data = await coingecko.getSimplePrices(ids, currency);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/coins/by-ids?ids=bitcoin,solana
 * Market data (price + image) for specific coin IDs
 */
async function coinsByIds(req, res, next) {
  try {
    const ids = (req.query.ids || "").split(",").filter(Boolean);
    if (!ids.length) return res.json([]);
    const currency = req.query.currency || "usd";
    const data = await coingecko.getCoinsByIds(ids, currency);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/coins/meme-bubbles
 * Aggregated meme coin data for bubble visualization
 */
async function memeBubbles(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 150);
    const memeBubbleService = require("../services/memeBubbleService");
    const tokens = await memeBubbleService.getMemeBubbles(limit);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/coins/:feedId/pyth-history
 * Fetch historical prices from Pyth Benchmarks API
 */
async function pythHistory(req, res, next) {
  try {
    const feedId = req.params.id;
    if (!feedId || feedId.length < 10) {
      return res.status(400).json({ error: "Invalid feed ID", received: feedId });
    }

    const now = Math.floor(Date.now() / 1000);
    const from = parseInt(req.query.from) || now - 86400;
    const to = parseInt(req.query.to) || now;
    const interval = Math.max(parseInt(req.query.interval) || 300, 60);

    const cacheKey = `pyth_history_${feedId}_${from}_${to}_${interval}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const BENCHMARKS = "https://benchmarks.pyth.network";
    const cleanId = feedId.replace(/^0x/, "");
    const points = [];
    const maxPoints = 300;
    let ts = from;
    let fetched = 0;
    let errors = 0;

    console.log(`[PythHistory] Fetching feed 0x${cleanId} from ${new Date(from * 1000).toISOString()} to ${new Date(to * 1000).toISOString()}, interval ${interval}s`);

    while (ts <= to && fetched < maxPoints && errors < 5) {
      try {
        const url = `${BENCHMARKS}/v1/updates/price/${ts}?ids[]=0x${cleanId}&parsed=true`;
        const resp = await axios.get(url, { timeout: 8000 });
        if (resp.data?.parsed?.length) {
          for (const feed of resp.data.parsed) {
            const p = feed.price || feed.ema_price;
            if (!p) continue;
            const expo = Number(p.expo);
            const price = Number(p.price) * Math.pow(10, expo);
            const confidence = Number(p.conf) * Math.pow(10, expo);
            points.push({
              time: Number(p.publish_time),
              price,
              confidence,
            });
          }
        }
      } catch (err) {
        errors++;
        if (errors === 1) console.warn(`[PythHistory] Benchmarks request failed at ts=${ts}:`, err.message?.slice(0, 100));
      }
      ts += interval;
      fetched++;
    }

    console.log(`[PythHistory] Got ${points.length} points (${fetched} requests, ${errors} errors)`);
    points.sort((a, b) => a.time - b.time);
    const result = { feedId: cleanId, from, to, interval, points };
    if (points.length > 0) cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, detail, ohlc, chart, global, trending, stream, fearGreed, exchanges, exchangeById, categories, gas, simplePrices, coinsByIds, memeBubbles, pythHistory };
