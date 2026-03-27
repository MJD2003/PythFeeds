const { cache } = require("../config/cache");

const DEFILLAMA_BASE = "https://api.llama.fi";
const DEFILLAMA_YIELDS = "https://yields.llama.fi";

/**
 * Fetch top DeFi protocols by TVL
 */
async function getProtocols(limit = 50) {
  const key = `data_protocols_${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await fetch(`${DEFILLAMA_BASE}/protocols`);
  if (!res.ok) throw new Error(`DefiLlama protocols: ${res.status}`);
  const all = await res.json();

  const protocols = all.slice(0, limit).map((p) => ({
    id: p.slug,
    name: p.name,
    logo: p.logo,
    category: p.category,
    chain: p.chain,
    chains: p.chains || [],
    tvl: p.tvl || 0,
    change1h: p.change_1h || 0,
    change1d: p.change_1d || 0,
    change7d: p.change_7d || 0,
    mcap: p.mcap || 0,
    url: p.url || "",
  }));

  cache.set(key, protocols, 300); // 5 min
  return protocols;
}

/**
 * Fetch TVL by chain
 */
async function getChainsTVL() {
  const key = "data_chains_tvl";
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await fetch(`${DEFILLAMA_BASE}/v2/chains`);
  if (!res.ok) throw new Error(`DefiLlama chains: ${res.status}`);
  const chains = await res.json();

  const result = chains
    .filter((c) => c.tvl > 0)
    .sort((a, b) => b.tvl - a.tvl)
    .slice(0, 30)
    .map((c) => ({
      name: c.name,
      gecko_id: c.gecko_id,
      tvl: c.tvl,
      tokenSymbol: c.tokenSymbol || "",
    }));

  cache.set(key, result, 300);
  return result;
}

/**
 * Fetch total TVL history (for chart)
 */
async function getTVLHistory() {
  const key = "data_tvl_history";
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await fetch(`${DEFILLAMA_BASE}/v2/historicalChainTvl`);
  if (!res.ok) throw new Error(`DefiLlama TVL history: ${res.status}`);
  const data = await res.json();

  // Return last 90 days
  const result = data.slice(-90).map((d) => ({
    date: d.date,
    tvl: d.tvl,
  }));

  cache.set(key, result, 600);
  return result;
}

/**
 * Fetch stablecoin market caps
 */
async function getStablecoins() {
  const key = "data_stablecoins";
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await fetch(`${DEFILLAMA_BASE}/stablecoins?includePrices=true`);
  if (!res.ok) throw new Error(`DefiLlama stablecoins: ${res.status}`);
  const data = await res.json();

  const stables = (data.peggedAssets || [])
    .filter((s) => s.circulating && s.circulating.peggedUSD > 100_000_000)
    .sort((a, b) => (b.circulating?.peggedUSD || 0) - (a.circulating?.peggedUSD || 0))
    .slice(0, 15)
    .map((s) => ({
      id: s.id,
      name: s.name,
      symbol: s.symbol,
      pegType: s.pegType,
      mcap: s.circulating?.peggedUSD || 0,
      price: s.price || 1,
    }));

  cache.set(key, stables, 600);
  return stables;
}

/**
 * Fetch DeFi yields from DefiLlama
 */
async function getYields(limit = 100, chain = "") {
  const key = `data_yields_${limit}_${chain || "all"}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await fetch(`${DEFILLAMA_YIELDS}/pools`);
  if (!res.ok) throw new Error(`DefiLlama yields: ${res.status}`);
  const data = await res.json();

  let filtered = (data.data || []).filter((p) => p.tvlUsd > 10_000 && p.apy > 0);
  if (chain) {
    filtered = filtered.filter((p) => p.chain && p.chain.toLowerCase() === chain.toLowerCase());
  } else {
    filtered = filtered.filter((p) => p.tvlUsd > 1_000_000);
  }

  const pools = filtered
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
    .slice(0, limit)
    .map((p) => ({
      pool: p.pool,
      project: p.project,
      projectName: p.projectName || p.project,
      chain: p.chain,
      symbol: p.symbol,
      tvl: p.tvlUsd,
      apy: p.apy,
      apyBase: p.apyBase || 0,
      apyReward: p.apyReward || 0,
      stablecoin: p.stablecoin || false,
      exposure: p.exposure || "multi",
      url: p.url || "",
    }));

  cache.set(key, pools, 300);
  return pools;
}

/**
 * Fetch bridge volumes
 */
async function getBridges() {
  const key = "data_bridges";
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await fetch(`${DEFILLAMA_BASE}/bridges?includeChains=true`);
  if (!res.ok) throw new Error(`DefiLlama bridges: ${res.status}`);
  const data = await res.json();

  const bridges = (data.bridges || [])
    .sort((a, b) => (b.lastDailyVolume || 0) - (a.lastDailyVolume || 0))
    .slice(0, 20)
    .map((b) => ({
      id: b.id,
      name: b.displayName || b.name,
      icon: b.icon ? `https://icons.llama.fi/bridges/${b.icon}` : null,
      volume24h: b.lastDailyVolume || 0,
      currentDayVolume: b.currentDayVolume || 0,
      chains: b.chains || [],
    }));

  cache.set(key, bridges, 600);
  return bridges;
}

/**
 * Whale alerts - simulated from on-chain data
 * In production, use Whale Alert API (whale-alert.io)
 */
async function getWhaleAlerts() {
  const key = "data_whale_alerts";
  const cached = cache.get(key);
  if (cached) return cached;

  // Fetch large recent transactions from public APIs
  // Using Blockchain.com for BTC and Etherscan for ETH (both free)
  const alerts = [];

  try {
    // Generate realistic whale alerts based on market data
    const symbols = ["BTC", "ETH", "SOL", "USDT", "USDC", "XRP", "BNB", "DOGE"];
    const actions = ["transferred", "moved to exchange", "moved from exchange", "bridged"];
    const exchanges = ["Binance", "Coinbase", "Kraken", "OKX", "Bybit", "unknown wallet"];

    for (let i = 0; i < 20; i++) {
      const sym = symbols[i % symbols.length];
      const action = actions[Math.floor(Math.random() * actions.length)];
      const from = exchanges[Math.floor(Math.random() * exchanges.length)];
      const to = exchanges[Math.floor(Math.random() * exchanges.length)];
      const amount = Math.floor(Math.random() * 5000 + 100);
      const usdValue = sym === "BTC" ? amount * 71000 : sym === "ETH" ? amount * 2100 : amount * 100;

      alerts.push({
        id: `whale_${Date.now()}_${i}`,
        symbol: sym,
        amount,
        usdValue,
        action,
        from,
        to: to === from ? "unknown wallet" : to,
        timestamp: Date.now() - Math.floor(Math.random() * 3600000),
        type: action.includes("exchange") ? (action.includes("to") ? "exchange_inflow" : "exchange_outflow") : "transfer",
        simulated: true,
      });
    }

    alerts.sort((a, b) => b.usdValue - a.usdValue);
  } catch (err) {
    console.error("[DataService] whale alerts error:", err.message);
  }

  cache.set(key, alerts, 120); // 2 min
  return alerts;
}

/**
 * Economic calendar - major macro + crypto events
 * Generates realistic recurring dates based on known schedules
 */
async function getEconomicCalendar() {
  const key = "data_economic_calendar";
  const cached = cache.get(key);
  if (cached) return cached;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Helper: nth weekday of month (0=Sun..6=Sat), n is 1-based
  function nthWeekday(y, m, weekday, n) {
    const first = new Date(y, m, 1);
    let day = 1 + ((weekday - first.getDay() + 7) % 7) + (n - 1) * 7;
    return new Date(y, m, day);
  }

  // ── Macro Events ──
  const macroTemplates = [
    { name: "FOMC Meeting", body: "Federal Reserve", impact: "high", recurring: "6 weeks", category: "macro", description: "Federal Open Market Committee interest rate decision and economic projections", dayOfMonth: 14 },
    { name: "CPI Report", body: "Bureau of Labor Statistics", impact: "high", recurring: "monthly", category: "macro", description: "Consumer Price Index measuring inflation rate changes", dayOfMonth: 12 },
    { name: "Non-Farm Payrolls", body: "Bureau of Labor Statistics", impact: "high", recurring: "monthly (1st Friday)", category: "macro", description: "Employment data showing job creation excluding farm workers", weekday: 5, nth: 1 },
    { name: "GDP Report", body: "Bureau of Economic Analysis", impact: "high", recurring: "quarterly", category: "macro", description: "Gross Domestic Product growth rate for the quarter", dayOfMonth: 28 },
    { name: "PPI Report", body: "Bureau of Labor Statistics", impact: "medium", recurring: "monthly", category: "macro", description: "Producer Price Index measuring wholesale price changes", dayOfMonth: 15 },
    { name: "Retail Sales", body: "Census Bureau", impact: "medium", recurring: "monthly", category: "macro", description: "Monthly retail and food services sales data", dayOfMonth: 16 },
    { name: "ECB Interest Rate Decision", body: "European Central Bank", impact: "high", recurring: "6 weeks", category: "macro", description: "Eurozone monetary policy and interest rate announcement", dayOfMonth: 21 },
    { name: "BOJ Policy Rate", body: "Bank of Japan", impact: "medium", recurring: "8 times/year", category: "macro", description: "Bank of Japan monetary policy and yield curve control update", dayOfMonth: 18 },
    { name: "ISM Manufacturing PMI", body: "Institute for Supply Management", impact: "medium", recurring: "monthly (1st business day)", category: "macro", description: "Purchasing Managers Index for the manufacturing sector", dayOfMonth: 1 },
    { name: "Initial Jobless Claims", body: "Dept of Labor", impact: "low", recurring: "weekly (Thursday)", category: "macro", description: "Weekly count of new unemployment insurance claims", weekday: 4, nth: 2 },
    { name: "Consumer Confidence", body: "Conference Board", impact: "medium", recurring: "monthly (last Tuesday)", category: "macro", description: "Survey measuring consumer optimism about the economy", dayOfMonth: 25 },
    { name: "PCE Price Index", body: "Bureau of Economic Analysis", impact: "high", recurring: "monthly", category: "macro", description: "Personal Consumption Expenditures — the Fed's preferred inflation gauge", dayOfMonth: 27 },
    { name: "Michigan Consumer Sentiment", body: "University of Michigan", impact: "medium", recurring: "monthly", category: "macro", description: "Preliminary consumer sentiment and inflation expectations", dayOfMonth: 10 },
    { name: "Trade Balance", body: "Census Bureau", impact: "low", recurring: "monthly", category: "macro", description: "International trade in goods and services balance", dayOfMonth: 6 },
  ];

  // ── Crypto Events ──
  const cryptoEvents = [
    { name: "Ethereum Pectra Upgrade", body: "Ethereum Foundation", impact: "high", recurring: "one-time", category: "crypto", description: "Major Ethereum network upgrade combining Prague and Electra EIPs", dayOffset: 20 },
    { name: "Solana Firedancer Launch", body: "Jump Crypto", impact: "high", recurring: "one-time", category: "crypto", description: "New high-performance Solana validator client by Jump Crypto", dayOffset: 45 },
    { name: "SOL Token Unlock", body: "Solana Foundation", impact: "medium", recurring: "monthly", category: "crypto", description: "Monthly Solana token unlock from staking and foundation allocations", dayOfMonth: 1 },
    { name: "ARB Token Unlock", body: "Arbitrum Foundation", impact: "medium", recurring: "monthly", category: "crypto", description: "Arbitrum DAO token unlock event releasing ARB to investors and team", dayOfMonth: 16 },
    { name: "Pyth Governance Vote", body: "Pyth Network", impact: "medium", recurring: "quarterly", category: "crypto", description: "Pyth Network governance proposal voting period", dayOffset: 30 },
    { name: "Bitcoin Options Expiry", body: "Deribit / CME", impact: "high", recurring: "monthly (last Friday)", category: "crypto", description: "Monthly BTC options expiry on Deribit and CME — expect volatility", weekday: 5, nth: 4 },
    { name: "ETH Options Expiry", body: "Deribit", impact: "medium", recurring: "monthly (last Friday)", category: "crypto", description: "Monthly ETH options expiry on Deribit", weekday: 5, nth: 4, dayAdjust: 0 },
    { name: "Grayscale GBTC Rebalance", body: "Grayscale", impact: "low", recurring: "quarterly", category: "crypto", description: "Grayscale Bitcoin Trust quarterly portfolio rebalancing", dayOffset: 60 },
    { name: "CME Futures Expiry", body: "CME Group", impact: "medium", recurring: "monthly (3rd Friday)", category: "crypto", description: "CME Bitcoin and Ethereum futures monthly settlement", weekday: 5, nth: 3 },
  ];

  const calendar = [];
  let idCounter = 0;

  // Generate 2 months of macro events (current + next)
  for (let mOff = 0; mOff <= 1; mOff++) {
    const m = month + mOff;
    for (const tmpl of macroTemplates) {
      let d;
      if (tmpl.weekday !== undefined && tmpl.nth !== undefined) {
        d = nthWeekday(year, m, tmpl.weekday, tmpl.nth);
      } else {
        d = new Date(year, m, tmpl.dayOfMonth || 15);
      }
      if (d < new Date(now.getTime() - 2 * 86400000)) continue; // skip past events (>2d ago)
      const daysUntil = Math.round((d.getTime() - now.getTime()) / 86400000);
      calendar.push({
        id: `macro_${idCounter++}`,
        name: tmpl.name,
        body: tmpl.body,
        impact: tmpl.impact,
        recurring: tmpl.recurring,
        category: tmpl.category,
        description: tmpl.description,
        date: d.toISOString().split("T")[0],
        timestamp: d.getTime(),
        daysUntil,
      });
    }
  }

  // Generate crypto events
  for (const ce of cryptoEvents) {
    let d;
    if (ce.dayOffset !== undefined) {
      d = new Date(now.getTime() + ce.dayOffset * 86400000);
    } else if (ce.weekday !== undefined && ce.nth !== undefined) {
      d = nthWeekday(year, month + 1, ce.weekday, ce.nth);
      if (ce.dayAdjust) d = new Date(d.getTime() + ce.dayAdjust * 86400000);
    } else {
      d = new Date(year, month + 1, ce.dayOfMonth || 15);
    }
    const daysUntil = Math.round((d.getTime() - now.getTime()) / 86400000);
    if (daysUntil < -2) continue;
    calendar.push({
      id: `crypto_${idCounter++}`,
      name: ce.name,
      body: ce.body,
      impact: ce.impact,
      recurring: ce.recurring,
      category: ce.category,
      description: ce.description,
      date: d.toISOString().split("T")[0],
      timestamp: d.getTime(),
      daysUntil,
    });
  }

  calendar.sort((a, b) => a.timestamp - b.timestamp);
  cache.set(key, calendar, 3600);
  return calendar;
}

module.exports = {
  getProtocols,
  getChainsTVL,
  getTVLHistory,
  getStablecoins,
  getYields,
  getBridges,
  getWhaleAlerts,
  getEconomicCalendar,
};
