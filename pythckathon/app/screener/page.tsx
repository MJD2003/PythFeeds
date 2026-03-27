"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Search, RefreshCw, ExternalLink, ArrowUpDown, Filter, Flame,
  ChevronDown, ChevronUp, AlertTriangle, ChevronLeft, ChevronRight,
  ArrowLeftRight, Shield, ShieldAlert, ShieldCheck, Clock, TrendingUp,
  Sparkles, X, Eye, EyeOff,
} from "lucide-react";
import { fetchDexSearch, fetchFreshSolanaPairs, fetchDexGainersLosers, type DexPair, type FreshPair } from "@/lib/api/backend";
import { toast } from "sonner";
import { fmtUsd, fmtPrice } from "@/lib/format";
import { useMode } from "@/lib/mode-store";
import QuickBuy from "@/Components/shared/QuickBuy";

type SortKey = "safety" | "volume" | "liquidity" | "priceChange" | "txns" | "marketCap" | "age";
type TimeFrame = "m5" | "h1" | "h6" | "h24";
type Feed = "hot" | "new" | "gainers" | "losers" | "search";

function timeAgo(ts: number) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function safetyColor(s: number) {
  if (s >= 65) return "#16c784";
  if (s >= 45) return "#f0b90b";
  return "#ea3943";
}

function safetyLabel(s: number) {
  if (s >= 65) return "Safe";
  if (s >= 45) return "Moderate";
  return "Risky";
}

interface Filters {
  minLiq: number;
  maxLiq: number;
  minVol: number;
  maxVol: number;
  minMcap: number;
  maxMcap: number;
  maxAgeH: number;
  minBuyRatio: number;
  minSafety: number;
  hideGraduated: boolean;
  hideRugRisk: boolean;
}

const DEFAULT_FILTERS: Filters = {
  minLiq: 0, maxLiq: 0, minVol: 0, maxVol: 0, minMcap: 0, maxMcap: 0,
  maxAgeH: 0, minBuyRatio: 0, minSafety: 0, hideGraduated: true, hideRugRisk: false,
};

export default function ScreenerPage() {
  const mode = useMode();
  const isDegen = mode === "degen";
  const [pairs, setPairs] = useState<FreshPair[]>([]);
  const [searchPairs, setSearchPairs] = useState<DexPair[]>([]);
  const [gainersPairs, setGainersPairs] = useState<FreshPair[]>([]);
  const [losersPairs, setLosersPairs] = useState<FreshPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [sortAsc, setSortAsc] = useState(false);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("h1");
  const [feed, setFeed] = useState<Feed>("hot");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const refreshRef = useRef<NodeJS.Timeout | null>(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [page, setPage] = useState(0);
  const prevPricesRef = useRef<Record<string, string>>({});
  const [flashMap, setFlashMap] = useState<Record<string, "up" | "down">>({});
  const PAGE_SIZE = 30;

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.minLiq > 0) c++;
    if (filters.maxLiq > 0) c++;
    if (filters.minVol > 0) c++;
    if (filters.maxVol > 0) c++;
    if (filters.minMcap > 0) c++;
    if (filters.maxMcap > 0) c++;
    if (filters.maxAgeH > 0) c++;
    if (filters.minBuyRatio > 0) c++;
    if (filters.minSafety > 0) c++;
    if (filters.hideGraduated) c++;
    if (filters.hideRugRisk) c++;
    return c;
  }, [filters]);

  // ── Load fresh pairs from multi-source backend ──
  const loadFresh = useCallback(async () => {
    try {
      const fresh = await fetchFreshSolanaPairs();
      // Flash animation
      const newFlash: Record<string, "up" | "down"> = {};
      for (const p of fresh) {
        const prev = prevPricesRef.current[p.pairAddress];
        if (prev && prev !== p.priceUsd) {
          newFlash[p.pairAddress] = parseFloat(p.priceUsd) > parseFloat(prev) ? "up" : "down";
        }
        prevPricesRef.current[p.pairAddress] = p.priceUsd;
      }
      if (Object.keys(newFlash).length > 0) {
        setFlashMap(newFlash);
        setTimeout(() => setFlashMap({}), 600);
      }
      setPairs(fresh);
      // Also fetch gainers/losers
      try {
        const gl = await fetchDexGainersLosers(20);
        setGainersPairs(gl.gainers || []);
        setLosersPairs(gl.losers || []);
      } catch {}
      setLastUpdate(Date.now());
    } catch (err) {
      console.error("[Screener] Load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) { setFeed("hot"); return; }
    setFeed("search");
    setLoading(true);
    try {
      const results = await fetchDexSearch(searchQuery.trim());
      setSearchPairs(results.filter(p => p.chainId === "solana"));
    } catch { toast.error("Search failed"); }
    finally { setLoading(false); }
  }, [searchQuery]);

  useEffect(() => {
    loadFresh();
    refreshRef.current = setInterval(loadFresh, 20000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [loadFresh]);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - lastUpdate) / 1000)), 1000);
    return () => clearInterval(t);
  }, [lastUpdate]);

  useEffect(() => { setPage(0); }, [filters, searchQuery, sortKey, sortAsc, timeFrame, feed]);

  // ── Apply filters + sort ──
  const displayPairs: (FreshPair | DexPair)[] = useMemo(() => {
    const base = feed === "search" ? searchPairs : feed === "gainers" ? gainersPairs : feed === "losers" ? losersPairs : pairs;
    // "New" feed: only show pairs < 72h old
    if (feed === "new") {
      return base.filter(p => {
        const fp = p as FreshPair;
        return (fp.ageHours ?? 9999) < 72;
      });
    }
    return base;
  }, [feed, searchPairs, gainersPairs, losersPairs, pairs]);

  const filtered = useMemo(() => {
    return displayPairs.filter(p => {
      const fp = p as FreshPair;
      const liq = p.liquidity?.usd || 0;
      const vol = p.volume?.h24 || 0;
      const mcap = p.marketCap || p.fdv || 0;
      const ageH = fp.ageHours ?? 0;
      const buyR = fp.buyRatio ?? 0.5;
      const safety = fp.safety ?? 50;
      const graduated = fp.isGraduated ?? false;

      if (filters.minLiq > 0 && liq < filters.minLiq) return false;
      if (filters.maxLiq > 0 && liq > filters.maxLiq) return false;
      if (filters.minVol > 0 && vol < filters.minVol) return false;
      if (filters.maxVol > 0 && vol > filters.maxVol) return false;
      if (filters.minMcap > 0 && mcap < filters.minMcap) return false;
      if (filters.maxMcap > 0 && mcap > filters.maxMcap) return false;
      if (filters.maxAgeH > 0 && ageH > filters.maxAgeH) return false;
      if (filters.minBuyRatio > 0 && buyR < filters.minBuyRatio) return false;
      if (filters.minSafety > 0 && safety < filters.minSafety) return false;
      if (filters.hideGraduated && graduated) return false;
      if (filters.hideRugRisk && liq < 1000 && vol > 50000) return false;
      return true;
    });
  }, [displayPairs, filters]);

  const sorted = useMemo(() => {
    // For "new" feed, sort by age asc by default
    const effectiveSortKey = feed === "new" && sortKey === "volume" ? "age" : sortKey;
    const effectiveSortAsc = feed === "new" && sortKey === "volume" ? true : sortAsc;

    return [...filtered].sort((a, b) => {
      let va = 0, vb = 0;
      const fa = a as FreshPair, fb = b as FreshPair;
      switch (effectiveSortKey) {
        case "safety": va = fa.safety ?? 50; vb = fb.safety ?? 50; break;
        case "volume": va = a.volume[timeFrame]; vb = b.volume[timeFrame]; break;
        case "liquidity": va = a.liquidity.usd; vb = b.liquidity.usd; break;
        case "priceChange": va = a.priceChange[timeFrame]; vb = b.priceChange[timeFrame]; break;
        case "txns": va = a.txns[timeFrame].buys + a.txns[timeFrame].sells; vb = b.txns[timeFrame].buys + b.txns[timeFrame].sells; break;
        case "marketCap": va = a.marketCap || a.fdv; vb = b.marketCap || b.fdv; break;
        case "age": va = a.pairCreatedAt || 0; vb = b.pairCreatedAt || 0; break;
      }
      return effectiveSortAsc ? va - vb : vb - va;
    });
  }, [filtered, sortKey, sortAsc, timeFrame, feed]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const updateFilter = (partial: Partial<Filters>) => setFilters(prev => ({ ...prev, ...partial }));

  const SortTh = ({ label, sKey, cls = "" }: { label: string; sKey: SortKey; cls?: string }) => (
    <th className={`px-2 py-2 text-[9px] font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap ${cls}`}
      style={{ color: sortKey === sKey ? "var(--cmc-text)" : "var(--cmc-neutral-5)" }}
      onClick={() => handleSort(sKey)}>
      <div className="flex items-center gap-0.5 justify-end">{label}{sortKey === sKey && <ArrowUpDown size={8} />}</div>
    </th>
  );

  const SelectFilter = ({ label, value, onChange, options }: { label: string; value: number; onChange: (v: number) => void; options: { v: number; l: string }[] }) => (
    <div>
      <label className="text-[8px] font-bold uppercase block mb-0.5 tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>{label}</label>
      <select value={value} onChange={e => onChange(Number(e.target.value))} className="rounded-lg px-2 py-1 text-[10px] outline-none w-full"
        style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-4">
      {/* ═══ Header ═══ */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--cmc-text)" }}>
            <Flame size={20} style={{ color: "#f0b90b" }} /> DEX Screener
            {isDegen && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(240,185,11,0.15)", color: "#f0b90b", border: "1px solid rgba(240,185,11,0.3)" }}>DEGEN</span>}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--cmc-neutral-5)" }}>
            Multi-source Solana pair discovery · {sorted.length} pairs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] tabular-nums" style={{ color: "var(--cmc-neutral-4)" }}>
            {elapsed}s ago
          </span>
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-semibold" style={{ background: "rgba(153,69,255,0.08)", color: "var(--pf-accent)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--pf-teal)" }} /> Live 20s
          </div>
          <button onClick={loadFresh} disabled={loading} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: "var(--cmc-neutral-5)" }}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ═══ Feed Tabs + Search + TimeFrame + Filters ═══ */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* Feed tabs */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
          {([
            { key: "hot" as Feed, label: "Hot", icon: <Flame size={10} /> },
            { key: "new" as Feed, label: "New", icon: <Sparkles size={10} /> },
            { key: "gainers" as Feed, label: "Gainers", icon: <TrendingUp size={10} /> },
            { key: "losers" as Feed, label: "Losers", icon: <AlertTriangle size={10} /> },
          ]).map(f => (
            <button key={f.key} onClick={() => { setFeed(f.key); setSearchQuery(""); }} className="px-3 py-1.5 text-[10px] font-bold flex items-center gap-1"
              style={{ background: feed === f.key ? "var(--pf-accent)" : "var(--cmc-neutral-1)", color: feed === f.key ? "#fff" : "var(--cmc-neutral-5)" }}>
              {f.icon} {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--cmc-neutral-5)" }} />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search token, symbol, or address..."
              className="w-full rounded-lg pl-8 pr-3 py-1.5 text-[11px] outline-none"
              style={{ background: "var(--cmc-neutral-1)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }} />
            {searchQuery && (
              <button type="button" onClick={() => { setSearchQuery(""); setFeed("hot"); }} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X size={10} style={{ color: "var(--cmc-neutral-5)" }} />
              </button>
            )}
          </div>
        </form>

        {/* TimeFrame */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
          {(["m5", "h1", "h6", "h24"] as TimeFrame[]).map(tf => (
            <button key={tf} onClick={() => setTimeFrame(tf)} className="px-2 py-1.5 text-[10px] font-bold uppercase"
              style={{ background: timeFrame === tf ? "var(--cmc-text)" : "var(--cmc-neutral-1)", color: timeFrame === tf ? "var(--cmc-bg)" : "var(--cmc-neutral-5)" }}>
              {tf}
            </button>
          ))}
        </div>

        {/* Filters toggle */}
        <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold relative"
          style={{ background: showFilters ? "var(--pf-accent)" : "var(--cmc-neutral-1)", color: showFilters ? "#fff" : "var(--cmc-neutral-5)", border: "1px solid var(--cmc-border)" }}>
          <Filter size={10} /> Filters
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center" style={{ background: "#f0b90b", color: "#000" }}>
              {activeFilterCount}
            </span>
          )}
          {showFilters ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
        </button>
      </div>

      {/* ═══ Filters Modal ═══ */}
      {showFilters && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 1000 }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowFilters(false)} />
          <div className="relative w-full max-w-lg mx-4 rounded-2xl p-5 shadow-2xl" style={{ background: "var(--cmc-bg)", border: "1px solid var(--cmc-border)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold flex items-center gap-1.5" style={{ color: "var(--cmc-text)" }}>
                <Filter size={14} /> Advanced Filters
                {activeFilterCount > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "rgba(240,185,11,0.15)", color: "#f0b90b" }}>{activeFilterCount} active</span>}
              </h3>
              <button onClick={() => setShowFilters(false)} className="p-1 rounded-lg hover:bg-white/10"><X size={16} style={{ color: "var(--cmc-neutral-5)" }} /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <SelectFilter label="Min Liquidity" value={filters.minLiq} onChange={v => updateFilter({ minLiq: v })}
                options={[{ v: 0, l: "Any" }, { v: 1000, l: "$1K+" }, { v: 5000, l: "$5K+" }, { v: 10000, l: "$10K+" }, { v: 50000, l: "$50K+" }, { v: 100000, l: "$100K+" }]} />
              <SelectFilter label="Max Liquidity" value={filters.maxLiq} onChange={v => updateFilter({ maxLiq: v })}
                options={[{ v: 0, l: "Any" }, { v: 10000, l: "<$10K" }, { v: 50000, l: "<$50K" }, { v: 100000, l: "<$100K" }, { v: 500000, l: "<$500K" }]} />
              <SelectFilter label="Min Volume 24h" value={filters.minVol} onChange={v => updateFilter({ minVol: v })}
                options={[{ v: 0, l: "Any" }, { v: 1000, l: "$1K+" }, { v: 10000, l: "$10K+" }, { v: 50000, l: "$50K+" }, { v: 100000, l: "$100K+" }]} />
              <SelectFilter label="Min MCap" value={filters.minMcap} onChange={v => updateFilter({ minMcap: v })}
                options={[{ v: 0, l: "Any" }, { v: 10000, l: "$10K+" }, { v: 50000, l: "$50K+" }, { v: 100000, l: "$100K+" }, { v: 500000, l: "$500K+" }, { v: 1000000, l: "$1M+" }]} />
              <SelectFilter label="Max Age" value={filters.maxAgeH} onChange={v => updateFilter({ maxAgeH: v })}
                options={[{ v: 0, l: "Any" }, { v: 1, l: "<1h" }, { v: 6, l: "<6h" }, { v: 24, l: "<24h" }, { v: 72, l: "<3d" }, { v: 168, l: "<7d" }]} />
              <SelectFilter label="Min Buy Ratio" value={filters.minBuyRatio} onChange={v => updateFilter({ minBuyRatio: v })}
                options={[{ v: 0, l: "Any" }, { v: 0.4, l: ">40%" }, { v: 0.5, l: ">50%" }, { v: 0.6, l: ">60%" }, { v: 0.7, l: ">70%" }]} />
              <SelectFilter label="Min Safety" value={filters.minSafety} onChange={v => updateFilter({ minSafety: v })}
                options={[{ v: 0, l: "Any" }, { v: 30, l: ">30" }, { v: 45, l: ">45" }, { v: 60, l: ">60" }, { v: 75, l: ">75" }]} />
              <div className="flex flex-col gap-2 justify-end">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={filters.hideGraduated} onChange={e => updateFilter({ hideGraduated: e.target.checked })} className="rounded" />
                  <span className="text-[10px] font-bold" style={{ color: "var(--cmc-neutral-5)" }}>Hide Graduated</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={filters.hideRugRisk} onChange={e => updateFilter({ hideRugRisk: e.target.checked })} className="rounded" />
                  <span className="text-[10px] font-bold" style={{ color: "var(--cmc-neutral-5)" }}>Hide Rug Risk</span>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: "1px solid var(--cmc-border)" }}>
              <button onClick={() => setFilters(DEFAULT_FILTERS)} className="text-[10px] font-bold px-3 py-1.5 rounded-lg" style={{ color: "var(--pf-accent)" }}>Reset All</button>
              <button onClick={() => setShowFilters(false)} className="text-[10px] font-bold px-4 py-1.5 rounded-lg" style={{ background: "var(--pf-accent)", color: "#fff" }}>Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Table ═══ */}
      {loading && sorted.length === 0 ? (
        <div className="py-20 text-center">
          <RefreshCw size={22} className="mx-auto mb-3 animate-spin" style={{ color: "var(--pf-accent)" }} />
          <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>Loading fresh pairs from multiple sources...</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="py-16 text-center rounded-xl" style={{ border: "1px dashed var(--cmc-border)" }}>
          <Search size={24} className="mx-auto mb-2" style={{ color: "var(--cmc-neutral-5)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--cmc-text)" }}>No pairs match your filters</p>
          <p className="text-[10px] mt-1" style={{ color: "var(--cmc-neutral-5)" }}>Try loosening filters or a different search</p>
          {activeFilterCount > 0 && (
            <button onClick={() => setFilters(DEFAULT_FILTERS)} className="mt-3 px-3 py-1.5 rounded-lg text-[10px] font-bold" style={{ background: "var(--pf-accent)", color: "#fff" }}>
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--cmc-border)" }}>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
                <th className="px-2 py-2 text-left text-[9px] font-semibold w-6" style={{ color: "var(--cmc-neutral-5)" }}>#</th>
                <th className="px-2 py-2 text-left text-[9px] font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>Token</th>
                <th className="px-2 py-2 text-right text-[9px] font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>Price</th>
                <SortTh label="Age" sKey="age" cls="text-right" />
                <SortTh label="Safety" sKey="safety" cls="text-right" />
                <SortTh label="Txns" sKey="txns" cls="text-right" />
                <SortTh label="Vol" sKey="volume" cls="text-right" />
                <SortTh label="Chg" sKey="priceChange" cls="text-right" />
                <SortTh label="Liq" sKey="liquidity" cls="text-right" />
                <SortTh label="MCap" sKey="marketCap" cls="text-right" />
                <th className="px-2 py-2 text-right text-[9px] font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>B/S Ratio</th>
                <th className="px-2 py-2 text-center text-[9px] font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((pair, idx) => {
                const fp = pair as FreshPair;
                const globalIdx = page * PAGE_SIZE + idx;
                const txTotal = pair.txns[timeFrame].buys + pair.txns[timeFrame].sells;
                const buyPct = txTotal > 0 ? (pair.txns[timeFrame].buys / txTotal) * 100 : 50;
                const flash = flashMap[pair.pairAddress];
                const safety = fp.safety ?? 50;
                const graduated = fp.isGraduated ?? false;
                const logoUrl = pair.info?.imageUrl;
                const isRugRisk = (pair.liquidity?.usd || 0) < 1000 && (pair.volume?.[timeFrame] || 0) > 50000;

                return (
                  <tr
                    key={pair.pairAddress}
                    className="transition-colors group"
                    style={{
                      borderBottom: "1px solid var(--cmc-border)",
                      background: flash === "up" ? "rgba(22,199,132,0.06)" : flash === "down" ? "rgba(234,57,67,0.06)" : undefined,
                    }}
                    onMouseEnter={(e) => { if (!flash) e.currentTarget.style.background = "var(--cmc-neutral-1)"; }}
                    onMouseLeave={(e) => { if (!flash) e.currentTarget.style.background = ""; }}
                  >
                    {/* # */}
                    <td className="px-2 py-1.5 text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>
                      {globalIdx < 3 ? <Flame size={11} style={{ color: "#f0b90b" }} /> : globalIdx + 1}
                    </td>

                    {/* Token */}
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        {logoUrl ? (
                          <img src={logoUrl} alt="" className="w-5 h-5 rounded-full shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[7px] font-bold" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>
                            {pair.baseToken.symbol.charAt(0)}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1">
                            <Link href={`/token/${pair.chainId}/${pair.baseToken.address}`} className="text-[11px] font-bold hover:underline truncate max-w-[80px]" style={{ color: "var(--cmc-text)" }}>{pair.baseToken.symbol}</Link>
                            <span className="text-[8px] px-1 py-px rounded" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>{pair.dexId}</span>
                            {graduated && <span className="text-[7px] px-1 py-px rounded" style={{ background: "rgba(234,57,67,0.1)", color: "#ea3943" }}>OLD</span>}
                            {isRugRisk && <span title="Rug risk"><AlertTriangle size={9} style={{ color: "#f59e0b" }} /></span>}
                            <a href={pair.url} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                              <ExternalLink size={8} style={{ color: "var(--cmc-neutral-5)" }} />
                            </a>
                          </div>
                          <span className="text-[8px] truncate max-w-[100px]" style={{ color: "var(--cmc-neutral-4)" }}>{pair.baseToken.name}</span>
                        </div>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="px-2 py-1.5 text-right text-[11px] font-semibold tabular-nums" style={{ color: flash === "up" ? "#16c784" : flash === "down" ? "#ea3943" : "var(--cmc-text)" }}>
                      {fmtPrice(pair.priceUsd)}
                    </td>

                    {/* Age */}
                    <td className="px-2 py-1.5 text-right">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{
                        background: (fp.ageHours ?? 999) < 1 ? "rgba(22,199,132,0.1)" : (fp.ageHours ?? 999) < 24 ? "rgba(240,185,11,0.1)" : "var(--cmc-neutral-2)",
                        color: (fp.ageHours ?? 999) < 1 ? "#16c784" : (fp.ageHours ?? 999) < 24 ? "#f0b90b" : "var(--cmc-neutral-5)",
                      }}>
                        {timeAgo(pair.pairCreatedAt)}
                      </span>
                    </td>

                    {/* Safety */}
                    <td className="px-2 py-1.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        {safety >= 65 ? <ShieldCheck size={9} style={{ color: safetyColor(safety) }} /> :
                         safety >= 45 ? <Shield size={9} style={{ color: safetyColor(safety) }} /> :
                         <ShieldAlert size={9} style={{ color: safetyColor(safety) }} />}
                        <span className="text-[10px] font-bold tabular-nums" style={{ color: safetyColor(safety) }}>{safety}</span>
                      </div>
                    </td>

                    {/* Txns */}
                    <td className="px-2 py-1.5 text-right text-[10px] tabular-nums" style={{ color: "var(--cmc-text)" }}>{txTotal.toLocaleString()}</td>

                    {/* Volume */}
                    <td className="px-2 py-1.5 text-right text-[10px] font-semibold tabular-nums" style={{ color: "var(--cmc-text)" }}>{fmtUsd(pair.volume[timeFrame])}</td>

                    {/* Change */}
                    <td className="px-2 py-1.5 text-right">
                      <span className="text-[10px] font-bold tabular-nums" style={{ color: pair.priceChange[timeFrame] > 0 ? "#16c784" : pair.priceChange[timeFrame] < 0 ? "#ea3943" : "var(--cmc-neutral-5)" }}>
                        {pair.priceChange[timeFrame] > 0 ? "+" : ""}{pair.priceChange[timeFrame]?.toFixed(1)}%
                      </span>
                    </td>

                    {/* Liquidity */}
                    <td className="px-2 py-1.5 text-right text-[10px] tabular-nums" style={{ color: "var(--cmc-text)" }}>
                      <span className="inline-block w-1.5 h-1.5 rounded-full mr-0.5" style={{ background: pair.liquidity.usd >= 50000 ? "#16c784" : pair.liquidity.usd >= 5000 ? "#f0b90b" : "#ea3943" }} />
                      {fmtUsd(pair.liquidity.usd)}
                    </td>

                    {/* MCap */}
                    <td className="px-2 py-1.5 text-right text-[10px] tabular-nums" style={{ color: "var(--cmc-text)" }}>
                      {pair.marketCap > 0 ? fmtUsd(pair.marketCap) : pair.fdv > 0 ? fmtUsd(pair.fdv) : "—"}
                    </td>

                    {/* Buy/Sell Ratio */}
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <span className="text-[9px] font-bold tabular-nums" style={{ color: "#16c784" }}>{pair.txns[timeFrame].buys}</span>
                        <div className="w-8 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(234,57,67,0.25)" }}>
                          <div className="h-full rounded-full" style={{ width: `${buyPct}%`, background: buyPct >= 60 ? "#16c784" : buyPct >= 40 ? "#f0b90b" : "#ea3943" }} />
                        </div>
                        <span className="text-[9px] font-bold tabular-nums" style={{ color: "#ea3943" }}>{pair.txns[timeFrame].sells}</span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-2 py-1.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link href={`/swap?from=SOL&to=${pair.baseToken.symbol}`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold transition-all hover:brightness-110" style={{ background: "var(--pf-accent)", color: "#fff" }} onClick={(e) => e.stopPropagation()}>
                          <ArrowLeftRight size={7} /> Swap
                        </Link>
                        {isDegen && pair.chainId === "solana" && (
                          <QuickBuy tokenMint={pair.baseToken.address} tokenSymbol={pair.baseToken.symbol} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ Pagination ═══ */}
      {sorted.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-3">
          <span className="text-[9px]" style={{ color: "var(--cmc-neutral-5)" }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-0.5">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="p-1 rounded-lg disabled:opacity-30" style={{ color: "var(--cmc-neutral-5)" }}>
              <ChevronLeft size={13} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(0, Math.min(page - 2, totalPages - 5));
              const p = start + i;
              if (p >= totalPages) return null;
              return (
                <button key={p} onClick={() => setPage(p)} className="w-6 h-6 rounded text-[10px] font-bold"
                  style={{ background: page === p ? "var(--pf-accent)" : "var(--cmc-neutral-1)", color: page === p ? "#fff" : "var(--cmc-neutral-5)" }}>
                  {p + 1}
                </button>
              );
            })}
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="p-1 rounded-lg disabled:opacity-30" style={{ color: "var(--cmc-neutral-5)" }}>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 text-[9px] text-center" style={{ color: "var(--cmc-neutral-5)" }}>
        Auto-refresh 20s · Solana
      </div>
    </div>
  );
}
