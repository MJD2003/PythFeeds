"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search, X, Copy, Check, ExternalLink, Radio, Wifi, WifiOff,
  ChevronDown, ChevronUp, ArrowUpDown, Loader2, Zap, Shield, Activity,
  Filter, Clock, CircleDot,
} from "lucide-react";
import {
  fetchAllPythFeeds, fetchPricesByIds, subscribePriceStream,
  type PythFeedMeta, type PythPriceData,
} from "@/lib/pyth-feeds";
import { BorderBeam } from "@/Components/magicui/border-beam";
import FeedIcon from "@/Components/shared/FeedIcon";

/* ─────────────── Constants ─────────────── */
const PAGE_SIZE = 50;
const STREAM_LIMIT = 100;
const TOP_CRYPTO_BASES = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "PYTH"];

const CAT_COLORS: Record<string, string> = {
  All: "var(--cmc-text)",
  Crypto: "var(--pf-accent)",
  "Crypto Index": "var(--pf-accent)",
  "Crypto NAV": "var(--pf-accent)",
  "Crypto Redemption Rate": "var(--pf-accent)",
  Equity: "var(--pf-info)",
  Metal: "#f5a623",
  Commodities: "var(--pf-warning)",
  FX: "var(--pf-teal)",
  Rates: "var(--pf-teal)",
  Kalshi: "#e06060",
  ECO: "#4caf50",
};
function catColor(c: string) { return CAT_COLORS[c] ?? "var(--cmc-neutral-5)"; }

function feedName(desc: string): string {
  const part = desc.split(" / ")[0] ?? desc;
  return part.split(" ").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

/* ─────────────── Price formatting ─────────────── */
function fmtPrice(p: number): string {
  if (!p || p === 0) return "—";
  if (p >= 10000) return `$${p.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.001) return `$${p.toFixed(4)}`;
  if (p >= 0.000001) return `$${p.toFixed(6)}`;
  return `$${p.toFixed(8)}`;
}

function fmtConf(c: number): string {
  if (!c || c === 0) return "—";
  if (c >= 1) return `±$${c.toFixed(2)}`;
  if (c >= 0.001) return `±$${c.toFixed(4)}`;
  if (c >= 0.000001) return `±$${c.toFixed(6)}`;
  return `±$${c.toFixed(8)}`;
}

function truncId(id: string): string {
  return `0x${id.slice(0, 6)}…${id.slice(-4)}`;
}

type SortKey = "symbol" | "price" | "confidence" | "age";
type StatusFilter = "all" | "live" | "stale" | "offline";

const STATUS_CONFIG: { key: StatusFilter; label: string; color: string }[] = [
  { key: "all", label: "All", color: "var(--cmc-text)" },
  { key: "live", label: "Live", color: "var(--pf-up)" },
  { key: "stale", label: "Stale", color: "var(--pf-warning)" },
  { key: "offline", label: "Offline", color: "var(--pf-down)" },
];

/* ─────────────── Page Component ─────────────── */
export default function FeedsExplorer() {
  const [feeds, setFeeds] = useState<PythFeedMeta[]>([]);
  const [prices, setPrices] = useState<Record<string, PythPriceData>>({});
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortAsc, setSortAsc] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const cleanupRef = useRef<(() => void) | null>(null);
  const flashRef = useRef<Set<string>>(new Set());
  const [flashTick, setFlashTick] = useState(0);
  const prevPricesRef = useRef<Record<string, number>>({});
  const [priceDeltas, setPriceDeltas] = useState<Record<string, number>>({});
  const [streamCount, setStreamCount] = useState(0);

  /* ── Discover all feeds + fetch initial prices ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const catalog = await fetchAllPythFeeds();
        if (cancelled) return;
        setFeeds(catalog);
        const ids = catalog.map((f) => f.id);
        const priceData = await fetchPricesByIds(ids);
        if (cancelled) return;
        setPrices(priceData);
      } catch (e) {
        console.error("Failed to load Pyth feeds:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── SSE streaming for top feeds (limited to STREAM_LIMIT) ── */
  useEffect(() => {
    if (feeds.length === 0) return;
    const topIds = feeds.slice(0, STREAM_LIMIT).map((f) => f.id);

    const unsub = subscribePriceStream(
      topIds,
      (feedId, price, confidence, publishTime) => {
        setStreaming(true);
        setStreamCount(c => c + 1);
        flashRef.current.add(feedId);
        setFlashTick((t) => t + 1);
        setTimeout(() => { flashRef.current.delete(feedId); setFlashTick((t) => t + 1); }, 600);
        // Track price deltas
        const prev = prevPricesRef.current[feedId];
        if (prev && prev > 0 && price > 0) {
          setPriceDeltas(d => ({ ...d, [feedId]: ((price - prev) / prev) * 100 }));
        }
        prevPricesRef.current[feedId] = price;
        setPrices((prev) => ({
          ...prev,
          [feedId]: { price, confidence, expo: prev[feedId]?.expo ?? 0, publishTime },
        }));
      }
    );
    cleanupRef.current = unsub;

    return () => { unsub(); };
  }, [feeds]);

  /* Reset page when filters change */
  useEffect(() => { setPage(0); }, [search, category, sortKey, sortAsc, statusFilter]);

  /* ── Derived categories ── */
  const categories = useMemo(() => {
    const set = new Set<string>();
    feeds.forEach((f) => set.add(f.assetType));
    return ["All", ...Array.from(set).sort()];
  }, [feeds]);

  /* Copy feed ID */
  const copyFeedId = useCallback((id: string) => {
    navigator.clipboard.writeText(`0x${id}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  /* Sort toggle */
  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(true); }
  }, [sortKey]);

  const now = Math.floor(Date.now() / 1000);

  /* ── Helper: get feed status ── */
  const getFeedStatus = useCallback((feedId: string): "live" | "stale" | "offline" => {
    const p = prices[feedId];
    if (!p || !p.publishTime) return "offline";
    const age = now - p.publishTime;
    if (age < 0 || age > 86400) return "offline";
    if (age > 60) return "stale";
    return "live";
  }, [prices, now]);

  /* ── Feed status counts ── */
  const statusCounts = useMemo(() => {
    const counts = { all: feeds.length, live: 0, stale: 0, offline: 0 };
    feeds.forEach((f) => { counts[getFeedStatus(f.id)]++; });
    return counts;
  }, [feeds, getFeedStatus]);

  /* ── Category counts ── */
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: feeds.length };
    feeds.forEach((f) => { counts[f.assetType] = (counts[f.assetType] || 0) + 1; });
    return counts;
  }, [feeds]);

  /* ── Filtered + sorted feeds ── */
  const filtered = useMemo(() => {
    let list = feeds;
    if (category !== "All") list = list.filter((f) => f.assetType === category);
    if (statusFilter !== "all") list = list.filter((f) => getFeedStatus(f.id) === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          f.base.toLowerCase().includes(q) ||
          f.displaySymbol.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      const pa = prices[a.id]?.price ?? 0;
      const pb = prices[b.id]?.price ?? 0;
      const ca = prices[a.id]?.confidence ?? 0;
      const cb = prices[b.id]?.confidence ?? 0;
      const ta = prices[a.id]?.publishTime ?? 0;
      const tb = prices[b.id]?.publishTime ?? 0;
      switch (sortKey) {
        case "symbol": cmp = a.displaySymbol.localeCompare(b.displaySymbol); break;
        case "price": cmp = pa - pb; break;
        case "confidence": cmp = (pa > 0 ? ca / pa : 0) - (pb > 0 ? cb / pb : 0); break;
        case "age": cmp = tb - ta; break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [feeds, category, search, sortKey, sortAsc, prices, statusFilter, getFeedStatus]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  /* ── Stats ── */
  const liveFeeds = Object.keys(prices).length;
  const avgConfPct = useMemo(() => {
    const vals = Object.values(prices)
      .filter((p) => p.price > 0)
      .map((p) => (p.confidence / p.price) * 100);
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  }, [prices]);

  /* ── Top-7 crypto for confidence monitor ── */
  const topCrypto = useMemo(() => {
    return TOP_CRYPTO_BASES
      .map((base) => feeds.find((f) => f.base === base && f.assetType === "Crypto" && f.quoteCurrency === "USD"))
      .filter(Boolean) as PythFeedMeta[];
  }, [feeds]);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "var(--cmc-bg)" }}>
      <div className="mx-auto max-w-[1400px] px-4 py-6">
        {/* ── Header ── */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold font-display" style={{ color: "var(--cmc-text)" }}>
            Pyth Price Feeds
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--cmc-neutral-5)" }}>
            {feeds.length.toLocaleString()} live oracle feeds — powered by Pyth Network
          </p>
        </div>

        {/* ── Stats cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
          {[
            { icon: Radio, label: "Total Feeds", value: feeds.length.toLocaleString(), color: "var(--pf-accent)" },
            { icon: Wifi, label: "Live Prices", value: liveFeeds.toLocaleString(), color: "var(--pf-up)" },
            { icon: Shield, label: "Avg Confidence", value: `±${avgConfPct.toFixed(4)}%`, color: "var(--pf-teal)" },
            { icon: Activity, label: "Stream", value: streaming ? `${streamCount.toLocaleString()} updates` : "Connecting...", color: streaming ? "var(--pf-up)" : "var(--pf-warning)" },
          ].map((stat) => (
            <div key={stat.label} className="relative overflow-hidden rounded-xl px-4 py-3 transition-all hover:-translate-y-0.5"
              style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <stat.icon size={12} style={{ color: stat.color }} />
                <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--cmc-neutral-5)" }}>{stat.label}</span>
              </div>
              <p className="text-base font-bold font-display" style={{ color: "var(--cmc-text)" }}>{stat.value}</p>
              <BorderBeam size={60} duration={8} colorFrom="var(--pf-accent)" colorTo="var(--pf-teal)" />
            </div>
          ))}
        </div>

        {/* ── Confidence Widget (featured) ── */}
        <div className="relative overflow-hidden rounded-2xl p-5 mb-5" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Zap size={16} style={{ color: "var(--pf-accent)" }} />
            <h2 className="text-sm font-bold font-display" style={{ color: "var(--cmc-text)" }}>Confidence Monitor</h2>
            <span className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(22,199,132,0.12)", color: "#16c784" }}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: streaming ? "#16c784" : "#f5a623" }} />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: streaming ? "#16c784" : "#f5a623" }} />
              </span>
              Live
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-2">
            {topCrypto.map((feed) => {
              const p = prices[feed.id];
              const confPct = p && p.price > 0 ? (p.confidence / p.price) * 100 : 0;
              const isFlashing = flashRef.current.has(feed.id);
              const barColor = confPct < 0.01 ? "var(--pf-up)" : confPct < 0.05 ? "var(--pf-teal)" : confPct < 0.1 ? "var(--pf-warning)" : "var(--pf-down)";
              return (
                <div key={feed.id}
                  className="rounded-lg p-2.5 transition-all"
                  style={{
                    background: isFlashing ? "rgba(113,66,207,0.08)" : "var(--cmc-neutral-05)",
                    border: `1px solid ${isFlashing ? "var(--pf-accent)" : "var(--cmc-border)"}`,
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <FeedIcon base={feed.base} assetType={feed.assetType} size={18} />
                    <span className="text-[10px] font-bold tracking-wide" style={{ color: "var(--cmc-neutral-5)" }}>{feed.base}</span>
                  </div>
                  <p className="text-sm font-bold font-display mt-0.5" style={{ color: "var(--cmc-text)" }}>
                    {p ? fmtPrice(p.price) : "—"}
                  </p>
                  <div className="mt-1.5">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[9px]" style={{ color: "var(--cmc-neutral-5)" }}>Conf.</span>
                      <span className="text-[9px] font-semibold" style={{ color: barColor }}>{confPct.toFixed(4)}%</span>
                    </div>
                    <div className="h-1 rounded-full" style={{ background: "var(--cmc-neutral-2)" }}>
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(confPct * 1000, 100)}%`, background: barColor }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <BorderBeam size={120} duration={10} colorFrom="var(--pf-accent)" colorTo="var(--pf-teal)" />
        </div>

        {/* ── Search + Category Filter ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 mb-3">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--cmc-neutral-5)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search feeds..."
              className="w-full rounded-lg border pl-9 pr-8 py-2 text-xs outline-none transition-colors focus:border-(--pf-accent)"
              style={{ background: "var(--cmc-neutral-1)", borderColor: "var(--cmc-border)", color: "var(--cmc-text)" }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X size={12} style={{ color: "var(--cmc-neutral-5)" }} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide w-full min-w-0">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setCategory(cat)}
                className="shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-all flex items-center gap-1"
                style={{
                  background: category === cat ? (catColor(cat)) : "transparent",
                  color: category === cat ? (cat === "All" ? "var(--cmc-bg)" : "#fff") : "var(--cmc-neutral-5)",
                  border: `1px solid ${category === cat ? "transparent" : "var(--cmc-border)"}`,
                }}
              >
                {cat}
                <span className="text-[9px] opacity-60 tabular-nums">{categoryCounts[cat] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Status Filter ── */}
        <div className="flex items-center gap-2 mb-4">
          <Filter size={12} style={{ color: "var(--cmc-neutral-5)" }} />
          <div className="flex items-center gap-1">
            {STATUS_CONFIG.map((s) => (
              <button key={s.key} onClick={() => setStatusFilter(s.key)}
                className="flex items-center gap-1 shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-all"
                style={{
                  background: statusFilter === s.key ? `${s.color}18` : "transparent",
                  color: statusFilter === s.key ? s.color : "var(--cmc-neutral-5)",
                  border: `1px solid ${statusFilter === s.key ? s.color : "var(--cmc-border)"}`,
                }}
              >
                {s.key !== "all" && <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />}
                {s.label}
                <span className="tabular-nums opacity-60">{statusCounts[s.key]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin" style={{ color: "var(--pf-accent)" }} />
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1fr_1fr] md:grid-cols-[2fr_1.2fr_1fr_0.5fr_0.8fr_0.6fr] gap-2 px-4 py-2.5" style={{ background: "var(--cmc-neutral-1)" }}>
              {([
                { key: "symbol" as SortKey, label: "Feed", hideClass: "" },
                { key: "price" as SortKey, label: "Price", hideClass: "" },
                { key: "confidence" as SortKey, label: "Confidence", hideClass: "" },
                { key: "age" as SortKey, label: "Status", hideClass: "hidden md:flex" },
                { key: "age" as SortKey, label: "Updated", hideClass: "hidden md:flex" },
              ] as const).map((col, idx) => (
                <button key={`${col.key}-${idx}`} onClick={() => toggleSort(col.key)}
                  className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${col.hideClass}`}
                  style={{ color: sortKey === col.key ? "var(--pf-accent)" : "var(--cmc-neutral-5)" }}
                >
                  {col.label}
                  {sortKey === col.key ? (sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />) : <ArrowUpDown size={9} />}
                </button>
              ))}
              <span className="hidden md:block text-[10px] font-semibold uppercase tracking-wide text-right" style={{ color: "var(--cmc-neutral-5)" }}>Feed ID</span>
            </div>

            {/* Table rows */}
            <div>
              {visible.length === 0 ? (
                <div className="py-12 text-center text-sm" style={{ color: "var(--cmc-neutral-5)" }}>No feeds found</div>
              ) : (
                visible.map((feed) => {
                  const p = prices[feed.id];
                  const confPct = p && p.price > 0 ? (p.confidence / p.price) * 100 : 0;
                  const age = p && p.publishTime > 0 ? now - p.publishTime : -1;
                  const isStale = age < 0 || age > 60;
                  const isOffline = age < 0 || age > 86400;
                  const isFlashing = flashRef.current.has(feed.id);
                  const isExpanded = expanded === feed.id;
                  const barColor = confPct < 0.01 ? "var(--pf-up)" : confPct < 0.05 ? "var(--pf-teal)" : confPct < 0.1 ? "var(--pf-warning)" : "var(--pf-down)";
                  const cc = catColor(feed.assetType);
                  const status = getFeedStatus(feed.id);
                  const statusColor = status === "live" ? "var(--pf-up)" : status === "stale" ? "var(--pf-warning)" : "var(--pf-down)";

                  return (
                    <div key={feed.id}>
                      <div
                        onClick={() => setExpanded(isExpanded ? null : feed.id)}
                        className="grid grid-cols-[2fr_1fr_1fr] md:grid-cols-[2fr_1.2fr_1fr_0.5fr_0.8fr_0.6fr] gap-2 px-4 py-3 cursor-pointer transition-colors"
                        style={{
                          background: isFlashing ? "rgba(113,66,207,0.06)" : "var(--cmc-bg)",
                          borderBottom: "1px solid var(--cmc-border)",
                        }}
                      >
                        {/* Symbol + name */}
                        <div className="flex items-center gap-2 min-w-0">
                          <FeedIcon base={feed.base} assetType={feed.assetType} size={28} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: "var(--cmc-text)" }}>
                              {/^\d/.test(feed.base) ? feedName(feed.description) : feed.displaySymbol}
                            </p>
                            <p className="text-[10px] truncate" style={{ color: "var(--cmc-neutral-5)" }}>
                              {/^\d/.test(feed.base) ? feed.displaySymbol : feedName(feed.description)}
                            </p>
                          </div>
                          <span className="hidden sm:inline text-[9px] px-1.5 py-0.5 rounded-full font-medium ml-1 shrink-0"
                            style={{ background: `${cc}15`, color: cc }}>
                            {feed.assetType}
                          </span>
                        </div>

                        {/* Price + delta */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold tabular-nums" style={{ color: p && p.price > 0 ? "var(--cmc-text)" : "var(--cmc-neutral-5)" }}>
                            {p ? fmtPrice(p.price) : "—"}
                          </span>
                          {priceDeltas[feed.id] !== undefined && Math.abs(priceDeltas[feed.id]) > 0.001 && (
                            <span className="text-[9px] font-bold tabular-nums" style={{ color: priceDeltas[feed.id] > 0 ? "var(--pf-up)" : "var(--pf-down)" }}>
                              {priceDeltas[feed.id] > 0 ? "+" : ""}{priceDeltas[feed.id].toFixed(3)}%
                            </span>
                          )}
                        </div>

                        {/* Confidence */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs font-medium tabular-nums" style={{ color: barColor }}>
                                {p ? `±${confPct.toFixed(3)}%` : "—"}
                              </span>
                            </div>
                            <div className="h-1 rounded-full" style={{ background: "var(--cmc-neutral-2)" }}>
                              <div className="h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(confPct * 1000, 100)}%`, background: barColor }} />
                            </div>
                          </div>
                        </div>

                        {/* Status badge — hidden on mobile */}
                        <div className="hidden md:flex items-center">
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: `${statusColor}15`, color: statusColor }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor, ...(status === "live" ? { animation: "pulse 2s infinite" } : {}) }} />
                            {status === "live" ? "Live" : status === "stale" ? "Stale" : "Offline"}
                          </span>
                        </div>

                        {/* Age — hidden on mobile */}
                        <div className="hidden md:flex items-center">
                          <span className="text-xs font-medium" style={{ color: isOffline ? "var(--cmc-neutral-5)" : isStale ? "var(--pf-warning)" : "var(--pf-up)" }}>
                            {!p || isOffline ? "—" : age < 5 ? "just now" : age < 60 ? `${age}s ago` : age < 3600 ? `${Math.floor(age / 60)}m ago` : `${Math.floor(age / 3600)}h ago`}
                          </span>
                        </div>

                        {/* Feed ID — hidden on mobile */}
                        <div className="hidden md:flex items-center justify-end">
                          <button
                            onClick={(e) => { e.stopPropagation(); copyFeedId(feed.id); }}
                            className="flex items-center gap-1 text-[10px] font-mono rounded-md px-1.5 py-0.5 transition-colors hover:bg-white/5"
                            style={{ color: "var(--cmc-neutral-5)" }}
                          >
                            {copiedId === feed.id ? <Check size={10} style={{ color: "var(--pf-up)" }} /> : <Copy size={10} />}
                            {truncId(feed.id)}
                          </button>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && p && (
                        <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3" style={{ background: "var(--cmc-neutral-1)", borderBottom: "1px solid var(--cmc-border)" }}>
                          <div>
                            <p className="text-[9px] font-medium uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Price</p>
                            <p className="text-base font-semibold tabular-nums" style={{ color: "var(--cmc-text)" }}>{fmtPrice(p.price)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-medium uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Confidence Interval</p>
                            <p className="text-sm font-semibold tabular-nums" style={{ color: barColor }}>{fmtConf(p.confidence)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-medium uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Price Range</p>
                            <p className="text-sm font-medium tabular-nums" style={{ color: "var(--cmc-text)" }}>
                              {fmtPrice(p.price - p.confidence)} — {fmtPrice(p.price + p.confidence)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] font-medium uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Full Feed ID</p>
                            <p className="text-[10px] font-mono break-all" style={{ color: "var(--cmc-neutral-5)" }}>0x{feed.id}</p>
                          </div>
                          {/* Visual confidence band */}
                          <div className="col-span-full">
                            <p className="text-[9px] font-medium uppercase mb-1.5" style={{ color: "var(--cmc-neutral-5)" }}>Confidence Band</p>
                            <div className="relative h-8 rounded-lg overflow-hidden" style={{ background: "var(--cmc-neutral-2)" }}>
                              {/* Band */}
                              <div className="absolute top-0 bottom-0 rounded-lg opacity-25" style={{
                                left: `${Math.max(50 - confPct * 500, 5)}%`,
                                right: `${Math.max(50 - confPct * 500, 5)}%`,
                                background: barColor,
                              }} />
                              {/* Center line */}
                              <div className="absolute top-0 bottom-0 w-0.5 left-1/2 -translate-x-1/2" style={{ background: "var(--cmc-text)" }} />
                              {/* Labels */}
                              <div className="absolute inset-0 flex items-center justify-between px-3">
                                <span className="text-[10px] font-mono tabular-nums" style={{ color: "var(--cmc-neutral-5)" }}>{fmtPrice(p.price - p.confidence)}</span>
                                <span className="text-xs font-bold tabular-nums" style={{ color: "var(--cmc-text)" }}>{fmtPrice(p.price)}</span>
                                <span className="text-[10px] font-mono tabular-nums" style={{ color: "var(--cmc-neutral-5)" }}>{fmtPrice(p.price + p.confidence)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── Pagination + Footer ── */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()} feeds
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-30"
                style={{ background: "var(--cmc-neutral-1)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}
              >
                Prev
              </button>
              <span className="text-[11px] px-2 font-medium" style={{ color: "var(--cmc-neutral-5)" }}>
                {page + 1} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-30"
                style={{ background: "var(--cmc-neutral-1)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}
              >
                Next
              </button>
            </div>
          )}
          <a
            href="https://pyth.network/price-feeds"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-medium transition-colors hover:underline"
            style={{ color: "var(--pf-accent)" }}
          >
            Browse all Pyth feeds <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </div>
  );
}
