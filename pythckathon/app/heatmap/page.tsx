"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { Loader2, TrendingUp, TrendingDown, Maximize2, Minimize2, Grid3X3, BarChart3, Filter, Search, X, ChevronDown, Camera, Play, Pause, Clock, ExternalLink, Circle, Star } from "lucide-react";
import html2canvas from "html2canvas";
import { Sparklines, SparklinesLine, SparklinesCurve } from "react-sparklines";
import { fetchCoins, type CoinMarketItem } from "@/lib/api/backend";
import { fetchPythPricesBatch, subscribePythStream } from "@/lib/pyth-prices";
import { toast } from "sonner";

/* ── Period options ── */
const PERIODS = ["1H", "24H", "7D"] as const;
const SIZE_MODES = ["Market Cap", "Volume"] as const;
const TOP_N_OPTIONS = [25, 50, 100, 200] as const;
const CAT_OPTIONS = ["All", "Layer 1", "DeFi", "Stablecoins", "Meme", "Exchange"] as const;

const SECTOR_COLORS: Record<string, string> = {
  "Layer 1": "rgba(59,130,246,0.7)",
  DeFi: "rgba(168,85,247,0.7)",
  Stablecoins: "rgba(34,197,94,0.7)",
  Meme: "rgba(251,191,36,0.7)",
  Exchange: "rgba(236,72,153,0.7)",
};

function getCoinSector(id: string): string | null {
  return COIN_CATS[id] || null;
}

const COIN_CATS: Record<string, string> = {
  bitcoin: "Layer 1", ethereum: "Layer 1", solana: "Layer 1", cardano: "Layer 1",
  "avalanche-2": "Layer 1", polkadot: "Layer 1", tron: "Layer 1",
  "matic-network": "Layer 1", near: "Layer 1", "internet-computer": "Layer 1",
  algorand: "Layer 1", aptos: "Layer 1", sui: "Layer 1", kaspa: "Layer 1",
  hedera: "Layer 1", sei: "Layer 1", fantom: "Layer 1", cosmos: "Layer 1",
  stellar: "Layer 1", vechain: "Layer 1", "the-open-network": "Layer 1",
  litecoin: "Layer 1", "bitcoin-cash": "Layer 1", monero: "Layer 1",
  "ethereum-classic": "Layer 1", filecoin: "Layer 1", arbitrum: "Layer 1",
  optimism: "Layer 1", stacks: "Layer 1", mantle: "Layer 1",
  tether: "Stablecoins", "usd-coin": "Stablecoins", dai: "Stablecoins",
  "first-digital-usd": "Stablecoins", "true-usd": "Stablecoins",
  "ethena-usde": "Stablecoins", "paxos-standard": "Stablecoins",
  uniswap: "DeFi", aave: "DeFi", maker: "DeFi", "lido-dao": "DeFi",
  "curve-dao-token": "DeFi", jupiter: "DeFi", raydium: "DeFi",
  "pancakeswap-token": "DeFi", "the-graph": "DeFi", chainlink: "DeFi",
  "render-token": "DeFi", "thorchain": "DeFi", "1inch": "DeFi",
  "compound-governance-token": "DeFi", "synthetix-network-token": "DeFi",
  dogecoin: "Meme", "shiba-inu": "Meme", pepe: "Meme", floki: "Meme",
  bonk: "Meme", dogwifcoin: "Meme", brett: "Meme", "memecoin-2": "Meme",
  binancecoin: "Exchange", "leo-token": "Exchange", okb: "Exchange",
  "crypto-com-chain": "Exchange", "kucoin-shares": "Exchange",
  "bitget-token": "Exchange", "gate-token": "Exchange",
};

function getChange(c: CoinMarketItem, period: string): number {
  if (period === "1H") return c.price_change_percentage_1h_in_currency ?? 0;
  if (period === "7D") return c.price_change_percentage_7d_in_currency ?? 0;
  return c.price_change_percentage_24h_in_currency ?? 0;
}

/* ── Color engine — smooth gradient like TradingView ── */
function changeColor(pct: number): string {
  // Clamp to [-13, 13] range
  const clamped = Math.max(-13, Math.min(13, pct));
  if (clamped > 0) {
    // Green gradient: darker at low, vivid at high
    const t = Math.min(clamped / 8, 1);
    const r = Math.round(30 + (0 - 30) * t);
    const g = Math.round(70 + (180 - 70) * t);
    const b = Math.round(50 + (80 - 50) * t);
    return `rgb(${r},${g},${b})`;
  } else if (clamped < 0) {
    // Red gradient: darker at low magnitude, vivid at high
    const t = Math.min(Math.abs(clamped) / 8, 1);
    const r = Math.round(100 + (190 - 100) * t);
    const g = Math.round(40 + (30 - 40) * t);
    const b = Math.round(40 + (35 - 40) * t);
    return `rgb(${r},${g},${b})`;
  }
  return "rgb(65,65,75)"; // neutral gray
}

function fmtPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(4)}`;
}

function fmtLarge(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtDominance(mcap: number, totalMcap: number): string {
  if (totalMcap <= 0) return "";
  const pct = (mcap / totalMcap) * 100;
  if (pct >= 1) return `${pct.toFixed(2)}%`;
  if (pct >= 0.1) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(3)}%`;
}

/* ── Tree node ── */
interface TreeNode {
  id: string;
  symbol: string;
  name: string;
  image: string;
  mcap: number;
  volume: number;
  change: number;
  price: number;
  rank: number;
  sparkline: number[];
}

interface LayoutRect extends TreeNode {
  rx: number; ry: number; rw: number; rh: number;
}

/* ── Squarified treemap (recursive — guarantees full space coverage) ── */
function squarify(
  items: TreeNode[],
  x: number, y: number, w: number, h: number,
  sizeKey: "mcap" | "volume"
): LayoutRect[] {
  const result: LayoutRect[] = [];
  const sorted = [...items].sort((a, b) => b[sizeKey] - a[sizeKey]).filter(n => n[sizeKey] > 0);

  function lay(nodes: TreeNode[], bx: number, by: number, bw: number, bh: number) {
    if (nodes.length === 0 || bw < 0.001 || bh < 0.001) return;

    // Base: single item fills entire remaining rect
    if (nodes.length === 1) {
      result.push({ ...nodes[0], rx: bx, ry: by, rw: bw, rh: bh });
      return;
    }

    // Base: two items — simple split
    if (nodes.length === 2) {
      const t = nodes[0][sizeKey] + nodes[1][sizeKey];
      if (t <= 0) return;
      const r = nodes[0][sizeKey] / t;
      if (bw >= bh) {
        result.push({ ...nodes[0], rx: bx, ry: by, rw: bw * r, rh: bh });
        result.push({ ...nodes[1], rx: bx + bw * r, ry: by, rw: bw * (1 - r), rh: bh });
      } else {
        result.push({ ...nodes[0], rx: bx, ry: by, rw: bw, rh: bh * r });
        result.push({ ...nodes[1], rx: bx, ry: by + bh * r, rw: bw, rh: bh * (1 - r) });
      }
      return;
    }

    const total = nodes.reduce((s, n) => s + n[sizeKey], 0);
    if (total <= 0) return;

    // Greedy: find best split — keep adding to row while worst aspect improves
    let bestSplit = 1;
    let bestWorst = Infinity;

    for (let i = 1; i <= nodes.length; i++) {
      let rowSum = 0;
      for (let j = 0; j < i; j++) rowSum += nodes[j][sizeKey];
      const frac = rowSum / total;
      let worst = 0;
      for (let j = 0; j < i; j++) {
        const nFrac = nodes[j][sizeKey] / rowSum;
        let cw: number, ch: number;
        if (bw >= bh) { cw = bw * frac; ch = bh * nFrac; }
        else { cw = bw * nFrac; ch = bh * frac; }
        if (cw > 0 && ch > 0) {
          const a = Math.max(cw / ch, ch / cw);
          if (a > worst) worst = a;
        }
      }
      if (worst <= bestWorst) { bestWorst = worst; bestSplit = i; }
      else break;
    }

    const row = nodes.slice(0, bestSplit);
    const rest = nodes.slice(bestSplit);
    let rowSum = 0;
    for (const n of row) rowSum += n[sizeKey];
    const frac = rowSum / total;

    if (bw >= bh) {
      const rw = bw * frac;
      let cy = by;
      for (const n of row) {
        const nh = bh * (n[sizeKey] / rowSum);
        result.push({ ...n, rx: bx, ry: cy, rw, rh: nh });
        cy += nh;
      }
      lay(rest, bx + rw, by, bw - rw, bh);
    } else {
      const rh = bh * frac;
      let cx = bx;
      for (const n of row) {
        const nw = bw * (n[sizeKey] / rowSum);
        result.push({ ...n, rx: cx, ry: by, rw: nw, rh });
        cx += nw;
      }
      lay(rest, bx, by + rh, bw, bh - rh);
    }
  }

  lay(sorted, x, y, w, h);
  return result;
}

/* ── Main Component ── */
export default function HeatmapPage() {
  const [coins, setCoins] = useState<CoinMarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("24H");
  const [sizeMode, setSizeMode] = useState<(typeof SIZE_MODES)[number]>("Market Cap");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDark, setIsDark] = useState(true);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const gridRef = useRef<HTMLDivElement>(null);
  const [topN, setTopN] = useState<number>(100);
  const [catFilter, setCatFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<string, { price: number, confidence: number }>>({});
  const prevPricesRef = useRef<Record<string, number>>({});
  const [priceFlash, setPriceFlash] = useState<Record<string, "up" | "down">>({});
  const [drillDownCat, setDrillDownCat] = useState<string | null>(null);
  // Track base prices from initial CoinGecko load for computing Pyth-derived % changes
  const basePricesRef = useRef<Record<string, number>>({});

  // H3: Heatmap time-lapse — cache snapshots of change values
  interface HeatmapSnapshot { t: number; changes: Record<string, number>; }
  const snapshotsRef = useRef<HeatmapSnapshot[]>([]);
  const [timelapseActive, setTimelapseActive] = useState(false);
  const [timelapseIdx, setTimelapseIdx] = useState(0);
  const [timelapsePlaying, setTimelapsePlaying] = useState(false);
  const timelapseIvRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Watchlist state
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('pythfeeds_watchlist');
    if (saved) {
      try {
        setWatchlist(new Set(JSON.parse(saved)));
      } catch (e) {}
    }
  }, []);

  const toggleWatchlist = (symbol: string) => {
    setWatchlist(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
        toast.info(`Removed ${symbol} from watchlist`);
      } else {
        next.add(symbol);
        toast.success(`Added ${symbol} to watchlist`);
      }
      localStorage.setItem('pythfeeds_watchlist', JSON.stringify([...next]));
      return next;
    });
  };

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    setLoading(true);
    // Fetch 2 pages (200 coins) for a richer heatmap
    Promise.all([fetchCoins(1, 100), fetchCoins(2, 100)])
      .then(([p1, p2]) => setCoins([...p1, ...p2]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Store base prices when coins first load
  useEffect(() => {
    if (coins.length === 0) return;
    const bp: Record<string, number> = {};
    for (const c of coins) bp[c.symbol.toUpperCase()] = c.current_price;
    basePricesRef.current = bp;
  }, [coins]);

/* Pyth real-time prices — SSE stream with polling fallback */
useEffect(() => {
  if (coins.length === 0) return;
  const symbols = [...new Set(coins.map(c => c.symbol.toUpperCase()))];

  const applyUpdate = (sym: string, price: number, confidence: number) => {
    const prev = prevPricesRef.current;
    const flash: Record<string, "up" | "down"> = {};
    if (price > 0 && prev[sym] && prev[sym] !== price) {
      flash[sym] = price > prev[sym] ? "up" : "down";
    }
    prev[sym] = price;
    setLivePrices(lp => ({ ...lp, [sym]: { price, confidence } }));
    if (Object.keys(flash).length > 0) {
      setPriceFlash(flash);
      setTimeout(() => setPriceFlash({}), 500);
    }
  };

  let cleanup: (() => void) | null = null;
  let pollIv: NodeJS.Timeout | null = null;

  const startSSE = async () => {
    try {
      const unsub = await subscribePythStream(symbols, applyUpdate);
      cleanup = unsub;
    } catch {
      cleanup = null;
    }
  };

  const startPolling = () => {
    const poll = async () => {
      try {
        const pythData = await fetchPythPricesBatch(symbols, true) as Record<string, import("@/lib/pyth-prices").PythPrice>;
        for (const [sym, data] of Object.entries(pythData)) {
          if (data && data.price > 0) applyUpdate(sym, data.price, data.confidence ?? 0);
        }
      } catch {}
    };
    poll();
    pollIv = setInterval(poll, 10_000);
  };

  // Try SSE first, fall back to polling after 3s if no updates received
  startSSE().then(() => {
    if (!cleanup) startPolling();
  });
  // Always keep a slow polling backup (30s) to fill any SSE gaps
  const backupIv = setInterval(async () => {
    try {
      const pythData = await fetchPythPricesBatch(symbols, true) as Record<string, import("@/lib/pyth-prices").PythPrice>;
      for (const [sym, data] of Object.entries(pythData)) {
        if (data && data.price > 0) applyUpdate(sym, data.price, data.confidence ?? 0);
      }
    } catch {}
  }, 30_000);

  return () => {
    cleanup?.();
    if (pollIv) clearInterval(pollIv);
    clearInterval(backupIv);
  };
}, [coins]);

  // H3: Cache a snapshot of change values after every price refresh
  useEffect(() => {
    if (coins.length === 0) return;
    const changes: Record<string, number> = {};
    for (const c of coins) {
      const sym = c.symbol.toUpperCase();
      const lp = livePrices[sym];
      const bp = basePricesRef.current[sym];
      let ch = getChange(c, period);
      if (lp && lp.price > 0 && bp && bp > 0) ch += ((lp.price - bp) / bp) * 100;
      changes[c.id] = ch;
    }
    const snaps = snapshotsRef.current;
    snaps.push({ t: Date.now(), changes });
    if (snaps.length > 360) snaps.shift();
  }, [livePrices, coins, period]);

  // H3: Time-lapse playback interval
  useEffect(() => {
    if (timelapsePlaying && snapshotsRef.current.length > 1) {
      timelapseIvRef.current = setInterval(() => {
        setTimelapseIdx((prev) => {
          const max = snapshotsRef.current.length - 1;
          if (prev >= max) { setTimelapsePlaying(false); return max; }
          return prev + 1;
        });
      }, 300);
    }
    return () => { if (timelapseIvRef.current) clearInterval(timelapseIvRef.current); };
  }, [timelapsePlaying]);

  /* Auto-refresh coin data every 60s */
  useEffect(() => {
    const iv = setInterval(() => {
      Promise.all([fetchCoins(1, 100), fetchCoins(2, 100)])
        .then(([p1, p2]) => setCoins([...p1, ...p2]))
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(iv);
  }, []);

  // Track container size for responsive font sizing
  useEffect(() => {
    if (!gridRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setContainerSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(gridRef.current);
    return () => ro.disconnect();
  }, []);

  const totalMcap = useMemo(() => coins.reduce((s, c) => s + (c.market_cap || 0), 0), [coins]);

  // Apply filters: category, top N (search is handled via highlight, not filter)
  const filtered = useMemo(() => {
    let result = [...coins];
    if (catFilter !== "All") {
      result = result.filter(c => COIN_CATS[c.id] === catFilter);
    }
    result.sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
    result = result.slice(0, topN);
    return result;
  }, [coins, catFilter, topN]);

  // Search & Watchlist highlight set — tiles not in this set get dimmed
  const searchMatchIds = useMemo(() => {
    if (!searchQuery.trim() && !showWatchlistOnly) return null; // null = no filter active
    const q = searchQuery.toLowerCase();
    return new Set(filtered.filter(c => {
      const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q);
      const matchesWatchlist = !showWatchlistOnly || watchlist.has(c.symbol.toUpperCase());
      return matchesSearch && matchesWatchlist;
    }).map(c => c.id));
  }, [filtered, searchQuery, showWatchlistOnly, watchlist]);

  const nodes: TreeNode[] = useMemo(() =>
    filtered.filter(c => c.market_cap > 0).map(c => {
      const sym = c.symbol.toUpperCase();
      const liveP = livePrices[sym]?.price;
      const bp = basePricesRef.current[sym];
      let ch = getChange(c, period);
      if (liveP && liveP > 0 && bp && bp > 0) {
        ch += ((liveP - bp) / bp) * 100;
      }
      return {
        id: c.id,
        symbol: sym,
        name: c.name,
        mcap: c.market_cap,
        volume: c.total_volume || 0,
        change: ch,
        price: liveP || c.current_price,
        image: c.image,
        rank: c.market_cap_rank,
        sparkline: c.sparkline_in_7d?.price || [],
      };
    }),
  [filtered, period, livePrices]);

  const sizeKey = sizeMode === "Volume" ? "volume" : "mcap";

  // Compute layout, then merge tiny tiles into an "Others" group
  const layout = useMemo(() => {
    // First pass: only include coins that would get a visible tile
    // Calculate total value and figure out which coins would be too small
    const total = nodes.reduce((s, n) => s + n[sizeKey], 0);
    if (total <= 0 || nodes.length === 0) return [];

    // Estimate: a tile is "too small" if its share is < 0.05% of total
    const MIN_SHARE = 0.0005;
    const visible: TreeNode[] = [];
    const tiny: TreeNode[] = [];
    for (const n of nodes) {
      if (n[sizeKey] / total >= MIN_SHARE) visible.push(n);
      else tiny.push(n);
    }

    // If there are tiny coins, create an "Others" node that collects their value
    if (tiny.length > 0) {
      const othersVal = tiny.reduce((s, n) => s + n[sizeKey], 0);
      const othersChange = tiny.length > 0 ? tiny.reduce((s, n) => s + n.change, 0) / tiny.length : 0;
      visible.push({
        id: "__others__",
        symbol: `+${tiny.length}`,
        name: `${tiny.length} more coins`,
        image: "",
        sparkline: [],
        mcap: sizeKey === "mcap" ? othersVal : 0,
        volume: sizeKey === "volume" ? othersVal : 0,
        change: othersChange,
        price: 0,
        rank: 9999,
      });
    }

    return squarify(visible, 0, 0, 100, 100, sizeKey as "mcap" | "volume");
  }, [nodes, sizeKey]);

  const stats = useMemo(() => {
    const up = nodes.filter(n => n.change > 0).length;
    const down = nodes.filter(n => n.change < 0).length;
    const avg = nodes.length ? nodes.reduce((s, n) => s + n.change, 0) / nodes.length : 0;
    return { total: nodes.length, up, down, avg };
  }, [nodes]);

  const topMovers = useMemo(() => {
    const valid = nodes.filter(n => n.id !== "__others__");
    const gainers = [...valid].sort((a, b) => b.change - a.change).slice(0, 5);
    const losers = [...valid].sort((a, b) => a.change - b.change).slice(0, 5);
    return { gainers, losers };
  }, [nodes]);

  const hovered = hoveredId ? layout.find(l => l.id === hoveredId) : null;
  const hoveredCoin = hoveredId ? coins.find(c => c.id === hoveredId) : null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedCoin = selectedId ? coins.find(c => c.id === selectedId) : null;
  const selectedNode = selectedId ? layout.find(l => l.id === selectedId) : null;

  const handleMouse = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Color legend stops
  const legendStops = [
    { pct: -13, label: "-13%" },
    { pct: -8, label: "-8%" },
    { pct: -3, label: "-3%" },
    { pct: 0, label: "0%" },
    { pct: 3, label: "3%" },
    { pct: 8, label: "8%" },
    { pct: 13, label: "13%" },
  ];

  return (
    <div ref={containerRef} className="flex flex-col relative" style={{ background: "#0a0a0f", height: isFullscreen ? "100vh" : "calc(100dvh - 56px)" }}>
      {/* Floating Reveal Button */}
      <button 
        onClick={() => setShowFilters(true)} 
        className={`absolute top-4 right-4 z-30 p-3 rounded-2xl backdrop-blur-xl shadow-lg pointer-events-auto transition-all duration-500 ease-in-out ${showFilters ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
        style={{ background: "rgba(20,20,25,0.75)", border: "1px solid rgba(255,255,255,0.08)", color: "white" }}
      >
        <Filter size={16} />
      </button>

      {/* ═══ Floating Cinematic Toolbar ═══ */}
      <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-[960px] flex flex-col rounded-2xl backdrop-blur-xl shadow-2xl pointer-events-auto transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${showFilters ? 'translate-y-0 opacity-100' : '-translate-y-[150%] opacity-0'}`}
        style={{ background: "rgba(20,20,25,0.82)", border: "1px solid rgba(255,255,255,0.08)" }}>
        
        {/* Main controls row */}
        <div className="flex items-center justify-between p-2.5 overflow-x-auto no-scrollbar gap-2">
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Logo / Title */}
            <div className="flex items-center gap-2 pr-3 border-r border-white/10">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/20 text-blue-400 cursor-pointer hover:bg-blue-500/30 transition-colors" onClick={() => setDrillDownCat(null)}>
                <Grid3X3 size={16} />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xs font-bold text-white leading-none">Pyth Heatmap</h1>
                <p className="text-[9px] text-white/50 mt-0.5 tracking-wider uppercase">
                  {drillDownCat ? `${drillDownCat} Sector` : "Market Overview"}
                </p>
              </div>
            </div>

            {/* Top N */}
            <div className="flex rounded-lg p-0.5 bg-black/40 border border-white/5 shrink-0">
              {TOP_N_OPTIONS.map((n) => (
                <button key={n} onClick={() => setTopN(n)}
                  className="rounded-md px-2.5 py-1 text-[10px] font-bold transition-all"
                  style={{
                    background: topN === n ? "rgba(255,255,255,0.15)" : "transparent",
                    color: topN === n ? "white" : "rgba(255,255,255,0.4)",
                  }}
                >Top {n}</button>
              ))}
            </div>

            {/* Size by */}
            <div className="flex rounded-lg p-0.5 bg-black/40 border border-white/5 shrink-0">
              {SIZE_MODES.map((m) => (
                <button key={m} onClick={() => setSizeMode(m)}
                  className="rounded-md px-2.5 py-1 text-[10px] font-bold transition-all"
                  style={{
                    background: sizeMode === m ? "rgba(255,255,255,0.15)" : "transparent",
                    color: sizeMode === m ? "white" : "rgba(255,255,255,0.4)",
                  }}
                >{m}</button>
              ))}
            </div>
            
            {/* Period */}
            <div className="flex rounded-lg p-0.5 bg-black/40 border border-white/5 shrink-0">
              {PERIODS.map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className="rounded-md px-2.5 py-1 text-[10px] font-bold transition-all"
                  style={{
                    background: period === p ? "rgba(255,255,255,0.15)" : "transparent",
                    color: period === p ? "white" : "rgba(255,255,255,0.4)",
                  }}
                >{p}</button>
              ))}
            </div>
            
            {/* Category Dropdown */}
            <div className="relative group shrink-0">
              <select
                value={drillDownCat || catFilter}
                onChange={(e) => {
                  if (e.target.value !== "All") {
                    setDrillDownCat(e.target.value);
                    setCatFilter(e.target.value);
                  } else {
                    setDrillDownCat(null);
                    setCatFilter("All");
                  }
                }}
                className="appearance-none bg-black/40 border border-white/5 text-white text-[10px] font-bold rounded-lg px-2.5 py-1 pr-7 outline-none cursor-pointer hover:bg-white/5 transition-colors"
                style={{ WebkitAppearance: 'none', MozAppearance: 'none' } as React.CSSProperties}
              >
                {CAT_OPTIONS.map((c) => (
                  <option key={c} value={c} className="bg-[#1a1a24] text-white py-1">{c}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/50" />
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowWatchlistOnly(!showWatchlistOnly)}
              className={`p-1.5 rounded-lg transition-all ${showWatchlistOnly ? "bg-yellow-500/20 text-yellow-500" : "hover:bg-white/10 text-white/50 hover:text-white"}`}
              title="Toggle Watchlist Only"
            >
              <Star size={14} fill={showWatchlistOnly ? "currentColor" : "none"} />
            </button>
            <div className="w-px h-5 bg-white/10" />
            {/* Search */}
            <div className="relative hidden lg:block group">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-white/70 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="h-7 w-28 rounded-lg pl-7 pr-7 text-[11px] font-medium outline-none transition-all focus:w-44 bg-black/40 border border-white/10 text-white placeholder:text-white/30 focus:border-white/20"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/10">
                  <X size={10} className="text-white/50" />
                </button>
              )}
            </div>
            <div className="w-px h-5 bg-white/10" />
            {/* Tools */}
            <button
              onClick={() => {
                const snaps = snapshotsRef.current;
                if (timelapseActive) {
                  setTimelapseActive(false); setTimelapsePlaying(false);
                } else if (snaps.length > 1) {
                  setTimelapseActive(true); setTimelapseIdx(0);
                }
              }}
              className="p-1.5 rounded-lg transition-all hover:bg-white/10"
              style={{ color: timelapseActive ? "#f5a623" : "rgba(255,255,255,0.5)", background: timelapseActive ? "rgba(245,166,35,0.1)" : "transparent" }}
              title="Time-lapse"
            >
              <Clock size={14} />
            </button>
            <button
              onClick={() => {
                if (!gridRef.current) return;
                const watermark = document.createElement("div");
                watermark.innerHTML = `
                  <div style="position: absolute; bottom: 20px; right: 24px; display: flex; align-items: center; gap: 8px; font-family: sans-serif; z-index: 9999;">
                    <div style="width: 24px; height: 24px; background: var(--pf-accent); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">P</div>
                    <div style="color: rgba(255,255,255,0.8); font-size: 14px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">Pyth Heatmap</div>
                  </div>
                  <div style="position: absolute; top: 20px; left: 24px; color: white; font-family: sans-serif; font-size: 24px; font-weight: 900; text-shadow: 0 2px 8px rgba(0,0,0,0.8); z-index: 9999;">
                    Crypto Market Overview <span style="color: rgba(255,255,255,0.5); font-size: 16px; font-weight: 500; margin-left: 8px;">Top ${topN} • ${sizeMode}</span>
                  </div>
                `;
                gridRef.current.appendChild(watermark);
                html2canvas(gridRef.current, { backgroundColor: "#0b0b12", scale: 2, logging: false }).then((canvas) => {
                  if (gridRef.current && watermark.parentNode === gridRef.current) {
                    gridRef.current.removeChild(watermark);
                  }
                  const link = document.createElement("a");
                  link.download = `pyth-heatmap-${period}-${new Date().toISOString().slice(0, 10)}.png`;
                  link.href = canvas.toDataURL("image/png");
                  link.click();
                  toast.success("Screenshot saved successfully!");
                });
              }}
              className="p-1.5 rounded-lg transition-all hover:bg-white/10 text-white/50 hover:text-white"
              title="Screenshot"
            >
              <Camera size={14} />
            </button>
            <button onClick={toggleFullscreen} className="p-1.5 rounded-lg transition-all hover:bg-white/10 text-white/50 hover:text-white">
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button onClick={() => setShowFilters(false)} className="p-1.5 rounded-lg transition-all hover:bg-white/10 text-white/50 hover:text-white">
              <ChevronDown size={14} className="rotate-180" />
            </button>
          </div>
        </div>

        {/* Stats ribbon */}
        <div className="flex items-center gap-4 px-3 pb-2 text-[10px]">
          <span className="text-white/40">Showing <span className="text-white/70 font-semibold">{stats.total}</span> coins</span>
          <span className="flex items-center gap-1"><TrendingUp size={10} className="text-green-500" /><span className="text-green-500 font-semibold">{stats.up}</span><span className="text-white/30">up</span></span>
          <span className="flex items-center gap-1"><TrendingDown size={10} className="text-red-500" /><span className="text-red-500 font-semibold">{stats.down}</span><span className="text-white/30">down</span></span>
          <span className="text-white/30">Avg: <span className="font-semibold" style={{ color: stats.avg >= 0 ? "#22c55e" : "#ef4444" }}>{stats.avg >= 0 ? "+" : ""}{stats.avg.toFixed(2)}%</span></span>
          {Object.keys(livePrices).length > 0 && (
            <span className="flex items-center gap-1 ml-auto"><span className="w-1.5 h-1.5 rounded-full animate-pulse bg-green-500" /><span className="text-white/40">Pyth Live</span></span>
          )}
        </div>
      </div>

      {/* ═══ Treemap + Sidebar ═══ */}
      <div className="flex flex-1 overflow-hidden">
      <div ref={gridRef} className="relative flex-1 overflow-hidden rounded-b-xl" onMouseMove={handleMouse} style={{ background: "#0b0b12" }}>
        {loading ? (
          <div className="absolute inset-0 p-1.5 grid grid-cols-6 grid-rows-4 gap-[3px]">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="rounded-[5px] animate-pulse" style={{
                background: `rgba(255,255,255,${0.03 + (i % 5) * 0.008})`,
                animationDelay: `${i * 60}ms`,
                gridColumn: i < 2 ? "span 2" : undefined,
                gridRow: i < 1 ? "span 2" : undefined,
              }} />
            ))}
          </div>
        ) : layout.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Filter size={32} style={{ color: "rgba(255,255,255,0.15)" }} />
            <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>No coins match your filters</span>
            <button
              onClick={() => { setCatFilter("All"); setSearchQuery(""); setTopN(100); }}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)" }}
            >Reset Filters</button>
          </div>
        ) : (
          <div className="relative w-full h-full" style={{ padding: 2 }}>
            {layout.map((node) => {
              const isHovered = hoveredId === node.id;
              const pixelW = (node.rw / 100) * containerSize.w;
              const pixelH = (node.rh / 100) * containerSize.h;
              const minDim = Math.min(pixelW, pixelH);
              const dominance = fmtDominance(node.mcap, totalMcap);
              const isOthers = node.id === "__others__";

              // Responsive font sizing
              const showContent = pixelW > 28 && pixelH > 20;
              const showLogo = minDim > 50 && !isOthers;
              const showPrice = pixelW > 65 && pixelH > 45 && !isOthers;
              const showDominance = pixelW > 100 && pixelH > 70 && !isOthers;
              const logoSize = minDim > 120 ? 36 : minDim > 80 ? 24 : 16;
              const symbolSize = pixelW > 180 ? 18 : pixelW > 100 ? 14 : pixelW > 60 ? 11 : 9;
              const priceSize = pixelW > 180 ? 14 : pixelW > 100 ? 11 : 9;
              const changeSize = pixelW > 180 ? 13 : pixelW > 100 ? 11 : 9;

              const tileFlash = !isOthers ? priceFlash[node.symbol] : undefined;
              // Add pyth confidence blur
              const confidence = !isOthers && livePrices[node.symbol] ? livePrices[node.symbol].confidence : 0;
              const price = !isOthers && livePrices[node.symbol] ? livePrices[node.symbol].price : node.price;
              const confRatio = confidence && price ? Math.min((confidence / price) * 100, 1) : 0; // % of price, max 1
              
              const tileStyle = {
                left: `calc(${node.rx}% + 1.5px)`,
                top: `calc(${node.ry}% + 1.5px)`,
                width: `calc(${node.rw}% - 3px)`,
                height: `calc(${node.rh}% - 3px)`,
                background: isOthers ? "rgba(255,255,255,0.05)" : changeColor(
                  timelapseActive && snapshotsRef.current[timelapseIdx]?.changes[node.id] !== undefined
                    ? snapshotsRef.current[timelapseIdx].changes[node.id]
                    : node.change
                ),
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.06)",
                opacity: searchMatchIds && !isOthers && !searchMatchIds.has(node.id) ? 0.2
                  : hoveredId && !isHovered ? 0.5 : 1,
                filter: searchMatchIds && !isOthers && searchMatchIds.has(node.id) ? "brightness(1.3)"
                  : isHovered ? "brightness(1.25)" : tileFlash ? "brightness(1.5) saturate(1.5)" : `blur(${confRatio * 3}px)`,
                boxShadow: tileFlash === "up" ? "inset 0 0 30px rgba(34,197,94,0.8)" : tileFlash === "down" ? "inset 0 0 30px rgba(239,68,68,0.8)" : isHovered ? "inset 0 0 20px rgba(255,255,255,0.06)" : "inset 0 1px 0 rgba(255,255,255,0.04)",
                transform: isHovered ? "scale(1.02)" : "scale(1)",
                zIndex: isHovered || tileFlash ? 10 : 1,
                transition: tileFlash ? "none" : "filter 0.3s ease, outline 0.3s ease, background 0.5s ease, transform 0.15s ease",
              };

              const content = showContent && (
                <div className="flex flex-col items-center justify-center gap-0.5 px-1 text-center select-none">
                  {showLogo && node.image && (
                    <img
                      src={node.image}
                      alt=""
                      className="rounded-full mb-0.5"
                      style={{ width: logoSize, height: logoSize, opacity: 0.95 }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <span className="font-extrabold leading-tight" style={{
                    fontSize: symbolSize,
                    color: isOthers ? "rgba(255,255,255,0.5)" : "#fff",
                    textShadow: isOthers ? "none" : "0 1px 4px rgba(0,0,0,0.4)",
                  }}>
                    {node.symbol}
                  </span>
                  {isOthers && pixelH > 40 && (
                    <span className="leading-tight" style={{ fontSize: Math.max(priceSize - 1, 8), color: "rgba(255,255,255,0.35)" }}>
                      {node.name}
                    </span>
                  )}
                  {showPrice && (
                    <span className="text-white/85 font-semibold leading-tight" style={{ fontSize: priceSize, textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>
                      {fmtPrice(node.price)}
                    </span>
                  )}
                  {!isOthers && (
                    <span className="font-bold leading-tight" style={{
                      fontSize: changeSize,
                      color: node.change >= 0 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.9)",
                      textShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    }}>
                      {node.change >= 0 ? "▲" : "▼"} {Math.abs(node.change).toFixed(2)}%
                    </span>
                  )}
                  {showDominance && (
                    <span className="text-white/50 leading-tight" style={{ fontSize: Math.max(priceSize - 2, 8) }}>
                      Dominance : {dominance}
                    </span>
                  )}
                  {/* Sector category badge */}
                  {!isOthers && pixelW > 80 && pixelH > 55 && (() => {
                    const sector = getCoinSector(node.id);
                    if (!sector) return null;
                    const sColor = SECTOR_COLORS[sector] || "rgba(255,255,255,0.3)";
                    return (
                      <span
                        className="mt-0.5 px-1.5 py-px rounded font-semibold"
                        style={{
                          fontSize: Math.max(changeSize - 3, 6),
                          background: sColor.replace("0.7", "0.15"),
                          color: sColor.replace("0.7", "0.9"),
                          border: `1px solid ${sColor.replace("0.7", "0.25")}`,
                        }}
                      >
                        {sector}
                      </span>
                    );
                  })()}
                  {/* Mini sparkline for larger tiles */}
                  {!isOthers && pixelW > 110 && pixelH > 80 && node.sparkline.length > 4 && (() => {
                    const spark = node.sparkline;
                    const last = spark.slice(-24);
                    const min = Math.min(...last);
                    const max = Math.max(...last);
                    const range = max - min || 1;
                    const sw = Math.min(pixelW * 0.6, 60);
                    const sh = 14;
                    const pts = last.map((v, i) => `${(i / (last.length - 1)) * sw},${(1 - (v - min) / range) * sh}`).join(" ");
                    return (
                      <svg width={sw} height={sh} viewBox={`0 0 ${sw} ${sh}`} className="mt-0.5" style={{ opacity: 0.5 }}>
                        <polyline points={pts} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinecap="round" />
                      </svg>
                    );
                  })()}
                </div>
              );

              // "Others" tile — click to show all coins
              if (isOthers) {
                return (
                  <div
                    key={node.id}
                    onClick={() => {
                      const nextTier = TOP_N_OPTIONS.find(n => n > topN);
                      if (nextTier) {
                        setTopN(nextTier);
                      } else if (drillDownCat) {
                        setDrillDownCat(null);
                        setCatFilter("All");
                      }
                    }}
                    className="absolute flex flex-col items-center justify-center overflow-hidden transition-[filter,opacity] duration-150 cursor-pointer hover:brightness-125"
                    style={tileStyle}
                    title={`Expand to show more coins`}
                  >
                    {content}
                  </div>
                );
              }

              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedId(node.id === selectedId ? null : node.id)}
                  className="absolute flex flex-col items-center justify-center overflow-hidden transition-[filter,opacity] duration-150 cursor-pointer"
                  style={tileStyle}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {content}
                </div>
              );
            })}
          </div>
        )}

        {/* H3: Time-lapse playback bar */}
        {timelapseActive && snapshotsRef.current.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center gap-3 px-4 py-2" style={{ background: "rgba(11,11,18,0.92)", borderTop: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}>
            <button
              onClick={() => { if (timelapsePlaying) setTimelapsePlaying(false); else { if (timelapseIdx >= snapshotsRef.current.length - 1) setTimelapseIdx(0); setTimelapsePlaying(true); } }}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: timelapsePlaying ? "#f59e0b" : "rgba(255,255,255,0.6)" }}
            >
              {timelapsePlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <input
              type="range" min={0} max={Math.max(snapshotsRef.current.length - 1, 0)} value={timelapseIdx}
              onChange={(e) => { setTimelapseIdx(Number(e.target.value)); setTimelapsePlaying(false); }}
              className="flex-1 h-1 accent-amber-500 cursor-pointer"
            />
            <span className="text-[10px] font-mono shrink-0" style={{ color: "rgba(255,255,255,0.5)" }}>
              {snapshotsRef.current[timelapseIdx] ? new Date(snapshotsRef.current[timelapseIdx].t).toLocaleTimeString() : "—"}
            </span>
            <span className="text-[9px] shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
              {timelapseIdx + 1}/{snapshotsRef.current.length}
            </span>
          </div>
        )}

        {/* ═══ Sliding Detail Panel ═══ */}
        <div
          className="absolute top-0 right-0 bottom-0 w-[340px] z-50 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col"
          style={{
            transform: selectedId ? "translateX(0)" : "translateX(100%)",
            background: "rgba(10,10,15,0.85)",
            backdropFilter: "blur(24px)",
            borderLeft: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
          }}
        >
          {selectedCoin && selectedNode ? (
            <>
              {/* Panel Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <img src={selectedNode.image} alt="" className="w-10 h-10 rounded-full shadow-lg" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white leading-tight">{selectedNode.name}</h2>
                      <button onClick={() => toggleWatchlist(selectedNode.symbol)} className="text-white/40 hover:text-yellow-500 transition-colors">
                        <Star size={14} fill={watchlist.has(selectedNode.symbol) ? "#eab308" : "none"} className={watchlist.has(selectedNode.symbol) ? "text-yellow-500" : ""} />
                      </button>
                    </div>
                    <span className="text-xs font-semibold text-white/50 tracking-wider uppercase">{selectedNode.symbol}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedId(null)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                  <X size={16} className="text-white/70" />
                </button>
              </div>
              
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 no-scrollbar">
                
                {/* Price Section */}
                <div>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Live Price (Pyth)</p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-black text-white">{fmtPrice(livePrices[selectedNode.symbol]?.price || selectedNode.price)}</span>
                    <span className="text-sm font-bold px-2 py-0.5 rounded-lg" style={{
                      background: selectedNode.change >= 0 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                      color: selectedNode.change >= 0 ? "#22c55e" : "#ef4444",
                    }}>
                      {selectedNode.change >= 0 ? "+" : ""}{selectedNode.change.toFixed(2)}%
                    </span>
                  </div>
                  {livePrices[selectedNode.symbol]?.confidence > 0 && (
                    <div className="text-xs font-mono mt-1 text-white/50">
                      Pyth Confidence Interval: ± ${fmtPrice(livePrices[selectedNode.symbol].confidence).replace('$', '')}
                    </div>
                  )}
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1">Market Cap</p>
                    <p className="text-sm font-semibold text-white">{fmtLarge(selectedNode.mcap)}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1">Volume 24h</p>
                    <p className="text-sm font-semibold text-white">{fmtLarge(selectedNode.volume)}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1">Dominance</p>
                    <p className="text-sm font-semibold text-white">{fmtDominance(selectedNode.mcap, totalMcap)}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1">Rank</p>
                    <p className="text-sm font-semibold text-white">#{selectedNode.rank}</p>
                  </div>
                </div>

                {/* Sector & Links */}
                <div className="pt-2">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Category & Links</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {getCoinSector(selectedNode.id) || "General"}
                    </span>
                    <Link href={`/coins/${selectedNode.id}`} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-all border border-white/10">
                      View Details <ExternalLink size={12} />
                    </Link>
                  </div>
                </div>

                {/* 7D Sparkline */}
                {selectedNode.sparkline.length > 0 && (
                  <div className="pt-2">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">7D Trend</p>
                    <div className="h-16 w-full opacity-80">
                      <Sparklines data={selectedNode.sparkline} width={280} height={60} margin={2}>
                        <SparklinesCurve style={{ fill: "none", strokeWidth: 3 }} color={selectedNode.change >= 0 ? "#22c55e" : "#ef4444"} />
                      </Sparklines>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Bottom Action Area */}
              <div className="p-4 border-t border-white/5 bg-black/20 flex gap-2">
                <Link
                  href={`/swap?from=${selectedNode.symbol}`}
                  className="flex-1 py-3 rounded-xl font-bold text-sm text-center transition-all text-white"
                  style={{ background: "rgba(153,69,255,0.85)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(153,69,255,1)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(153,69,255,0.85)"; }}
                >
                  Swap {selectedNode.symbol}
                </Link>
                <Link
                  href={`/coins/${selectedNode.id}`}
                  className="px-4 py-3 rounded-xl font-bold text-sm transition-all"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  Details
                </Link>
              </div>
            </>
          ) : (
            <div className="flex-1" />
          )}
        </div>

        {/* ═══ Floating Tooltip (Only if panel not open for that coin) ═══ */}
        {hovered && hoveredCoin && hovered.id !== selectedId && (
          <div
            className="pointer-events-none fixed z-[100] rounded-xl shadow-2xl"
            style={{
              left: mousePos.x + 16,
              top: mousePos.y - 10,
              background: "rgba(15,15,25,0.97)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(16px)",
              minWidth: 260,
              maxWidth: 320,
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2">
              {hovered.image && <img src={hovered.image} alt="" className="h-7 w-7 rounded-full" />}
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white">{hovered.name}</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                    {hovered.symbol}
                  </span>
                </div>
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>Rank #{hovered.rank}</span>
              </div>
            </div>

            {/* Details */}
            <div className="px-3.5 pb-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Price</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{fmtPrice(livePrices[hovered.symbol]?.price || hovered.price)}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{
                    background: hovered.change >= 0 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                    color: hovered.change >= 0 ? "#22c55e" : "#ef4444",
                  }}>
                    {hovered.change >= 0 ? "+" : ""}{hovered.change.toFixed(2)}%
                  </span>
                </div>
              </div>
              {livePrices[hovered.symbol]?.confidence > 0 && (
                <div className="flex items-center justify-between">
                   <span className="text-[9px] text-white/30">Confidence</span>
                   <span className="text-[9px] font-mono text-white/50">± ${fmtPrice(livePrices[hovered.symbol].confidence).replace('$', '')}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{period} Change</span>
                <span className="text-[11px] font-bold" style={{ color: hovered.change >= 0 ? "#22c55e" : "#ef4444" }}>
                  {hovered.change >= 0 ? "+" : ""}{hovered.change.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/5">
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Market Cap</span>
                <span className="text-[11px] font-semibold text-white">{fmtLarge(hovered.mcap)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Volume (24h)</span>
                <span className="text-[11px] font-semibold text-white">{fmtLarge(hoveredCoin.total_volume)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Dominance</span>
                <span className="text-[11px] font-semibold text-white">{fmtDominance(hovered.mcap, totalMcap)}</span>
              </div>
              {/* Mini sparkline in tooltip */}
              {hovered.sparkline.length > 4 && (
                <div className="pt-1.5 mt-1.5 border-t border-white/5">
                  <div className="h-8 w-full opacity-70">
                    <Sparklines data={hovered.sparkline.slice(-24)} width={240} height={30} margin={2}>
                      <SparklinesCurve style={{ fill: "none", strokeWidth: 2 }} color={hovered.change >= 0 ? "#22c55e" : "#ef4444"} />
                    </Sparklines>
                  </div>
                </div>
              )}
            </div>
            {/* Click hint */}
            <div className="px-3.5 pb-2">
              <span className="text-[9px] text-white/25">Click tile to view details</span>
            </div>
          </div>
        )}
      </div>

        {/* ═══ Top Movers Sidebar ═══ */}
        <div className="hidden lg:flex flex-col w-[220px] shrink-0 overflow-y-auto no-scrollbar" style={{ background: "rgba(11,11,18,0.95)", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp size={12} style={{ color: "var(--pf-up, #22c55e)" }} />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--pf-up, #22c55e)" }}>Top Gainers</span>
            </div>
            {topMovers.gainers.map((g) => (
              <div
                key={g.id}
                onClick={() => setSelectedId(g.id === selectedId ? null : g.id)}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-colors hover:bg-white/5"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--pf-up, #22c55e)" }} />
                  <span className="text-[11px] font-bold text-white">{g.symbol}</span>
                </div>
                <span className="text-[11px] font-bold" style={{ color: "var(--pf-up, #22c55e)" }}>
                  +{g.change.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
          <div className="mx-3 border-t" style={{ borderColor: "var(--cmc-border, rgba(255,255,255,0.06))" }} />
          <div className="px-3 pt-2 pb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingDown size={12} style={{ color: "var(--pf-down, #ef4444)" }} />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--pf-down, #ef4444)" }}>Top Losers</span>
            </div>
            {topMovers.losers.map((l) => (
              <div
                key={l.id}
                onClick={() => setSelectedId(l.id === selectedId ? null : l.id)}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-colors hover:bg-white/5"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--pf-down, #ef4444)" }} />
                  <span className="text-[11px] font-bold text-white">{l.symbol}</span>
                </div>
                <span className="text-[11px] font-bold" style={{ color: "var(--pf-down, #ef4444)" }}>
                  {l.change.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ Color Legend Bar ═══ */}
      <div className="flex items-center gap-4 px-4 py-2 shrink-0" style={{ background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex flex-col gap-0.5 flex-1 max-w-[420px]">
          <div className="relative h-3 rounded-full overflow-hidden shadow-inner"
            style={{ background: `linear-gradient(to right, ${changeColor(-13)}, ${changeColor(-8)}, ${changeColor(-3)}, ${changeColor(0)}, ${changeColor(3)}, ${changeColor(8)}, ${changeColor(13)})` }}>
            {[
              { pct: -10, pos: ((-10 + 13) / 26) * 100 },
              { pct: -5, pos: ((-5 + 13) / 26) * 100 },
              { pct: 0, pos: 50 },
              { pct: 5, pos: ((5 + 13) / 26) * 100 },
              { pct: 10, pos: ((10 + 13) / 26) * 100 },
            ].map(({ pct, pos }) => (
              <div key={pct} className="absolute top-0 bottom-0 w-px" style={{ left: `${pos}%`, background: pct === 0 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)" }} />
            ))}
          </div>
          <div className="relative h-3" style={{ fontSize: 8 }}>
            {[
              { label: "-13%", pos: 0 },
              { label: "-10%", pos: ((-10 + 13) / 26) * 100 },
              { label: "-5%", pos: ((-5 + 13) / 26) * 100 },
              { label: "0%", pos: 50 },
              { label: "+5%", pos: ((5 + 13) / 26) * 100 },
              { label: "+10%", pos: ((10 + 13) / 26) * 100 },
              { label: "+13%", pos: 100 },
            ].map(({ label, pos }) => (
              <span key={label} className="absolute font-semibold tabular-nums" style={{ left: `${pos}%`, transform: "translateX(-50%)", color: "rgba(255,255,255,0.4)" }}>{label}</span>
            ))}
          </div>
        </div>
        {Object.keys(livePrices).length > 0 && (
          <div className="flex items-center gap-1.5 text-[9px] shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#16c784" }} />
            Pyth <span className="font-bold">Live</span>
          </div>
        )}
      </div>
    </div>
  );
}
