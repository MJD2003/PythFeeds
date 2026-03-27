"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, X, ChevronDown, TrendingUp, TrendingDown, ExternalLink, Loader2, Grid3X3, Circle, Filter } from "lucide-react";
import { Sparklines, SparklinesLine, SparklinesCurve } from "react-sparklines";
import { fetchCoins, fetchMemeBubbles, type CoinMarketItem, type MemeBubbleToken } from "@/lib/api/backend";
import { fetchPythPricesBatch, subscribePythStream } from "@/lib/pyth-prices";
import { fmtB } from "@/lib/format";

/* ─────────────── Constants ─────────────── */
const PERIODS = ["1H", "24H", "7D"] as const;
const PERIOD_LABELS: Record<string, string> = { "1H": "1 Hour", "24H": "24 Hours", "7D": "7 Days" };
const SIZE_MODES = ["Market Cap", "Volume"] as const;
const COIN_COUNT = 100;
type BubbleMode = "crypto" | "meme";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "layer-1", label: "Layer 1", match: ["bitcoin","ethereum","solana","cardano","avalanche-2","polkadot","near","aptos","sui","ton","internet-computer","cosmos","algorand","tron","fantom","hedera-hashgraph"] },
  { key: "defi", label: "DeFi", match: ["uniswap","aave","maker","lido-dao","chainlink","the-graph","jupiter-exchange-solana","raydium","pancakeswap-token","curve-dao-token","compound-governance-token","1inch","sushi"] },
  { key: "meme", label: "Meme", match: ["dogecoin","shiba-inu","pepe","dogwifcoin","floki","bonk","brett","memecoin","book-of-meme","cat-in-a-dogs-world"] },
  { key: "stablecoin", label: "Stablecoins", match: ["tether","usd-coin","dai","first-digital-usd","ethena-usde","paypal-usd"] },
  { key: "ai", label: "AI", match: ["render-token","fetch-ai","bittensor","ocean-protocol","singularitynet","akash-network","arkham","worldcoin-wld"] },
] as const;

const MEME_CATEGORIES = [
  { key: "all", label: "All" },
  { key: "dogs", label: "Dogs", matchSymbols: ["DOGE","SHIB","FLOKI","WIF","BONK","MYRO","POPCAT","CHEEMS","WOOF","SAMO","INU"] },
  { key: "cats", label: "Cats", matchSymbols: ["MEW","POPCAT","KITTY","MANEKI","PURR","CATDOG","MEOW","MICHI"] },
  { key: "frogs", label: "Frogs", matchSymbols: ["PEPE","PEPECOIN","BRETT","FROG","RIBBIT","BOME"] },
  { key: "ai-meme", label: "AI Memes", matchSymbols: ["GOAT","ACT","FARTCOIN","TURBO","AI16Z","GRIFFAIN","VIRTUAL","ZEREBRO"] },
  { key: "political", label: "Political", matchSymbols: ["TRUMP","MAGA","BODEN","TREMP","JILL"] },
  { key: "food", label: "Food", matchSymbols: ["SUSHI","PIZZA","COFFEE","NOODLE","BURGER","TACO"] },
] as const;

const SOURCE_COLORS: Record<string, string> = {
  dexscreener: "#00d4aa",
  pumpfun: "#f7931a",
  jupiter: "#c7f284",
  raydium: "#6366f1",
};

type Category = typeof CATEGORIES[number];

interface CryptoItem {
  symbol: string; name: string; mcap: number; price: number;
  rank: number; vol24h: number; image: string; cgId: string;
  change1h: number; change24h: number; change7d: number;
  sparkline: number[];
  // Meme-specific fields
  source?: string;
  mint?: string;
  bondingProgress?: number | null;
  liquidity?: number;
  txns24h?: number;
}

/* ─────────────── Helpers ─────────────── */
function getChange(item: CryptoItem, period: string): number {
  switch (period) {
    case "1H": return item.change1h;
    case "24H": return item.change24h;
    case "7D": return item.change7d;
    default: return item.change24h;
  }
}


function fmtPrice(p: number) {
  if (p >= 1000) return `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.0001) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(8)}`;
}

/* ─────────────── Meme bubble color — more vibrant/neon ─────────────── */
function getMemeBubbleColor(change: number, isDark: boolean) {
  const isUp = change >= 0;
  const intensity = Math.min(Math.abs(change) / 25, 1);
  if (isDark) {
    if (isUp) {
      const alpha = 0.35 + intensity * 0.45;
      return { bg: `rgba(0, 255, 136, ${alpha})`, border: `rgba(0, 255, 136, ${alpha * 0.5})` };
    } else {
      const alpha = 0.35 + intensity * 0.45;
      return { bg: `rgba(255, 56, 96, ${alpha})`, border: `rgba(255, 56, 96, ${alpha * 0.5})` };
    }
  } else {
    if (isUp) {
      const alpha = 0.25 + intensity * 0.5;
      return { bg: `rgba(0,200,100,${alpha})`, border: `rgba(0,180,90,${alpha * 0.6})` };
    } else {
      const alpha = 0.25 + intensity * 0.45;
      return { bg: `rgba(220,50,60,${alpha})`, border: `rgba(200,45,55,${alpha * 0.6})` };
    }
  }
}

/* ─────────────── Bubble type ─────────────── */
interface Bubble {
  id: string; name: string; img: string;
  x: number; y: number; vx: number; vy: number; r: number;
  change: number; price: number; mcap: number; vol24h: number; rank: number;
  sparkline: number[];
  cgId: string;
  pinned: boolean;
  // Meme-specific
  source?: string;
  mint?: string;
  bondingProgress?: number | null;
  liquidity?: number;
  txns24h?: number;
}

/* ─────────────── Color computation ─────────────── */
function getBubbleColor(change: number, isDark: boolean) {
  const isUp = change >= 0;
  const intensity = Math.min(Math.abs(change) / 20, 1);

  if (isDark) {
    // Muted, semi-transparent for dark mode — modern glassmorphism feel
    if (isUp) {
      const alpha = 0.3 + intensity * 0.4; // 0.3 to 0.7
      return { bg: `rgba(22, 199, 132, ${alpha})`, border: `rgba(22, 199, 132, ${alpha * 0.5})` };
    } else {
      const alpha = 0.3 + intensity * 0.4;
      return { bg: `rgba(234, 57, 67, ${alpha})`, border: `rgba(234, 57, 67, ${alpha * 0.5})` };
    }
  } else {
    if (isUp) {
      const alpha = 0.2 + intensity * 0.45;
      return { bg: `rgba(22,180,90,${alpha})`, border: `rgba(22,160,80,${alpha * 0.6})` };
    } else {
      const alpha = 0.2 + intensity * 0.4;
      return { bg: `rgba(200,50,55,${alpha})`, border: `rgba(180,45,50,${alpha * 0.6})` };
    }
  }
}

/* ─────────────── Force-directed circle packing ─────────────── */
function packCircles(items: Bubble[], W: number, H: number, clusterSectors: boolean = false) {
  const cx = W / 2, cy = H / 2;
  
  // Define cluster centers if clustering is enabled
  const clusters: Record<string, { x: number, y: number }> = {};
  if (clusterSectors) {
    CATEGORIES.filter(c => c.key !== 'all').forEach((cat, i, arr) => {
      const angle = (i / arr.length) * Math.PI * 2;
      const radius = Math.min(W, H) * 0.25;
      clusters[cat.key] = {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius
      };
    });
    clusters['all'] = { x: cx, y: cy }; // Fallback
  }

  /* Place using golden-angle spiral as initial positions */
  const golden = Math.PI * (3 - Math.sqrt(5));
  const sorted = [...items].sort((a, b) => b.r - a.r);
  sorted.forEach((b, i) => {
    const angle = i * golden;
    const dist = Math.sqrt(i + 0.5) * (Math.min(W, H) * 0.04);
    
    // If clustering, start them closer to their cluster center
    if (clusterSectors) {
      let bCategory = 'all';
      for (const cat of CATEGORIES) {
        if ('match' in cat && cat.match && (cat.match as readonly string[]).includes(b.cgId)) {
          bCategory = cat.key;
          break;
        }
      }
      const center = clusters[bCategory] || clusters['all'];
      b.x = center.x + Math.cos(angle) * dist * 0.5;
      b.y = center.y + Math.sin(angle) * dist * 0.5;
    } else {
      b.x = cx + Math.cos(angle) * dist;
      b.y = cy + Math.sin(angle) * dist;
    }
  });

  /* Run force relaxation iterations to remove overlaps */
  for (let iter = 0; iter < 80; iter++) {
    const strength = iter < 30 ? 0.4 : 0.2;
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const minDist = a.r + b.r + 2;
        if (dist < minDist) {
          const force = (minDist - dist) * strength;
          const nx = dx / dist;
          const ny = dy / dist;
          const massA = a.r * a.r;
          const massB = b.r * b.r;
          const total = massA + massB;
          a.x += nx * force * (massB / total);
          a.y += ny * force * (massB / total);
          b.x -= nx * force * (massA / total);
          b.y -= ny * force * (massA / total);
        }
      }
      
      /* Pull toward center (or cluster center) */
      let targetX = cx;
      let targetY = cy;
      
      if (clusterSectors) {
        let bCategory = 'all';
        for (const cat of CATEGORIES) {
          if ('match' in cat && cat.match && (cat.match as readonly string[]).includes(a.cgId)) {
            bCategory = cat.key;
            break;
          }
        }
        const center = clusters[bCategory] || clusters['all'];
        targetX = center.x;
        targetY = center.y;
      }

      const dcx = targetX - a.x;
      const dcy = targetY - a.y;
      const dc = Math.sqrt(dcx * dcx + dcy * dcy) || 1;
      a.x += (dcx / dc) * Math.min(dc * 0.01, 3);
      a.y += (dcy / dc) * Math.min(dc * 0.01, 3);

      /* Keep in bounds */
      a.x = Math.max(a.r + 2, Math.min(W - a.r - 2, a.x));
      a.y = Math.max(a.r + 2, Math.min(H - a.r - 2, a.y));
    }
  }
}

/* ─────────────── MAIN COMPONENT ─────────────── */
export default function BubblesPage() {
  const [period, setPeriod] = useState<string>("24H");
  const [sizeMode, setSizeMode] = useState<string>("Market Cap");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Bubble | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const dragRef = useRef<{ id: string; ox: number; oy: number; lx: number; ly: number; moved: boolean } | null>(null);
  const animRef = useRef<number>(0);
  const [tick, setTick] = useState(0);
  const [isDark, setIsDark] = useState(true);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [coins, setCoins] = useState<CryptoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [livePrices, setLivePrices] = useState<Record<string, { price: number, confidence: number }>>({});
  const prevPricesRef = useRef<Record<string, number>>({});
  const [priceFlash, setPriceFlash] = useState<Record<string, "up" | "down">>({});

  const [category, setCategory] = useState<string>("all");
  const [clusterSectors, setClusterSectors] = useState(false);
  const [bubbleMode, setBubbleMode] = useState<BubbleMode>("crypto");

  /* Fetch data based on mode */
  useEffect(() => {
    setLoading(true);
    setCategory("all");
    setSearch("");
    if (bubbleMode === "meme") {
      fetchMemeBubbles(100)
        .then((data) => {
          const mapped: CryptoItem[] = data.map((t, i) => ({
            symbol: t.symbol,
            name: t.name,
            mcap: t.mcap || 0,
            price: t.price || 0,
            rank: t.rank || i + 1,
            vol24h: t.volume || 0,
            image: t.image || "",
            cgId: t.mint || t.symbol,
            change1h: t.change1h || 0,
            change24h: t.change24h || 0,
            change7d: t.change7d || 0,
            sparkline: t.sparkline || [],
            source: t.source,
            mint: t.mint,
            bondingProgress: t.bondingProgress,
            liquidity: t.liquidity,
            txns24h: t.txns24h,
          }));
          setCoins(mapped);
        })
        .catch(() => setCoins([]))
        .finally(() => setLoading(false));
    } else {
      fetchCoins(1, COIN_COUNT)
        .then((data) => {
          const mapped: CryptoItem[] = data.map((c, i) => ({
            symbol: c.symbol.toUpperCase(),
            name: c.name,
            mcap: c.market_cap || 0,
            price: c.current_price || 0,
            rank: c.market_cap_rank || i + 1,
            vol24h: c.total_volume || 0,
            image: c.image || "",
            cgId: c.id,
            change1h: c.price_change_percentage_1h_in_currency || 0,
            change24h: c.price_change_percentage_24h_in_currency || 0,
            change7d: c.price_change_percentage_7d_in_currency || 0,
            sparkline: c.sparkline_in_7d?.price || [],
          }));
          setCoins(mapped);
        })
        .catch(() => setCoins([]))
        .finally(() => setLoading(false));
    }
  }, [bubbleMode]);

  /* Pyth real-time prices — SSE stream with polling fallback */
  useEffect(() => {
    if (coins.length === 0) return;
    const symbols = [...new Set(coins.map(c => c.symbol.toUpperCase()))];
    const prev = prevPricesRef.current;

    const applyUpdate = (sym: string, price: number, confidence: number) => {
      if (price <= 0) return;
      const flash: Record<string, "up" | "down"> = {};
      if (prev[sym] && prev[sym] !== price) flash[sym] = price > prev[sym] ? "up" : "down";
      prev[sym] = price;
      setLivePrices(lp => ({ ...lp, [sym]: { price, confidence } }));
      if (Object.keys(flash).length > 0) {
        setPriceFlash(flash);
        setTimeout(() => setPriceFlash({}), 800);
      }
    };

    let sseCleanup: (() => void) | null = null;
    let pollIv: NodeJS.Timeout | null = null;

    const doPoll = async () => {
      try {
        const pythData = await fetchPythPricesBatch(symbols, true) as Record<string, import("@/lib/pyth-prices").PythPrice>;
        for (const [sym, data] of Object.entries(pythData)) {
          if (data && data.price > 0) applyUpdate(sym, data.price, data.confidence ?? 0);
        }
      } catch {}
    };

    subscribePythStream(symbols, applyUpdate)
      .then(unsub => { sseCleanup = unsub; })
      .catch(() => {
        doPoll();
        pollIv = setInterval(doPoll, 10_000);
      });

    // 30s backup poll to fill any SSE gaps
    const backupIv = setInterval(doPoll, 30_000);
    doPoll();

    return () => {
      sseCleanup?.();
      if (pollIv) clearInterval(pollIv);
      clearInterval(backupIv);
    };
  }, [coins]);

  /* Auto-refresh data every 60s (crypto) or 45s (meme) */
  useEffect(() => {
    const interval = bubbleMode === "meme" ? 45_000 : 60_000;
    const iv = setInterval(() => {
      if (bubbleMode === "meme") {
        fetchMemeBubbles(100)
          .then((data) => {
            const mapped: CryptoItem[] = data.map((t, i) => ({
              symbol: t.symbol, name: t.name, mcap: t.mcap || 0, price: t.price || 0,
              rank: t.rank || i + 1, vol24h: t.volume || 0, image: t.image || "",
              cgId: t.mint || t.symbol,
              change1h: t.change1h || 0, change24h: t.change24h || 0, change7d: t.change7d || 0,
              sparkline: t.sparkline || [], source: t.source, mint: t.mint,
              bondingProgress: t.bondingProgress, liquidity: t.liquidity, txns24h: t.txns24h,
            }));
            setCoins(mapped);
          }).catch(() => {});
      } else {
        fetchCoins(1, COIN_COUNT)
          .then((data) => {
            const mapped: CryptoItem[] = data.map((c, i) => ({
              symbol: c.symbol.toUpperCase(), name: c.name, mcap: c.market_cap || 0,
              price: c.current_price || 0, rank: c.market_cap_rank || i + 1,
              vol24h: c.total_volume || 0, image: c.image || "", cgId: c.id,
              change1h: c.price_change_percentage_1h_in_currency || 0,
              change24h: c.price_change_percentage_24h_in_currency || 0,
              change7d: c.price_change_percentage_7d_in_currency || 0,
              sparkline: c.sparkline_in_7d?.price || [],
            }));
            setCoins(mapped);
          }).catch(() => {});
      }
    }, interval);
    return () => clearInterval(iv);
  }, [bubbleMode]);

  /* Theme detection */
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  /* L10: Keyboard navigation between bubbles */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const bs = bubblesRef.current;
      if (!bs.length) return;
      if (e.key === "Escape") { setSelected(null); setHovered(null); return; }
      if (e.key === "Enter" && hovered) {
        const b = bs.find((b) => b.id === hovered);
        if (b) setSelected(b);
        return;
      }
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
      e.preventDefault();
      const cur = hovered ? bs.find((b) => b.id === hovered) : null;
      if (!cur) { setHovered(bs[0]?.id || null); return; }
      const dx = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      const dy = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
      let best: typeof cur | null = null;
      let bestScore = Infinity;
      for (const b of bs) {
        if (b.id === cur.id) continue;
        const ddx = b.x - cur.x, ddy = b.y - cur.y;
        if (dx !== 0 && Math.sign(ddx) !== dx) continue;
        if (dy !== 0 && Math.sign(ddy) !== dy) continue;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dist < bestScore) { bestScore = dist; best = b; }
      }
      if (best) setHovered(best.id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hovered]);

  /* Measure container */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Active categories based on mode */
  const activeCategories = bubbleMode === "meme" ? MEME_CATEGORIES : CATEGORIES;

  /* Build bubbles when inputs change */
  const buildBubbles = useCallback(() => {
    const { w: W, h: H } = dims;
    if (!W || !H || coins.length === 0) return;

    let items = coins.map((d) => ({
      ...d,
      change: getChange(d, period),
    }));
    // Category filter — use meme categories when in meme mode
    if (category !== "all") {
      if (bubbleMode === "meme") {
        const catDef = MEME_CATEGORIES.find((c) => c.key === category);
        if (catDef && "matchSymbols" in catDef) {
          const matchSet = new Set(catDef.matchSymbols as readonly string[]);
          items = items.filter((d) => matchSet.has(d.symbol));
        }
      } else {
        const catDef = CATEGORIES.find((c) => c.key === category);
        if (catDef && "match" in catDef) {
          const matchSet = new Set((catDef as { match: readonly string[] }).match);
          items = items.filter((d) => matchSet.has(d.cgId));
        }
      }
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((d) => d.symbol.toLowerCase().includes(q) || d.name.toLowerCase().includes(q));
    }
    if (items.length === 0) { bubblesRef.current = []; return; }

    /* Radius based on market cap (or volume) — sqrt scale */
    const sizeValues = items.map((d) => sizeMode === "Volume" ? d.vol24h : d.mcap);
    const maxVal = Math.max(...sizeValues, 0.01);
    const area = W * H;
    const targetFill = area * 0.65;
    const rawAreas = sizeValues.map((v) => 0.12 + (Math.sqrt(v / maxVal)) * 0.88);
    const rawSum = rawAreas.reduce((s, v) => s + v, 0);
    const scale = targetFill / (rawSum * Math.PI);

    const bubbles: Bubble[] = items.map((d, i) => {
      const r = Math.sqrt(rawAreas[i] * scale);
      const clamped = Math.max(14, Math.min(r, Math.min(W, H) * 0.2));
      return {
        id: d.symbol, name: d.name, img: d.image,
        x: W / 2, y: H / 2, vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 50,
        r: clamped, change: d.change, price: d.price,
        mcap: d.mcap, vol24h: d.vol24h, rank: d.rank,
        sparkline: d.sparkline, cgId: d.cgId,
        pinned: false,
        source: d.source,
        mint: d.mint,
        bondingProgress: d.bondingProgress,
        liquidity: d.liquidity,
        txns24h: d.txns24h,
      };
    });

    packCircles(bubbles, W, H, clusterSectors);
    bubblesRef.current = bubbles;
  }, [period, search, sizeMode, dims, coins, category, clusterSectors, bubbleMode]);

  useEffect(() => { buildBubbles(); }, [buildBubbles]);

  /* Physics loop */
  useEffect(() => {
    const { w: W, h: H } = dims;
    if (!W || !H) return;
    let frame = 0;

    const loop = () => {
      const bs = bubblesRef.current;
      const drag = dragRef.current;

      for (let i = 0; i < bs.length; i++) {
        const a = bs[i];
        const aD = drag && drag.id === a.id;

        if (!aD) {
          /* Handle Pinned State - strong gravity to center, push others away */
          if (a.pinned) {
            const dcx = W / 2 - a.x;
            const dcy = H / 2 - a.y;
            a.vx += dcx * 0.05;
            a.vy += dcy * 0.05;
            // Dampen movement for pinned bubble to lock it in place faster
            a.vx *= 0.8;
            a.vy *= 0.8;
          } else {
            /* Gentle ambient drift */
            const phase = a.rank * 2.1 + frame * 0.005;
            a.vx += Math.sin(phase) * 0.002;
            a.vy += Math.cos(phase * 0.7) * 0.002;

              const cx = W / 2, cy = H / 2;
              const pinnedBubble = bs.find(b => b.pinned);
              
              let targetX = cx;
              let targetY = cy;
              
              // Multi-gravity cluster forces
              if (clusterSectors && !pinnedBubble) {
                let bCategory = 'all';
                for (const cat of CATEGORIES) {
                  if ('match' in cat && cat.match && (cat.match as readonly string[]).includes(a.cgId)) {
                    bCategory = cat.key;
                    break;
                  }
                }
                const catIdx = CATEGORIES.findIndex(c => c.key === bCategory) - 1; // offset 'all'
                if (catIdx >= 0) {
                  const angle = (catIdx / (CATEGORIES.length - 1)) * Math.PI * 2;
                  const radius = Math.min(W, H) * 0.25;
                  targetX = cx + Math.cos(angle) * radius;
                  targetY = cy + Math.sin(angle) * radius;
                }
              }

              if (pinnedBubble) {
                targetX = pinnedBubble.x;
                targetY = pinnedBubble.y;
              }
              
              const dcx = targetX - a.x;
              const dcy = targetY - a.y;
              const dc = Math.sqrt(dcx * dcx + dcy * dcy) || 1;
              
              // If there's a pinned bubble, orbit around it
              if (pinnedBubble) {
                const idealDist = pinnedBubble.r + a.r + 20;
                const diff = dc - idealDist;
                a.vx += (dcx / dc) * diff * 0.001;
                a.vy += (dcy / dc) * diff * 0.001;
                // Orbital tangential force
                a.vx -= (dcy / dc) * 0.002;
                a.vy += (dcx / dc) * 0.002;
              } else if (dc > Math.min(W, H) * (clusterSectors ? 0.1 : 0.25)) {
                a.vx += (dcx / dc) * 0.004;
                a.vy += (dcy / dc) * 0.004;
              }
            }
        }

        /* Collision — skip pairs that are clearly too far apart */
        for (let j = i + 1; j < bs.length; j++) {
          const b = bs[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const minD = a.r + b.r + 1.5;
          /* Quick reject: if either axis distance exceeds minD, skip sqrt */
          if (Math.abs(dx) > minD || Math.abs(dy) > minD) continue;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          if (dist < minD) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minD - dist;
            const mA = a.r * a.r;
            const mB = b.r * b.r;
            const mT = mA + mB;
            const bD = drag && drag.id === b.id;

            if (!aD) { a.x += nx * overlap * 0.3 * (mB / mT); a.y += ny * overlap * 0.3 * (mB / mT); }
            if (!bD) { b.x -= nx * overlap * 0.3 * (mA / mT); b.y -= ny * overlap * 0.3 * (mA / mT); }

            const rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
            if (rv > 0) {
              const imp = rv * 0.15;
              if (!aD) { a.vx -= nx * imp * (mB / mT); a.vy -= ny * imp * (mB / mT); }
              if (!bD) { b.vx += nx * imp * (mA / mT); b.vy += ny * imp * (mA / mT); }
            }
          }
        }

        if (!aD) {
          /* Wall bounce */
          if (a.x - a.r < 0) { a.x = a.r; a.vx = Math.abs(a.vx) * 0.3; }
          if (a.x + a.r > W) { a.x = W - a.r; a.vx = -Math.abs(a.vx) * 0.3; }
          if (a.y - a.r < 0) { a.y = a.r; a.vy = Math.abs(a.vy) * 0.3; }
          if (a.y + a.r > H) { a.y = H - a.r; a.vy = -Math.abs(a.vy) * 0.3; }

          /* Damping */
          a.vx *= 0.992;
          a.vy *= 0.992;
          const spd = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
          if (spd > 0.4) { const s = 0.4 / spd; a.vx *= s; a.vy *= s; }

          a.x += a.vx;
          a.y += a.vy;
        }
      }

      frame++;
      if (frame % 3 === 0) setTick((n) => n + 1);
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [dims]);

  /* Drag handlers */
  const onPointerDown = useCallback((id: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const b = bubblesRef.current.find((b) => b.id === id);
    if (!b) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    dragRef.current = { id, ox: mx - b.x, oy: my - b.y, lx: mx, ly: my, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const b = bubblesRef.current.find((b) => b.id === d.id);
    if (!b) return;
    if (Math.abs(mx - d.lx) > 3 || Math.abs(my - d.ly) > 3) d.moved = true;
    b.vx = (mx - d.lx) * 0.05;
    b.vy = (my - d.ly) * 0.05;
    b.x = mx - d.ox;
    b.y = my - d.oy;
    d.lx = mx;
    d.ly = my;
  }, []);

  const onPointerUp = useCallback(() => {
    const d = dragRef.current;
    if (d && !d.moved) {
      const b = bubblesRef.current.find((b) => b.id === d.id);
      if (b) setSelected(b);
    }
    dragRef.current = null;
  }, []);

  /* Stats */
  const stats = useMemo(() => {
    const bs = bubblesRef.current;
    const up = bs.filter((b) => b.change > 0).length;
    const down = bs.filter((b) => b.change < 0).length;
    const avg = bs.length ? bs.reduce((s, b) => s + b.change, 0) / bs.length : 0;
    return { total: bs.length, up, down, avg };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, period, search]);

  const bubbles = bubblesRef.current;

  return (
    <div className="flex h-[calc(100dvh-56px)] flex-col bg-background overflow-hidden relative font-sans">
      {/* ─── Floating Glassmorphism Header Controls ─── */}
      <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-[800px] flex flex-col gap-2 pointer-events-none transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${showSearch ? 'translate-y-0 opacity-100' : '-translate-y-[150%] opacity-0'}`}>
        <div className="flex items-center justify-between p-2 rounded-2xl backdrop-blur-xl pointer-events-auto shadow-2xl"
          style={{ background: isDark ? "rgba(20,20,25,0.85)" : "rgba(255,255,255,0.9)", border: "1px solid var(--cmc-border)" }}>
          
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-edges pr-2 pl-1">
          {/* Mode Toggle: Crypto / Meme */}
          <div className="flex items-center rounded-xl p-0.5 shrink-0" style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}>
            <button onClick={() => setBubbleMode("crypto")}
              className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all"
              style={{
                background: bubbleMode === "crypto" ? "var(--cmc-bg)" : "transparent",
                color: bubbleMode === "crypto" ? "var(--cmc-text)" : "var(--cmc-neutral-5)",
                boxShadow: bubbleMode === "crypto" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
              }}>Crypto</button>
            <button onClick={() => setBubbleMode("meme")}
              className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all flex items-center gap-1"
              style={{
                background: bubbleMode === "meme" ? "linear-gradient(135deg, #f7931a, #ff6b6b)" : "transparent",
                color: bubbleMode === "meme" ? "#fff" : "var(--cmc-neutral-5)",
                boxShadow: bubbleMode === "meme" ? "0 2px 12px rgba(247,147,26,0.3)" : "none",
              }}>Meme</button>
          </div>

          {/* Cluster Sectors Toggle */}
          <button 
            onClick={() => setClusterSectors(!clusterSectors)}
            className={`rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all border ${clusterSectors ? 'bg-(--pf-accent) text-white border-transparent shadow-lg shadow-purple-500/20' : 'bg-transparent text-(--cmc-neutral-5) border-(--cmc-border) hover:bg-white/5'}`}
          >
            Cluster
          </button>
          
          <div className="w-px h-4 bg-(--cmc-border) shrink-0" />
            
          {/* Period selector */}
            <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-xl p-0.5 shrink-0">
              {PERIODS.map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all"
                  style={{
                    background: period === p ? "var(--cmc-bg)" : "transparent",
                    color: period === p ? "var(--cmc-text)" : "var(--cmc-neutral-5)",
                    boxShadow: period === p ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
                  }}
                >{p}</button>
              ))}
            </div>

            {/* Size mode selector */}
            <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-xl p-0.5 shrink-0">
              {SIZE_MODES.map((m) => (
                <button key={m} onClick={() => setSizeMode(m)}
                  className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all"
                  style={{
                    background: sizeMode === m ? "var(--cmc-bg)" : "transparent",
                    color: sizeMode === m ? "var(--cmc-text)" : "var(--cmc-neutral-5)",
                    boxShadow: sizeMode === m ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
                  }}
                >{m}</button>
              ))}
            </div>

            {/* Category Dropdown */}
            <div className="relative group shrink-0">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="appearance-none bg-black/5 dark:bg-white/5 border border-transparent dark:border-white/5 text-(--cmc-text) text-[11px] font-bold rounded-xl px-3 py-1.5 pr-8 outline-none cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
              >
                {activeCategories.map((cat) => (
                  <option key={cat.key} value={cat.key} className="bg-(--cmc-bg) text-(--cmc-text) py-1">
                    {cat.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-(--cmc-neutral-5)" />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0 pl-3 border-l border-(--cmc-border)">
            {/* Search */}
            <div className="relative group hidden sm:block">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <Search size={14} style={{ color: "var(--cmc-neutral-5)" }} />
              </div>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search coins..."
                className="w-28 lg:w-36 focus:w-48 transition-all duration-300 rounded-xl py-2 pl-8 pr-3 text-xs font-medium outline-none bg-black/5 dark:bg-white/5"
                style={{ color: "var(--cmc-text)", border: "1px solid transparent" }}
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10" style={{ color: "var(--cmc-neutral-5)" }}>
                  <X size={12} />
                </button>
              )}
            </div>
            
            <Link href="/heatmap" className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl transition-all hover:opacity-80" style={{ color: "white", background: "linear-gradient(to right, var(--pf-accent), var(--pf-teal))" }}>
              <Grid3X3 size={13} /> <span className="hidden lg:inline">Heatmap</span>
            </Link>
            
            <button onClick={() => setShowSearch(false)} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-(--cmc-neutral-5) transition-colors">
              <ChevronDown size={14} className="rotate-180" />
            </button>
          </div>
        </div>

        {/* Floating Mini Stats */}
        {!loading && coins.length > 0 && (
          <div className="self-center hidden sm:flex items-center gap-4 px-4 py-1.5 rounded-full backdrop-blur-md text-[10px] font-bold pointer-events-auto shadow-lg"
               style={{ background: isDark ? "rgba(20,20,25,0.6)" : "rgba(255,255,255,0.7)", border: "1px solid var(--cmc-border)", color: "var(--cmc-neutral-5)" }}>
            <span>{stats.total} {bubbleMode === "meme" ? "Meme Coins" : "Assets"}</span>
            <div className="w-1 h-1 rounded-full bg-(--cmc-border)" />
            <span style={{ color: "#16c784" }}>{stats.up} Up</span>
            <span style={{ color: "#ea3943" }}>{stats.down} Down</span>
            <div className="w-1 h-1 rounded-full bg-(--cmc-border)" />
            <span style={{ color: stats.avg >= 0 ? "#16c784" : "#ea3943" }}>Avg {stats.avg >= 0 ? "+" : ""}{stats.avg.toFixed(1)}%</span>
            <div className="w-1 h-1 rounded-full bg-(--cmc-border)" />
            <span className="flex items-center gap-1"><Circle size={8} fill="var(--pf-accent)" stroke="none" /> Click a bubble to pin</span>
          </div>
        )}
      </div>

      {/* Floating Reveal Button */}
      <button 
        onClick={() => setShowSearch(true)} 
        className={`absolute top-4 right-4 z-30 p-3 rounded-2xl backdrop-blur-xl shadow-lg border pointer-events-auto transition-all duration-500 ease-in-out ${showSearch ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
        style={{ background: isDark ? "rgba(20,20,25,0.75)" : "rgba(255,255,255,0.85)", borderColor: "var(--cmc-border)", color: "var(--cmc-text)" }}
      >
        <Filter size={16} />
      </button>

      {/* ─── Bubble canvas ─── */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden"
        onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        style={{ cursor: dragRef.current ? "grabbing" : "default" }}
      >
        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center">
            {[80, 60, 50, 40, 35, 30, 25, 22, 20, 18, 16, 14].map((r, i) => {
              const angle = (i / 12) * Math.PI * 2;
              const dist = 60 + i * 12;
              return (
                <div key={i} className="absolute rounded-full animate-pulse" style={{
                  width: r * 2, height: r * 2,
                  left: `calc(50% + ${Math.cos(angle) * dist}px - ${r}px)`,
                  top: `calc(50% + ${Math.sin(angle) * dist}px - ${r}px)`,
                  background: isDark ? `rgba(255,255,255,${0.04 + (i % 4) * 0.01})` : `rgba(0,0,0,${0.04 + (i % 4) * 0.01})`,
                  animationDelay: `${i * 80}ms`,
                }} />
              );
            })}
          </div>
        )}
        {bubbles.map((b, _bIdx) => {
          const isUp = b.change >= 0;
          const { bg, border } = bubbleMode === "meme" ? getMemeBubbleColor(b.change, isDark) : getBubbleColor(b.change, isDark);
          const isHov = hovered === b.id;
          const isBeingDragged = dragRef.current?.id === b.id;
          const flash = priceFlash[b.id];
          const d = b.r * 2;

          /* Responsive text sizing */
          const showIcon = b.r > 16;
          const showSymbol = b.r > 18;
          const showPct = b.r > 26;
          const showName = b.r > 55;
          const iconSz = Math.round(b.r * (b.r > 50 ? 0.38 : b.r > 32 ? 0.36 : 0.5));
          const symSz = b.r > 55 ? 13 : b.r > 40 ? 11 : b.r > 30 ? 9 : 7;
          const pctSz = b.r > 55 ? 11 : b.r > 40 ? 9.5 : 7.5;
          const nameSz = 8;

          return (
            <div
              key={`${b.id}-${_bIdx}`}
              onClick={(e) => {
                // If it was just a click (not a drag), toggle pinned state
                if (!dragRef.current?.moved) {
                  bubblesRef.current.forEach(bubble => {
                    if (bubble.id === b.id) {
                      bubble.pinned = !bubble.pinned;
                    } else {
                      bubble.pinned = false; // Only one pinned at a time
                    }
                  });
                  setSelected(b);
                }
              }}
              onPointerDown={(e) => onPointerDown(b.id, e)}
              onMouseEnter={() => setHovered(b.id)}
              onMouseLeave={() => setHovered(null)}
              className="absolute flex flex-col items-center justify-center rounded-full select-none"
              style={{
                left: b.x - b.r,
                top: b.y - b.r,
                width: d,
                height: d,
                background: bg,
                border: b.pinned 
                  ? `2.5px solid ${isDark ? "#fff" : "#000"}`
                  : flash
                    ? `2.5px solid ${flash === "up" ? "rgba(22,199,132,0.9)" : "rgba(234,57,67,0.9)"}`
                    : `1.5px solid ${border}`,
                transform: `scale(${isHov ? 1.08 : b.pinned ? 1.1 : flash ? 1.04 : 1})`,
                boxShadow: b.pinned
                  ? `0 0 20px 5px ${isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)"}`
                  : flash
                    ? `0 0 12px 3px ${flash === "up" ? "rgba(22,199,132,0.35)" : "rgba(234,57,67,0.35)"}`
                    : isHov
                      ? `0 0 0 2px ${isUp ? "rgba(22,199,132,0.4)" : "rgba(234,57,67,0.4)"}, 0 8px 25px rgba(0,0,0,0.2)`
                      : "none",
                transition: "transform 0.15s ease, box-shadow 0.2s ease",
                willChange: "transform",
                contain: "layout style paint",
                zIndex: b.pinned ? 200 : isBeingDragged ? 100 : isHov ? 50 : 1,
                cursor: isBeingDragged ? "grabbing" : "pointer",
                touchAction: "none",
              }}
            >
              {showIcon && b.img && (
                <Image src={b.img} alt="" width={iconSz} height={iconSz}
                  className="rounded-full pointer-events-none shrink-0"
                  style={{ opacity: 0.95, marginBottom: showSymbol ? 1 : 0 }}
                  unoptimized draggable={false}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              {showName && (
                <span className="font-medium leading-none pointer-events-none" style={{ fontSize: nameSz, color: "rgba(255,255,255,0.6)", marginBottom: 1 }}>{b.name}</span>
              )}
              {showSymbol && (
                <span className="font-bold leading-none tracking-wide pointer-events-none" style={{ fontSize: symSz, color: "rgba(255,255,255,0.95)" }}>{b.id}</span>
              )}
              {showPct && (
                <span className="font-semibold leading-tight pointer-events-none" style={{ fontSize: pctSz, color: "rgba(255,255,255,0.75)", marginTop: 1 }}>
                  {isUp ? "+" : ""}{b.change.toFixed(1)}%
                </span>
              )}
              {!showIcon && (
                <span className="font-bold leading-none pointer-events-none" style={{ fontSize: Math.max(6, b.r * 0.55), color: "rgba(255,255,255,0.85)" }}>{b.id}</span>
              )}
              {/* Meme mode: source dot badge */}
              {bubbleMode === "meme" && b.source && b.r > 18 && (
                <span className="absolute bottom-[2px] right-[2px] rounded-full pointer-events-none"
                  style={{ width: Math.max(4, b.r * 0.12), height: Math.max(4, b.r * 0.12), background: SOURCE_COLORS[b.source] || "#888", boxShadow: `0 0 4px ${SOURCE_COLORS[b.source] || "#888"}` }} />
              )}
              {/* Meme mode: bonding progress arc (Pump.fun tokens) */}
              {bubbleMode === "meme" && b.bondingProgress != null && b.bondingProgress < 100 && b.r > 20 && (
                <svg className="absolute inset-0 pointer-events-none" width={d} height={d} viewBox={`0 0 ${d} ${d}`}>
                  <circle cx={b.r} cy={b.r} r={b.r - 2} fill="none" stroke="rgba(247,147,26,0.15)" strokeWidth={2} />
                  <circle cx={b.r} cy={b.r} r={b.r - 2} fill="none" stroke="#f7931a" strokeWidth={2}
                    strokeDasharray={`${(b.bondingProgress / 100) * 2 * Math.PI * (b.r - 2)} ${2 * Math.PI * (b.r - 2)}`}
                    strokeLinecap="round" transform={`rotate(-90 ${b.r} ${b.r})`} style={{ filter: "drop-shadow(0 0 3px rgba(247,147,26,0.5))" }} />
                </svg>
              )}
            </div>
          );
        })}

        {/* Hover tooltip */}
        {hovered && !selected && (() => {
          const hb = bubblesRef.current.find((b) => b.id === hovered);
          if (!hb || hb.r < 20) return null;
          const lpData = livePrices[hb.id];
          const lpPrice = lpData ? lpData.price : hb.price;
          const isHUp = hb.change >= 0;
          return (
            <div
              className="absolute z-80 pointer-events-none rounded-xl px-3 py-2 shadow-xl"
              style={{
                left: Math.min(hb.x + hb.r + 8, dims.w - 180),
                top: Math.max(hb.y - 50, 8),
                background: isDark ? "rgba(20,20,26,0.95)" : "rgba(255,255,255,0.95)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                backdropFilter: "blur(12px)",
                minWidth: 150,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs font-bold" style={{ color: isDark ? "#fff" : "#000" }}>{hb.name}</span>
                <span className="text-[9px] font-semibold" style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)" }}>{hb.id}</span>
              </div>
              <div className="text-sm font-bold" style={{ color: isDark ? "#fff" : "#000" }}>
                ${lpPrice >= 1 ? lpPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : lpPrice.toFixed(6)}
              </div>
              {lpData && lpData.confidence > 0 && (
                <div className="text-[9px] font-mono mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                  ± ${lpData.confidence >= 1 ? lpData.confidence.toFixed(2) : lpData.confidence.toFixed(6)}
                </div>
              )}
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-semibold" style={{ color: isHUp ? "#16c784" : "#ea3943" }}>
                  {isHUp ? "+" : ""}{hb.change.toFixed(2)}%
                </span>
                <span className="text-[9px]" style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }}>
                  MCap {hb.mcap >= 1e9 ? `$${(hb.mcap / 1e9).toFixed(1)}B` : hb.mcap >= 1e6 ? `$${(hb.mcap / 1e6).toFixed(0)}M` : `$${(hb.mcap / 1e3).toFixed(0)}K`}
                </span>
              </div>
              {/* Meme-mode extra info */}
              {bubbleMode === "meme" && hb.source && (
                <div className="flex items-center gap-2 mt-1 pt-1" style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}` }}>
                  <span className="flex items-center gap-1 text-[9px] font-bold" style={{ color: SOURCE_COLORS[hb.source] || "#888" }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: SOURCE_COLORS[hb.source] || "#888" }} />
                    {hb.source}
                  </span>
                  {(hb.liquidity ?? 0) > 0 && (
                    <span className="text-[9px]" style={{ color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }}>
                      Liq ${((hb.liquidity ?? 0) / 1e3).toFixed(0)}K
                    </span>
                  )}
                  {hb.bondingProgress != null && hb.bondingProgress < 100 && (
                    <span className="text-[9px] font-bold" style={{ color: "#f7931a" }}>
                      {hb.bondingProgress.toFixed(0)}% bonded
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Period label watermark */}
        <div className="absolute bottom-3 left-4 pointer-events-none select-none" style={{ color: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}>
          <span className="text-6xl font-black tracking-tight">{PERIOD_LABELS[period]}</span>
        </div>

        {/* Pyth attribution */}
        {Object.keys(livePrices).length > 0 && (
          <div className="absolute bottom-3 right-4 flex items-center gap-1.5 text-[9px] pointer-events-none" style={{ color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#16c784" }} />
            Prices powered by <span className="font-bold">Pyth Network</span>
          </div>
        )}

        {/* Detail panel */}
        {selected && <DetailPanel coin={selected} period={period} isDark={isDark} onClose={() => setSelected(null)} livePrices={livePrices} isMemeMode={bubbleMode === "meme"} />}
      </div>
    </div>
  );
}

/* ─────────────── DETAIL PANEL ─────────────── */
function DetailPanel({ coin, period, isDark, onClose, livePrices, isMemeMode }: { coin: Bubble; period: string; isDark: boolean; onClose: () => void; livePrices: Record<string, { price: number; confidence: number }>; isMemeMode?: boolean }) {
  const spark = coin.sparkline.length > 0 ? coin.sparkline : Array.from({ length: 48 }, (_, i) => 50 + Math.sin(i * 0.3) * 10);
  const isUp = coin.change >= 0;
  const color = isUp ? "#16c784" : "#ea3943";
  const liveData = livePrices[coin.id];
  const displayPrice = liveData?.price || coin.price;
  const confidence = liveData?.confidence || 0;

  const fmtK = (v: number) => v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v.toFixed(0)}`;

  return (
    <div className="absolute right-3 top-3 z-90 w-[320px] overflow-hidden rounded-2xl shadow-2xl"
      style={{ background: "var(--cmc-bg)", border: "1px solid var(--cmc-border)" }}
      onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
        {coin.img ? (
          <Image src={coin.img} alt="" width={28} height={28} className="rounded-full" unoptimized
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>{coin.id.charAt(0)}</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold truncate" style={{ color: "var(--cmc-text)" }}>{coin.name}</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>#{coin.rank}</span>
            {isMemeMode && coin.source && (
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${SOURCE_COLORS[coin.source]}20`, color: SOURCE_COLORS[coin.source] }}>{coin.source}</span>
            )}
          </div>
          <span className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>{coin.id}/USD</span>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 transition-colors" style={{ color: "var(--cmc-neutral-5)" }}><X size={16} /></button>
      </div>

      {/* Price row */}
      <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold" style={{ color: "var(--cmc-text)" }}>{displayPrice > 0 ? fmtPrice(displayPrice) : "—"}</span>
            {liveData && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(22,199,132,0.1)", color: "#16c784" }}>
                <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: "#16c784" }} />LIVE
              </span>
            )}
          </div>
          <span className="flex items-center gap-1 text-sm font-semibold" style={{ color }}>
            {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {isUp ? "+" : ""}{coin.change.toFixed(1)}%
          </span>
        </div>
        {confidence > 0 && (
          <div className="mt-1.5 flex items-center justify-between text-[10px]">
            <span style={{ color: "var(--cmc-neutral-5)" }}>Pyth Confidence</span>
            <span className="font-mono" style={{ color: "var(--cmc-neutral-5)" }}>± ${confidence >= 1 ? confidence.toFixed(2) : confidence.toFixed(6)}</span>
          </div>
        )}
        {/* Bonding progress bar for Pump.fun tokens */}
        {isMemeMode && coin.bondingProgress != null && coin.bondingProgress < 100 && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-[9px] mb-1">
              <span className="font-bold" style={{ color: "#f7931a" }}>Bonding Curve</span>
              <span className="font-bold tabular-nums" style={{ color: "#f7931a" }}>{coin.bondingProgress.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(247,147,26,0.12)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${coin.bondingProgress}%`, background: "linear-gradient(90deg, #f7931a, #ffb347)" }} />
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
        <div className="h-[80px]">
          <Sparklines data={spark} width={280} height={80} margin={2} svgWidth={280} svgHeight={80} preserveAspectRatio="none">
            <SparklinesCurve color={color} style={{ fill: "none", strokeWidth: "1.8px" }} />
          </Sparklines>
        </div>
      </div>

      {/* Stats grid */}
      <div className={`grid ${isMemeMode ? "grid-cols-4" : "grid-cols-3"} gap-px`} style={{ background: "var(--cmc-border)" }}>
        {[
          { label: "Market Cap", value: fmtK(coin.mcap) },
          { label: "Volume 24h", value: fmtK(coin.vol24h) },
          ...(isMemeMode ? [{ label: "Liquidity", value: fmtK(coin.liquidity ?? 0) }] : []),
          { label: "Rank", value: `#${coin.rank}` },
        ].map((s) => (
          <div key={s.label} className="flex flex-col items-center py-2.5" style={{ background: "var(--cmc-bg)" }}>
            <span className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>{s.label}</span>
            <span className="text-xs font-bold mt-0.5" style={{ color: "var(--cmc-text)" }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Footer — swap + details */}
      <div className="flex" style={{ borderTop: "1px solid var(--cmc-border)" }}>
        <Link href={isMemeMode ? `/swap?from=SOL&to=${coin.id}` : `/swap?from=${coin.id.toUpperCase()}`}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors"
          style={{ color: "#fff", background: "rgba(153,69,255,0.85)", borderRight: "1px solid var(--cmc-border)" }}
        >
          Swap
        </Link>
        {isMemeMode && coin.mint ? (
          <Link href={`/token/solana/${coin.mint}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors"
            style={{ color: "var(--pf-accent)" }}
          >
            View Details <ExternalLink size={11} />
          </Link>
        ) : (
          <Link href={`/coins/${coin.cgId}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors"
            style={{ color: "var(--pf-accent)" }}
          >
            View Details <ExternalLink size={11} />
          </Link>
        )}
      </div>
    </div>
  );
}
