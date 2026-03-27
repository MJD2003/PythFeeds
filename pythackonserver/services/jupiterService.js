const { cache } = require("../config/cache");
const { getBreaker } = require("../middleware/circuitBreaker");

const cb = getBreaker("jupiter");
const JUP_BASE = "https://api.jup.ag";
const JUP_TOKENS = "https://tokens.jup.ag";

const TTL_TRENDING = 30;
const TTL_PRICES = 15;
const TTL_TOKEN = 300;
const TTL_LIST = 120;

async function jupFetch(url) {
  return cb.call(async () => {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Jupiter ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  });
}

/**
 * Get verified token list from Jupiter
 */
async function getVerifiedTokens(limit = 100) {
  const key = `jup_verified_${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await jupFetch(`${JUP_TOKENS}/tokens?tags=verified`);
  const tokens = Array.isArray(data) ? data.slice(0, limit) : [];
  cache.set(key, tokens, TTL_LIST);
  return tokens;
}

/**
 * Get all tradeable tokens sorted by daily volume (trending proxy)
 */
async function getTrendingTokens(limit = 50) {
  const key = `jup_trending_${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await jupFetch(`${JUP_TOKENS}/tokens?tags=verified`);
  const tokens = Array.isArray(data) ? data : [];

  // Sort by daily_volume descending as a proxy for trending
  const sorted = tokens
    .filter((t) => t.daily_volume > 0)
    .sort((a, b) => (b.daily_volume || 0) - (a.daily_volume || 0))
    .slice(0, limit)
    .map(normalizeJupToken);

  cache.set(key, sorted, TTL_TRENDING);
  return sorted;
}

/**
 * Batch price lookup via Jupiter Price API v2 (free, no key)
 */
async function getPrices(mints) {
  if (!mints || mints.length === 0) return {};
  const ids = mints.join(",");
  const key = `jup_prices_${ids.slice(0, 80)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await jupFetch(`${JUP_BASE}/price/v2?ids=${ids}`);
  const prices = data?.data || {};
  cache.set(key, prices, TTL_PRICES);
  return prices;
}

/**
 * Get token metadata by mint address
 */
async function getTokenByMint(mint) {
  const key = `jup_token_${mint}`;
  const cached = cache.get(key);
  if (cached) return cached;

  // Search in full token list
  const data = await jupFetch(`${JUP_TOKENS}/tokens?tags=verified`);
  const tokens = Array.isArray(data) ? data : [];
  const token = tokens.find((t) => t.address === mint);

  if (token) {
    const normalized = normalizeJupToken(token);
    cache.set(key, normalized, TTL_TOKEN);
    return normalized;
  }

  // Fallback: try strict token list (unverified)
  try {
    const allData = await jupFetch(`${JUP_TOKENS}/tokens_with_markets`);
    const all = Array.isArray(allData) ? allData : [];
    const found = all.find((t) => t.address === mint);
    if (found) {
      const normalized = normalizeJupToken(found);
      cache.set(key, normalized, TTL_TOKEN);
      return normalized;
    }
  } catch (e) {
    // fallback failed
  }

  return null;
}

/**
 * Search tokens by query
 */
async function searchTokens(query, limit = 20) {
  const key = `jup_search_${query.toLowerCase()}_${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await jupFetch(`${JUP_TOKENS}/tokens?tags=verified`);
  const tokens = Array.isArray(data) ? data : [];
  const q = query.toLowerCase();

  const matches = tokens
    .filter(
      (t) =>
        t.symbol?.toLowerCase().includes(q) ||
        t.name?.toLowerCase().includes(q) ||
        t.address?.toLowerCase() === q
    )
    .sort((a, b) => (b.daily_volume || 0) - (a.daily_volume || 0))
    .slice(0, limit)
    .map(normalizeJupToken);

  cache.set(key, matches, TTL_LIST);
  return matches;
}

function normalizeJupToken(t) {
  return {
    address: t.address || "",
    symbol: t.symbol || "???",
    name: t.name || "Unknown",
    decimals: t.decimals ?? 6,
    logoURI: t.logoURI || "",
    dailyVolume: t.daily_volume || 0,
    tags: t.tags || [],
    verified: (t.tags || []).includes("verified"),
    freezeAuthority: t.freeze_authority || null,
    mintAuthority: t.mint_authority || null,
  };
}

module.exports = {
  getVerifiedTokens,
  getTrendingTokens,
  getPrices,
  getTokenByMint,
  searchTokens,
};
