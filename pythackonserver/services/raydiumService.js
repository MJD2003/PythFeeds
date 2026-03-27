const { cache } = require("../config/cache");
const { getBreaker } = require("../middleware/circuitBreaker");

const cb = getBreaker("raydium");
const RAY_BASE = "https://api-v3.raydium.io";

const TTL_POOLS = 60;
const TTL_NEW_POOLS = 30;
const TTL_TOKEN = 300;
const TTL_MINT_LIST = 120;

async function rayFetch(url) {
  return cb.call(async () => {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Raydium ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  });
}

/**
 * Get pool list with volume/TVL — paginated
 */
async function getPools(page = 1, pageSize = 50, sortBy = "volume24h", sortOrder = "desc") {
  const key = `ray_pools_${page}_${pageSize}_${sortBy}_${sortOrder}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await rayFetch(
    `${RAY_BASE}/pools/info/list?poolType=all&poolSortField=${sortBy}&sortType=${sortOrder}&pageSize=${pageSize}&page=${page}`
  );

  const result = {
    pools: ((data?.data?.data) || []).map(normalizePool),
    count: data?.data?.count || 0,
    hasNextPage: data?.data?.hasNextPage || false,
  };

  cache.set(key, result, TTL_POOLS);
  return result;
}

/**
 * Get newly created pools (sorted by openTime desc)
 */
async function getNewPools(limit = 50) {
  const key = `ray_new_pools_${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await rayFetch(
    `${RAY_BASE}/pools/info/list?poolType=all&poolSortField=liquidity&sortType=desc&pageSize=${limit}&page=1`
  );

  const pools = ((data?.data?.data) || [])
    .map(normalizePool)
    .filter((p) => p.openTime > 0)
    .sort((a, b) => b.openTime - a.openTime)
    .slice(0, limit);

  cache.set(key, pools, TTL_NEW_POOLS);
  return pools;
}

/**
 * Get pools for a specific token mint
 */
async function getPoolsByMint(mint) {
  const key = `ray_mint_pools_${mint}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await rayFetch(`${RAY_BASE}/pools/info/mint?mint1=${mint}&poolType=all&poolSortField=liquidity&sortType=desc&pageSize=20&page=1`);
  const pools = ((data?.data?.data) || []).map(normalizePool);

  cache.set(key, pools, TTL_POOLS);
  return pools;
}

/**
 * Get Raydium mint list (token metadata)
 */
async function getMintList() {
  const key = "ray_mint_list";
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await rayFetch(`${RAY_BASE}/mint/list`);
  const mints = data?.data || {};

  cache.set(key, mints, TTL_MINT_LIST);
  return mints;
}

/**
 * Get token info from mint list
 */
async function getTokenByMint(mint) {
  const key = `ray_token_${mint}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const mints = await getMintList();
  // mintList is { mintAddress: { symbol, name, decimals, ... } } or array
  let token = null;
  if (mints && typeof mints === "object") {
    if (mints[mint]) {
      token = { address: mint, ...mints[mint] };
    } else if (Array.isArray(mints)) {
      token = mints.find((m) => m.address === mint || m.mint === mint);
    }
  }

  if (token) {
    cache.set(key, token, TTL_TOKEN);
  }
  return token;
}

function normalizePool(p) {
  const mintA = p.mintA || {};
  const mintB = p.mintB || {};
  return {
    id: p.id || "",
    type: p.type || "Standard",
    programId: p.programId || "",
    mintA: {
      address: mintA.address || p.mintA?.address || "",
      symbol: mintA.symbol || "???",
      name: mintA.name || "",
      decimals: mintA.decimals ?? 6,
      logoURI: mintA.logoURI || "",
    },
    mintB: {
      address: mintB.address || p.mintB?.address || "",
      symbol: mintB.symbol || "???",
      name: mintB.name || "",
      decimals: mintB.decimals ?? 6,
      logoURI: mintB.logoURI || "",
    },
    price: p.price || 0,
    tvl: p.tvl || 0,
    volume24h: p.day?.volume || 0,
    volumeQuote24h: p.day?.volumeQuote || 0,
    fee24h: p.day?.fee || 0,
    apr24h: p.day?.apr || 0,
    apr7d: p.week?.apr || 0,
    apr30d: p.month?.apr || 0,
    lpFeeRate: p.feeRate || 0,
    openTime: p.openTime ? p.openTime * 1000 : 0, // convert to ms
    lpMint: p.lpMint?.address || "",
    lpPrice: p.lpPrice || 0,
    farmCount: p.farmCount || 0,
    isOpenBook: p.marketId ? true : false,
    burnPercent: p.burnPercent || 0,
  };
}

/**
 * Get LaunchLab tokens — three-source approach for fresh real-time data:
 *  1. DexScreener latest profiles + boosted → filter Solana/Raydium pairs
 *  2. Raydium API v3 new pools (sorted by liquidity, filtered by recency)
 *  3. DexScreener trending → filter Solana/Raydium
 * Merges, deduplicates, and returns sorted by recency/volume.
 */
async function getLaunchLabTokens(limit = 50) {
  const key = `ray_launchlab_${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const DEX_BASE = "https://api.dexscreener.com";

  const dexPairMap = {}; // baseToken.address → best pair

  // ── Source 1: DexScreener latest profiles → batch fetch Raydium pairs ──
  try {
    const profRes = await fetch(`${DEX_BASE}/token-profiles/latest/v1`, { headers: { Accept: "application/json" } });
    if (profRes.ok) {
      const profiles = await profRes.json();
      const solProfiles = (Array.isArray(profiles) ? profiles : []).filter(p => p.chainId === "solana").slice(0, 30);
      if (solProfiles.length > 0) {
        const addresses = solProfiles.map(p => p.tokenAddress).join(",");
        const pairRes = await fetch(`${DEX_BASE}/tokens/v1/solana/${addresses}`, { headers: { Accept: "application/json" } });
        if (pairRes.ok) {
          const pairs = await pairRes.json();
          for (const p of (Array.isArray(pairs) ? pairs : [])) {
            if (p.dexId !== "raydium") continue;
            const addr = p.baseToken?.address;
            if (!addr) continue;
            const liq = p.liquidity?.usd || 0;
            if (!dexPairMap[addr] || liq > (dexPairMap[addr].liquidity?.usd || 0)) {
              dexPairMap[addr] = p;
            }
          }
        }
      }
    }
  } catch (e) { console.warn("[LaunchLab] Profiles fetch failed:", e.message); }

  // ── Source 2: DexScreener top boosted → filter Raydium ──
  try {
    const boostRes = await fetch(`${DEX_BASE}/token-boosts/top/v1`, { headers: { Accept: "application/json" } });
    if (boostRes.ok) {
      const boosted = await boostRes.json();
      const solBoosted = (Array.isArray(boosted) ? boosted : []).filter(t => t.chainId === "solana").slice(0, 30);
      if (solBoosted.length > 0) {
        const addresses = solBoosted.map(t => t.tokenAddress).join(",");
        const pairRes = await fetch(`${DEX_BASE}/tokens/v1/solana/${addresses}`, { headers: { Accept: "application/json" } });
        if (pairRes.ok) {
          const pairs = await pairRes.json();
          for (const p of (Array.isArray(pairs) ? pairs : [])) {
            if (p.dexId !== "raydium") continue;
            const addr = p.baseToken?.address;
            if (!addr) continue;
            const liq = p.liquidity?.usd || 0;
            if (!dexPairMap[addr] || liq > (dexPairMap[addr].liquidity?.usd || 0)) {
              dexPairMap[addr] = p;
            }
          }
        }
      }
    }
  } catch (e) { console.warn("[LaunchLab] Boosted fetch failed:", e.message); }

  // ── Source 3: DexScreener latest boosts (trending) → filter Raydium ──
  try {
    const trendRes = await fetch(`${DEX_BASE}/token-boosts/latest/v1`, { headers: { Accept: "application/json" } });
    if (trendRes.ok) {
      const trending = await trendRes.json();
      const solTrending = (Array.isArray(trending) ? trending : []).filter(t => t.chainId === "solana").slice(0, 30);
      if (solTrending.length > 0) {
        const addresses = solTrending.map(t => t.tokenAddress).join(",");
        const pairRes = await fetch(`${DEX_BASE}/tokens/v1/solana/${addresses}`, { headers: { Accept: "application/json" } });
        if (pairRes.ok) {
          const pairs = await pairRes.json();
          for (const p of (Array.isArray(pairs) ? pairs : [])) {
            if (p.dexId !== "raydium") continue;
            const addr = p.baseToken?.address;
            if (!addr) continue;
            const liq = p.liquidity?.usd || 0;
            if (!dexPairMap[addr] || liq > (dexPairMap[addr].liquidity?.usd || 0)) {
              dexPairMap[addr] = p;
            }
          }
        }
      }
    }
  } catch (e) { console.warn("[LaunchLab] Trending fetch failed:", e.message); }

  console.log(`[LaunchLab] DexScreener found ${Object.keys(dexPairMap).length} unique Raydium pairs`);

  // ── Source 4: Raydium API v3 new pools (by liquidity, recent only) ──
  let rayPools = [];
  try {
    const res = await fetch(
      `${RAY_BASE}/pools/info/list?poolType=all&poolSortField=liquidity&sortType=desc&pageSize=100&page=1`
    );
    if (res.ok) {
      const data = await res.json();
      rayPools = (data?.data?.data || []).filter(p => {
        // Only keep pools created within the last 7 days
        const age = p.openTime ? Date.now() - p.openTime * 1000 : Infinity;
        return age < 7 * 24 * 3600 * 1000;
      });
      console.log(`[LaunchLab] Raydium API returned ${rayPools.length} recent pools`);
    }
  } catch (err) {
    console.warn("[LaunchLab] Raydium API failed:", err.message);
  }

  // Build Raydium pool map
  const rayPoolMap = {};
  for (const pool of rayPools) {
    const addr = pool.mintA?.address;
    if (!addr) continue;
    rayPoolMap[addr] = pool;
  }

  // ── Merge both sources ──
  const mergedTokens = Object.entries(dexPairMap).map(([addr, pair]) => {
    const rayPool = rayPoolMap[addr] || null;
    return {
      tokenAddress: addr,
      chainId: "solana",
      icon: pair.info?.imageUrl || rayPool?.mintA?.logoURI || "",
      header: pair.info?.header || "",
      description: "",
      url: pair.url || "",
      links: pair.info?.websites?.map((w) => ({ type: "website", url: w })) || [],
      pair: normalizeLaunchLabPair(pair),
      tvl: rayPool?.tvl || pair.liquidity?.usd || 0,
      burnPercent: rayPool?.burnPercent || 0,
      poolType: rayPool?.type || pair.labels?.[0] || "AMM",
    };
  });

  // Add Raydium pools that DexScreener missed
  for (const pool of rayPools) {
    const addr = pool.mintA?.address;
    if (!addr || dexPairMap[addr]) continue;
    const sym = (pool.mintA?.symbol || "").toUpperCase();
    if (["WSOL", "USDC", "USDT", "SOL"].includes(sym)) continue;

    mergedTokens.push({
      tokenAddress: addr,
      chainId: "solana",
      icon: pool.mintA?.logoURI || "",
      header: "",
      description: "",
      url: "",
      links: [],
      pair: {
        chainId: "solana",
        dexId: "raydium",
        pairAddress: pool.id || "",
        url: `https://raydium.io/swap/?inputMint=So11111111111111111111111111111111111111112&outputMint=${addr}`,
        baseToken: {
          address: addr,
          name: pool.mintA?.name || "",
          symbol: pool.mintA?.symbol || "",
        },
        quoteToken: {
          address: pool.mintB?.address || "",
          name: pool.mintB?.name || "",
          symbol: pool.mintB?.symbol || "",
        },
        priceNative: String(pool.price || "0"),
        priceUsd: String(pool.price || "0"),
        liquidity: { usd: pool.tvl || 0, base: 0, quote: 0 },
        fdv: 0,
        marketCap: 0,
        pairCreatedAt: pool.openTime ? pool.openTime * 1000 : 0,
        volume: {
          m5: 0, h1: 0, h6: 0,
          h24: pool.day?.volume || 0,
        },
        priceChange: {
          m5: 0, h1: 0, h6: 0,
          h24: pool.day?.priceChange || 0,
        },
        txns: {
          m5: { buys: 0, sells: 0 }, h1: { buys: 0, sells: 0 },
          h6: { buys: 0, sells: 0 }, h24: { buys: 0, sells: 0 },
        },
        info: null,
      },
      tvl: pool.tvl || 0,
      burnPercent: pool.burnPercent || 0,
      poolType: pool.type || "AMM",
    });
  }

  // Sort: newest first, then by volume
  const sorted = mergedTokens
    .sort((a, b) => {
      const aCreated = a.pair.pairCreatedAt || 0;
      const bCreated = b.pair.pairCreatedAt || 0;
      if (bCreated !== aCreated) return bCreated - aCreated;
      return (b.pair.volume?.h24 || 0) - (a.pair.volume?.h24 || 0);
    })
    .slice(0, limit);

  console.log(`[LaunchLab] Returning ${sorted.length} tokens`);
  cache.set(key, sorted, 30); // 30s cache for freshness
  return sorted;
}

function normalizeLaunchLabPair(p) {
  return {
    chainId: p.chainId || "solana",
    dexId: p.dexId || "raydium",
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
  };
}

module.exports = {
  getPools,
  getNewPools,
  getPoolsByMint,
  getMintList,
  getTokenByMint,
  getLaunchLabTokens,
};
