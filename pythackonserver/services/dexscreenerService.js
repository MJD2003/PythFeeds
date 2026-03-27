const { cache } = require("../config/cache");

const DEX_BASE = "https://api.dexscreener.com";

// Cache TTLs
const TTL_TRENDING = 30;    // 30s for trending data
const TTL_PAIRS = 60;       // 60s for pair data
const TTL_PROFILES = 300;   // 5min for token profiles
const TTL_SEARCH = 60;      // 60s for search results

async function dexFetch(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DexScreener ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Search for pairs matching a query string
 */
async function searchPairs(query) {
  const key = `dex_search_${query.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await dexFetch(`${DEX_BASE}/latest/dex/search?q=${encodeURIComponent(query)}`);
  const pairs = (data.pairs || []).map(normalizePair);
  cache.set(key, pairs, TTL_SEARCH);
  return pairs;
}

/**
 * Get pairs for a specific token address on a chain
 */
async function getTokenPairs(chain, tokenAddress) {
  const key = `dex_pairs_${chain}_${tokenAddress}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await dexFetch(`${DEX_BASE}/token-pairs/v1/${chain}/${tokenAddress}`);
  const pairs = (data || []).map(normalizePair);
  cache.set(key, pairs, TTL_PAIRS);
  return pairs;
}

/**
 * Get latest boosted/trending tokens
 */
async function getTrending() {
  const key = "dex_trending";
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await dexFetch(`${DEX_BASE}/token-boosts/latest/v1`);
  const tokens = Array.isArray(data) ? data : [];
  cache.set(key, tokens, TTL_TRENDING);
  return tokens;
}

/**
 * Get tokens with most active boosts (top trending)
 */
async function getTopBoosted() {
  const key = "dex_top_boosted";
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await dexFetch(`${DEX_BASE}/token-boosts/top/v1`);
  const tokens = Array.isArray(data) ? data : [];
  cache.set(key, tokens, TTL_TRENDING);
  return tokens;
}

/**
 * Get latest token profiles (new tokens with verified info)
 */
async function getLatestProfiles() {
  const key = "dex_profiles";
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await dexFetch(`${DEX_BASE}/token-profiles/latest/v1`);
  const profiles = Array.isArray(data) ? data : [];
  cache.set(key, profiles, TTL_PROFILES);
  return profiles;
}

/**
 * Get enriched new pairs: profiles + batch pair data (server-side)
 */
async function getEnrichedNewPairs() {
  const key = "dex_enriched_pairs";
  const cached = cache.get(key);
  if (cached) return cached;

  // 1. Fetch latest profiles
  const profiles = await getLatestProfiles();
  if (!profiles.length) return [];

  // 2. Group by chain
  const byChain = {};
  for (const p of profiles) {
    if (!byChain[p.chainId]) byChain[p.chainId] = [];
    byChain[p.chainId].push(p);
  }

  // 3. Batch fetch pairs per chain (DexScreener allows comma-separated, max 30)
  const pairMap = {}; // tokenAddress -> best pair
  const batchLimit = 30;

  for (const [chain, chainProfiles] of Object.entries(byChain)) {
    for (let i = 0; i < chainProfiles.length; i += batchLimit) {
      const batch = chainProfiles.slice(i, i + batchLimit);
      const addresses = batch.map(p => p.tokenAddress).join(",");
      try {
        const data = await dexFetch(`${DEX_BASE}/tokens/v1/${chain}/${addresses}`);
        const pairs = Array.isArray(data) ? data : [];
        // Group pairs by base token address, keep highest-liquidity pair per token
        for (const pair of pairs) {
          const addr = pair.baseToken?.address;
          if (!addr) continue;
          const normalized = normalizePair(pair);
          if (!pairMap[addr] || (normalized.liquidity.usd > (pairMap[addr].liquidity?.usd || 0))) {
            pairMap[addr] = normalized;
          }
        }
      } catch (err) {
        console.warn(`[DexScreener] Batch fetch failed for ${chain}:`, err.message);
      }
    }
  }

  // 4. Merge profile + pair
  const enriched = profiles.map(p => ({
    ...p,
    pair: pairMap[p.tokenAddress] || null,
  }));

  cache.set(key, enriched, TTL_PAIRS); // 60s cache
  return enriched;
}

/**
 * Get pools for a given token address on a chain
 */
async function getTokenPools(chain, tokenAddress) {
  const key = `dex_pools_${chain}_${tokenAddress}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await dexFetch(`${DEX_BASE}/tokens/v1/${chain}/${tokenAddress}`);
  const pairs = (Array.isArray(data) ? data : data?.pairs || []).map(normalizePair);
  cache.set(key, pairs, TTL_PAIRS);
  return pairs;
}

/**
 * Normalize a DexScreener pair into a consistent shape
 */
function normalizePair(p) {
  return {
    chainId: p.chainId || "",
    dexId: p.dexId || "",
    pairAddress: p.pairAddress || "",
    url: p.url || "",
    baseToken: {
      address: p.baseToken?.address || "",
      name: p.baseToken?.name || "",
      symbol: p.baseToken?.symbol || "",
    },
    quoteToken: {
      address: p.quoteToken?.address || "",
      name: p.quoteToken?.name || "",
      symbol: p.quoteToken?.symbol || "",
    },
    priceNative: p.priceNative || "0",
    priceUsd: p.priceUsd || "0",
    liquidity: {
      usd: p.liquidity?.usd || 0,
      base: p.liquidity?.base || 0,
      quote: p.liquidity?.quote || 0,
    },
    fdv: p.fdv || 0,
    marketCap: p.marketCap || 0,
    pairCreatedAt: p.pairCreatedAt || 0,
    volume: {
      m5: p.volume?.m5 || 0,
      h1: p.volume?.h1 || 0,
      h6: p.volume?.h6 || 0,
      h24: p.volume?.h24 || 0,
    },
    priceChange: {
      m5: p.priceChange?.m5 || 0,
      h1: p.priceChange?.h1 || 0,
      h6: p.priceChange?.h6 || 0,
      h24: p.priceChange?.h24 || 0,
    },
    txns: {
      m5: { buys: p.txns?.m5?.buys || 0, sells: p.txns?.m5?.sells || 0 },
      h1: { buys: p.txns?.h1?.buys || 0, sells: p.txns?.h1?.sells || 0 },
      h6: { buys: p.txns?.h6?.buys || 0, sells: p.txns?.h6?.sells || 0 },
      h24: { buys: p.txns?.h24?.buys || 0, sells: p.txns?.h24?.sells || 0 },
    },
    info: p.info || null,
    boosts: p.boosts || null,
  };
}

/**
 * Get enriched trending/boosted tokens — boosted list + batch pair data
 */
async function getEnrichedTrending() {
  const key = "dex_enriched_trending";
  const cached = cache.get(key);
  if (cached) return cached;

  const boosted = await getTopBoosted();
  if (!boosted.length) return [];

  // Group by chain
  const byChain = {};
  for (const t of boosted) {
    const chain = t.chainId || "solana";
    if (!byChain[chain]) byChain[chain] = [];
    byChain[chain].push(t);
  }

  // Batch fetch pair data per chain
  const pairMap = {};
  const batchLimit = 30;

  for (const [chain, tokens] of Object.entries(byChain)) {
    for (let i = 0; i < tokens.length; i += batchLimit) {
      const batch = tokens.slice(i, i + batchLimit);
      const addresses = batch.map((t) => t.tokenAddress).join(",");
      try {
        const data = await dexFetch(`${DEX_BASE}/tokens/v1/${chain}/${addresses}`);
        const pairs = Array.isArray(data) ? data : [];
        for (const pair of pairs) {
          const addr = pair.baseToken?.address;
          if (!addr) continue;
          const normalized = normalizePair(pair);
          if (!pairMap[addr] || normalized.liquidity.usd > (pairMap[addr].liquidity?.usd || 0)) {
            pairMap[addr] = normalized;
          }
        }
      } catch (err) {
        console.warn(`[DexScreener] Trending batch fetch failed for ${chain}:`, err.message);
      }
    }
  }

  // Merge boosted token + pair data
  const enriched = boosted.map((t) => ({
    ...t,
    pair: pairMap[t.tokenAddress] || null,
  }));

  cache.set(key, enriched, TTL_TRENDING);
  return enriched;
}

/**
 * Multi-source fresh Solana pairs for the screener.
 * Sources: DexScreener trending + profiles + token-boosts
 * Deduplicates, enriches with safety indicators, filters graduated/stale.
 */
async function getFreshSolanaPairs() {
  const key = "dex_fresh_solana";
  const cached = cache.get(key);
  if (cached) return cached;

  const pairMap = {}; // baseToken.address → best pair

  // ── Source 1: Top Boosted tokens → batch fetch their pairs ──
  try {
    const boosted = await getTopBoosted();
    const solBoosted = boosted.filter(t => t.chainId === "solana").slice(0, 30);
    if (solBoosted.length > 0) {
      const addresses = solBoosted.map(t => t.tokenAddress).join(",");
      const data = await dexFetch(`${DEX_BASE}/tokens/v1/solana/${addresses}`);
      const pairs = Array.isArray(data) ? data : [];
      for (const p of pairs) {
        const addr = p.baseToken?.address;
        if (!addr) continue;
        const norm = normalizePair(p);
        norm._source = "boosted";
        if (!pairMap[addr] || norm.liquidity.usd > (pairMap[addr].liquidity?.usd || 0)) {
          pairMap[addr] = norm;
        }
      }
    }
  } catch (e) { console.warn("[FreshPairs] Boosted fetch failed:", e.message); }

  // ── Source 2: Latest token profiles → batch fetch pairs ──
  try {
    const profiles = await getLatestProfiles();
    const solProfiles = profiles.filter(p => p.chainId === "solana").slice(0, 30);
    if (solProfiles.length > 0) {
      const addresses = solProfiles.map(p => p.tokenAddress).join(",");
      const data = await dexFetch(`${DEX_BASE}/tokens/v1/solana/${addresses}`);
      const pairs = Array.isArray(data) ? data : [];
      for (const p of pairs) {
        const addr = p.baseToken?.address;
        if (!addr) continue;
        const norm = normalizePair(p);
        norm._source = norm._source || "profile";
        if (!pairMap[addr] || norm.liquidity.usd > (pairMap[addr].liquidity?.usd || 0)) {
          pairMap[addr] = norm;
        }
      }
    }
  } catch (e) { console.warn("[FreshPairs] Profiles fetch failed:", e.message); }

  // ── Source 3: Trending tokens ──
  try {
    const trending = await getTrending();
    const solTrending = trending.filter(t => t.chainId === "solana").slice(0, 30);
    if (solTrending.length > 0) {
      const addresses = solTrending.map(t => t.tokenAddress).join(",");
      const data = await dexFetch(`${DEX_BASE}/tokens/v1/solana/${addresses}`);
      const pairs = Array.isArray(data) ? data : [];
      for (const p of pairs) {
        const addr = p.baseToken?.address;
        if (!addr) continue;
        const norm = normalizePair(p);
        norm._source = norm._source || "trending";
        if (!pairMap[addr] || norm.liquidity.usd > (pairMap[addr].liquidity?.usd || 0)) {
          pairMap[addr] = norm;
        }
      }
    }
  } catch (e) { console.warn("[FreshPairs] Trending fetch failed:", e.message); }

  // ── Enrich with computed safety fields ──
  const now = Date.now();
  const allPairs = Object.values(pairMap).map(p => {
    const ageMs = p.pairCreatedAt > 0 ? now - p.pairCreatedAt : 0;
    const ageHours = ageMs / 3600000;
    const txTotal24 = (p.txns?.h24?.buys || 0) + (p.txns?.h24?.sells || 0);
    const buyRatio = txTotal24 > 0 ? (p.txns.h24.buys / txTotal24) : 0.5;
    const liq = p.liquidity?.usd || 0;
    const vol = p.volume?.h24 || 0;
    const volLiqRatio = liq > 0 ? vol / liq : 0;

    // Safety score: 0-100
    let safety = 50;
    if (liq >= 50000) safety += 15;
    else if (liq >= 10000) safety += 8;
    else if (liq < 1000) safety -= 20;
    if (txTotal24 >= 500) safety += 10;
    else if (txTotal24 >= 100) safety += 5;
    else if (txTotal24 < 10) safety -= 15;
    if (buyRatio > 0.3 && buyRatio < 0.7) safety += 5;
    if (volLiqRatio > 10 && liq < 5000) safety -= 15; // suspicious wash trading
    if (ageHours < 1) safety -= 5; // very new = risky
    if (ageHours > 24 * 30) safety -= 10; // very old = likely graduated
    safety = Math.max(0, Math.min(100, safety));

    return {
      ...p,
      ageMs,
      ageHours,
      txTotal24,
      buyRatio,
      volLiqRatio,
      safety,
      isGraduated: ageHours > 24 * 14 && vol < 1000, // older than 14d with <$1k vol
    };
  });

  // Sort: safety desc, then volume desc
  allPairs.sort((a, b) => {
    if (b.safety !== a.safety) return b.safety - a.safety;
    return (b.volume?.h24 || 0) - (a.volume?.h24 || 0);
  });

  console.log(`[FreshPairs] Returning ${allPairs.length} Solana pairs from ${Object.keys(pairMap).length} unique tokens`);
  cache.set(key, allPairs, 20); // 20s cache for freshness
  return allPairs;
}

/**
 * Top gainers and losers from fresh Solana pairs (by 24h price change)
 */
async function getTopGainersLosers(limit = 20) {
  const key = `dex_gainers_losers_${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const allPairs = await getFreshSolanaPairs();
  const withChange = allPairs.filter(p => p.priceChange?.h24 && p.liquidity?.usd > 500 && (p.txns?.h24?.buys || 0) + (p.txns?.h24?.sells || 0) > 5);

  const sorted = [...withChange].sort((a, b) => (b.priceChange?.h24 || 0) - (a.priceChange?.h24 || 0));
  const gainers = sorted.slice(0, limit);
  const losers = sorted.slice(-limit).reverse();

  const result = { gainers, losers };
  cache.set(key, result, 30);
  return result;
}

module.exports = {
  searchPairs,
  getTokenPairs,
  getTrending,
  getTopBoosted,
  getLatestProfiles,
  getEnrichedNewPairs,
  getEnrichedTrending,
  getTokenPools,
  getFreshSolanaPairs,
  getTopGainersLosers,
};
