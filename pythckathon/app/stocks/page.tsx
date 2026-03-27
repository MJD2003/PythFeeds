"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Star, Search, Loader2, Wifi, WifiOff, Building2, Activity, ArrowUpDown, ChevronUp, ChevronDown, Bot, X as XIcon, RefreshCw, Radio, ChevronLeft, ChevronRight } from "lucide-react";
import { Sparklines, SparklinesLine } from "react-sparklines";
import { Badge } from "@/Components/ui/badge";
import { Card, CardContent } from "@/Components/ui/card";
import { fetchStocks, fetchAIAnalysis, type StockPrice } from "@/lib/api/backend";
import { useWallet } from "@solana/wallet-adapter-react";
import { toggleWatchlist, isInWatchlist } from "@/lib/watchlist";
import { toast } from "sonner";
import { getAlerts, checkAlerts } from "@/lib/price-alerts";
import { setFaviconBadge } from "@/lib/favicon-badge";
import {
  fetchPythFeedsByType, fetchPricesByIds, subscribePriceStream,
  type PythFeedMeta, type PythPriceData,
} from "@/lib/pyth-feeds";
import FeedIcon from "@/Components/shared/FeedIcon";

type AssetTab = "stocks" | "crypto" | "metals" | "commodities" | "forex";
const TAB_CONFIG: { key: AssetTab; label: string; href: string; pythType?: string }[] = [
  { key: "stocks", label: "US Stocks", href: "/stocks" },
  { key: "crypto", label: "Crypto", href: "/stocks?tab=crypto", pythType: "Crypto" },
  { key: "metals", label: "Metals", href: "/stocks?tab=metals", pythType: "Metal" },
  { key: "commodities", label: "Commodities", href: "/stocks?tab=commodities", pythType: "Commodities" },
  { key: "forex", label: "Forex", href: "/stocks?tab=forex", pythType: "FX" },
];

type SortKey = "price" | "change1d" | "pe" | "marketCap" | "volume" | null;
type SortDir = "asc" | "desc";

function genSparkline(price: number, change: number): number[] {
  const pts: number[] = [];
  const base = price / (1 + change / 100);
  for (let i = 0; i < 20; i++) {
    const t = i / 19;
    const noise = (Math.sin(i * 2.7 + price) * 0.02 + Math.cos(i * 1.3 + change) * 0.015);
    pts.push(base + (price - base) * t + price * noise);
  }
  return pts;
}

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: "1px solid var(--cmc-border)" }}>
      <td className="px-2 py-3"><div className="w-4 h-4 rounded-full animate-pulse" style={{ background: "var(--cmc-neutral-3)" }} /></td>
      <td className="px-2 py-3"><div className="w-4 h-3 rounded animate-pulse" style={{ background: "var(--cmc-neutral-3)" }} /></td>
      <td className="px-2 py-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg animate-pulse" style={{ background: "var(--cmc-neutral-3)" }} /><div><div className="w-24 h-3 rounded animate-pulse mb-1" style={{ background: "var(--cmc-neutral-3)" }} /><div className="w-16 h-2 rounded animate-pulse" style={{ background: "var(--cmc-neutral-3)" }} /></div></div></td>
      <td className="px-2 py-3"><div className="w-16 h-3 rounded animate-pulse ml-auto" style={{ background: "var(--cmc-neutral-3)" }} /></td>
      <td className="px-2 py-3"><div className="w-12 h-3 rounded animate-pulse ml-auto" style={{ background: "var(--cmc-neutral-3)" }} /></td>
      <td className="hidden sm:table-cell px-2 py-3"><div className="w-8 h-3 rounded animate-pulse ml-auto" style={{ background: "var(--cmc-neutral-3)" }} /></td>
      <td className="hidden md:table-cell px-2 py-3"><div className="w-14 h-3 rounded animate-pulse ml-auto" style={{ background: "var(--cmc-neutral-3)" }} /></td>
      <td className="hidden lg:table-cell px-2 py-3"><div className="w-14 h-3 rounded animate-pulse ml-auto" style={{ background: "var(--cmc-neutral-3)" }} /></td>
      <td className="hidden xl:table-cell px-2 py-3"><div className="w-16 h-4 rounded animate-pulse mx-auto" style={{ background: "var(--cmc-neutral-3)" }} /></td>
      <td className="px-2 py-3"><div className="w-10 h-4 rounded-full animate-pulse mx-auto" style={{ background: "var(--cmc-neutral-3)" }} /></td>
    </tr>
  );
}
const SECTOR_MAP: Record<string, string> = {
  "Technology": "Tech",
  "Communication Services": "Comms",
  "Consumer Cyclical": "Consumer",
};
function shortSector(s: string) { return SECTOR_MAP[s] || s; }

function fmtLarge(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtPrice(p: number): string {
  return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sourceBadge(source: string) {
  if (source === "pyth") return { label: "Live", bg: "rgba(22,199,132,0.12)", color: "#16c784" };
  if (source === "pyth_closed") return { label: "Last Close", bg: "rgba(245,209,0,0.12)", color: "#f5d100" };
  if (source === "cached") return { label: "Cached", bg: "rgba(245,209,0,0.12)", color: "#f5d100" };
  if (source === "no_data") return { label: "No Data", bg: "rgba(234,57,67,0.08)", color: "#ea3943" };
  if (source === "unavailable") return { label: "Offline", bg: "rgba(153,69,255,0.08)", color: "var(--pf-accent)" };
  return { label: "Reference", bg: "rgba(153,69,255,0.1)", color: "var(--pf-accent)" };
}

export default function StocksPage() {
  const searchParams = useSearchParams();
  const tabParam = (searchParams.get("tab") || "stocks") as AssetTab;
  const currentTab = TAB_CONFIG.find((t) => t.key === tabParam) ? tabParam : "stocks";
  const { publicKey, connected } = useWallet();
  const wallet = publicKey?.toBase58() || "";

  const [activeSector, setActiveSector] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [stocks, setStocks] = useState<StockPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sseConnected, setSseConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Pyth dynamic feeds state (for non-stock tabs)
  const [pythFeeds, setPythFeeds] = useState<PythFeedMeta[]>([]);
  const [pythPrices, setPythPrices] = useState<Record<string, PythPriceData>>({});
  const [pythStreaming, setPythStreaming] = useState(false);
  const pythCleanupRef = useRef<(() => void) | null>(null);
  const [pythSearch, setPythSearch] = useState("");
  const [pythPage, setPythPage] = useState(0);
  const PYTH_PAGE_SIZE = 40;

  // Feed detail modal
  const [selectedFeed, setSelectedFeed] = useState<PythFeedMeta | null>(null);
  const [copiedFeedId, setCopiedFeedId] = useState(false);

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // AI modal state
  const [aiTicker, setAiTicker] = useState<string | null>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Relative time
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - lastUpdate) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [lastUpdate]);

  // Fetch data based on current tab
  useEffect(() => {
    setLoading(true);
    setError("");
    setStocks([]);
    setPythFeeds([]);
    setPythPrices({});
    setPythStreaming(false);
    setPythSearch("");
    setPythPage(0);
    pythCleanupRef.current?.();

    const tabCfg = TAB_CONFIG.find((t) => t.key === currentTab);

    if (currentTab === "stocks") {
      fetchStocks().then((data) => { setStocks(data); setLastUpdate(Date.now()); setLoading(false); }).catch(() => { setError("Could not load stock data."); setLoading(false); });
    } else if (tabCfg?.pythType) {
      // Dynamic Hermes fetch for all Pyth-backed tabs
      (async () => {
        try {
          const feeds = await fetchPythFeedsByType(tabCfg.pythType!);
          setPythFeeds(feeds);
          const ids = feeds.map((f) => f.id);
          const prices = await fetchPricesByIds(ids);
          setPythPrices(prices);
          setLastUpdate(Date.now());
        } catch {
          setError(`Could not load ${currentTab} feeds.`);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [currentTab]);

  // SSE streaming — stocks tab uses backend SSE, Pyth tabs use Hermes SSE
  useEffect(() => {
    if (currentTab === "stocks") {
      const es = new EventSource("/api/cryptoserve/stocks/stream/sse");
      eventSourceRef.current = es;
      es.onopen = () => { setSseConnected(true); setFaviconBadge("green"); };
      es.onmessage = (event) => {
        try {
          const data: StockPrice[] = JSON.parse(event.data);
          if (Array.isArray(data) && data.length > 0) {
            setStocks(data); setError(""); setLastUpdate(Date.now());
            setFaviconBadge("green");
            const priceMap = new Map(data.map(s => [s.ticker, s.price]));
            checkAlerts(priceMap);
          }
        } catch {}
      };
      es.onerror = () => { setSseConnected(false); setFaviconBadge("red"); };
      return () => { es.close(); eventSourceRef.current = null; setFaviconBadge(null); };
    } else if (pythFeeds.length > 0) {
      const topIds = pythFeeds.slice(0, 80).map((f) => f.id);
      const unsub = subscribePriceStream(topIds, (feedId, price, confidence, publishTime) => {
        setPythStreaming(true);
        setPythPrices((prev) => ({
          ...prev,
          [feedId]: { price, confidence, expo: prev[feedId]?.expo ?? 0, publishTime },
        }));
      });
      pythCleanupRef.current = unsub;
      return () => { unsub(); };
    }
  }, [currentTab, pythFeeds]);

  // Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const tabCfg = TAB_CONFIG.find((t) => t.key === currentTab);
      if (currentTab === "stocks") {
        const data = await fetchStocks();
        setStocks(data); setLastUpdate(Date.now());
      } else if (tabCfg?.pythType) {
        const feeds = await fetchPythFeedsByType(tabCfg.pythType!);
        setPythFeeds(feeds);
        const prices = await fetchPricesByIds(feeds.map((f) => f.id));
        setPythPrices(prices);
        setLastUpdate(Date.now());
      }
    } catch {}
    setRefreshing(false);
  }, [currentTab]);

  // Watchlist star
  const handleStar = useCallback((s: StockPrice) => {
    if (!connected) { toast.info("Connect wallet to use watchlist"); return; }
    const { added } = toggleWatchlist(wallet, { id: s.ticker, type: "stock", symbol: s.ticker, name: s.name });
    toast.success(added ? `${s.name} added to watchlist` : `${s.name} removed`);
  }, [wallet, connected]);

  // AI analysis
  const openAI = useCallback((s: StockPrice) => {
    setAiTicker(s.ticker); setAiText(null); setAiLoading(true);
    fetchAIAnalysis({ symbol: s.ticker, name: s.name, price: s.price, change24h: s.change1d, marketCap: s.marketCap, volume: s.volume })
      .then(t => { setAiText(t); setAiLoading(false); })
      .catch(() => { setAiText("Analysis unavailable."); setAiLoading(false); });
  }, []);

  // Sort handler
  const handleSort = (key: SortKey) => {
    if (sortKey === key) { setSortDir(d => d === "desc" ? "asc" : "desc"); }
    else { setSortKey(key); setSortDir("desc"); }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "s" || e.key === "S") { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Derive sectors, filtered + sorted list
  const allSectors = useMemo(() => ["All", ...Array.from(new Set(stocks.map((s) => shortSector(s.sector || "")))).filter(Boolean)], [stocks]);

  const sorted = useMemo(() => {
    let list = stocks.filter((s) => {
      if (activeSector !== "All" && shortSector(s.sector) !== activeSector) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!s.name?.toLowerCase().includes(q) && !s.ticker.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const va = (a as any)[sortKey] ?? 0;
        const vb = (b as any)[sortKey] ?? 0;
        return sortDir === "desc" ? vb - va : va - vb;
      });
    }
    return list;
  }, [stocks, activeSector, searchQuery, sortKey, sortDir]);

  const totalMktCap = stocks.reduce((sum, v) => sum + (v.marketCap || 0), 0);
  const totalVol = stocks.reduce((sum, v) => sum + (v.volume || 0), 0);
  const liveCount = stocks.filter((s) => s.source === "pyth" || s.source === "pyth_closed").length;

  const tabTitle = TAB_CONFIG.find((t) => t.key === currentTab)?.label || "Assets";

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4 animate-fade-in-up">
      {/* Tabs — route-based */}
      <div className="flex w-full gap-1 overflow-x-auto pb-px" style={{ scrollbarWidth: "none", borderBottom: "1px solid var(--cmc-border)" }}>
        {TAB_CONFIG.map((tab) => (
          <Link key={tab.key} href={tab.href}
            className="relative px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 shrink-0 rounded-t-lg"
            style={{
              color: currentTab === tab.key ? "var(--pf-accent)" : "var(--cmc-neutral-5)",
              background: currentTab === tab.key ? "var(--pf-accent-muted)" : "transparent",
            }}
          >
            {tab.label}
            {currentTab === tab.key && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full" style={{ background: "linear-gradient(90deg, var(--pf-accent), var(--pf-up))" }} />
            )}
          </Link>
        ))}
      </div>

      {/* Title + live indicator */}
      <div className="mt-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight" style={{ color: "var(--cmc-text)" }}>{tabTitle} Overview</h1>
          <p className="mt-1 text-xs sm:text-sm" style={{ color: "var(--cmc-text-sub)" }}>
            Real-time prices powered by <span className="font-semibold" style={{ color: "var(--pf-accent)" }}>Pyth Network</span> oracle data.
          </p>
        </div>
        {currentTab === "stocks" ? (
          <div className="flex items-center gap-2">
            {stocks.length > 0 && (
              <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: stocks[0]?.marketOpen ? "rgba(22,199,132,0.1)" : "rgba(245,209,0,0.1)", color: stocks[0]?.marketOpen ? "#16c784" : "#f5d100" }}>
                {stocks[0]?.marketOpen ? "Market Open" : "Market Closed"}
              </span>
            )}
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium" style={{ background: sseConnected ? "rgba(22,199,132,0.1)" : "rgba(234,57,67,0.1)", color: sseConnected ? "#16c784" : "#ea3943" }}>
              {sseConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {sseConnected ? "Live Feed" : "Connecting..."}
            </div>
            <button onClick={handleRefresh} disabled={refreshing} className="rounded-full p-1.5 transition-colors hover:bg-(--cmc-neutral-2)" title="Refresh prices">
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} style={{ color: "var(--cmc-neutral-5)" }} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: "rgba(113,66,207,0.1)", color: "var(--pf-accent)" }}>
              {pythFeeds.length} feeds
            </span>
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium" style={{ background: pythStreaming ? "rgba(22,199,132,0.1)" : "rgba(245,209,0,0.1)", color: pythStreaming ? "#16c784" : "#f5d100" }}>
              {pythStreaming ? <Wifi size={12} /> : <Radio size={12} />}
              {pythStreaming ? "Streaming" : "Connecting..."}
            </div>
            <button onClick={handleRefresh} disabled={refreshing} className="rounded-full p-1.5 transition-colors hover:bg-(--cmc-neutral-2)" title="Refresh prices">
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} style={{ color: "var(--cmc-neutral-5)" }} />
            </button>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mt-3 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "#ea3943", background: "rgba(234,57,67,0.06)", color: "#ea3943" }}>
          {error}
        </div>
      )}

      {/* === STOCKS TAB === */}
      {currentTab === "stocks" && (
        <>
          {/* Stats row */}
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 stagger-grid">
            {[
              { icon: <Building2 size={10} />, label: "Total Market Cap", value: fmtLarge(totalMktCap) },
              { icon: <Activity size={10} />, label: "Total Volume", value: fmtLarge(totalVol) },
              { icon: null, label: "Stocks Tracked", value: String(stocks.length) },
              { icon: null, label: "Live Feeds", value: `${liveCount} / ${stocks.length}`, color: liveCount > 0 ? "#16c784" : "#f5d100" },
            ].map((stat) => (
              <div key={stat.label} className="card-interactive rounded-xl p-3">
                <div className="flex items-center gap-1 mb-1">{stat.icon}<p className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>{stat.label}</p></div>
                <p className="text-sm font-bold font-data" style={{ color: stat.color || "var(--cmc-text)" }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Filters + Search */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {allSectors.map((sec) => (
                <button key={sec} onClick={() => setActiveSector(sec)}
                  className="rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium transition-all shrink-0"
                  style={{ border: `1px solid ${activeSector === sec ? "var(--pf-accent)" : "var(--cmc-border)"}`, color: activeSector === sec ? "var(--pf-accent)" : "var(--cmc-text-sub)", background: activeSector === sec ? "rgba(153,69,255,0.08)" : "transparent" }}
                >{sec}</button>
              ))}
            </div>
            <div className="sm:ml-auto relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--cmc-neutral-5)" }} />
              <input ref={searchRef} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search stocks... (S)" className="w-full sm:w-52 rounded-xl py-2 pl-9 pr-3 text-xs outline-none transition-all duration-200 focus:ring-2" style={{ background: "var(--cmc-neutral-1)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)", boxShadow: "none" }} />
            </div>
          </div>

          {/* Stocks Table */}
          <div className="mt-4 overflow-x-auto rounded-xl" style={{ border: "1px solid var(--cmc-border)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                  {([
                    { label: "", align: "text-left", hide: "", key: null },
                    { label: "#", align: "text-left", hide: "", key: null },
                    { label: "Name", align: "text-left", hide: "", key: null },
                    { label: "Price", align: "text-right", hide: "", key: "price" as SortKey },
                    { label: "Change", align: "text-right", hide: "", key: "change1d" as SortKey },
                    { label: "P/E", align: "text-right", hide: "hidden sm:table-cell", key: "pe" as SortKey },
                    { label: "Mkt Cap", align: "text-right", hide: "hidden md:table-cell", key: "marketCap" as SortKey },
                    { label: "Volume", align: "text-right", hide: "hidden lg:table-cell", key: "volume" as SortKey },
                    { label: "7D", align: "text-center", hide: "hidden xl:table-cell", key: null },
                    { label: "Source", align: "text-center", hide: "", key: null },
                  ] as const).map((h, i) => (
                    <th key={h.label || i}
                      className={`px-2 py-3 text-xs font-semibold ${h.align} ${h.hide} ${h.key ? "cursor-pointer select-none hover:text-(--pf-accent) transition-colors" : ""}`}
                      style={{ color: sortKey === h.key ? "var(--pf-accent)" : "var(--cmc-neutral-5)", background: "var(--cmc-bg)" }}
                      onClick={() => h.key && handleSort(h.key)}
                    >
                      <span className="inline-flex items-center gap-0.5">
                        {h.label}
                        {h.key && sortKey === h.key && (sortDir === "desc" ? <ChevronDown size={10} /> : <ChevronUp size={10} />)}
                        {h.key && sortKey !== h.key && <ArrowUpDown size={8} className="opacity-30" />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <>{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}</>
                ) : sorted.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-16 text-center text-sm" style={{ color: "var(--cmc-neutral-5)" }}>No stocks match your filter.</td></tr>
                ) : sorted.map((s, idx) => {
                  const badge = sourceBadge(s.source);
                  const chg = s.change1d || 0;
                  const spark = genSparkline(s.price, chg);
                  const isStarred = wallet ? isInWatchlist(wallet, s.ticker, "stock") : false;
                  return (
                    <tr key={s.ticker} className="group transition-colors cursor-pointer" style={{ borderBottom: "1px solid var(--cmc-border)" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--cmc-neutral-1)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); handleStar(s); }} title="Add to watchlist">
                            <Star size={14} className={isStarred ? "fill-yellow-400 text-yellow-400" : ""} style={{ color: isStarred ? undefined : "var(--cmc-neutral-4)" }} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); openAI(s); }} className="opacity-0 group-hover:opacity-100 transition-opacity" title="Why is it moving?">
                            <Bot size={13} style={{ color: "var(--pf-accent)" }} />
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-xs font-medium" style={{ color: "var(--cmc-text-sub)" }}>{idx + 1}</td>
                      <td className="px-2 py-3">
                        <Link href={`/stocks/${s.ticker}`} className="flex items-center gap-2.5 hover:opacity-80">
                          {s.logo ? <img src={s.logo} alt={s.ticker} width={32} height={32} className="rounded-lg object-cover" style={{ background: "var(--cmc-neutral-2)" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <div className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}>{s.ticker.slice(0, 2)}</div>}
                          <div>
                            <span className="text-sm font-semibold" style={{ color: "var(--cmc-text)" }}>{s.name || s.ticker}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>{s.ticker}</span>
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{s.exchange}</Badge>
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{shortSector(s.sector)}</Badge>
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--cmc-text)" }}>${fmtPrice(s.price)}</span>
                          {s.confidence > 0 && (
                            <span className="text-[9px] font-mono" style={{ color: "var(--cmc-neutral-5)" }}>±${s.confidence.toFixed(2)}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-right text-sm font-medium tabular-nums" style={{ color: chg >= 0 ? "#16c784" : "#ea3943" }}>{chg >= 0 ? "+" : ""}{chg.toFixed(2)}%</td>
                      <td className="hidden sm:table-cell px-2 py-3 text-right text-sm" style={{ color: "var(--cmc-text)" }}>{s.pe ? s.pe.toFixed(1) : "—"}</td>
                      <td className="hidden md:table-cell px-2 py-3 text-right text-sm" style={{ color: "var(--cmc-text)" }}>{s.marketCap > 0 ? fmtLarge(s.marketCap) : "—"}</td>
                      <td className="hidden lg:table-cell px-2 py-3 text-right text-sm" style={{ color: "var(--cmc-text)" }}>{s.volume > 0 ? fmtLarge(s.volume) : "—"}</td>
                      <td className="hidden xl:table-cell px-2 py-3">
                        <div className="w-[80px] h-[28px] ml-auto">
                          <Sparklines data={spark} width={80} height={28} margin={2}>
                            <SparklinesLine color={chg >= 0 ? "#16c784" : "#ea3943"} style={{ strokeWidth: 1.5, fill: "none" }} />
                          </Sparklines>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center"><span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
            <span>Showing {sorted.length} of {stocks.length} stocks {sortKey && `· sorted by ${sortKey}`}</span>
            <span>Updated {elapsed}s ago &bull; {sseConnected ? "Streaming" : "Polling"} &bull; Press <kbd className="px-1 py-0.5 rounded text-[9px] font-mono" style={{ background: "var(--cmc-neutral-3)" }}>S</kbd> to search</span>
          </div>
        </>
      )}

      {/* === DYNAMIC PYTH TABS (Crypto, Metals, Commodities, Forex) === */}
      {currentTab !== "stocks" && (() => {
        const q = pythSearch.toLowerCase();
        const filtered = pythFeeds.filter((f) => {
          if (!q) return true;
          return f.base.toLowerCase().includes(q) || f.displaySymbol.toLowerCase().includes(q) || f.description.toLowerCase().includes(q);
        });
        const totalPages = Math.ceil(filtered.length / PYTH_PAGE_SIZE);
        const page = Math.min(pythPage, Math.max(0, totalPages - 1));
        const sliced = filtered.slice(page * PYTH_PAGE_SIZE, (page + 1) * PYTH_PAGE_SIZE);
        const priced = Object.keys(pythPrices).length;

        return (
          <>
            {/* Stats + Search */}
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
                <span className="font-semibold" style={{ color: "var(--cmc-text)" }}>{pythFeeds.length}</span> feeds discovered
                <span className="text-[10px]">&bull;</span>
                <span className="font-semibold" style={{ color: "#16c784" }}>{priced}</span> priced
              </div>
              <div className="sm:ml-auto relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--cmc-neutral-5)" }} />
                <input value={pythSearch} onChange={(e) => { setPythSearch(e.target.value); setPythPage(0); }}
                  placeholder={`Search ${tabTitle}...`}
                  className="w-full sm:w-56 rounded-xl py-2 pl-9 pr-3 text-xs outline-none transition-all duration-200 focus:ring-2"
                  style={{ background: "var(--cmc-neutral-1)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }} />
              </div>
            </div>

            {loading ? (
              <div className="mt-6 flex items-center justify-center gap-2 py-16" style={{ color: "var(--cmc-neutral-5)" }}>
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Discovering Pyth {tabTitle} feeds...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="mt-6 py-16 text-center text-sm rounded-xl" style={{ color: "var(--cmc-neutral-5)", border: "1px dashed var(--cmc-border)" }}>
                {pythSearch ? `No ${tabTitle} feeds match "${pythSearch}"` : `No ${tabTitle} feeds available.`}
              </div>
            ) : (
              <div className="mt-4 mx-auto w-full max-w-6xl grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sliced.map((feed) => {
                  const p = pythPrices[feed.id];
                  const confPct = p && p.price > 0 ? (p.confidence / p.price) * 100 : 0;
                  const fmtAmt = (v: number) => {
                    if (feed.quoteCurrency === "JPY") return `¥${v.toLocaleString()}`;
                    if (v >= 10000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
                    if (v >= 1) return `$${v.toFixed(2)}`;
                    if (v >= 0.001) return `$${v.toFixed(4)}`;
                    if (v >= 0.000001) return `$${v.toFixed(6)}`;
                    return `$${v.toFixed(8)}`;
                  };
                  const barColor = confPct < 0.01 ? "#16c784" : confPct < 0.05 ? "var(--pf-teal)" : confPct < 0.1 ? "#f5d100" : "#ea3943";
                  const age = p ? Math.max(0, Math.floor(Date.now() / 1000) - p.publishTime) : null;
                  return (
                    <div key={feed.id} className="rounded-xl p-4 transition-all hover:-translate-y-px group cursor-pointer"
                      onClick={() => setSelectedFeed(feed)}
                      style={{ border: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <FeedIcon base={feed.base} assetType={feed.assetType} size={32} />
                          <div className="min-w-0">
                            <p className="text-sm font-bold leading-none truncate" style={{ color: "var(--cmc-text)" }}>{feed.displaySymbol}</p>
                            <p className="text-[10px] mt-0.5 leading-none truncate" style={{ color: "var(--cmc-neutral-5)" }}>
                              {feed.description.split(" / ")[0]?.split(" ").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ")}
                            </p>
                          </div>
                        </div>
                        {age !== null && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full" style={{ background: age < 10 ? "rgba(22,199,132,0.1)" : "rgba(245,209,0,0.1)", color: age < 10 ? "#16c784" : "#f5d100" }}>
                            {age < 60 ? `${age}s` : `${Math.floor(age / 60)}m`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-end justify-between">
                        <p className="text-lg font-bold tabular-nums" style={{ color: "var(--cmc-text)" }}>
                          {p ? fmtAmt(p.price) : "—"}
                        </p>
                        {p && p.confidence > 0 && (
                          <div className="text-right">
                            <p className="text-[9px] font-mono" style={{ color: barColor }}>±{confPct.toFixed(4)}%</p>
                          </div>
                        )}
                      </div>
                      {/* Confidence bar */}
                      <div className="mt-2.5">
                        <div className="h-1 rounded-full" style={{ background: "var(--cmc-neutral-2)" }}>
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(confPct * 1000, 100)}%`, background: barColor }} />
                        </div>
                      </div>
                      {/* Feed ID */}
                      <p className="mt-2 text-[8px] font-mono truncate opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: "var(--cmc-neutral-5)" }}>
                        0x{feed.id.slice(0, 8)}…{feed.id.slice(-6)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button onClick={() => setPythPage(Math.max(0, page - 1))} disabled={page === 0}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-30"
                  style={{ background: "var(--cmc-neutral-1)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}>
                  <ChevronLeft size={12} /> Prev
                </button>
                <span className="text-xs font-medium" style={{ color: "var(--cmc-neutral-5)" }}>
                  {page + 1} / {totalPages}
                </span>
                <button onClick={() => setPythPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-30"
                  style={{ background: "var(--cmc-neutral-1)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}>
                  Next <ChevronRight size={12} />
                </button>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
              <span>Showing {sliced.length} of {filtered.length} {tabTitle} feeds &bull; Updated {elapsed}s ago</span>
              <span>Powered by <span className="font-semibold" style={{ color: "var(--pf-accent)" }}>Pyth Network</span> Hermes</span>
            </div>
          </>
        );
      })()}
      {/* Pyth Feed Detail Modal */}
      {selectedFeed && (() => {
        const p = pythPrices[selectedFeed.id];
        const confPct = p && p.price > 0 ? (p.confidence / p.price) * 100 : 0;
        const fmtAmt = (v: number) => {
          if (selectedFeed.quoteCurrency === "JPY") return `¥${v.toLocaleString()}`;
          if (v >= 10000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
          if (v >= 1) return `$${v.toFixed(2)}`;
          if (v >= 0.001) return `$${v.toFixed(4)}`;
          return `$${v.toFixed(8)}`;
        };
        const barColor = confPct < 0.01 ? "#16c784" : confPct < 0.05 ? "var(--pf-teal)" : confPct < 0.1 ? "#f5d100" : "#ea3943";
        const age = p ? Math.max(0, Math.floor(Date.now() / 1000) - p.publishTime) : null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => { setSelectedFeed(null); setCopiedFeedId(false); }}>
            <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: "var(--cmc-bg)", border: "1px solid var(--cmc-border)" }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
                <div className="flex items-center gap-3">
                  <FeedIcon base={selectedFeed.base} assetType={selectedFeed.assetType} size={36} />
                  <div>
                    <h3 className="text-base font-bold" style={{ color: "var(--cmc-text)" }}>{selectedFeed.displaySymbol}</h3>
                    <p className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>
                      {selectedFeed.description.split(" / ")[0]?.split(" ").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ")}
                    </p>
                  </div>
                </div>
                <button onClick={() => { setSelectedFeed(null); setCopiedFeedId(false); }} className="p-1 rounded-full hover:bg-white/5">
                  <XIcon size={16} style={{ color: "var(--cmc-neutral-5)" }} />
                </button>
              </div>

              {/* Price */}
              <div className="px-5 py-4">
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <p className="text-[10px] font-medium uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Current Price</p>
                    <p className="text-3xl font-bold tabular-nums mt-1" style={{ color: "var(--cmc-text)" }}>
                      {p ? fmtAmt(p.price) : "—"}
                    </p>
                  </div>
                  {age !== null && (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: age < 10 ? "rgba(22,199,132,0.1)" : "rgba(245,209,0,0.1)", color: age < 10 ? "#16c784" : "#f5d100" }}>
                      Updated {age < 60 ? `${age}s` : `${Math.floor(age / 60)}m`} ago
                    </span>
                  )}
                </div>

                {/* Confidence band */}
                {p && p.confidence > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Confidence Interval</span>
                      <span className="text-[10px] font-bold" style={{ color: barColor }}>±{confPct.toFixed(4)}%</span>
                    </div>
                    <div className="relative h-8 rounded-lg overflow-hidden" style={{ background: "var(--cmc-neutral-2)" }}>
                      <div className="absolute top-0 bottom-0 rounded-lg opacity-25" style={{ left: `${Math.max(50 - confPct * 500, 5)}%`, right: `${Math.max(50 - confPct * 500, 5)}%`, background: barColor }} />
                      <div className="absolute top-0 bottom-0 w-0.5 left-1/2 -translate-x-1/2" style={{ background: "var(--cmc-text)" }} />
                      <div className="absolute inset-0 flex items-center justify-between px-3">
                        <span className="text-[9px] font-mono tabular-nums" style={{ color: "var(--cmc-neutral-5)" }}>{fmtAmt(p.price - p.confidence)}</span>
                        <span className="text-xs font-bold tabular-nums" style={{ color: "var(--cmc-text)" }}>{fmtAmt(p.price)}</span>
                        <span className="text-[9px] font-mono tabular-nums" style={{ color: "var(--cmc-neutral-5)" }}>{fmtAmt(p.price + p.confidence)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full mt-2" style={{ background: "var(--cmc-neutral-2)" }}>
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(confPct * 1000, 100)}%`, background: barColor }} />
                    </div>
                  </div>
                )}

                {/* Detail grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Asset Type", value: selectedFeed.assetType },
                    { label: "Quote Currency", value: selectedFeed.quoteCurrency || "USD" },
                    { label: "Base", value: selectedFeed.base },
                    { label: "Status", value: age !== null ? (age < 60 ? "Live" : "Stale") : "Offline" },
                  ].map(d => (
                    <div key={d.label} className="rounded-lg px-3 py-2" style={{ background: "var(--cmc-neutral-1)" }}>
                      <p className="text-[9px] font-medium uppercase" style={{ color: "var(--cmc-neutral-5)" }}>{d.label}</p>
                      <p className="text-xs font-semibold mt-0.5" style={{ color: "var(--cmc-text)" }}>{d.value}</p>
                    </div>
                  ))}
                </div>

                {/* Feed ID */}
                <div className="mt-3 rounded-lg px-3 py-2" style={{ background: "var(--cmc-neutral-1)" }}>
                  <p className="text-[9px] font-medium uppercase mb-1" style={{ color: "var(--cmc-neutral-5)" }}>Pyth Feed ID</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-mono truncate mr-2" style={{ color: "var(--cmc-text)" }}>0x{selectedFeed.id}</p>
                    <button onClick={() => { navigator.clipboard.writeText(`0x${selectedFeed.id}`); setCopiedFeedId(true); setTimeout(() => setCopiedFeedId(false), 2000); }}
                      className="shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors"
                      style={{ background: copiedFeedId ? "rgba(22,199,132,0.1)" : "var(--cmc-neutral-2)", color: copiedFeedId ? "#16c784" : "var(--cmc-neutral-5)" }}>
                      {copiedFeedId ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 flex items-center justify-between text-[10px]" style={{ borderTop: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)", color: "var(--cmc-neutral-5)" }}>
                <span>Powered by <span className="font-semibold" style={{ color: "var(--pf-accent)" }}>Pyth Network</span></span>
                <a href={`https://pyth.network/price-feeds`} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: "var(--pf-accent)" }}>View on Pyth ↗</a>
              </div>
            </div>
          </div>
        );
      })()}

      {/* AI Analysis Modal */}
      {aiTicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setAiTicker(null)}>
          <div className="w-full max-w-lg rounded-2xl p-5 max-h-[80vh] overflow-y-auto" style={{ background: "var(--cmc-bg)", border: "1px solid var(--cmc-border)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bot size={18} style={{ color: "var(--pf-accent)" }} />
                <h3 className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>Why is {aiTicker} moving?</h3>
              </div>
              <button onClick={() => setAiTicker(null)}><XIcon size={16} style={{ color: "var(--cmc-neutral-5)" }} /></button>
            </div>
            {aiLoading ? (
              <div className="flex items-center gap-2 py-8 justify-center" style={{ color: "var(--cmc-neutral-5)" }}>
                <Loader2 size={16} className="animate-spin" /> <span className="text-sm">Analyzing with AI...</span>
              </div>
            ) : (
              <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--cmc-text-sub)" }}>{aiText}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
