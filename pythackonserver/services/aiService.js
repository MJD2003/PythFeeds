const { GoogleGenerativeAI } = require("@google/generative-ai");
const { cache } = require("../config/cache");

const AI_TTL = 30 * 60; // 30 minutes
const ANALYSIS_TTL_HOURS = 2; // asset analyses cached for 2h
const DIGEST_TTL_HOURS = 4; // digest cached for 4h

// ── Gemini circuit breaker ──
const DEFAULT_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes
let geminiBackoffUntil = 0;
/** When true the free-tier daily quota is fully exhausted — stop retrying until midnight UTC. */
let geminiDailyLockout = false;
let geminiDailyLockoutUntil = 0;

/** Check env var to completely disable AI without removing the key. */
function isGeminiDisabledByConfig() {
  const flag = (process.env.GEMINI_ENABLED ?? "").trim().toLowerCase();
  return flag === "false" || flag === "0";
}

function isGeminiInBackoff() {
  if (isGeminiDisabledByConfig()) return true;
  if (geminiDailyLockout && Date.now() < geminiDailyLockoutUntil) return true;
  if (geminiDailyLockout && Date.now() >= geminiDailyLockoutUntil) {
    geminiDailyLockout = false; // reset at midnight
    console.log("[AI] Daily lockout expired — Gemini re-enabled");
  }
  return Date.now() < geminiBackoffUntil;
}

function getGeminiBackoffRemaining() {
  if (isGeminiDisabledByConfig()) return Infinity;
  if (geminiDailyLockout) {
    const rem = geminiDailyLockoutUntil - Date.now();
    return rem > 0 ? Math.ceil(rem / 1000) : 0;
  }
  const remaining = geminiBackoffUntil - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

/**
 * Activate Gemini backoff. Parses retryDelay from the error if available,
 * otherwise uses DEFAULT_BACKOFF_MS.
 * When the free-tier quota is fully exhausted (limit: 0) we lock out until
 * midnight UTC to avoid thousands of pointless 429 retries.
 */
function activateGeminiBackoff(err) {
  let delayMs = DEFAULT_BACKOFF_MS;
  const msg = err?.message || "";
  // Parse retryDelay from Gemini 429 response (e.g. '"retryDelay":"43s"')
  const match = msg.match(/retryDelay[":]\s*["](\d+)s?"/i) || msg.match(/retry in ([\d.]+)s/i);
  if (match) {
    const parsed = Math.ceil(parseFloat(match[1]));
    if (parsed > 0) delayMs = Math.max(parsed * 1000, 60000); // at least 60s
  }
  // If daily quota is fully exhausted (limit: 0), lock out until midnight UTC
  if (msg.includes("limit: 0")) {
    const now = new Date();
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    geminiDailyLockout = true;
    geminiDailyLockoutUntil = midnight.getTime();
    const hoursLeft = ((midnight - now) / 3600000).toFixed(1);
    console.warn(`[AI] Gemini daily quota EXHAUSTED (limit: 0) — locked out until midnight UTC (~${hoursLeft}h)`);
    return;
  }
  geminiBackoffUntil = Date.now() + delayMs;
  console.warn(`[AI] Gemini circuit breaker OPEN — cooling down for ${Math.ceil(delayMs / 1000)}s`);
}

function isGeminiRateLimitError(err) {
  const msg = err?.message || "";
  return msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests") || msg.includes("rate limit");
}

// ── DB-backed AI cache (shared across all users) ──
async function getAiCache(key) {
  try {
    const { getPool } = require("../config/database");
    const pool = getPool();
    const [rows] = await pool.execute(
      "SELECT content FROM ai_cache WHERE cache_key = ? AND expires_at > NOW() LIMIT 1",
      [key]
    );
    return rows.length > 0 ? rows[0].content : null;
  } catch { return null; }
}

async function setAiCache(key, content, ttlHours) {
  try {
    const { getPool } = require("../config/database");
    const pool = getPool();
    await pool.execute(
      `INSERT INTO ai_cache (cache_key, content, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))
       ON DUPLICATE KEY UPDATE content = VALUES(content), expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR)`,
      [key, content, ttlHours, ttlHours]
    );
  } catch {}
}

let genAI = null;
let model = null;
let cachedModelId = null;

/** Default works with Google AI Studio keys; override with GEMINI_MODEL if needed. */
function getGeminiModelId() {
  return (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
}

function getModel() {
  if (!process.env.GEMINI_API_KEY || !String(process.env.GEMINI_API_KEY).trim()) {
    const e = new Error("GEMINI_API_KEY is not configured on the server");
    e.status = 503;
    throw e;
  }
  const id = getGeminiModelId();
  if (!model || cachedModelId !== id) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
    model = genAI.getGenerativeModel({ model: id });
    cachedModelId = id;
  }
  return model;
}

/**
 * Gemini SDK: response.text() throws when content is blocked, empty, or malformed.
 * Assemble text from candidates when possible.
 */
function safeTextFromGenerateResult(result) {
  const res = result?.response;
  if (!res) throw new Error("Empty model response");
  try {
    const t = res.text();
    if (typeof t === "string" && t.trim()) return t.trim();
  } catch (e) {
    const cand = res.candidates?.[0];
    const parts = cand?.content?.parts;
    if (parts?.length) {
      const joined = parts.map((p) => p.text || "").join("").trim();
      if (joined) return joined;
    }
    const reason = cand?.finishReason || cand?.finish_reason || "unknown";
    console.error("[AI] response.text() failed:", e.message, "finishReason:", reason);
    throw new Error(`AI response blocked or empty (${reason})`);
  }
  throw new Error("AI returned no text");
}

/**
 * Explain why an asset is up or down
 */
async function analyzeAsset({ symbol, name, price, change24h, change7d, marketCap, volume, newsItems = [] }) {
  const dbKey = `analysis_${symbol.toLowerCase()}`;
  
  // 1. Check in-memory cache first
  const memKey = `ai_analyze_${symbol.toLowerCase()}`;
  const memCached = cache.get(memKey);
  if (memCached) return memCached;

  // 2. Check DB cache (shared across all users)
  const dbCached = await getAiCache(dbKey);
  if (dbCached) {
    cache.set(memKey, dbCached, AI_TTL);
    return dbCached;
  }

  const direction = change24h >= 0 ? "up" : "down";
  const absChange = Math.abs(change24h).toFixed(2);
  const mcap = marketCap ? `$${(marketCap / 1e9).toFixed(2)}B market cap` : "";
  const vol = volume ? `$${(volume / 1e9).toFixed(2)}B 24h volume` : "";
  const week = change7d !== undefined ? `7d: ${change7d >= 0 ? "+" : ""}${Number(change7d).toFixed(2)}%` : "";

  const newsBlock = newsItems.length
    ? newsItems.slice(0, 6).map((n, i) => {
        let entry = `${i + 1}. [${n.source || "News"}] ${n.title}`;
        if (n.content) entry += `\n   Snippet: ${n.content.substring(0, 200)}`;
        if (n.timeAgo) entry += ` (${n.timeAgo})`;
        return entry;
      }).join("\n")
    : "No recent headlines available.";

  const prompt = `You are a senior financial market analyst writing for PythFeeds, a real-time market data platform powered by Pyth Network oracles. Analyze why ${name || symbol} (${symbol}) is ${direction} ${absChange}% in the last 24 hours.

Market data:
- Current price: $${Number(price).toLocaleString()}
- 24h change: ${change24h >= 0 ? "+" : ""}${absChange}%
${week ? `- ${week}` : ""}
${mcap ? `- ${mcap}` : ""}
${vol ? `- ${vol}` : ""}

Recent news articles:
${newsBlock}

Instructions:
1. Write a clear, structured analysis in 4-5 sentences explaining the most likely reasons for this price movement.
2. Reference SPECIFIC news articles by citing the source name in brackets, e.g. [CoinDesk], [Bloomberg]. This is critical for trust.
3. If any geopolitical events, regulatory changes, or macroeconomic factors (interest rates, inflation, tariffs, elections, wars) are mentioned in the news and are affecting this asset, include them with the source citation.
4. Only mention geopolitical or macro factors if the news above references them — do NOT speculate or invent context.
5. End with one sentence about key support/resistance levels to watch based on the price data.
6. Do NOT give financial advice or buy/sell recommendations. Be factual and neutral.
7. After your analysis, add a "**Sources:**" section listing the news articles you referenced, formatted as: "- [Source] Title".`;

  try {
    if (isGeminiInBackoff()) throw new Error(`AI rate-limited — retry in ${getGeminiBackoffRemaining()}s`);
    const m = getModel();
    const result = await m.generateContent(prompt);
    const text = safeTextFromGenerateResult(result);
    cache.set(memKey, text, AI_TTL);
    // Persist to DB so other users get the same result
    await setAiCache(dbKey, text, ANALYSIS_TTL_HOURS);
    return text;
  } catch (err) {
    if (isGeminiRateLimitError(err)) activateGeminiBackoff(err);
    console.error("[AI] analyzeAsset error:", err.message);
    throw new Error("AI analysis temporarily unavailable");
  }
}

/**
 * Generate a brief market summary from headlines
 */
async function getMarketBrief(headlines = []) {
  const key = `ai_market_brief_${Math.floor(Date.now() / (AI_TTL * 1000))}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const headlineBlock = headlines.length
    ? headlines.slice(0, 12).map((h, i) => `${i + 1}. ${h}`).join("\n")
    : "No headlines available.";

  const prompt = `You are a crypto market analyst. Based on these recent news headlines, write a 3-sentence market brief summarizing the current state of the crypto market. Be factual, neutral, and concise. Do not give financial advice.

Headlines:
${headlineBlock}`;

  try {
    if (isGeminiInBackoff()) throw new Error(`AI rate-limited — retry in ${getGeminiBackoffRemaining()}s`);
    const m = getModel();
    const result = await m.generateContent(prompt);
    const text = safeTextFromGenerateResult(result);
    cache.set(key, text, AI_TTL);
    return text;
  } catch (err) {
    if (isGeminiRateLimitError(err)) activateGeminiBackoff(err);
    console.error("[AI] marketBrief error:", err.message);
    throw new Error("Market brief temporarily unavailable");
  }
}

/**
 * Generic AI Chatbot for platform queries
 */
const PYTHFEEDS_KNOWLEDGE_BASE = `
--- PYTHFEEDS PLATFORM KNOWLEDGE BASE ---

About PythFeeds:
PythFeeds is a real-time market data platform powered by Pyth Network oracles. It aggregates live prices, analytics, and news for crypto, stocks, forex, and commodities. Users can track portfolios, set price alerts, view correlation matrices, compare assets, explore DeFi yields, read AI-powered market digests, and swap tokens.

About Pyth Network:
Pyth Network is a first-party oracle network that publishes financial market data on-chain. Unlike traditional oracles that rely on third-party data aggregators, Pyth sources data directly from exchanges, market makers, and trading firms. This gives sub-second update latency and high-fidelity pricing.

Understanding Pyth Confidence Intervals:
Each Pyth price feed includes a confidence interval (±). This represents the uncertainty in the aggregate price. A tight confidence (e.g. ±0.01%) means strong agreement among data publishers. A wide confidence (e.g. ±0.5%) may indicate low liquidity, market volatility, or publisher disagreement. Users should treat wide confidence as a caution signal.

Platform Features You Can Reference:
- Homepage: Live crypto rankings with prices, market cap, volume, and 24h changes
- Coin/Stock Detail Pages: In-depth price charts, AI analysis, and news for individual assets
- Portfolio Tracker: Track holdings, see diversification scores, and get AI portfolio insights
- Correlation Matrix: Visualize how assets move together or diverge
- Market Heatmap: Color-coded grid showing sector/asset performance at a glance
- Economic Calendar: Upcoming macro events (FOMC, CPI, NFP) that impact markets
- Pyth Price Feeds: Browse all Pyth oracle feeds with live prices and confidence data
- DeFi Yields: Top yield opportunities across chains with APY and TVL data
- Fear & Greed Index: Market sentiment gauge from 0 (Extreme Fear) to 100 (Extreme Greed)
- AI Daily Digest: AI-generated daily market summary with trends and outlook
- Token Swap: Swap tokens directly within the platform
- Price Alerts: Set custom price alerts for any asset
- News Feed: Aggregated crypto news with AI-powered summaries and sentiment tags
`;

async function chat(message, history = [], marketContext = "") {
  try {
    if (isGeminiInBackoff()) throw new Error(`AI rate-limited — retry in ${getGeminiBackoffRemaining()}s`);
    const m = getModel();
    const sysText = `You are PythFeeds AI, a helpful, concise, and expert financial market assistant embedded in the PythFeeds platform. You provide insights on crypto, stocks, metals, forex, and general market trends. Do not provide financial advice. Keep answers brief, formatted with markdown when appropriate, and easy to read. You have access to real-time market context to answer live queries. When users ask about platform features, guide them to the relevant page.
${PYTHFEEDS_KNOWLEDGE_BASE}${marketContext ? `\n${marketContext}` : ""}`;

    const chatSession = m.startChat({
      history: history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })),
      systemInstruction: { role: "user", parts: [{ text: sysText }] },
    });

    const result = await chatSession.sendMessage(message);
    return safeTextFromGenerateResult(result);
  } catch (err) {
    if (isGeminiRateLimitError(err)) activateGeminiBackoff(err);
    console.error("[AI] chat error:", err.message);
    throw new Error("AI Chat temporarily unavailable");
  }
}

/**
 * Summarize an individual news article
 */
async function summarizeNews(title, content) {
  const key = `ai_news_summary_${Buffer.from(title).toString('base64').substring(0, 20)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const prompt = `You are a financial news summarizer for PythFeeds. Read the following article headline and snippet/content carefully.
  
Title: ${title}
Content: ${content || "No extra content provided. Try to infer the meaning from the title."}

Instructions:
1. Provide exactly 2 short bullet points summarizing the core factual impact.
2. Focus strictly on the information provided in the Title and Content. Do not invent details or pull in outside context not mentioned.
3. Be direct, objective, and neutral. Do not give financial advice.`;

  try {
    if (isGeminiInBackoff()) throw new Error(`AI rate-limited — retry in ${getGeminiBackoffRemaining()}s`);
    const m = getModel();
    const result = await m.generateContent(prompt);
    const text = safeTextFromGenerateResult(result);
    cache.set(key, text, AI_TTL * 24); // Cache for 12 hours
    return text;
  } catch (err) {
    if (isGeminiRateLimitError(err)) activateGeminiBackoff(err);
    console.error("[AI] summarizeNews error:", err.message);
    throw new Error("News summary temporarily unavailable");
  }
}

/**
 * Streaming chat - returns async generator
 */
async function* chatStream(message, history = [], marketContext = "") {
  if (isGeminiInBackoff()) throw new Error(`AI rate-limited — retry in ${getGeminiBackoffRemaining()}s`);
  const m = getModel();
  const sysText = `You are PythFeeds AI, a helpful, concise, and expert financial market assistant embedded in the PythFeeds platform. You provide insights on crypto, stocks, metals, forex, and general market trends. Do not provide financial advice. Keep answers brief, formatted with markdown when appropriate, and easy to read. You have access to real-time market context to answer live queries. When users ask about platform features, guide them to the relevant page.
${PYTHFEEDS_KNOWLEDGE_BASE}${marketContext ? `\n${marketContext}` : ""}`;

  const chatSession = m.startChat({
    history: history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })),
    systemInstruction: { role: "user", parts: [{ text: sysText }] },
  });

  const result = await chatSession.sendMessageStream(message);
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

/**
 * Portfolio insights
 */
async function portfolioInsights(holdings) {
  const list = (Array.isArray(holdings) ? holdings : [])
    .filter((h) => h && (h.symbol || h.name))
    .map((h) => {
      const amt = Number(h.amount);
      const price = Number(h.price);
      const ch = h.change24h !== undefined && h.change24h !== null ? Number(h.change24h) : 0;
      return {
        symbol: String(h.symbol || h.name || "?").slice(0, 32),
        amount: Number.isFinite(amt) ? amt : 0,
        price: Number.isFinite(price) ? price : 0,
        change24h: Number.isFinite(ch) ? ch : 0,
      };
    });
  if (!list.length) {
    const e = new Error("No valid holdings to analyze");
    e.status = 400;
    throw e;
  }

  const holdingsText = list.map(h =>
    `${h.symbol}: ${h.amount} units @ $${h.price} (${h.change24h >= 0 ? "+" : ""}${h.change24h.toFixed(2)}% 24h)`
  ).join("\n");

  const totalValue = list.reduce((s, h) => s + h.amount * h.price, 0);

  const prompt = `You are a portfolio analyst for PythFeeds. Analyze this crypto/stock portfolio:

Holdings:
${holdingsText}

Total Portfolio Value: $${totalValue.toLocaleString()}

Provide:
1. **Diversification Score** (1-10) with explanation
2. **Concentration Risk** — identify if any single asset is >40% of portfolio
3. **Top Mover Impact** — which holding moved the portfolio most today
4. **Suggestion** — one neutral observation about portfolio balance (NOT financial advice)

Keep it concise, use markdown formatting. Do NOT give buy/sell recommendations.`;

  try {
    if (isGeminiInBackoff()) throw new Error(`AI rate-limited — retry in ${getGeminiBackoffRemaining()}s`);
    const m = getModel();
    const result = await m.generateContent(prompt);
    return safeTextFromGenerateResult(result);
  } catch (err) {
    if (isGeminiRateLimitError(err)) activateGeminiBackoff(err);
    console.error("[AI] portfolioInsights error:", err.message);
    if (err.status) throw err;
    throw new Error("Portfolio insights temporarily unavailable");
  }
}

/**
 * Correlation insights
 */
async function correlationInsights(pairs) {
  const pairsText = pairs.map(p =>
    `${p.a} ↔ ${p.b}: correlation = ${p.correlation.toFixed(3)}`
  ).join("\n");

  const prompt = `You are a financial data analyst for PythFeeds. Explain these asset correlations:

${pairsText}

For each notable pair (correlation > 0.7 or < -0.3):
1. Briefly explain WHY they might be correlated or inversely correlated
2. Mention any known sector/market relationships

Keep it to 2-3 sentences per pair. Be factual. Do not give financial advice.`;

  try {
    if (isGeminiInBackoff()) throw new Error(`AI rate-limited — retry in ${getGeminiBackoffRemaining()}s`);
    const m = getModel();
    const result = await m.generateContent(prompt);
    return safeTextFromGenerateResult(result);
  } catch (err) {
    if (isGeminiRateLimitError(err)) activateGeminiBackoff(err);
    console.error("[AI] correlationInsights error:", err.message);
    throw new Error("Correlation insights temporarily unavailable");
  }
}

/**
 * Simplify/ELI5 mode
 */
async function simplify(text) {
  const prompt = `You are explaining crypto/finance to a complete beginner (ELI5 mode). Rewrite the following analysis in very simple, jargon-free language that a 10-year-old could understand. Use short sentences, simple words, and helpful analogies.

Original text:
${text}

Rewrite it simply:`;

  try {
    if (isGeminiInBackoff()) throw new Error(`AI rate-limited — retry in ${getGeminiBackoffRemaining()}s`);
    const m = getModel();
    const result = await m.generateContent(prompt);
    return safeTextFromGenerateResult(result);
  } catch (err) {
    if (isGeminiRateLimitError(err)) activateGeminiBackoff(err);
    console.error("[AI] simplify error:", err.message);
    throw new Error("Simplification temporarily unavailable");
  }
}

/**
 * Daily market digest
 */
async function generateDigest(marketData) {
  const today = new Date().toISOString().split("T")[0];
  const memKey = `ai_digest_${today}`;
  
  // 1. In-memory cache
  const memCached = cache.get(memKey);
  if (memCached) return memCached;

  // 2. DB cache (shared globally)
  const dbKey = `digest_${today}`;
  const dbCached = await getAiCache(dbKey);
  if (dbCached) {
    cache.set(memKey, dbCached, 3600);
    return dbCached;
  }

  const prompt = `You are a senior market analyst writing a structured daily digest for PythFeeds, a real-time market data platform powered by Pyth Network oracles.

Market data:
${marketData}

Write a comprehensive, well-structured daily digest with the following EXACT section headers (use ## for each):

## Market Overview
Summarize overall market direction, total market cap movement, BTC dominance shift, and 24h volume in 2-3 sentences.

## Top Movers
List the top 3 gainers and top 3 losers with brief 1-sentence explanations for each move. Use bullet points.

## DeFi & Yields Pulse
Highlight notable DeFi yield opportunities and any TVL shifts. 2-3 sentences.

## Oracle & Data Quality
If Pyth confidence interval data is available, comment on oracle health and any notable spread widening. Otherwise note that oracle feeds are operating normally. 1-2 sentences.

## News Roundup
Summarize the 3-4 most impactful headlines with source citations in brackets [Source]. Use bullet points.

## Outlook
Provide a neutral, data-driven outlook for the next 24 hours. Mention key levels or events to watch. 2-3 sentences. No financial advice.

Formatting rules:
- Use markdown (##, **, -, numbered lists)
- Be factual and concise — aim for 400-600 words total
- Start with: ## Daily Market Digest — ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
- No financial advice or buy/sell recommendations`;

  try {
    if (isGeminiInBackoff()) throw new Error(`AI rate-limited — retry in ${getGeminiBackoffRemaining()}s`);
    const m = getModel();
    const result = await m.generateContent(prompt);
    const text = safeTextFromGenerateResult(result);
    cache.set(memKey, text, 3600);
    await setAiCache(dbKey, text, DIGEST_TTL_HOURS);
    return text;
  } catch (err) {
    if (isGeminiRateLimitError(err)) activateGeminiBackoff(err);
    console.error("[AI] digest error:", err.message);
    throw new Error("Digest temporarily unavailable");
  }
}

/**
 * Batch classify news headline sentiment using Gemini
 * Returns array of { title, sentiment: "bullish"|"bearish"|"neutral" }
 */
async function classifySentiment(headlines) {
  if (!headlines || headlines.length === 0) return [];

  // Check cache for individual headlines
  const results = [];
  const uncached = [];
  for (const h of headlines) {
    const key = `ai_sentiment_${Buffer.from(h).toString('base64').substring(0, 24)}`;
    const cached = cache.get(key);
    if (cached) {
      results.push({ title: h, sentiment: cached });
    } else {
      uncached.push(h);
    }
  }

  if (uncached.length > 0) {
    const batch = uncached.slice(0, 20); // max 20 at a time
    const prompt = `Classify each headline as exactly one of: bullish, bearish, neutral.
Return ONLY a JSON array of objects with "title" and "sentiment" fields. No extra text.

Headlines:
${batch.map((h, i) => `${i + 1}. ${h}`).join("\n")}`;

    try {
      if (isGeminiInBackoff()) throw new Error(`AI rate-limited — retry in ${getGeminiBackoffRemaining()}s`);
      const m = getModel();
      const result = await m.generateContent(prompt);
      let text = safeTextFromGenerateResult(result);
      // Strip markdown code fences if present
      text = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const sentiment = ["bullish", "bearish", "neutral"].includes(item.sentiment) ? item.sentiment : "neutral";
          const key = `ai_sentiment_${Buffer.from(item.title || "").toString('base64').substring(0, 24)}`;
          cache.set(key, sentiment, 3600 * 6); // 6h cache
          results.push({ title: item.title, sentiment });
        }
      }
    } catch (err) {
      if (isGeminiRateLimitError(err)) activateGeminiBackoff(err);
      console.error("[AI] classifySentiment error:", err.message);
      // Fallback: return neutral for all uncached
      for (const h of batch) {
        results.push({ title: h, sentiment: "neutral" });
      }
    }
  }

  return results;
}

/**
 * Generate a one-sentence market mood based on Fear & Greed + market data
 */
async function getMarketMood(fearGreedValue, fearGreedLabel, topGainer, topLoser) {
  const key = "ai_market_mood";
  const cached = cache.get(key);
  if (cached) return cached;

  const prompt = `You are PythFeeds AI. Generate exactly ONE short sentence (max 15 words) describing the current crypto market mood.

Data:
- Fear & Greed Index: ${fearGreedValue}/100 (${fearGreedLabel})
- Top gainer: ${topGainer || "N/A"}
- Top loser: ${topLoser || "N/A"}

Rules:
- Start with an emoji that matches the mood
- Be catchy and informative
- No financial advice
- Return ONLY the one sentence, nothing else`;

  try {
    if (isGeminiInBackoff()) return null; // silent fallback for mood
    const m = getModel();
    const result = await m.generateContent(prompt);
    const text = safeTextFromGenerateResult(result);
    cache.set(key, text, 3600); // 1h cache
    return text;
  } catch (err) {
    if (isGeminiRateLimitError(err)) activateGeminiBackoff(err);
    console.error("[AI] mood error:", err.message);
    return null;
  }
}

module.exports = { analyzeAsset, getMarketBrief, chat, chatStream, summarizeNews, portfolioInsights, correlationInsights, simplify, generateDigest, classifySentiment, getMarketMood, isGeminiInBackoff, getGeminiBackoffRemaining };
