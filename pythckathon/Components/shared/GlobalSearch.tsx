"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, X, TrendingUp, Loader2, Clock, Flame, Star, PieChart, ArrowRight, Zap, BarChart3 } from "lucide-react";
import { fetchSearch, fetchTrending, fetchDexSearch, type DexPair } from "@/lib/api/backend";
import type { SearchResult } from "@/lib/api/backend";

const WATCHLIST_KEY = "cryptoserve_watchlist";
function getWatchlistItems(): { id: string; symbol: string; name: string; image: string }[] {
  try { return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "[]"); } catch { return []; }
}
const PORTFOLIO_KEY = "pythfeeds_portfolio";
function getPortfolioSymbols(): string[] {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(PORTFOLIO_KEY + "_"));
    const symbols: string[] = [];
    for (const k of keys) {
      const items = JSON.parse(localStorage.getItem(k) || "[]");
      for (const item of items) { if (item.symbol && !symbols.includes(item.symbol)) symbols.push(item.symbol); }
    }
    return symbols;
  } catch { return []; }
}

// Mock stock data for search (since stocks don't have a search API)
const MOCK_STOCKS = [
  { ticker: "AAPL", name: "Apple Inc.", sector: "Technology" },
  { ticker: "MSFT", name: "Microsoft Corp.", sector: "Technology" },
  { ticker: "GOOGL", name: "Alphabet Inc.", sector: "Technology" },
  { ticker: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Cyclical" },
  { ticker: "META", name: "Meta Platforms", sector: "Technology" },
  { ticker: "NVDA", name: "NVIDIA Corp.", sector: "Technology" },
  { ticker: "TSLA", name: "Tesla Inc.", sector: "Consumer Cyclical" },
  { ticker: "JPM", name: "JPMorgan Chase", sector: "Financial Services" },
  { ticker: "V", name: "Visa Inc.", sector: "Financial Services" },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
  { ticker: "WMT", name: "Walmart Inc.", sector: "Consumer Defensive" },
  { ticker: "NFLX", name: "Netflix Inc.", sector: "Communication Services" },
  { ticker: "AMD", name: "AMD Inc.", sector: "Technology" },
  { ticker: "INTC", name: "Intel Corp.", sector: "Technology" },
  { ticker: "DIS", name: "Walt Disney Co.", sector: "Communication Services" },
];

interface GlobalSearchProps {
  onClose?: () => void;
}

const NAV_PAGES = [
  { label: "Swap", href: "/swap", keywords: ["swap", "trade", "exchange", "buy", "sell"] },
  { label: "Portfolio", href: "/portfolio", keywords: ["portfolio", "wallet", "holdings", "balance"] },
  { label: "Pyth Feeds", href: "/feeds", keywords: ["feeds", "pyth", "oracle", "prices"] },
  { label: "DEX Screener", href: "/screener", keywords: ["screener", "dex", "pairs"] },
  { label: "Token Discovery", href: "/new-pairs", keywords: ["new", "pairs", "discover", "token", "launch"] },
  { label: "Heatmap", href: "/heatmap", keywords: ["heatmap", "heat", "map"] },
  { label: "Bubbles", href: "/bubbles", keywords: ["bubbles", "bubble"] },
  { label: "Fear & Greed", href: "/fear-greed", keywords: ["fear", "greed", "sentiment", "index"] },
  { label: "AI Digest", href: "/digest", keywords: ["ai", "digest", "summary", "insight"] },
  { label: "Converter", href: "/converter", keywords: ["convert", "converter", "calc"] },
  { label: "DeFi Yields", href: "/yields", keywords: ["defi", "yield", "apy", "farm"] },
  { label: "Gainers & Losers", href: "/gainers-losers", keywords: ["gainers", "losers", "movers"] },
  { label: "News", href: "/news", keywords: ["news", "headlines"] },
  { label: "US Equities", href: "/stocks", keywords: ["stocks", "equities", "shares"] },
  { label: "Multi-Chart", href: "/multi-chart", keywords: ["multi", "chart", "charts"] },
  { label: "Correlation", href: "/correlation", keywords: ["correlation", "correlate"] },
  { label: "Compare", href: "/compare", keywords: ["compare", "versus", "vs"] },
  { label: "Analytics", href: "/analytics", keywords: ["analytics", "stats"] },
  { label: "Calendar", href: "/calendar", keywords: ["calendar", "events", "eco"] },
  { label: "Alerts", href: "/alerts", keywords: ["alerts", "alert", "notify"] },
  { label: "Profile", href: "/profile", keywords: ["profile", "account", "settings"] },
  { label: "Categories", href: "/categories", keywords: ["categories", "sectors"] },
  { label: "Polls", href: "/polls", keywords: ["polls", "poll", "vote"] },
  { label: "Token Unlocks", href: "/unlocks", keywords: ["unlocks", "unlock", "vesting"] },
];

const RECENT_KEY = "pythfeeds_recent_searches";
function getRecent(): { id: string; name: string; symbol: string; thumb: string }[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").slice(0, 5); } catch { return []; }
}
function addRecent(item: { id: string; name: string; symbol: string; thumb: string }) {
  const list = getRecent().filter(r => r.id !== item.id);
  list.unshift(item);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
}

export default function GlobalSearch({ onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [trending, setTrending] = useState<{ id: string; name: string; symbol: string; thumb: string; market_cap_rank: number }[]>([]);
  const [recentSearches, setRecentSearches] = useState<{ id: string; name: string; symbol: string; thumb: string }[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<{ id: string; symbol: string; name: string; image: string }[]>([]);
  const [portfolioSymbols, setPortfolioSymbols] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Search stocks locally
  const stockResults = query.length >= 1
    ? MOCK_STOCKS.filter(
        (s) =>
          s.ticker.toLowerCase().includes(query.toLowerCase()) ||
          s.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5)
    : [];

  const [dexResults, setDexResults] = useState<DexPair[]>([]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      setDexResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [data, dexPairs] = await Promise.allSettled([
        fetchSearch(q),
        fetchDexSearch(q),
      ]);
      setResults(data.status === "fulfilled" ? data.value : null);
      setDexResults(data.status === "fulfilled" ? [] : []);
      if (dexPairs.status === "fulfilled") setDexResults(dexPairs.value.slice(0, 5));
    } catch { setResults(null); setDexResults([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  // Fetch trending coins once
  useEffect(() => {
    fetchTrending()
      .then((data) => {
        if (data?.coins) {
          setTrending(data.coins.slice(0, 7).map((c: any) => ({
            id: c.item.id,
            name: c.item.name,
            symbol: c.item.symbol,
            thumb: c.item.thumb || c.item.small || "",
            market_cap_rank: c.item.market_cap_rank || 0,
          })));
        }
      })
      .catch(() => {});
  }, []);

  // Load recent searches, watchlist, portfolio when opening
  useEffect(() => {
    if (isOpen) {
      setRecentSearches(getRecent());
      setWatchlistItems(getWatchlistItems().slice(0, 5));
      setPortfolioSymbols(getPortfolioSymbols().slice(0, 8));
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        onClose?.();
      }
      // Cmd/Ctrl+K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const coins = results?.coins?.slice(0, 8) || [];
  const exchanges = results?.exchanges?.slice(0, 3) || [];

  // Page navigation matches
  const navMatches = query.length >= 1
    ? NAV_PAGES.filter((p) => {
        const q = query.toLowerCase().replace(/^go\s*to\s*/i, "");
        if (!q) return false;
        return p.label.toLowerCase().includes(q) || p.keywords.some((k) => k.includes(q));
      }).slice(0, 5)
    : [];

  const hasResults = coins.length > 0 || exchanges.length > 0 || stockResults.length > 0 || navMatches.length > 0 || dexResults.length > 0;

  return (
    <div ref={containerRef} className="relative">
      {/* Search Input */}
      <div
        className="flex items-center gap-2 rounded-full border px-3 py-1.5 transition-all cursor-pointer"
        style={{
          borderColor: isOpen ? "var(--pf-accent)" : "var(--cmc-border)",
          background: isOpen ? "var(--cmc-neutral-1)" : "transparent",
          minWidth: isOpen ? 320 : undefined,
        }}
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        <Search size={14} style={{ color: "var(--cmc-neutral-5)", flexShrink: 0 }} />
        {isOpen ? (
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search coins, stocks, exchanges..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--cmc-text)" }}
            autoFocus
          />
        ) : (
          <span className="text-xs font-medium" style={{ color: "var(--cmc-neutral-5)" }}>
            Search
          </span>
        )}
        {isOpen && query && (
          <button onClick={(e) => { e.stopPropagation(); setQuery(""); }} className="shrink-0">
            <X size={14} style={{ color: "var(--cmc-neutral-5)" }} />
          </button>
        )}
        {!isOpen && (
          <kbd className="ml-1 hidden xl:inline-flex items-center rounded border px-1 text-[10px] font-mono"
            style={{ borderColor: "var(--cmc-border)", color: "var(--cmc-neutral-5)" }}>
            {typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "⌘K" : "Ctrl+K"}
          </kbd>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-2 max-h-[420px] overflow-y-auto rounded-xl border shadow-xl"
          style={{
            background: "var(--cmc-bg)",
            borderColor: "var(--cmc-border)",
            minWidth: 360,
            zIndex: 1001,
          }}
        >
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={18} className="animate-spin" style={{ color: "var(--cmc-neutral-5)" }} />
            </div>
          )}

          {!loading && !hasResults && query.length >= 2 && (
            <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--cmc-neutral-5)" }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Crypto Coins */}
          {coins.length > 0 && (
            <div>
              <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>
                Cryptocurrencies
              </div>
              {coins.map((coin) => (
                <Link
                  key={coin.id}
                  href={`/coins/${coin.id}`}
                  onClick={() => {
                    addRecent({ id: coin.id, name: coin.name, symbol: coin.symbol, thumb: coin.thumb });
                    setIsOpen(false); setQuery("");
                  }}
                  className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-(--cmc-neutral-1)"
                >
                  <Image src={coin.thumb} alt={coin.name} width={24} height={24} className="rounded-full" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium" style={{ color: "var(--cmc-text)" }}>{coin.name}</span>
                    <span className="ml-2 text-xs uppercase" style={{ color: "var(--cmc-neutral-5)" }}>{coin.symbol}</span>
                  </div>
                  {coin.market_cap_rank && (
                    <span className="text-[10px] rounded px-1.5 py-0.5 font-medium" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>
                      #{coin.market_cap_rank}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}

          {/* DEX Pairs */}
          {dexResults.length > 0 && (
            <div>
              <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: "var(--cmc-neutral-5)" }}>
                <BarChart3 size={10} /> DEX Pairs
              </div>
              {dexResults.map((pair) => (
                <Link
                  key={pair.pairAddress}
                  href={`/token/${pair.chainId}/${pair.baseToken?.address}`}
                  onClick={() => { setIsOpen(false); setQuery(""); }}
                  className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-(--cmc-neutral-1)"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full text-[8px] font-bold" style={{ background: "rgba(240,185,11,0.1)", color: "#f0b90b" }}>
                    {pair.baseToken?.symbol?.slice(0, 2) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium" style={{ color: "var(--cmc-text)" }}>{pair.baseToken?.symbol || "?"}</span>
                    <span className="ml-1.5 text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{pair.baseToken?.name}</span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>{pair.chainId}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>{pair.dexId}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Stocks */}
          {stockResults.length > 0 && (
            <div>
              <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>
                Stocks
              </div>
              {stockResults.map((stock) => (
                <Link
                  key={stock.ticker}
                  href={`/stocks/${stock.ticker.toLowerCase()}`}
                  onClick={() => { setIsOpen(false); setQuery(""); }}
                  className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-(--cmc-neutral-1)"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold"
                    style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}>
                    {stock.ticker.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium" style={{ color: "var(--cmc-text)" }}>{stock.name}</span>
                    <span className="ml-2 text-xs" style={{ color: "var(--cmc-neutral-5)" }}>{stock.ticker}</span>
                  </div>
                  <span className="text-[10px] rounded px-1.5 py-0.5" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>
                    {stock.sector}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {/* Quick Navigation */}
          {navMatches.length > 0 && (
            <div>
              <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>
                Quick Navigation
              </div>
              {navMatches.map((nav) => (
                <Link
                  key={nav.href}
                  href={nav.href}
                  onClick={() => { setIsOpen(false); setQuery(""); }}
                  className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-(--cmc-neutral-1)"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "rgba(139,92,246,0.1)" }}>
                    <ArrowRight size={11} style={{ color: "#8b5cf6" }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: "var(--cmc-text)" }}>Go to {nav.label}</span>
                  <span className="ml-auto text-[9px] font-mono" style={{ color: "var(--cmc-neutral-5)" }}>{nav.href}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Exchanges */}
          {exchanges.length > 0 && (
            <div>
              <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>
                Exchanges
              </div>
              {exchanges.map((ex) => (
                <Link
                  key={ex.id}
                  href="/exchanges"
                  onClick={() => { setIsOpen(false); setQuery(""); }}
                  className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-(--cmc-neutral-1)"
                >
                  <Image src={ex.thumb} alt={ex.name} width={24} height={24} className="rounded-full" />
                  <span className="text-sm font-medium" style={{ color: "var(--cmc-text)" }}>{ex.name}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Recent searches + Trending when no query */}
          {query.length < 2 && (
            <div className="px-3 py-2">
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--cmc-neutral-5)" }}>
                    <Clock size={10} /> Recent
                  </div>
                  {recentSearches.map((r) => (
                    <Link key={r.id} href={`/coins/${r.id}`}
                      onClick={() => { setIsOpen(false); setQuery(""); }}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors hover:bg-(--cmc-neutral-1)"
                    >
                      {r.thumb && <Image src={r.thumb} alt={r.name} width={20} height={20} className="rounded-full" />}
                      <span className="text-xs font-medium" style={{ color: "var(--cmc-text)" }}>{r.name}</span>
                      <span className="text-[10px] uppercase" style={{ color: "var(--cmc-neutral-5)" }}>{r.symbol}</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Watchlist Items */}
              {watchlistItems.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--cmc-neutral-5)" }}>
                    <Star size={10} /> Watchlist
                  </div>
                  {watchlistItems.map((w) => (
                    <Link key={w.id} href={`/coins/${w.id}`}
                      onClick={() => { setIsOpen(false); setQuery(""); }}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors hover:bg-(--cmc-neutral-1)"
                    >
                      {w.image && <img src={w.image} alt={w.name} className="w-5 h-5 rounded-full" />}
                      <span className="text-xs font-medium" style={{ color: "var(--cmc-text)" }}>{w.name}</span>
                      <span className="text-[10px] uppercase" style={{ color: "var(--cmc-neutral-5)" }}>{w.symbol}</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Portfolio Tokens */}
              {portfolioSymbols.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--cmc-neutral-5)" }}>
                    <PieChart size={10} /> Portfolio
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-1">
                    {portfolioSymbols.map((sym) => (
                      <span key={sym} className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}>
                        {sym}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending Coins */}
              {trending.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--cmc-neutral-5)" }}>
                    <Flame size={10} /> Trending
                  </div>
                  {trending.map((t, i) => (
                    <Link key={t.id} href={`/coins/${t.id}`}
                      onClick={() => {
                        addRecent({ id: t.id, name: t.name, symbol: t.symbol, thumb: t.thumb });
                        setIsOpen(false); setQuery("");
                      }}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors hover:bg-(--cmc-neutral-1)"
                    >
                      <span className="text-[10px] font-bold w-4 text-center" style={{ color: "var(--cmc-neutral-5)" }}>{i + 1}</span>
                      {t.thumb && <Image src={t.thumb} alt={t.name} width={20} height={20} className="rounded-full" />}
                      <span className="text-xs font-medium" style={{ color: "var(--cmc-text)" }}>{t.name}</span>
                      <span className="text-[10px] uppercase" style={{ color: "var(--cmc-neutral-5)" }}>{t.symbol}</span>
                      {t.market_cap_rank > 0 && (
                        <span className="ml-auto text-[9px] rounded px-1 py-0.5" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>
                          #{t.market_cap_rank}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}

              {trending.length === 0 && recentSearches.length === 0 && watchlistItems.length === 0 && (
                <p className="text-xs py-2" style={{ color: "var(--cmc-neutral-5)" }}>
                  Type at least 2 characters to search...
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
