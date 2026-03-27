const CG_BASE = "https://api.coingecko.com/api/v3";

// Simple in-memory cache with TTL
const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 60_000; // 1 minute

async function cgFetch<T>(path: string, ttl = CACHE_TTL): Promise<T | null> {
  const key = path;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data as T;

  try {
    const res = await fetch(`${CG_BASE}${path}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json();
    cache.set(key, { data, expires: Date.now() + ttl });
    return data as T;
  } catch (err) {
    console.error(`[CoinGecko] ${path}:`, err);
    return null;
  }
}

/* ─── Types ─── */
export interface CGCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_24h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
  circulating_supply: number;
  sparkline_in_7d?: { price: number[] };
}

export interface CGCoinDetail {
  id: string;
  symbol: string;
  name: string;
  image: { small: string; large: string };
  market_cap_rank: number;
  genesis_date: string | null;
  links: {
    homepage: string[];
    blockchain_site: string[];
    official_forum_url: string[];
    subreddit_url: string;
    repos_url: { github: string[] };
  };
  market_data: {
    current_price: { usd: number; btc: number; eth: number };
    price_change_percentage_24h: number;
    price_change_percentage_24h_in_currency: { btc: number; eth: number };
    low_24h: { usd: number };
    high_24h: { usd: number };
    market_cap: { usd: number };
    fully_diluted_valuation: { usd: number };
    total_volume: { usd: number };
    circulating_supply: number;
    total_supply: number | null;
    max_supply: number | null;
  };
  description: { en: string };
}

export interface CGSearchResult {
  coins: { id: string; name: string; symbol: string; thumb: string; market_cap_rank: number | null }[];
  exchanges: { id: string; name: string; thumb: string }[];
}

export interface CGTrending {
  coins: { item: { id: string; name: string; symbol: string; thumb: string; price_btc: number; market_cap_rank: number } }[];
}

export interface CGGlobalData {
  data: {
    total_market_cap: { usd: number };
    total_volume: { usd: number };
    market_cap_percentage: { btc: number; eth: number };
    market_cap_change_percentage_24h_usd: number;
    active_cryptocurrencies: number;
  };
}

export interface CGExchange {
  id: string;
  name: string;
  image: string;
  trust_score: number;
  trust_score_rank: number;
  trade_volume_24h_btc: number;
  trade_volume_24h_btc_normalized: number;
  year_established: number | null;
  country: string | null;
}

/* ─── API Functions ─── */

/**
 * Fetch top coins by market cap
 */
export async function fetchCoins(
  page = 1,
  perPage = 100,
  sparkline = true,
): Promise<CGCoin[]> {
  const data = await cgFetch<CGCoin[]>(
    `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=${sparkline}&price_change_percentage=1h,24h,7d`
  );
  return data || [];
}

/**
 * Fetch coin detail by ID (slug)
 */
export async function fetchCoinDetail(id: string): Promise<CGCoinDetail | null> {
  return cgFetch<CGCoinDetail>(
    `/coins/${id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`,
    120_000, // cache 2 min
  );
}

/**
 * Search coins and exchanges
 */
export async function searchCoinGecko(query: string): Promise<CGSearchResult | null> {
  if (!query || query.length < 2) return null;
  return cgFetch<CGSearchResult>(`/search?query=${encodeURIComponent(query)}`, 30_000);
}

/**
 * Fetch trending coins
 */
export async function fetchTrending(): Promise<CGTrending | null> {
  return cgFetch<CGTrending>("/search/trending", 300_000); // cache 5 min
}

/**
 * Fetch global market data
 */
export async function fetchGlobalData(): Promise<CGGlobalData | null> {
  return cgFetch<CGGlobalData>("/global", 120_000);
}

/**
 * Fetch exchanges list
 */
export async function fetchExchanges(page = 1, perPage = 100): Promise<CGExchange[]> {
  const data = await cgFetch<CGExchange[]>(
    `/exchanges?per_page=${perPage}&page=${page}`
  );
  return data || [];
}

/**
 * Fetch coin OHLC data for charts
 */
export async function fetchCoinOHLC(id: string, days: number | string = 30): Promise<number[][] | null> {
  return cgFetch<number[][]>(
    `/coins/${id}/ohlc?vs_currency=usd&days=${days}`,
    300_000,
  );
}
