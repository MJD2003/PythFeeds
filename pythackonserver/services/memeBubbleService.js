const { cache } = require("../config/cache");
const dexService = require("./dexscreenerService");
const pumpService = require("./pumpfunService");
const jupiterService = require("./jupiterService");
const raydiumService = require("./raydiumService");

const TTL_MEME_BUBBLES = 45; // 45s cache

/**
 * Aggregate meme coin data from multiple sources for bubble visualization.
 * Returns normalized array: { symbol, name, image, price, change1h, change24h, change7d,
 *   mcap, volume, source, sparkline, mint, bondingProgress }
 */
async function getMemeBubbles(limit = 100) {
  const key = `meme_bubbles_${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const seen = new Map(); // mint -> token (dedup by mint address)

  // Fetch from all sources in parallel
  const [dexTrending, dexFresh, pumpGrad, pumpLatest, jupTrending, launchLab] =
    await Promise.allSettled([
      dexService.getEnrichedTrending().catch(() => []),
      dexService.getFreshSolanaPairs().catch(() => []),
      pumpService.getGraduatedTokens(60).catch(() => []),
      pumpService.getLatestTokens(60, 0, "market_cap").catch(() => []),
      jupiterService.getTrendingTokens(80).catch(() => []),
      raydiumService.getLaunchLabTokens(60).catch(() => []),
    ]);

  // ── 1. DexScreener trending (Solana meme-like tokens) ──
  const dexTrendingVal = dexTrending.status === "fulfilled" ? dexTrending.value : [];
  for (const t of dexTrendingVal) {
    if (!t.tokenAddress || t.chainId !== "solana") continue;
    const pair = t.pairs?.[0] || t.pair;
    if (!pair) continue;
    const mint = t.tokenAddress;
    if (seen.has(mint)) continue;
    seen.set(mint, {
      symbol: (pair.baseToken?.symbol || t.symbol || "?").toUpperCase(),
      name: pair.baseToken?.name || t.description || t.symbol || "Unknown",
      image: t.icon || pair.info?.imageUrl || "",
      price: parseFloat(pair.priceUsd) || 0,
      change1h: pair.priceChange?.h1 || 0,
      change24h: pair.priceChange?.h24 || 0,
      change7d: 0,
      mcap: pair.marketCap || pair.fdv || 0,
      volume: pair.volume?.h24 || 0,
      source: "dexscreener",
      sparkline: [],
      mint,
      bondingProgress: null,
      pairAddress: pair.pairAddress || "",
      liquidity: pair.liquidity?.usd || 0,
      txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
    });
  }

  // ── 2. DexScreener fresh Solana pairs (already filtered for meme-like) ──
  const dexFreshVal = dexFresh.status === "fulfilled" ? dexFresh.value : [];
  for (const p of dexFreshVal) {
    const mint = p.baseToken?.address;
    if (!mint || seen.has(mint)) continue;
    // Only include if it has some volume/liquidity (not dead)
    if ((p.volume?.h24 || 0) < 500 && (p.liquidity?.usd || 0) < 1000) continue;
    seen.set(mint, {
      symbol: (p.baseToken?.symbol || "?").toUpperCase(),
      name: p.baseToken?.name || "Unknown",
      image: p.info?.imageUrl || "",
      price: parseFloat(p.priceUsd) || 0,
      change1h: p.priceChange?.h1 || 0,
      change24h: p.priceChange?.h24 || 0,
      change7d: 0,
      mcap: p.marketCap || p.fdv || 0,
      volume: p.volume?.h24 || 0,
      source: "dexscreener",
      sparkline: [],
      mint,
      bondingProgress: null,
      pairAddress: p.pairAddress || "",
      liquidity: p.liquidity?.usd || 0,
      txns24h: (p.txns?.h24?.buys || 0) + (p.txns?.h24?.sells || 0),
    });
  }

  // ── 3. Pump.fun graduated tokens ──
  const pumpGradVal = pumpGrad.status === "fulfilled" ? pumpGrad.value : [];
  for (const t of pumpGradVal) {
    if (!t.mint || seen.has(t.mint)) continue;
    seen.set(t.mint, {
      symbol: (t.symbol || "?").toUpperCase(),
      name: t.name || "Unknown",
      image: t.image_uri || "",
      price: 0, // Will be enriched below or by frontend
      change1h: 0,
      change24h: 0,
      change7d: 0,
      mcap: t.usd_market_cap || 0,
      volume: 0,
      source: "pumpfun",
      sparkline: [],
      mint: t.mint,
      bondingProgress: t.bondingProgress ?? 100,
      pairAddress: "",
      liquidity: 0,
      txns24h: 0,
    });
  }

  // ── 4. Pump.fun latest (high mcap, not yet graduated — about to graduate) ──
  const pumpLatestVal = pumpLatest.status === "fulfilled" ? pumpLatest.value : [];
  for (const t of pumpLatestVal) {
    if (!t.mint || seen.has(t.mint)) continue;
    if ((t.usd_market_cap || 0) < 5000) continue; // Skip dust
    seen.set(t.mint, {
      symbol: (t.symbol || "?").toUpperCase(),
      name: t.name || "Unknown",
      image: t.image_uri || "",
      price: 0,
      change1h: 0,
      change24h: 0,
      change7d: 0,
      mcap: t.usd_market_cap || 0,
      volume: 0,
      source: "pumpfun",
      sparkline: [],
      mint: t.mint,
      bondingProgress: t.bondingProgress ?? 0,
      pairAddress: "",
      liquidity: 0,
      txns24h: 0,
    });
  }

  // ── 5. Jupiter trending (filter likely meme tokens — low mcap, high volume) ──
  const jupTrendingVal = jupTrending.status === "fulfilled" ? jupTrending.value : [];
  for (const t of jupTrendingVal) {
    const mint = t.address;
    if (!mint || seen.has(mint)) continue;
    // Jupiter trending tokens that look like memes: not major coins
    const sym = (t.symbol || "").toUpperCase();
    const majorCoins = ["SOL", "USDC", "USDT", "ETH", "BTC", "WBTC", "WETH", "WSOL", "RAY", "JUP", "BONK", "JTO", "PYTH", "RNDR", "HNT"];
    if (majorCoins.includes(sym)) continue;
    seen.set(mint, {
      symbol: sym || "?",
      name: t.name || "Unknown",
      image: t.logoURI || "",
      price: 0,
      change1h: 0,
      change24h: 0,
      change7d: 0,
      mcap: t.mc || t.v || 0,
      volume: t.v || 0,
      source: "jupiter",
      sparkline: [],
      mint,
      bondingProgress: null,
      pairAddress: "",
      liquidity: 0,
      txns24h: 0,
    });
  }

  // ── 6. Raydium LaunchLab tokens ──
  const launchLabVal = launchLab.status === "fulfilled" ? launchLab.value : [];
  for (const t of launchLabVal) {
    const mint = t.tokenAddress;
    if (!mint || seen.has(mint)) continue;
    const pair = t.pair || {};
    seen.set(mint, {
      symbol: (pair.baseToken?.symbol || t.symbol || "?").toUpperCase(),
      name: pair.baseToken?.name || t.name || "Unknown",
      image: t.icon || pair.info?.imageUrl || "",
      price: parseFloat(pair.priceUsd) || 0,
      change1h: pair.priceChange?.h1 || 0,
      change24h: pair.priceChange?.h24 || 0,
      change7d: 0,
      mcap: pair.marketCap || pair.fdv || 0,
      volume: pair.volume?.h24 || 0,
      source: "raydium",
      sparkline: [],
      mint,
      bondingProgress: null,
      pairAddress: pair.pairAddress || "",
      liquidity: pair.liquidity?.usd || 0,
      txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
    });
  }

  // ── Merge, sort by mcap desc, cap at limit ──
  let tokens = Array.from(seen.values());

  // Filter out tokens with zero mcap AND zero volume (dead/empty)
  tokens = tokens.filter((t) => t.mcap > 0 || t.volume > 500);

  // Sort: prioritize by mcap, then volume
  tokens.sort((a, b) => {
    const scoreA = (a.mcap || 0) + (a.volume || 0) * 0.5;
    const scoreB = (b.mcap || 0) + (b.volume || 0) * 0.5;
    return scoreB - scoreA;
  });

  tokens = tokens.slice(0, limit);

  // Assign ranks
  tokens.forEach((t, i) => { t.rank = i + 1; });

  cache.set(key, tokens, TTL_MEME_BUBBLES);
  return tokens;
}

module.exports = { getMemeBubbles };
