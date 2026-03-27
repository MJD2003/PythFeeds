const { cache } = require("../config/cache");
const { getBreaker } = require("../middleware/circuitBreaker");

const cb = getBreaker("pumpfun");
const PUMP_BASE = "https://frontend-api-v3.pump.fun";

const TTL_LATEST = 20;
const TTL_GRADUATED = 30;
const TTL_TOKEN = 120;

async function pumpFetch(url) {
  return cb.call(async () => {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "PythFeeds/1.0",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Pump.fun ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  });
}

/**
 * Get latest token launches from Pump.fun
 */
async function getLatestTokens(limit = 50, offset = 0, sort = "creation_time", order = "DESC") {
  const key = `pump_latest_${limit}_${offset}_${sort}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await pumpFetch(
    `${PUMP_BASE}/coins?offset=${offset}&limit=${limit}&sort=${sort}&order=${order}&includeNsfw=false`
  );
  const tokens = (Array.isArray(data) ? data : []).map(normalizePumpToken);

  cache.set(key, tokens, TTL_LATEST);
  return tokens;
}

/**
 * Get "King of the Hill" — tokens that completed the bonding curve
 */
async function getGraduatedTokens(limit = 50) {
  const key = `pump_graduated_${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  // /king-of-the-hill returns empty — use /coins sorted by market_cap instead
  const data = await pumpFetch(
    `${PUMP_BASE}/coins?offset=0&limit=${limit}&sort=market_cap&order=DESC&includeNsfw=false`
  );
  const tokens = (Array.isArray(data) ? data : []).map(normalizePumpToken);

  cache.set(key, tokens, TTL_GRADUATED);
  return tokens;
}

/**
 * Get token detail by mint address
 */
async function getTokenByMint(mint) {
  const key = `pump_token_${mint}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await pumpFetch(`${PUMP_BASE}/coins/${mint}`);
  if (!data || !data.mint) return null;

  const token = normalizePumpToken(data);
  cache.set(key, token, TTL_TOKEN);
  return token;
}

/**
 * Get trending tokens (high reply count + recent activity)
 */
async function getTrendingTokens(limit = 30) {
  const key = `pump_trending_${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await pumpFetch(
    `${PUMP_BASE}/coins?offset=0&limit=${limit}&sort=last_reply&order=DESC&includeNsfw=false`
  );
  const tokens = (Array.isArray(data) ? data : []).map(normalizePumpToken);
  cache.set(key, tokens, TTL_LATEST);
  return tokens;
}

/**
 * Get tokens about to graduate (>60% bonding curve, not yet graduated)
 */
async function getAboutToGraduate(limit = 30) {
  const key = `pump_about_to_grad_${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  // Fetch a large pool of recent tokens sorted by mcap and filter for near-graduation
  const data = await pumpFetch(
    `${PUMP_BASE}/coins?offset=0&limit=${Math.min(limit * 3, 150)}&sort=market_cap&order=DESC&includeNsfw=false`
  );
  const all = (Array.isArray(data) ? data : []).map(normalizePumpToken);
  const nearGrad = all
    .filter((t) => !t.bondingCurveComplete && t.bondingProgress >= 60)
    .sort((a, b) => b.bondingProgress - a.bondingProgress)
    .slice(0, limit);

  cache.set(key, nearGrad, TTL_LATEST);
  return nearGrad;
}

function normalizePumpToken(t) {
  const bondingCurveComplete = t.complete === true || t.bonding_curve_complete === true;
  const marketCapSol = t.market_cap || 0;
  const usdMarketCap = t.usd_market_cap || 0;
  const virtualSolReserves = t.virtual_sol_reserves || 0;
  const virtualTokenReserves = t.virtual_token_reserves || 0;

  // Bonding curve progress (0-100%)
  let bondingProgress = 0;
  if (bondingCurveComplete) {
    bondingProgress = 100;
  } else if (t.virtual_sol_reserves && t.real_sol_reserves) {
    const realSol = (t.real_sol_reserves || 0) / 1e9;
    bondingProgress = Math.min(100, Math.round((realSol / 85) * 100));
  }

  // Estimate token price from reserves
  let estimatedPrice = 0;
  if (virtualSolReserves > 0 && virtualTokenReserves > 0) {
    estimatedPrice = (virtualSolReserves / 1e9) / (virtualTokenReserves / 1e6);
  }

  // Social score (0-100) based on available metadata
  let socialScore = 0;
  if (t.website) socialScore += 25;
  if (t.twitter) socialScore += 30;
  if (t.telegram) socialScore += 25;
  if ((t.reply_count || 0) > 10) socialScore += 10;
  if ((t.reply_count || 0) > 50) socialScore += 10;

  // Age in seconds
  const ageSeconds = t.created_timestamp ? Math.floor(Date.now() / 1000) - t.created_timestamp : 0;

  return {
    mint: t.mint || "",
    name: t.name || "Unknown",
    symbol: t.symbol || "???",
    description: t.description || "",
    imageUri: t.image_uri || "",
    metadataUri: t.metadata_uri || "",
    creator: t.creator || "",
    createdTimestamp: t.created_timestamp || 0,
    bondingCurveComplete,
    bondingProgress,
    marketCapSol,
    usdMarketCap,
    virtualSolReserves,
    virtualTokenReserves,
    totalSupply: t.total_supply || 0,
    website: t.website || "",
    twitter: t.twitter || "",
    telegram: t.telegram || "",
    kingOfTheHill: t.king_of_the_hill_timestamp ? true : false,
    kingTimestamp: t.king_of_the_hill_timestamp || 0,
    replyCount: t.reply_count || 0,
    lastReply: t.last_reply || 0,
    raydiumPool: t.raydium_pool || null,
    isNsfw: t.is_currently_live === false && t.nsfw === true,
    // New enriched fields
    estimatedPrice,
    socialScore,
    ageSeconds,
    realSolReserves: (t.real_sol_reserves || 0) / 1e9,
    isLive: t.is_currently_live || false,
  };
}

module.exports = {
  getLatestTokens,
  getGraduatedTokens,
  getTokenByMint,
  getTrendingTokens,
  getAboutToGraduate,
};
