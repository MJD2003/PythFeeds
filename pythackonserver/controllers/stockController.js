const { getPythPrices, EQUITY_FEEDS } = require("../services/pythService");
const fs = require("fs");
const path = require("path");

// ── Persistent previous close prices ──
const PREV_CLOSE_FILE = path.join(__dirname, "..", "data", "previousClose.json");
let persistedClose = {};
try {
  if (fs.existsSync(PREV_CLOSE_FILE)) {
    persistedClose = JSON.parse(fs.readFileSync(PREV_CLOSE_FILE, "utf-8"));
    console.log(`[Stocks] Loaded ${Object.keys(persistedClose).length} previous close prices`);
  }
} catch { persistedClose = {}; }

function savePreviousClose() {
  try {
    const dir = path.dirname(PREV_CLOSE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PREV_CLOSE_FILE, JSON.stringify(persistedClose, null, 2));
  } catch (err) {
    console.warn("[Stocks] Failed to save previousClose.json:", err.message);
  }
}

// ── US Market hours detection ──
function isUSMarketOpen() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  // Convert to ET (UTC-5 in EST, UTC-4 in EDT)
  // Approximate: use -4 (EDT) Mar-Nov, -5 (EST) Nov-Mar
  const month = now.getUTCMonth(); // 0-indexed
  const etOffset = (month >= 2 && month <= 10) ? -4 : -5; // rough EDT/EST
  const etHour = now.getUTCHours() + etOffset;
  const etMin = now.getUTCMinutes();
  const etTime = etHour * 60 + etMin; // minutes since midnight ET
  // Market: 9:30 AM (570 min) to 4:00 PM (960 min)
  return etTime >= 570 && etTime < 960;
}

// Reference prices + metadata
const STOCK_META = {
  AAPL:  { name: "Apple Inc.",         sector: "Technology",             exchange: "NASDAQ", refPrice: 230, marketCap: 3480e9, volume: 52e9, pe: 34.2, eps: 6.65, dividend: 0.52, beta: 1.21, high52w: 260, low52w: 164, logo: "https://www.google.com/s2/favicons?domain=apple.com&sz=64",     description: "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide." },
  MSFT:  { name: "Microsoft Corp.",    sector: "Technology",             exchange: "NASDAQ", refPrice: 420, marketCap: 3090e9, volume: 28e9, pe: 36.8, eps: 11.29, dividend: 0.75, beta: 0.89, high52w: 470, low52w: 363, logo: "https://www.google.com/s2/favicons?domain=microsoft.com&sz=64", description: "Microsoft Corporation develops and supports software, services, devices, and solutions worldwide." },
  GOOGL: { name: "Alphabet Inc.",      sector: "Communication Services", exchange: "NASDAQ", refPrice: 178, marketCap: 2170e9, volume: 22e9, pe: 24.1, eps: 7.30, dividend: 0.20, beta: 1.06, high52w: 193, low52w: 150, logo: "https://www.google.com/s2/favicons?domain=google.com&sz=64",    description: "Alphabet Inc. offers various products and platforms worldwide including Google Search, YouTube, and Cloud." },
  AMZN:  { name: "Amazon.com Inc.",    sector: "Consumer Cyclical",      exchange: "NASDAQ", refPrice: 200, marketCap: 2080e9, volume: 35e9, pe: 58.2, eps: 3.41, dividend: 0,    beta: 1.15, high52w: 216, low52w: 152, logo: "https://www.google.com/s2/favicons?domain=amazon.com&sz=64",    description: "Amazon.com, Inc. engages in the retail sale of consumer products, advertising, and subscription services." },
  TSLA:  { name: "Tesla Inc.",         sector: "Consumer Cyclical",      exchange: "NASDAQ", refPrice: 250, marketCap: 794e9,  volume: 38e9, pe: 72.1, eps: 3.45, dividend: 0,    beta: 2.05, high52w: 362, low52w: 139, logo: "https://www.google.com/s2/favicons?domain=tesla.com&sz=64",     description: "Tesla, Inc. designs, develops, manufactures, leases, and sells electric vehicles and energy solutions." },
  NVDA:  { name: "NVIDIA Corp.",       sector: "Technology",             exchange: "NASDAQ", refPrice: 140, marketCap: 3390e9, volume: 45e9, pe: 62.4, eps: 2.22, dividend: 0.01, beta: 1.68, high52w: 153, low52w: 47,  logo: "https://www.google.com/s2/favicons?domain=nvidia.com&sz=64",    description: "NVIDIA Corporation provides graphics, compute, and networking solutions for gaming, data center, and AI." },
  META:  { name: "Meta Platforms",     sector: "Communication Services", exchange: "NASDAQ", refPrice: 590, marketCap: 1480e9, volume: 18e9, pe: 28.5, eps: 20.54, dividend: 0.50, beta: 1.24, high52w: 603, low52w: 390, logo: "https://www.google.com/s2/favicons?domain=meta.com&sz=64",      description: "Meta Platforms, Inc. develops products that enable people to connect and share through mobile and VR." },
  JPM:   { name: "JPMorgan Chase",     sector: "Financial Services",     exchange: "NYSE",   refPrice: 235, marketCap: 675e9,  volume: 9e9,  pe: 12.8, eps: 18.32, dividend: 4.20, beta: 1.12, high52w: 244, low52w: 166, logo: "https://www.google.com/s2/favicons?domain=jpmorganchase.com&sz=64", description: "JPMorgan Chase & Co. operates as a financial services company worldwide." },
  JNJ:   { name: "Johnson & Johnson",  sector: "Healthcare",             exchange: "NYSE",   refPrice: 155, marketCap: 375e9,  volume: 7e9,  pe: 15.2, eps: 10.20, dividend: 3.80, beta: 0.55, high52w: 168, low52w: 144, logo: "https://www.google.com/s2/favicons?domain=jnj.com&sz=64",       description: "Johnson & Johnson researches, develops, manufactures, and sells healthcare products worldwide." },
  V:     { name: "Visa Inc.",          sector: "Financial Services",     exchange: "NYSE",   refPrice: 290, marketCap: 580e9,  volume: 8e9,  pe: 31.5, eps: 9.20, dividend: 0.90, beta: 0.95, high52w: 318, low52w: 253, logo: "https://www.google.com/s2/favicons?domain=visa.com&sz=64",       description: "Visa Inc. operates a digital payments network connecting consumers, merchants, and financial institutions." },
  WMT:   { name: "Walmart Inc.",       sector: "Consumer Defensive",     exchange: "NYSE",   refPrice: 90,  marketCap: 650e9,  volume: 10e9, pe: 38.2, eps: 2.35, dividend: 0.83, beta: 0.52, high52w: 105, low52w: 75,  logo: "https://www.google.com/s2/favicons?domain=walmart.com&sz=64",   description: "Walmart Inc. operates retail and wholesale stores and ecommerce websites worldwide." },
  NFLX:  { name: "Netflix Inc.",       sector: "Communication Services", exchange: "NASDAQ", refPrice: 900, marketCap: 390e9,  volume: 5e9,  pe: 48.5, eps: 18.55, dividend: 0,    beta: 1.35, high52w: 1000, low52w: 560, logo: "https://www.google.com/s2/favicons?domain=netflix.com&sz=64",  description: "Netflix, Inc. provides entertainment services with streaming content in over 190 countries." },
  INTC:  { name: "Intel Corp.",        sector: "Technology",             exchange: "NASDAQ", refPrice: 22,  marketCap: 95e9,   volume: 30e9, pe: 0,    eps: -0.38, dividend: 0,    beta: 1.05, high52w: 52,  low52w: 18,  logo: "https://www.google.com/s2/favicons?domain=intel.com&sz=64",    description: "Intel Corporation designs and manufactures computing and related products worldwide." },
  AMD:   { name: "AMD Inc.",           sector: "Technology",             exchange: "NASDAQ", refPrice: 120, marketCap: 195e9,  volume: 40e9, pe: 105,  eps: 1.14, dividend: 0,    beta: 1.70, high52w: 187, low52w: 118, logo: "https://www.google.com/s2/favicons?domain=amd.com&sz=64",      description: "Advanced Micro Devices, Inc. designs and sells semiconductors for computing and graphics." },
};

// In-memory last known Pyth prices
const lastKnownPrices = {};

// Track last live price per symbol (for auto-saving previous close)
const sessionLastPrices = {};
let lastSaveDate = new Date().toISOString().slice(0, 10);

/**
 * Get the "previous close" price for a symbol.
 * Priority: persisted close → refPrice
 */
function getPreviousClose(sym) {
  if (persistedClose[sym] && persistedClose[sym] > 0) return persistedClose[sym];
  const meta = STOCK_META[sym];
  return meta ? meta.refPrice : 0;
}

/**
 * Auto-save: when a new trading day starts, save yesterday's last prices as previous close.
 * Called on every price build — lightweight check.
 */
function maybeRotateClose() {
  const today = new Date().toISOString().slice(0, 10);
  if (today === lastSaveDate) return;
  // New day — save session last prices as previous close
  const syms = Object.keys(sessionLastPrices);
  if (syms.length > 0) {
    for (const sym of syms) {
      persistedClose[sym] = sessionLastPrices[sym];
    }
    savePreviousClose();
    console.log(`[Stocks] Rotated ${syms.length} previous close prices for ${today}`);
  }
  lastSaveDate = today;
}

function buildStock(sym, pyth) {
  const meta = STOCK_META[sym] || { name: sym, sector: "Unknown", exchange: "N/A", refPrice: 0, marketCap: 0, volume: 0, pe: 0, eps: 0, dividend: 0, beta: 0, high52w: 0, low52w: 0, logo: "", description: "" };
  const marketOpen = isUSMarketOpen();

  // Use Pyth live price if valid, otherwise last known, otherwise reference
  let price = 0;
  let source = "reference";
  if (pyth && pyth.price > 0) {
    price = pyth.price;
    source = marketOpen ? "pyth" : "pyth_closed";
    lastKnownPrices[sym] = pyth.price;
    sessionLastPrices[sym] = pyth.price; // track for close rotation
  } else if (lastKnownPrices[sym]) {
    price = lastKnownPrices[sym];
    source = "cached";
  } else {
    price = meta.refPrice;
    source = "reference";
  }

  // Maybe rotate previous close if new day
  maybeRotateClose();

  // Calculate change from previous close (persisted or refPrice)
  const previousClose = getPreviousClose(sym);
  const change1d = previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : 0;

  return {
    ticker: sym,
    name: meta.name,
    price,
    change1d: Math.round(change1d * 100) / 100,
    previousClose,
    confidence: pyth?.confidence || 0,
    publishTime: pyth?.publishTime || 0,
    source,
    marketOpen,
    sector: meta.sector,
    exchange: meta.exchange,
    marketCap: meta.marketCap,
    volume: meta.volume,
    pe: meta.pe,
    eps: meta.eps,
    dividend: meta.dividend,
    beta: meta.beta,
    high52w: meta.high52w,
    low52w: meta.low52w,
    logo: meta.logo || "",
    description: meta.description,
  };
}

/**
 * GET /api/stocks
 */
async function list(req, res, next) {
  try {
    // Use all symbols from STOCK_META (superset of EQUITY_FEEDS)
    const allSymbols = [...new Set([...Object.keys(EQUITY_FEEDS), ...Object.keys(STOCK_META)])];
    const pythSymbols = allSymbols.filter((s) => EQUITY_FEEDS[s]);
    const pythPrices = await getPythPrices(pythSymbols);
    const stocks = allSymbols.map((sym) => buildStock(sym, pythPrices[sym]));
    res.json(stocks);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/stocks/:ticker
 */
async function detail(req, res, next) {
  try {
    const ticker = req.params.ticker.toUpperCase();
    if (!EQUITY_FEEDS[ticker] && !STOCK_META[ticker]) {
      return res.status(404).json({ error: true, message: `Stock ${ticker} not supported` });
    }
    const pythPrices = await getPythPrices([ticker]);
    res.json(buildStock(ticker, pythPrices[ticker]));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/stocks/stream/sse
 * Server-Sent Events — streams all stock prices every 5s
 */
const MAX_STOCK_SSE_CLIENTS = 100;
let sseClients = [];
async function stream(req, res) {
  if (sseClients.length >= MAX_STOCK_SSE_CLIENTS) {
    return res.status(503).json({ error: "Too many SSE connections" });
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write(":\n\n"); // keep-alive comment

  sseClients.push(res);
  req.on("close", () => {
    sseClients = sseClients.filter((c) => c !== res);
  });
}

// Periodic cleanup of stale SSE connections
setInterval(() => {
  const before = sseClients.length;
  sseClients = sseClients.filter((client) => {
    try { client.write(":\n\n"); return true; } catch { return false; }
  });
  const removed = before - sseClients.length;
  if (removed > 0) console.log(`[StockSSE] Cleaned ${removed} stale clients`);
}, 30000);

// Broadcast stock prices to all SSE clients every 5 seconds
setInterval(async () => {
  if (sseClients.length === 0) return;
  try {
    const symbols = Object.keys(EQUITY_FEEDS);
    const pythPrices = await getPythPrices(symbols);
    const stocks = symbols.map((sym) => buildStock(sym, pythPrices[sym]));
    const data = `data: ${JSON.stringify(stocks)}\n\n`;
    sseClients.forEach((client) => {
      try { client.write(data); } catch { /* client gone */ }
    });
  } catch (err) {
    console.warn("[SSE] broadcast error:", err.message);
  }
}, 5000);

module.exports = { list, detail, stream };
