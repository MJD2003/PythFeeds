const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

function getBaseUrl(): string {
  // Server-side: call backend directly
  if (typeof window === "undefined") return `${BACKEND_URL}/api`;
  // Client-side: use Next.js proxy
  return "/api/cryptoserve";
}

async function apiFetch<T>(path: string): Promise<T> {
  const base = getBaseUrl();
  const res = await fetch(`${base}${path}`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

// ── AI (Gemini) ──

export async function fetchAIAnalysis(params: {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d?: number;
  marketCap?: number;
  volume?: number;
}): Promise<string> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/ai/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("AI analysis unavailable");
  const data = await res.json();
  return data.analysis as string;
}

export async function fetchMarketBrief(): Promise<string> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/ai/market-brief`, { next: { revalidate: 1800 } });
  if (!res.ok) throw new Error("Market brief unavailable");
  const data = await res.json();
  return data.brief as string;
}

export async function fetchAIChat(message: string, history: { role: string; content: string }[] = []): Promise<string> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("AI Chat unavailable");
  const data = await res.json();
  return data.reply as string;
}

export async function fetchAISimplify(text: string): Promise<string> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/ai/simplify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Simplification unavailable");
  const data = await res.json();
  return data.simplified as string;
}

export async function fetchPortfolioInsights(holdings: { symbol: string; amount: number; price: number; change24h?: number }[]): Promise<string> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/ai/portfolio-insights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ holdings }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Portfolio insights unavailable");
  const data = await res.json();
  return data.insights as string;
}

export async function fetchCorrelationInsights(pairs: { a: string; b: string; correlation: number }[]): Promise<string> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/ai/correlation-insights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairs }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Correlation insights unavailable");
  const data = await res.json();
  return data.insights as string;
}

export async function fetchDigest(): Promise<{ digest: string; date: string }> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/ai/digest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Digest unavailable");
  return res.json();
}

export async function fetchMarketMood(): Promise<{ mood: string; fearGreed: { value: number; label: string } }> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/ai/mood`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error("Mood unavailable");
  return res.json();
}

export async function fetchAIChatStream(
  message: string,
  history: { role: string; content: string }[] = [],
  pageContext?: Record<string, string>
): Promise<Response> {
  const base = getBaseUrl();
  return fetch(`${base}/ai/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, pageContext }),
  });
}

// ── Data (DeFi Llama, Whale Alerts, Calendar) ──

export async function fetchProtocols(limit = 100) {
  return apiFetch<DefiProtocol[]>(`/data/protocols?limit=${limit}`);
}

export async function fetchChainsTVL() {
  return apiFetch<ChainTVL[]>(`/data/chains`);
}

export async function fetchTVLHistory() {
  return apiFetch<{ date: number; tvl: number }[]>(`/data/tvl-history`);
}

export async function fetchStablecoins() {
  return apiFetch<StablecoinData[]>(`/data/stablecoins`);
}

export async function fetchBridges() {
  return apiFetch<BridgeData[]>(`/data/bridges`);
}

export async function fetchWhaleAlerts() {
  return apiFetch<WhaleAlert[]>(`/data/whales`);
}

export async function fetchEconomicCalendar() {
  return apiFetch<CalendarEvent[]>(`/data/calendar`);
}

export async function fetchYields(limit = 100, chain = "") {
  const params = `limit=${limit}${chain ? `&chain=${chain}` : ""}`;
  return apiFetch<YieldPoolBackend[]>(`/data/yields?${params}`);
}

export async function fetchSimplePrices(ids: string[], currency = "usd") {
  return apiFetch<Record<string, { usd?: number }>>(`/coins/simple-prices?ids=${ids.join(",")}&currency=${currency}`);
}

export async function fetchCoinsByIds(ids: string[], currency = "usd") {
  return apiFetch<CoinsByIdsItem[]>(`/coins/by-ids?ids=${ids.join(",")}&currency=${currency}`);
}

export interface CoinsByIdsItem {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number;
}

export interface YieldPoolBackend {
  pool: string;
  project: string;
  projectName: string;
  chain: string;
  symbol: string;
  tvl: number;
  apy: number;
  apyBase: number;
  apyReward: number;
  stablecoin: boolean;
  exposure: string;
  url: string;
}

export async function fetchNewsSummary(title: string, content: string = ""): Promise<string> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/ai/summarize-news`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("AI Summary unavailable");
  const data = await res.json();
  return data.summary as string;
}

// ── Coins ──

export async function fetchCoins(page = 1, perPage = 100, category = "") {
  const params = `page=${page}&per_page=${perPage}${category ? `&category=${category}` : ""}`;
  return apiFetch<CoinMarketItem[]>(`/coins?${params}`);
}

export async function fetchCoinDetail(id: string) {
  return apiFetch<CoinDetailResponse>(`/coins/${id}`);
}

export async function fetchCoinOHLC(id: string, days = 7) {
  return apiFetch<number[][]>(`/coins/${id}/ohlc?days=${days}`);
}

export async function fetchCoinChart(id: string, days = 7) {
  return apiFetch<{ prices: number[][]; market_caps: number[][]; total_volumes: number[][] }>(
    `/coins/${id}/chart?days=${days}`
  );
}

export async function fetchGlobalData() {
  return apiFetch<{ data: GlobalData }>(`/coins/global`);
}

export async function fetchTrending() {
  return apiFetch<{ coins: TrendingCoin[] }>(`/coins/trending`);
}

// ── Meme Bubbles ──

export interface MemeBubbleToken {
  symbol: string;
  name: string;
  image: string;
  price: number;
  change1h: number;
  change24h: number;
  change7d: number;
  mcap: number;
  volume: number;
  source: "dexscreener" | "pumpfun" | "jupiter" | "raydium";
  sparkline: number[];
  mint: string;
  bondingProgress: number | null;
  pairAddress: string;
  liquidity: number;
  txns24h: number;
  rank: number;
}

export async function fetchMemeBubbles(limit = 100): Promise<MemeBubbleToken[]> {
  return apiFetch<MemeBubbleToken[]>(`/coins/meme-bubbles?limit=${limit}`);
}

// ── Stocks ──

export async function fetchStocks() {
  return apiFetch<StockPrice[]>(`/stocks`);
}

export async function fetchStockDetail(ticker: string) {
  return apiFetch<StockPrice>(`/stocks/${ticker}`);
}

// ── Prices (direct Pyth) ──

export async function fetchPythPrices(symbols: string[]) {
  return apiFetch<Record<string, PythPriceItem>>(`/prices/pyth?symbols=${symbols.join(",")}`);
}

export async function fetchPythFeeds() {
  return apiFetch<{ crypto: string[]; equities: string[] }>(`/prices/feeds`);
}

// ── News ──

export async function fetchCryptoNews(symbols: string[] = [], limit = 10) {
  const params = new URLSearchParams();
  if (symbols.length > 0) params.set("symbols", symbols.join(","));
  params.set("limit", String(limit));
  return apiFetch<NewsArticle[]>(`/news/crypto?${params}`);
}

export async function fetchStockNews(ticker: string, limit = 10) {
  return apiFetch<NewsArticle[]>(`/news/stock/${ticker}?limit=${limit}`);
}

// ── Fear & Greed ──

export async function fetchFearGreed() {
  return apiFetch<FearGreedData>(`/coins/fear-greed`);
}

export async function fetchFearGreedHistory(limit = 31) {
  return apiFetch<FearGreedHistoryEntry[]>(`/coins/fear-greed?limit=${limit}`);
}

export interface FearGreedHistoryEntry {
  value: number;
  classification: string;
  timestamp: string;
}

// ── Exchanges ──

export async function fetchExchanges(page = 1, perPage = 100) {
  return apiFetch<ExchangeItem[]>(`/coins/exchanges?page=${page}&per_page=${perPage}`);
}

// ── Search ──

export async function fetchSearch(q: string) {
  return apiFetch<SearchResult>(`/search?q=${encodeURIComponent(q)}`);
}

// ── Types ──

export interface CoinMarketItem {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number;
  price_change_percentage_1h_in_currency: number;
  price_change_percentage_24h_in_currency: number;
  price_change_percentage_7d_in_currency: number;
  circulating_supply: number;
  total_supply: number;
  sparkline_in_7d: { price: number[] };
  pyth_price?: number;
  pyth_confidence?: number;
  price_source: "pyth" | "coingecko";
}

export interface CoinDetailResponse {
  id: string;
  symbol: string;
  name: string;
  image: { thumb: string; small: string; large: string };
  market_data: {
    current_price: { usd: number };
    market_cap: { usd: number };
    total_volume: { usd: number };
    high_24h: { usd: number };
    low_24h: { usd: number };
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_30d: number;
    circulating_supply: number;
    total_supply: number;
    max_supply: number;
    ath: { usd: number };
    atl: { usd: number };
    fully_diluted_valuation: { usd: number };
    sparkline_7d: { price: number[] };
  };
  description: { en: string };
  links: { homepage: string[]; blockchain_site: string[] };
  genesis_date: string;
  pyth_price?: number;
  pyth_confidence?: number;
  pyth_publish_time?: number;
  price_source: "pyth" | "coingecko";
}

export interface StockPrice {
  ticker: string;
  name: string;
  price: number;
  change1d: number;
  previousClose: number;
  confidence: number;
  publishTime: number;
  source: string;
  marketOpen: boolean;
  sector: string;
  exchange: string;
  marketCap: number;
  volume: number;
  pe: number;
  eps: number;
  dividend: number;
  beta: number;
  high52w: number;
  low52w: number;
  logo: string;
  description: string;
}

export interface PythPriceItem {
  symbol: string;
  price: number;
  confidence: number;
  expo: number;
  publishTime: number;
  source: string;
}

export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  timeAgo: string;
}

export interface GlobalData {
  total_market_cap: { usd: number };
  total_volume: { usd: number };
  market_cap_percentage: { btc: number; eth: number };
  active_cryptocurrencies: number;
}

export interface TrendingCoin {
  item: {
    id: string;
    name: string;
    symbol: string;
    thumb: string;
    market_cap_rank: number;
  };
}

export interface SearchResult {
  coins: { id: string; name: string; symbol: string; thumb: string; market_cap_rank: number }[];
  exchanges: { id: string; name: string; thumb: string }[];
  categories: { id: number; name: string }[];
}

export interface ExchangeItem {
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

export interface FearGreedData {
  value: number;
  classification: string;
  timestamp: number;
}

export interface DefiProtocol {
  id: string;
  name: string;
  logo: string;
  category: string;
  chain: string;
  chains: string[];
  tvl: number;
  change1h: number;
  change1d: number;
  change7d: number;
  mcap: number;
  url: string;
}

export interface ChainTVL {
  name: string;
  gecko_id: string;
  tvl: number;
  tokenSymbol: string;
}

export interface StablecoinData {
  id: number;
  name: string;
  symbol: string;
  pegType: string;
  mcap: number;
  price: number;
}

export interface BridgeData {
  id: number;
  name: string;
  icon: string | null;
  volume24h: number;
  currentDayVolume: number;
  chains: string[];
}

export interface WhaleAlert {
  id: string;
  symbol: string;
  amount: number;
  usdValue: number;
  action: string;
  from: string;
  to: string;
  timestamp: number;
  type: string;
}

export interface CalendarEvent {
  id: string;
  name: string;
  body: string;
  impact: string;
  recurring: string;
  category: "macro" | "crypto";
  description: string;
  date: string;
  timestamp: number;
  daysUntil: number;
}

// ── Watchlist (MySQL-backed) ──

export interface WatchlistItem {
  coin_id: string;
  symbol: string;
  name: string;
  added_at: string;
}

export async function fetchWatchlist(wallet: string): Promise<WatchlistItem[]> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/watchlist`, { headers: { "x-wallet-address": wallet } });
  if (!res.ok) return [];
  return res.json();
}

export async function addToWatchlist(wallet: string, coinId: string, symbol: string, name: string) {
  const base = getBaseUrl();
  return fetch(`${base}/watchlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-wallet-address": wallet },
    body: JSON.stringify({ coinId, symbol, name }),
  });
}

export async function removeFromWatchlist(wallet: string, coinId: string) {
  const base = getBaseUrl();
  return fetch(`${base}/watchlist/${coinId}`, {
    method: "DELETE",
    headers: { "x-wallet-address": wallet },
  });
}

// ── Alerts (MySQL-backed) ──

export interface AlertItem {
  id: number;
  coin_id: string;
  symbol: string;
  target_price: number;
  direction: "above" | "below";
  triggered: number;
  triggered_at: string | null;
  created_at: string;
}

export async function fetchAlerts(wallet: string): Promise<AlertItem[]> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/alerts`, { headers: { "x-wallet-address": wallet } });
  if (!res.ok) return [];
  return res.json();
}

export async function createAlert(wallet: string, coinId: string, symbol: string, targetPrice: number, direction: "above" | "below") {
  const base = getBaseUrl();
  const res = await fetch(`${base}/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-wallet-address": wallet },
    body: JSON.stringify({ coinId, symbol, targetPrice, direction }),
  });
  return res.json();
}

export async function deleteAlert(wallet: string, id: number) {
  const base = getBaseUrl();
  return fetch(`${base}/alerts/${id}`, {
    method: "DELETE",
    headers: { "x-wallet-address": wallet },
  });
}

export async function triggerAlert(wallet: string, id: number) {
  const base = getBaseUrl();
  return fetch(`${base}/alerts/${id}/trigger`, {
    method: "PUT",
    headers: { "x-wallet-address": wallet },
  });
}

// ── Polls (MySQL-backed) ──

export interface PollResult {
  bullish: number;
  bearish: number;
  voted: "bull" | "bear" | null;
}

export async function fetchPollBatchResults(assets: string[], timeframe: string, sessionId: string): Promise<Record<string, PollResult>> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/polls/batch-results?assets=${assets.join(",")}&timeframe=${timeframe}`, {
    headers: { "x-session-id": sessionId },
  });
  if (!res.ok) return {};
  return res.json();
}

export async function castPollVote(assetId: string, timeframe: string, side: "bull" | "bear", sessionId: string, wallet?: string) {
  const base = getBaseUrl();
  const headers: Record<string, string> = { "Content-Type": "application/json", "x-session-id": sessionId };
  if (wallet) headers["x-wallet-address"] = wallet;
  const res = await fetch(`${base}/polls/vote`, {
    method: "POST",
    headers,
    body: JSON.stringify({ assetId, timeframe, side }),
  });
  return res.json();
}

// ── Portfolio Snapshots (MySQL-backed) ──

export interface PortfolioSnapshot {
  totalValueUsd: number;
  snapshotDate: string;
  holdings: { symbol: string; amount: number; valueUsd: number }[];
}

export async function fetchPortfolioSnapshots(wallet: string, days = 30): Promise<PortfolioSnapshot[]> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/portfolio/snapshots?days=${days}`, { headers: { "x-wallet-address": wallet } });
  if (!res.ok) return [];
  return res.json();
}

export async function savePortfolioSnapshot(wallet: string, totalValueUsd: number, holdings: { symbol: string; amount: number; valueUsd: number }[]) {
  const base = getBaseUrl();
  return fetch(`${base}/portfolio/snapshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-wallet-address": wallet },
    body: JSON.stringify({ totalValueUsd, holdings }),
  });
}

// ── User Data (generic JSON blob persistence) ──

export async function getUserData<T>(wallet: string, key: string): Promise<T | null> {
  const base = getBaseUrl();
  try {
    const res = await fetch(`${base}/user-data/${key}`, { headers: { "x-wallet-address": wallet } });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function setUserData<T>(wallet: string, key: string, value: T): Promise<boolean> {
  const base = getBaseUrl();
  try {
    const res = await fetch(`${base}/user-data/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-wallet-address": wallet },
      body: JSON.stringify({ value }),
    });
    return res.ok;
  } catch { return false; }
}

// ── DexScreener ──

export interface DexPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  url: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd: string;
  liquidity: { usd: number; base: number; quote: number };
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
  volume: { m5: number; h1: number; h6: number; h24: number };
  priceChange: { m5: number; h1: number; h6: number; h24: number };
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  info: { imageUrl?: string; websites?: { url: string }[]; socials?: { type: string; url: string }[]; [key: string]: unknown } | null;
  boosts: Record<string, unknown> | null;
}

export interface DexToken {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  header?: string;
  description?: string;
  links?: { label?: string; type?: string; url: string }[];
  amount?: number;
  totalAmount?: number;
  pair?: DexPair | null;
}

export async function fetchDexSearch(query: string): Promise<DexPair[]> {
  const data = await apiFetch<{ pairs: DexPair[] }>(`/dex/search?q=${encodeURIComponent(query)}`);
  return data.pairs || [];
}

export async function fetchDexTokenPairs(chain: string, tokenAddress: string): Promise<DexPair[]> {
  const data = await apiFetch<{ pairs: DexPair[] }>(`/dex/pairs/${chain}/${tokenAddress}`);
  return data.pairs || [];
}

export async function fetchDexTrending(): Promise<DexToken[]> {
  const data = await apiFetch<{ tokens: DexToken[] }>("/dex/trending");
  return data.tokens || [];
}

export async function fetchDexTopBoosted(): Promise<DexToken[]> {
  const data = await apiFetch<{ tokens: DexToken[] }>("/dex/top-boosted");
  return data.tokens || [];
}

export async function fetchDexNewPairs(): Promise<DexToken[]> {
  const data = await apiFetch<{ profiles: DexToken[] }>("/dex/new-pairs");
  return data.profiles || [];
}

export async function fetchDexTokenPools(chain: string, tokenAddress: string): Promise<DexPair[]> {
  const data = await apiFetch<{ pairs: DexPair[] }>(`/dex/pools/${chain}/${tokenAddress}`);
  return data.pairs || [];
}

export interface FreshPair extends DexPair {
  ageMs: number;
  ageHours: number;
  txTotal24: number;
  buyRatio: number;
  volLiqRatio: number;
  safety: number;
  isGraduated: boolean;
  _source?: string;
}

export async function fetchFreshSolanaPairs(): Promise<FreshPair[]> {
  const data = await apiFetch<{ pairs: FreshPair[] }>("/dex/fresh-solana-pairs");
  return data.pairs || [];
}

export async function fetchDexGainersLosers(limit = 20): Promise<{ gainers: FreshPair[]; losers: FreshPair[] }> {
  return apiFetch<{ gainers: FreshPair[]; losers: FreshPair[] }>(`/dex/gainers-losers?limit=${limit}`);
}

// ── Jupiter ──

export interface JupiterToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  dailyVolume: number;
  tags: string[];
  verified: boolean;
  freezeAuthority: string | null;
  mintAuthority: string | null;
}

export interface JupiterPrice {
  id: string;
  type: string;
  price: string;
  extraInfo?: { quotedPrice?: { buyPrice: string; sellPrice: string } };
}

export async function fetchJupTrending(limit = 50): Promise<JupiterToken[]> {
  const data = await apiFetch<{ tokens: JupiterToken[] }>(`/jup/trending?limit=${limit}`);
  return data.tokens || [];
}

export async function fetchJupVerified(limit = 100): Promise<JupiterToken[]> {
  const data = await apiFetch<{ tokens: JupiterToken[] }>(`/jup/verified?limit=${limit}`);
  return data.tokens || [];
}

export async function fetchJupPrices(mints: string[]): Promise<Record<string, JupiterPrice>> {
  const data = await apiFetch<{ prices: Record<string, JupiterPrice> }>(`/jup/prices?ids=${mints.join(",")}`);
  return data.prices || {};
}

export async function fetchJupToken(mint: string): Promise<JupiterToken | null> {
  try {
    return await apiFetch<JupiterToken>(`/jup/token/${mint}`);
  } catch { return null; }
}

export async function fetchJupSearch(query: string, limit = 20): Promise<JupiterToken[]> {
  const data = await apiFetch<{ tokens: JupiterToken[] }>(`/jup/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  return data.tokens || [];
}

// ── Raydium ──

export interface RaydiumMintInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
}

export interface RaydiumPool {
  id: string;
  type: string;
  programId: string;
  mintA: RaydiumMintInfo;
  mintB: RaydiumMintInfo;
  price: number;
  tvl: number;
  volume24h: number;
  volumeQuote24h: number;
  fee24h: number;
  apr24h: number;
  apr7d: number;
  apr30d: number;
  lpFeeRate: number;
  openTime: number;
  lpMint: string;
  lpPrice: number;
  farmCount: number;
  isOpenBook: boolean;
  burnPercent: number;
}

export async function fetchRaydiumPools(page = 1, pageSize = 50, sortBy = "volume24h", sortOrder = "desc"): Promise<{ pools: RaydiumPool[]; count: number; hasNextPage: boolean }> {
  return apiFetch(`/raydium/pools?page=${page}&pageSize=${pageSize}&sortBy=${sortBy}&sortOrder=${sortOrder}`);
}

export async function fetchRaydiumNewPools(limit = 50): Promise<RaydiumPool[]> {
  const data = await apiFetch<{ pools: RaydiumPool[] }>(`/raydium/new-pools?limit=${limit}`);
  return data.pools || [];
}

export async function fetchRaydiumPoolsByMint(mint: string): Promise<RaydiumPool[]> {
  const data = await apiFetch<{ pools: RaydiumPool[] }>(`/raydium/pools/mint/${mint}`);
  return data.pools || [];
}

export async function fetchRaydiumToken(mint: string): Promise<RaydiumMintInfo | null> {
  try {
    return await apiFetch<RaydiumMintInfo>(`/raydium/token/${mint}`);
  } catch { return null; }
}

export interface LaunchLabToken {
  tokenAddress: string;
  chainId: string;
  icon: string;
  header: string;
  description: string;
  url: string;
  links: { type?: string; label?: string; url: string }[];
  pair: DexPair;
}

export async function fetchRaydiumLaunchLab(limit = 50): Promise<LaunchLabToken[]> {
  const data = await apiFetch<{ tokens: LaunchLabToken[] }>(`/raydium/launchlab?limit=${limit}`);
  return data.tokens || [];
}

// ── Pump.fun ──

export interface PumpToken {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  imageUri: string;
  metadataUri: string;
  creator: string;
  createdTimestamp: number;
  bondingCurveComplete: boolean;
  bondingProgress: number;
  marketCapSol: number;
  usdMarketCap: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  totalSupply: number;
  website: string;
  twitter: string;
  telegram: string;
  kingOfTheHill: boolean;
  kingTimestamp: number;
  replyCount: number;
  lastReply: number;
  raydiumPool: string | null;
  isNsfw: boolean;
  estimatedPrice?: number;
  socialScore?: number;
  ageSeconds?: number;
  realSolReserves?: number;
  isLive?: boolean;
}

export async function fetchPumpLatest(limit = 50, offset = 0): Promise<PumpToken[]> {
  const data = await apiFetch<{ tokens: PumpToken[] }>(`/pump/latest?limit=${limit}&offset=${offset}`);
  return data.tokens || [];
}

export async function fetchPumpGraduated(limit = 50): Promise<PumpToken[]> {
  const data = await apiFetch<{ tokens: PumpToken[] }>(`/pump/graduated?limit=${limit}`);
  return data.tokens || [];
}

export async function fetchPumpToken(mint: string): Promise<PumpToken | null> {
  try {
    return await apiFetch<PumpToken>(`/pump/token/${mint}`);
  } catch { return null; }
}

export async function fetchPumpTrending(limit = 30): Promise<PumpToken[]> {
  const data = await apiFetch<{ tokens: PumpToken[] }>(`/pump/trending?limit=${limit}`);
  return data.tokens || [];
}

export async function fetchPumpAboutToGraduate(limit = 30): Promise<PumpToken[]> {
  const data = await apiFetch<{ tokens: PumpToken[] }>(`/pump/about-to-graduate?limit=${limit}`);
  return data.tokens || [];
}

// ── CoinGecko Trending ──

export interface CoinGeckoTrendingItem {
  id: string;
  coin_id: number;
  name: string;
  symbol: string;
  market_cap_rank: number;
  thumb: string;
  small: string;
  large: string;
  slug: string;
  score: number;
  data?: {
    price?: number;
    price_btc?: string;
    price_change_percentage_24h?: { usd?: number };
    market_cap?: string;
    total_volume?: string;
    sparkline?: string;
  };
}

export async function fetchCoinGeckoTrending(): Promise<CoinGeckoTrendingItem[]> {
  try {
    const data = await apiFetch<{ coins: { item: CoinGeckoTrendingItem }[] }>("/coins/trending");
    return (data.coins || []).map((c) => c.item);
  } catch { return []; }
}
