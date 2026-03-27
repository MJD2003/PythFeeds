"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Filter, Columns3, X, Check, BarChart3, Calendar, Zap, Unlock, ArrowRight, Layers, Sprout, Flame, Radio, ArrowLeftRight, PieChart, Wallet } from "lucide-react";
import { fetchGlobalData, fetchFearGreed, fetchProtocols, type DefiProtocol } from "@/lib/api/backend";
import { useWallet } from "@solana/wallet-adapter-react";
import AIMarketMood from "@/Components/shared/AIMarketMood";
import { fmtB } from "@/lib/format";
import { BorderBeam } from "@/Components/magicui/border-beam";

const NETWORKS = [
  { label: "All Networks", logo: "" },
  { label: "BSC", logo: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png" },
  { label: "Solana", logo: "https://assets.coingecko.com/coins/images/4128/small/solana.png" },
  { label: "Base", logo: "https://assets.coingecko.com/asset_platforms/images/131/small/base.jpeg" },
  { label: "Ethereum", logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png" },
  { label: "Polygon", logo: "https://assets.coingecko.com/coins/images/4713/small/polygon.png" },
  { label: "Arbitrum", logo: "https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg" },
  { label: "Avalanche", logo: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png" },
  { label: "Optimism", logo: "https://assets.coingecko.com/coins/images/25244/small/Optimism.png" },
];

const SORT_OPTIONS = [
  { key: "mcap_desc", label: "Market Cap ↓" },
  { key: "mcap_asc", label: "Market Cap ↑" },
  { key: "vol_desc", label: "Volume ↓" },
  { key: "vol_asc", label: "Volume ↑" },
  { key: "price_desc", label: "Price ↓" },
  { key: "price_asc", label: "Price ↑" },
];

const COLUMN_OPTIONS = [
  { key: "price", label: "Price", default: true },
  { key: "1h", label: "1h %", default: true },
  { key: "24h", label: "24h %", default: true },
  { key: "7d", label: "7d %", default: true },
  { key: "mcap", label: "Market Cap", default: true },
  { key: "vol", label: "Volume(24h)", default: true },
  { key: "supply", label: "Circulating Supply", default: true },
  { key: "sparkline", label: "Last 7 Days", default: true },
];

function fmtT(n: number): string {
  return fmtB(n);
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-1000 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div ref={ref} className="w-full max-w-md rounded-2xl p-5" style={{ background: "var(--cmc-bg)", border: "1px solid var(--cmc-border)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5"><X size={16} style={{ color: "var(--cmc-neutral-5)" }} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface HomeHeroProps {
  onChainChange?: (chain: string) => void;
  onSortChange?: (sort: string) => void;
  onFilterApply?: (minMcap: string, maxMcap: string, minVol: string) => void;
  onColumnsChange?: (cols: Set<string>) => void;
  altcoinSeason?: number | null;
  avgRsi?: number | null;
  trendingSlot?: React.ReactNode;
}

function QuickActions() {
  const { connected } = useWallet();
  const base = [
    { icon: Radio, label: "Pyth Feeds", href: "/feeds", accent: true },
    { icon: Flame, label: "Screener", href: "/screener" },
    { icon: Zap, label: "AI Digest", href: "/digest" },
    { icon: Sprout, label: "Yields", href: "/yields" },
    { icon: BarChart3, label: "Analytics", href: "/analytics" },
    { icon: Calendar, label: "Calendar", href: "/calendar" },
    { icon: Unlock, label: "Unlocks", href: "/unlocks" },
  ];
  const walletLinks = connected
    ? [
        { icon: ArrowLeftRight, label: "Swap", href: "/swap", accent: true },
        { icon: PieChart, label: "Portfolio", href: "/portfolio", accent: true },
        ...base,
      ]
    : base;

  return (
    <div className="mt-3 flex items-center justify-center gap-2 flex-wrap pb-0.5">
      {walletLinks.map((card, i) => (
        <Link key={card.href} href={card.href}
          className="relative overflow-hidden flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[11px] font-medium transition-all hover:-translate-y-0.5 press-scale"
          style={{ border: `1px solid ${card.accent ? "var(--pf-accent)" : "var(--cmc-border)"}`, color: "var(--cmc-text)", background: "var(--cmc-neutral-1)" }}
        >
          <card.icon size={13} style={{ color: card.accent ? "var(--pf-accent)" : "var(--cmc-neutral-5)" }} />
          {card.label}
          <BorderBeam size={40} duration={6} delay={i * 0.5} colorFrom="var(--pf-accent)" colorTo="var(--pf-teal)" />
        </Link>
      ))}
    </div>
  );
}

export default function HomeHero({ onChainChange, onSortChange, onFilterApply, onColumnsChange, altcoinSeason, avgRsi, trendingSlot }: HomeHeroProps) {
  const [activeNetwork, setActiveNetwork] = useState<string>("All Networks");
  const [globalData, setGlobalData] = useState<{ totalMcap: number; totalVol: number; mcapChange: number; btcDom: number; activeCryptos: number } | null>(null);
  const [fgData, setFgData] = useState<{ value: number; classification: string } | null>(null);
  const [chainModal, setChainModal] = useState(false);
  const [sortModal, setSortModal] = useState(false);
  const [filterModal, setFilterModal] = useState(false);
  const [columnModal, setColumnModal] = useState(false);
  const [activeSort, setActiveSort] = useState("mcap_desc");
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(COLUMN_OPTIONS.map((c) => c.key)));
  const [minMcap, setMinMcap] = useState("");
  const [maxMcap, setMaxMcap] = useState("");
  const [minVol, setMinVol] = useState("");
  const [totalTVL, setTotalTVL] = useState<number | null>(null);

  useEffect(() => {
    fetchGlobalData()
      .then((data) => {
        if (data?.data) {
          setGlobalData({
            totalMcap: data.data.total_market_cap?.usd || 0,
            totalVol: data.data.total_volume?.usd || 0,
            mcapChange: (data.data as typeof data.data & { market_cap_change_percentage_24h_usd?: number }).market_cap_change_percentage_24h_usd || 0,
            btcDom: data.data.market_cap_percentage?.btc || 0,
            activeCryptos: data.data.active_cryptocurrencies || 0,
          });
        }
      })
      .catch(() => {});
    fetchFearGreed()
      .then((data) => {
        if (data) setFgData({ value: data.value, classification: data.classification });
      })
      .catch(() => {});
    fetchProtocols(50)
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setTotalTVL(data.reduce((s: number, p: DefiProtocol) => s + (p.tvl || 0), 0));
        }
      })
      .catch(() => {});
  }, []);

  const fgValue = fgData?.value ?? 50;
  const fgAngle = (fgValue / 100) * 180;
  const fgRad = (fgAngle * Math.PI) / 180;
  const dotX = 50 - 40 * Math.cos(fgRad);
  const dotY = 50 - 40 * Math.sin(fgRad);

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      onColumnsChange?.(next);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4">
      {/* ── Stats strip ── */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 stagger-grid">
        {/* Market Cap */}
        <div className="relative overflow-hidden flex flex-col rounded-xl px-3.5 py-3 min-h-[88px] transition-all duration-200 hover:-translate-y-0.5" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
          <p className="text-[10px] font-medium tracking-wide uppercase" style={{ color: "var(--cmc-neutral-5)" }}>
            Market Cap
          </p>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-base font-bold font-display" style={{ color: "var(--cmc-text)" }}>{globalData ? fmtT(globalData.totalMcap) : "—"}</span>
            {globalData && (
              <span className="text-[10px] font-semibold" style={{ color: globalData.mcapChange >= 0 ? "var(--pf-up)" : "var(--pf-down)" }}>
                {globalData.mcapChange >= 0 ? "+" : ""}{globalData.mcapChange.toFixed(2)}%
              </span>
            )}
          </div>
          <p className="mt-auto pt-1 text-[9px]" style={{ color: "var(--cmc-neutral-4)" }}>{globalData ? `${globalData.activeCryptos.toLocaleString()} cryptos` : ""}</p>
          <BorderBeam size={80} duration={8} colorFrom="var(--pf-accent)" colorTo="var(--pf-teal)" />
        </div>

        {/* 24h Volume */}
        <div className="relative overflow-hidden flex flex-col rounded-xl px-3.5 py-3 min-h-[88px] transition-all duration-200 hover:-translate-y-0.5" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
          <p className="text-[10px] font-medium tracking-wide uppercase" style={{ color: "var(--cmc-neutral-5)" }}>
            24h Volume
          </p>
          <span className="mt-1.5 text-base font-bold font-display" style={{ color: "var(--cmc-text)" }}>{globalData ? fmtT(globalData.totalVol) : "—"}</span>
          <p className="mt-auto pt-1 text-[9px]" style={{ color: "var(--cmc-neutral-4)" }}>{globalData ? `BTC Dom: ${globalData.btcDom.toFixed(1)}%` : ""}</p>
          <BorderBeam size={80} duration={8} delay={1} colorFrom="var(--pf-accent)" colorTo="var(--pf-teal)" />
        </div>

        {/* Fear & Greed */}
        <Link href="/fear-greed" className="relative overflow-hidden flex flex-col items-center rounded-xl px-3.5 py-3 min-h-[88px] hover:border-[color:var(--cmc-neutral-4)] transition-all duration-200 hover:-translate-y-0.5 group" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
          <p className="flex w-full items-center gap-1 text-[10px] font-medium tracking-wide uppercase group-hover:text-[color:var(--cmc-text)] transition-colors" style={{ color: "var(--cmc-neutral-5)" }}>
            Fear &amp; Greed <ChevronRight size={8} />
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="relative w-[60px] h-[35px] flex items-end justify-center">
              <svg viewBox="0 0 100 55" className="absolute bottom-0 w-full h-[120%] overflow-visible">
                <defs>
                  <linearGradient id="fgGradHome" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ea3943" />
                    <stop offset="25%" stopColor="#f5a623" />
                    <stop offset="50%" stopColor="#f5d100" />
                    <stop offset="75%" stopColor="#93c648" />
                    <stop offset="100%" stopColor="#16c784" />
                  </linearGradient>
                </defs>
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="var(--cmc-neutral-2)" strokeWidth="10" strokeLinecap="round" />
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="url(#fgGradHome)" strokeWidth="10" strokeLinecap="round" />
                <g style={{ transformOrigin: '50px 50px', transform: `rotate(${fgAngle - 90}deg)` }} className="transition-transform duration-1000 ease-out">
                  <path d="M 48 50 L 52 50 L 50.5 18 L 49.5 18 Z" fill="var(--cmc-text)" />
                  <circle cx="50" cy="50" r="4" fill="var(--cmc-text)" />
                  <circle cx="50" cy="50" r="1.5" fill="var(--cmc-bg)" />
                </g>
              </svg>
            </div>
            <div className="text-left flex flex-col justify-center">
              <p className="text-xl font-extrabold font-display leading-none" style={{ color: "var(--cmc-text)" }}>{fgValue}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: fgValue <= 25 ? "#ea3943" : fgValue <= 45 ? "#f5a623" : fgValue <= 55 ? "#f5d100" : fgValue <= 75 ? "#93c648" : "#16c784" }}>
                {fgData?.classification || "Neutral"}
              </p>
            </div>
          </div>
          <BorderBeam size={80} duration={8} delay={2} colorFrom="var(--pf-accent)" colorTo="var(--pf-teal)" />
        </Link>

        {/* Altcoin Season */}
        <div className="relative overflow-hidden flex flex-col rounded-xl px-3.5 py-3 min-h-[88px] transition-all duration-200 hover:-translate-y-0.5" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
          <p className="text-[10px] font-medium tracking-wide uppercase" style={{ color: "var(--cmc-neutral-5)" }}>
            Altcoin Season
          </p>
          <div className="flex items-baseline gap-1 mt-1.5">
            <p className="text-lg font-extrabold font-display" style={{ color: "var(--cmc-text)" }}>{altcoinSeason ?? "—"}</p>
            {altcoinSeason != null && <p className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>/ 100</p>}
          </div>
          <div className="mt-auto pt-1.5">
            <div className="relative h-1.5 w-full rounded-full" style={{ background: "linear-gradient(to right, var(--pf-accent), var(--pf-warning), var(--pf-up))" }}>
              <span className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 shadow transition-all duration-500" style={{ left: `calc(${altcoinSeason ?? 50}% - 6px)`, borderColor: "var(--cmc-bg)", background: "var(--cmc-text)" }} />
            </div>
          </div>
          <BorderBeam size={80} duration={8} delay={3} colorFrom="var(--pf-accent)" colorTo="var(--pf-teal)" />
        </div>

        {/* Average Crypto RSI */}
        <div className="relative overflow-hidden flex flex-col rounded-xl px-3.5 py-3 min-h-[88px] transition-all duration-200 hover:-translate-y-0.5" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
          <p className="text-[10px] font-medium tracking-wide uppercase" style={{ color: "var(--cmc-neutral-5)" }}>
            Avg. RSI
          </p>
          <p className="mt-1.5 text-lg font-extrabold font-display" style={{ color: "var(--cmc-text)" }}>{avgRsi ?? "—"}</p>
          <div className="mt-auto pt-1.5">
            <div className="relative flex h-1.5 w-full gap-px">
              <div className="flex-1 rounded-l-full" style={{ background: "linear-gradient(to right, var(--pf-accent), var(--pf-info))" }} />
              <div className="flex-[0.4]" style={{ background: "var(--pf-warning)" }} />
              <div className="flex-1 rounded-r-full" style={{ background: "linear-gradient(to right, var(--pf-warning), var(--pf-down))" }} />
              <span className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 shadow transition-all duration-500" style={{ left: `calc(${avgRsi ?? 50}% - 6px)`, borderColor: "var(--cmc-bg)", background: "var(--cmc-text)" }} />
            </div>
          </div>
          <BorderBeam size={80} duration={8} delay={4} colorFrom="var(--pf-accent)" colorTo="var(--pf-teal)" />
        </div>

        {/* DeFi TVL */}
        <Link href="/analytics" className="relative overflow-hidden flex flex-col rounded-xl px-3.5 py-3 min-h-[88px] transition-all duration-200 hover:-translate-y-0.5 group" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
          <p className="flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase group-hover:text-[color:var(--cmc-text)] transition-colors" style={{ color: "var(--cmc-neutral-5)" }}>
            <Layers size={9} /> DeFi TVL <ChevronRight size={8} />
          </p>
          <span className="mt-1.5 text-base font-bold font-display" style={{ color: "var(--cmc-text)" }}>{totalTVL ? fmtT(totalTVL) : "—"}</span>
          <p className="mt-auto pt-1 text-[9px]" style={{ color: "var(--cmc-neutral-4)" }}>
            {totalTVL ? `${Math.round(totalTVL / 1e9)}B+ locked` : ""}
          </p>
          <BorderBeam size={80} duration={8} delay={5} colorFrom="var(--pf-accent)" colorTo="var(--pf-teal)" />
        </Link>
      </div>

      {/* ── AI Market Mood ── */}
      <div className="mt-2.5">
        <AIMarketMood />
      </div>

      {/* ── Quick links (wallet-aware) ── */}
      <QuickActions />

      {/* ── Trending slot ── */}
      {trendingSlot}

      {/* ── Network filter + toolbar ── */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {NETWORKS.slice(0, 5).map((net) => (
            <button
              key={net.label}
              onClick={() => { setActiveNetwork(net.label); onChainChange?.(net.label); }}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeNetwork === net.label
                  ? "border border-(--pf-accent) text-(--pf-accent)"
                  : "border border-(--cmc-border) text-(--cmc-text-sub) hover:border-(--cmc-neutral-4)"
              }`}
            >
              {net.logo && <img src={net.logo} alt={net.label} className="h-3.5 w-3.5 rounded-full object-cover" />}
              {net.label}
            </button>
          ))}
          <button
            onClick={() => setChainModal(true)}
            className="flex shrink-0 items-center gap-1 rounded-full border border-(--cmc-border) px-2.5 py-1 text-[11px] font-medium text-(--cmc-text-sub) hover:border-(--cmc-neutral-4)"
          >
            More <ChevronDown size={10} />
          </button>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            onClick={() => setSortModal(true)}
            className="hidden lg:flex items-center gap-1 rounded-full border border-(--cmc-border) px-2.5 py-1 text-[11px] font-medium text-(--cmc-text-sub) hover:border-(--cmc-neutral-4)"
          >
            Market Cap <ChevronDown size={10} />
          </button>
          <button
            onClick={() => setSortModal(true)}
            className="hidden lg:flex items-center gap-1 rounded-full border border-(--cmc-border) px-2.5 py-1 text-[11px] font-medium text-(--cmc-text-sub) hover:border-(--cmc-neutral-4)"
          >
            Volume(24h) <ChevronDown size={10} />
          </button>
          <button
            onClick={() => setFilterModal(true)}
            className="flex items-center gap-1 rounded-full border border-(--cmc-border) px-2 sm:px-2.5 py-1 text-[11px] font-medium text-(--cmc-text-sub) hover:border-(--cmc-neutral-4)"
          >
            <Filter size={10} /> <span className="hidden sm:inline">Filters</span>
          </button>
          <button
            onClick={() => setColumnModal(true)}
            className="hidden sm:flex items-center gap-1 rounded-full border border-(--cmc-border) px-2.5 py-1 text-[11px] font-medium text-(--cmc-text-sub) hover:border-(--cmc-neutral-4)"
          >
            <Columns3 size={10} /> Columns
          </button>
        </div>
      </div>

      {/* ── Chain Filter Modal ── */}
      <Modal open={chainModal} onClose={() => setChainModal(false)} title="Select Network">
        <div className="grid grid-cols-2 gap-2">
          {NETWORKS.map((net) => (
            <button
              key={net.label}
              onClick={() => { setActiveNetwork(net.label); onChainChange?.(net.label); setChainModal(false); }}
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition-all ${
                activeNetwork === net.label
                  ? "border-2 border-(--pf-accent) text-(--pf-accent)"
                  : "border border-(--cmc-border) text-(--cmc-text) hover:border-(--cmc-neutral-4)"
              }`}
              style={{ background: activeNetwork === net.label ? "var(--pf-accent-muted)" : "var(--cmc-neutral-1)" }}
            >
              {net.logo ? <img src={net.logo} alt={net.label} className="h-5 w-5 rounded-full" /> : <div className="h-5 w-5 rounded-full bg-linear-to-br from-blue-400 to-purple-500" />}
              {net.label}
              {activeNetwork === net.label && <Check size={14} className="ml-auto" />}
            </button>
          ))}
        </div>
      </Modal>

      {/* ── Sort Modal ── */}
      <Modal open={sortModal} onClose={() => setSortModal(false)} title="Sort By">
        <div className="space-y-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setActiveSort(opt.key); onSortChange?.(opt.key); setSortModal(false); }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-all ${
                activeSort === opt.key ? "text-(--pf-accent)" : "text-(--cmc-text) hover-surface"
              }`}
              style={{ background: activeSort === opt.key ? "var(--pf-accent-muted)" : "transparent" }}
            >
              {opt.label}
              {activeSort === opt.key && <Check size={14} />}
            </button>
          ))}
        </div>
      </Modal>

      {/* ── Filters Modal ── */}
      <Modal open={filterModal} onClose={() => setFilterModal(false)} title="Filters">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-semibold text-(--cmc-neutral-5) uppercase tracking-wide">Market Cap Range</label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="text"
                placeholder="Min (e.g. 1B)"
                value={minMcap}
                onChange={(e) => setMinMcap(e.target.value)}
                className="flex-1 rounded-lg px-3 py-2 text-xs outline-none"
                style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)", color: "var(--cmc-text)" }}
              />
              <span className="text-(--cmc-neutral-5) text-xs">—</span>
              <input
                type="text"
                placeholder="Max (e.g. 100B)"
                value={maxMcap}
                onChange={(e) => setMaxMcap(e.target.value)}
                className="flex-1 rounded-lg px-3 py-2 text-xs outline-none"
                style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)", color: "var(--cmc-text)" }}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-(--cmc-neutral-5) uppercase tracking-wide">Min 24h Volume</label>
            <input
              type="text"
              placeholder="e.g. 10M"
              value={minVol}
              onChange={(e) => setMinVol(e.target.value)}
              className="mt-1.5 w-full rounded-lg px-3 py-2 text-xs outline-none"
              style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)", color: "var(--cmc-text)" }}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => { setMinMcap(""); setMaxMcap(""); setMinVol(""); }}
              className="flex-1 rounded-lg py-2 text-xs font-medium"
              style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-text)" }}
            >
              Reset
            </button>
            <button
              onClick={() => { onFilterApply?.(minMcap, maxMcap, minVol); setFilterModal(false); }}
              className="flex-1 rounded-lg py-2 text-xs font-semibold text-white"
              style={{ background: "var(--pf-accent)" }}
            >
              Apply
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Columns Modal ── */}
      <Modal open={columnModal} onClose={() => setColumnModal(false)} title="Toggle Columns">
        <div className="space-y-1">
          {COLUMN_OPTIONS.map((col) => (
            <button
              key={col.key}
              onClick={() => toggleColumn(col.key)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-all hover:bg-white/5"
              style={{ color: "var(--cmc-text)" }}
            >
              {col.label}
              <div
                className="h-4 w-8 rounded-full transition-colors flex items-center px-0.5"
                style={{ background: visibleColumns.has(col.key) ? "var(--pf-accent)" : "var(--cmc-neutral-3)" }}
              >
                <div
                  className="h-3 w-3 rounded-full bg-white shadow transition-transform"
                  style={{ transform: visibleColumns.has(col.key) ? "translateX(14px)" : "translateX(0)" }}
                />
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
