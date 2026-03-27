const aiService = require("../services/aiService");
const newsService = require("../services/newsService");
const cgService = require("../services/coingeckoService");

async function analyze(req, res, next) {
  try {
    const { symbol, name, price, change24h, change7d, marketCap, volume } = req.body;
    if (!symbol) return res.status(400).json({ error: "symbol is required" });

    // Fetch recent news (headlines + content) for context
    let newsItems = [];
    try {
      const news = await newsService.getCryptoNews([symbol.toUpperCase()], 10);
      newsItems = news.filter(n => n.title).slice(0, 8).map(n => ({
        title: n.title,
        content: n.content || "",
        source: n.source || "",
        timeAgo: n.timeAgo || "",
      }));
    } catch {}

    const analysis = await aiService.analyzeAsset({
      symbol: symbol.toUpperCase(),
      name: name || symbol,
      price: Number(price) || 0,
      change24h: Number(change24h) || 0,
      change7d: change7d !== undefined ? Number(change7d) : undefined,
      marketCap: marketCap ? Number(marketCap) : undefined,
      volume: volume ? Number(volume) : undefined,
      newsItems,
    });

    res.json({ analysis, symbol: symbol.toUpperCase() });
  } catch (err) {
    next(err);
  }
}

async function marketBrief(req, res, next) {
  try {
    let headlines = [];
    try {
      const news = await newsService.getCryptoNews([], 14);
      headlines = news.map((n) => n.title).filter(Boolean);
    } catch {}

    const brief = await aiService.getMarketBrief(headlines);
    res.json({ brief });
  } catch (err) {
    next(err);
  }
}

async function buildMarketContext(pageContext) {
  let marketContext = "";
  try {
    const dataService = require("../services/dataService");
    const { cache: ctxCache } = require("../config/cache");
    const [global, trending, topCoins, yields] = await Promise.allSettled([
      cgService.getGlobal(),
      cgService.getTrending(),
      cgService.getCoinsMarkets(1, 50),
      dataService.getYields(5).catch(() => []),
    ]);

    const globalVal = global.status === "fulfilled" ? global.value : null;
    const trendingVal = trending.status === "fulfilled" ? trending.value : null;
    const topCoinsVal = topCoins.status === "fulfilled" ? topCoins.value : [];
    const yieldsVal = yields.status === "fulfilled" ? yields.value : [];

    marketContext = `--- LIVE MARKET CONTEXT (${new Date().toISOString()}) ---\n`;

    const fgCached = ctxCache.get("fear_greed_1");
    if (fgCached) {
      marketContext += `- Fear & Greed Index: ${fgCached.value}/100 (${fgCached.classification})\n`;
    }

    if (globalVal?.data) {
      marketContext += `- Global Crypto Market Cap: $${(globalVal.data.total_market_cap?.usd / 1e9).toFixed(2)}B\n`;
      marketContext += `- 24h Volume: $${(globalVal.data.total_volume?.usd / 1e9).toFixed(2)}B\n`;
      marketContext += `- BTC Dominance: ${globalVal.data.market_cap_percentage?.btc?.toFixed(1)}%\n`;
    }
    if (trendingVal?.coins) {
      marketContext += `- Trending Coins: ${trendingVal.coins.slice(0, 5).map(c => c.item.name).join(", ")}\n`;
    }
    if (topCoinsVal && topCoinsVal.length) {
      const top10 = topCoinsVal.slice(0, 10);
      const gainers = [...topCoinsVal].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)).slice(0, 3);
      
      marketContext += `- Top 10 Coins by Market Cap:\n${top10.map(c => `  * ${c.symbol.toUpperCase()}: $${c.current_price} (24h: ${c.price_change_percentage_24h?.toFixed(2)}%)`).join("\n")}\n`;
      marketContext += `- Top Gainers (from top 50):\n${gainers.map(c => `  * ${c.symbol.toUpperCase()}: +${c.price_change_percentage_24h?.toFixed(2)}%`).join("\n")}\n`;
    }
    if (yieldsVal.length > 0) {
      marketContext += `- Top DeFi Yields: ${yieldsVal.slice(0, 3).map(y => `${y.project}: ${y.apy?.toFixed(1)}% APY`).join(", ")}\n`;
    }
  } catch (err) {
    console.error("[AI Controller] Failed to fetch market context:", err.message);
  }

  try {
    const HERMES = process.env.PYTH_HERMES_URL || "https://hermes.pyth.network";
    const PYTH_KEY = process.env.PYTH_API_KEY || "";
    const pythFeeds = {
      BTC: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
      ETH: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
      SOL: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    };
    const idsParam = Object.values(pythFeeds).map(id => `ids[]=0x${id}`).join("&");
    const fetchHeaders = {};
    if (PYTH_KEY) fetchHeaders["x-api-key"] = PYTH_KEY;
    const pythRes = await fetch(`${HERMES}/v2/updates/price/latest?${idsParam}`, { headers: fetchHeaders });
    if (pythRes.ok) {
      const pythData = await pythRes.json();
      if (pythData?.parsed?.length) {
        marketContext += `- Pyth Oracle Prices:\n`;
        for (const feed of pythData.parsed) {
          const p = feed.price;
          if (!p) continue;
          const expo = Number(p.expo);
          const price = Number(p.price) * Math.pow(10, expo);
          const conf = Number(p.conf) * Math.pow(10, expo);
          const confPct = price > 0 ? ((conf / price) * 100).toFixed(4) : "N/A";
          const sym = Object.entries(pythFeeds).find(([, id]) => id === feed.id)?.[0] || feed.id;
          marketContext += `  * ${sym}: $${price.toLocaleString()} (confidence: ±${confPct}%)\n`;
        }
      }
    }
  } catch {}

  if (pageContext && typeof pageContext === "object") {
    marketContext += `\n--- USER PAGE CONTEXT ---\n`;
    if (pageContext.page) marketContext += `- Current page: ${pageContext.page}\n`;
    if (pageContext.symbol) marketContext += `- Viewing asset: ${pageContext.symbol}\n`;
    if (pageContext.price) marketContext += `- Current price: $${pageContext.price}\n`;
    if (pageContext.change24h) marketContext += `- 24h change: ${pageContext.change24h}%\n`;
    if (pageContext.marketCap) marketContext += `- Market cap: $${pageContext.marketCap}\n`;
    if (pageContext.extra) marketContext += `- Extra: ${pageContext.extra}\n`;

    if (pageContext.page === "calendar") marketContext += `- Note: User is viewing the Economic Calendar page.\n`;
    if (pageContext.page === "heatmap") marketContext += `- Note: User is viewing the Market Heatmap.\n`;
    if (pageContext.page === "feeds") marketContext += `- Note: User is viewing Pyth Price Feeds.\n`;
    if (pageContext.symbol) marketContext += `- Note: User is viewing the ${pageContext.symbol} detail page.\n`;
  }

  return marketContext;
}

async function chat(req, res, next) {
  try {
    const { message, history, pageContext } = req.body;
    if (!message) return res.status(400).json({ error: "message is required" });

    const marketContext = await buildMarketContext(pageContext);
    const reply = await aiService.chat(message, history || [], marketContext);
    res.json({ reply });
  } catch (err) {
    next(err);
  }
}

async function summarizeNews(req, res, next) {
  try {
    const { title, content } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });

    const summary = await aiService.summarizeNews(title, content);
    res.json({ summary });
  } catch (err) {
    next(err);
  }
}

async function chatStream(req, res, next) {
  try {
    const { message, history, pageContext } = req.body;
    if (!message) return res.status(400).json({ error: "message is required" });

    const marketContext = await buildMarketContext(pageContext);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const stream = aiService.chatStream(message, history || [], marketContext);
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }
    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      next(err);
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
}

async function portfolioInsights(req, res, next) {
  try {
    const { holdings } = req.body;
    if (!holdings || !holdings.length) return res.status(400).json({ error: "holdings array is required" });
    const insights = await aiService.portfolioInsights(holdings);
    res.json({ insights });
  } catch (err) { next(err); }
}

async function correlationInsights(req, res, next) {
  try {
    const { pairs } = req.body;
    if (!pairs || !pairs.length) return res.status(400).json({ error: "pairs array is required" });
    const insights = await aiService.correlationInsights(pairs);
    res.json({ insights });
  } catch (err) { next(err); }
}

async function simplify(req, res, next) {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "text is required" });
    const simplified = await aiService.simplify(text);
    res.json({ simplified });
  } catch (err) { next(err); }
}

// In-memory digest history store (persists across requests, resets on server restart)
const digestHistory = new Map();

async function digest(req, res, next) {
  try {
    const today = new Date().toISOString().split("T")[0];
    // Support date query: GET /api/ai/digest?date=2025-03-14 or POST with { date }
    const requestedDate = req.query.date || req.body?.date || today;

    // If requesting a past date, check history
    if (requestedDate !== today && digestHistory.has(requestedDate)) {
      return res.json({ digest: digestHistory.get(requestedDate), date: requestedDate });
    }

    // If requesting today and already cached in history, return it
    if (requestedDate === today && digestHistory.has(today)) {
      return res.json({ digest: digestHistory.get(today), date: today });
    }

    // Only generate new digest for today (can't generate for past dates without data)
    if (requestedDate !== today) {
      return res.json({ digest: null, date: requestedDate, available: false });
    }

    let marketData = "";
    try {
      const dataService = require("../services/dataService");
      const [global, topCoins, trending, news, fgData, yields] = await Promise.allSettled([
        cgService.getGlobal(),
        cgService.getCoinsMarkets(1, 50),
        cgService.getTrending(),
        newsService.getCryptoNews([], 10),
        cgService.getSimplePrices(["bitcoin"], "usd").catch(() => null),
        dataService.getYields(10).catch(() => []),
      ]);

      const globalVal = global.status === "fulfilled" ? global.value : null;
      const topCoinsVal = topCoins.status === "fulfilled" ? topCoins.value : [];
      const trendingVal = trending.status === "fulfilled" ? trending.value : null;
      const newsVal = news.status === "fulfilled" ? news.value : [];
      const yieldsVal = yields.status === "fulfilled" ? yields.value : [];

      // Fear & Greed from cache
      const { cache: fgCache } = require("../config/cache");
      const fgCached = fgCache.get("fear_greed_1");
      if (fgCached) {
        marketData += `Fear & Greed Index: ${fgCached.value}/100 (${fgCached.classification})\n`;
      }

      if (globalVal?.data) {
        marketData += `Global Market Cap: $${(globalVal.data.total_market_cap?.usd / 1e9).toFixed(2)}B\n`;
        marketData += `24h Volume: $${(globalVal.data.total_volume?.usd / 1e9).toFixed(2)}B\n`;
        marketData += `BTC Dominance: ${globalVal.data.market_cap_percentage?.btc?.toFixed(1)}%\n\n`;
      }
      if (topCoinsVal && topCoinsVal.length) {
        const gainers = [...topCoinsVal].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)).slice(0, 5);
        const losers = [...topCoinsVal].sort((a, b) => (a.price_change_percentage_24h || 0) - (b.price_change_percentage_24h || 0)).slice(0, 5);
        marketData += `Top Gainers:\n${gainers.map(c => `  ${c.symbol.toUpperCase()}: ${c.price_change_percentage_24h?.toFixed(2)}%`).join("\n")}\n\n`;
        marketData += `Top Losers:\n${losers.map(c => `  ${c.symbol.toUpperCase()}: ${c.price_change_percentage_24h?.toFixed(2)}%`).join("\n")}\n\n`;
      }
      if (trendingVal?.coins) {
        marketData += `Trending: ${trendingVal.coins.slice(0, 5).map(c => c.item.name).join(", ")}\n\n`;
      }
      if (yieldsVal.length > 0) {
        marketData += `Top DeFi Yields:\n${yieldsVal.slice(0, 5).map(y => `  ${y.project} (${y.chain}): ${y.apy?.toFixed(1)}% APY, $${(y.tvl / 1e6).toFixed(1)}M TVL`).join("\n")}\n\n`;
      }
      if (newsVal && newsVal.length) {
        marketData += `Headlines:\n${newsVal.slice(0, 8).map(n => `- [${n.source || "News"}] ${n.title}`).join("\n")}\n`;
      }
    } catch {}

    const digestText = await aiService.generateDigest(marketData);

    // Store in history
    digestHistory.set(today, digestText);
    // Keep only last 7 days
    const keys = [...digestHistory.keys()].sort();
    while (keys.length > 7) {
      digestHistory.delete(keys.shift());
    }

    // Return available dates for navigation
    const availableDates = [...digestHistory.keys()].sort().reverse();
    res.json({ digest: digestText, date: today, availableDates });
  } catch (err) { next(err); }
}

async function digestDates(req, res) {
  const dates = [...digestHistory.keys()].sort().reverse();
  res.json({ dates });
}

async function classifySentiment(req, res, next) {
  try {
    const { headlines } = req.body;
    if (!headlines || !Array.isArray(headlines) || headlines.length === 0) {
      return res.status(400).json({ error: "headlines array is required" });
    }
    const results = await aiService.classifySentiment(headlines);
    res.json({ results });
  } catch (err) { next(err); }
}

async function mood(req, res) {
  // Fetch Fear & Greed via internal cache (same as /api/coins/fear-greed)
  let fgValue = 50, fgLabel = "Neutral", topGainer = "", topLoser = "";
  try {
    const { cache: fgCache } = require("../config/cache");
    const cached = fgCache.get("fear_greed_1");
    if (cached) {
      fgValue = cached.value || 50;
      fgLabel = cached.classification || "Neutral";
    } else {
      const axios = require("axios");
      const { data } = await axios.get("https://api.alternative.me/fng/?limit=1&format=json", { timeout: 3000 });
      fgValue = parseInt(data?.data?.[0]?.value) || 50;
      fgLabel = data?.data?.[0]?.value_classification || "Neutral";
    }
  } catch {}
  try {
    const topCoins = await cgService.getCoinsMarkets(1, 20);
    if (topCoins && topCoins.length) {
      const sorted = [...topCoins].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
      const gainer = sorted[0];
      const loser = sorted[sorted.length - 1];
      if (gainer) topGainer = `${gainer.symbol.toUpperCase()} +${gainer.price_change_percentage_24h?.toFixed(1)}%`;
      if (loser) topLoser = `${loser.symbol.toUpperCase()} ${loser.price_change_percentage_24h?.toFixed(1)}%`;
    }
  } catch {}

  const fallbacks = {
    "Extreme Fear": "Markets gripped by fear — caution prevails across the board.",
    "Fear": "Sentiment leans bearish — traders tread carefully.",
    "Neutral": "Markets holding steady — no strong conviction either way.",
    "Greed": "Optimism building — bullish energy across major assets.",
    "Extreme Greed": "Euphoria in full swing — markets riding high on confidence.",
  };

  let moodText = await aiService.getMarketMood(fgValue, fgLabel, topGainer, topLoser);
  if (!moodText) {
    moodText = fallbacks[fgLabel] || `Market sentiment: ${fgLabel} (${fgValue}/100).`;
  }
  res.json({ mood: moodText, fearGreed: { value: fgValue, label: fgLabel } });
}

module.exports = { analyze, marketBrief, chat, chatStream, summarizeNews, portfolioInsights, correlationInsights, simplify, digest, digestDates, classifySentiment, mood };
