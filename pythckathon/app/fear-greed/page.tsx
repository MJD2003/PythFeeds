"use client";

import { useState, useEffect, useCallback, useId } from "react";
import { motion } from "motion/react";
import {
  BarChart3, Activity, TrendingUp, Loader2, RefreshCw, Gauge,
  Clock, Info, ArrowUpRight, ArrowDownRight, ChevronRight,
} from "lucide-react";
import { fetchFearGreedHistory, fetchGlobalData, type FearGreedHistoryEntry } from "@/lib/api/backend";
import { fmtB } from "@/lib/format";

interface FearGreedData { value: number; classification: string; timestamp: string; }
interface GlobalData { total_market_cap: number; total_volume: number; btc_dominance: number; eth_dominance: number; market_cap_change_24h: number; active_cryptocurrencies: number; }
interface HistoryItem { label: string; value: number; delta?: number; }

function classify(v: number) {
  if (v <= 20) return { label: "Extreme Fear", color: "#ea3943" };
  if (v <= 40) return { label: "Fear", color: "#ef8c22" };
  if (v <= 60) return { label: "Neutral", color: "#93979f" };
  if (v <= 80) return { label: "Greed", color: "#16c784" };
  return { label: "Extreme Greed", color: "#00d67e" };
}

/* ────── SVG arc helpers (standard SVG: 0°=right, 90°=down, 180°=left, 270°=up) ────── */
function toXY(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = toXY(cx, cy, r, startDeg);
  const e = toXY(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

/* value 0→100 maps to 180°→360° (left → top → right) */
function valToDeg(v: number) { return 180 + (v / 100) * 180; }

/* ────── Smooth Gauge ────── */
const SEGMENTS = [
  { min: 0, max: 20, color: "#ea3943" },
  { min: 20, max: 40, color: "#ef8c22" },
  { min: 40, max: 60, color: "#93979f" },
  { min: 60, max: 80, color: "#16c784" },
  { min: 80, max: 100, color: "#00d67e" },
];

const TICKS = [0, 25, 50, 75, 100];

function SentimentGauge({ value }: { value: number }) {
  const { label, color } = classify(value);
  const [display, setDisplay] = useState(0);
  const uid = useId();

  useEffect(() => {
    let raf: number;
    const t0 = performance.now();
    const dur = 1200;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(ease * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const W = 320;
  const H = 240;
  const CX = W / 2;
  const CY = 150;
  const R = 115;
  const SW = 14;

  const needleDeg = valToDeg(display);
  // SVG native rotation: rotate(angle, cx, cy) — this avoids the CSS transform
  // conflict with framer-motion that was causing the needle to stay at 0
  const needleRotation = needleDeg - 270;

  return (
    <div className="flex flex-col items-center select-none w-full max-w-[360px] mx-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
        <defs>
          <linearGradient id={`${uid}-grad`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ea3943" />
            <stop offset="25%" stopColor="#f5a623" />
            <stop offset="50%" stopColor="#f5d100" />
            <stop offset="75%" stopColor="#93c648" />
            <stop offset="100%" stopColor="#16c784" />
          </linearGradient>
          <filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Background track */}
        <path d={arc(CX, CY, R, 180, 360)} fill="none" stroke="var(--cmc-neutral-2)" strokeWidth={SW} strokeLinecap="round" />

        {/* Colorful gradient track */}
        <path d={arc(CX, CY, R, 180, 360)} fill="none" stroke={`url(#${uid}-grad)`} strokeWidth={SW} strokeLinecap="round" />

        {/* Tick marks */}
        {TICKS.map((t) => {
          const tDeg = valToDeg(t);
          const p1 = toXY(CX, CY, R - SW / 2 - 4, tDeg);
          const p2 = toXY(CX, CY, R - SW / 2 - 12, tDeg);
          return (
            <line key={`tick-${t}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="var(--cmc-neutral-4)" strokeWidth={2} strokeLinecap="round" />
          );
        })}

        {/* Tick labels */}
        {TICKS.map((t) => {
          const p = toXY(CX, CY, R + 26, valToDeg(t));
          return (
            <text key={t} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
              fill="var(--cmc-neutral-5)" fontSize={11} fontWeight={600} fontFamily="var(--font-inter), system-ui, sans-serif">
              {t}
            </text>
          );
        })}

        {/* Needle — uses SVG native transform to avoid framer-motion conflict */}
        <g transform={`rotate(${needleRotation}, ${CX}, ${CY})`}>
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.4 }}>
            <path d={`M ${CX - 5} ${CY} L ${CX + 5} ${CY} L ${CX + 1.5} ${CY - R + 20} L ${CX - 1.5} ${CY - R + 20} Z`} fill="var(--cmc-text)" filter={`url(#${uid}-shadow)`} />
            <circle cx={CX} cy={CY} r="8" fill="var(--cmc-text)" filter={`url(#${uid}-shadow)`} />
            <circle cx={CX} cy={CY} r="3" fill="var(--cmc-bg)" />
          </motion.g>
        </g>

        {/* Value + label below the needle */}
        <motion.text x={CX} y={CY + 40} textAnchor="middle" dominantBaseline="central"
          fill="var(--cmc-text)" fontSize={46} fontWeight={800} fontFamily="var(--font-inter), system-ui, sans-serif"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          {display}
        </motion.text>
        <motion.text x={CX} y={CY + 70} textAnchor="middle" dominantBaseline="central"
          fill={color} fontSize={14} fontWeight={700} letterSpacing={1}
          style={{ textTransform: "uppercase" }}
          fontFamily="var(--font-inter), system-ui, sans-serif"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
          {label}
        </motion.text>
      </svg>
    </div>
  );
}

/* ────── Sparkline ────── */
function Sparkline({ data, height = 120 }: { data: number[]; height?: number }) {
  const uid = useId();
  const [hover, setHover] = useState<number | null>(null);
  if (data.length < 2) return null;

  const w = 560;
  const pad = 6;
  const mn = Math.min(...data);
  const mx = Math.max(...data);
  const rng = mx - mn || 1;
  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (w - 2 * pad),
    y: pad + (1 - (v - mn) / rng) * (height - 2 * pad),
    v,
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${line} L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z`;
  const last = data[data.length - 1];
  const { color } = classify(last);

  return (
    <div className="relative">
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * w;
          const closest = pts.reduce((best, p, i) => Math.abs(p.x - x) < Math.abs(pts[best].x - x) ? i : best, 0);
          setHover(closest);
        }}
        onMouseLeave={() => setHover(null)}
        className="cursor-crosshair"
      >
        <defs>
          <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.15} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${uid}-g)`} />
        <motion.path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeOut" }} />
        {hover !== null && (
          <>
            <line x1={pts[hover].x} y1={0} x2={pts[hover].x} y2={height} stroke="var(--cmc-neutral-4)" strokeWidth={1} strokeDasharray="3,3" />
            <circle cx={pts[hover].x} cy={pts[hover].y} r={4} fill={color} stroke="var(--cmc-bg)" strokeWidth={2} />
          </>
        )}
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={3.5} fill={color} />
      </svg>
      {hover !== null && (
        <div className="absolute top-0 pointer-events-none px-2 py-1 rounded-lg text-[10px] font-semibold"
          style={{
            left: `${(pts[hover].x / w) * 100}%`,
            transform: "translateX(-50%)",
            background: "var(--cmc-neutral-2)",
            color: classify(pts[hover].v).color,
            border: "1px solid var(--cmc-border)",
          }}>
          {pts[hover].v} · {data.length - 1 - hover}d ago
        </div>
      )}
    </div>
  );
}

/* ────── Stat Card ────── */
function StatCard({ label, value, sub, icon, color, i = 0 }: { label: string; value: string; sub?: string; icon: React.ReactNode; color: string; i?: number }) {
  return (
    <motion.div className="rounded-xl p-4 group hover:scale-[1.02] transition-transform duration-200 cursor-default" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.06 }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg" style={{ background: color + "14", color }}>{icon}</div>
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>{label}</span>
      </div>
      <p className="text-xl font-bold tabular-nums" style={{ color: "var(--cmc-text)" }}>{value}</p>
      {sub && (
        <div className="flex items-center gap-1 mt-0.5">
          {sub.startsWith("+") ? <ArrowUpRight size={11} style={{ color: "#16c784" }} /> : sub.startsWith("-") ? <ArrowDownRight size={11} style={{ color: "#ea3943" }} /> : null}
          <span className="text-[11px] font-semibold" style={{ color: sub.startsWith("+") ? "#16c784" : sub.startsWith("-") ? "#ea3943" : "var(--cmc-neutral-5)" }}>{sub}</span>
        </div>
      )}
    </motion.div>
  );
}

/* ────── Dominance ────── */
function DominanceSection({ btc, eth }: { btc: number; eth: number }) {
  const other = Math.max(0, 100 - btc - eth);
  const items = [
    { label: "Bitcoin", pct: btc, color: "#f7931a" },
    { label: "Ethereum", pct: eth, color: "#627eea" },
    { label: "Others", pct: other, color: "var(--cmc-neutral-4)" },
  ];
  return (
    <motion.div className="rounded-xl p-4" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--cmc-neutral-5)" }}>Market Dominance</p>
      <div className="flex rounded-lg overflow-hidden h-6 mb-3 gap-px">
        {items.map((s) => (
          <motion.div key={s.label} className="flex items-center justify-center text-[9px] font-bold text-white"
            style={{ background: s.color }} initial={{ width: 0 }} animate={{ width: `${s.pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.6 }}>
            {s.pct > 8 && `${s.pct.toFixed(1)}%`}
          </motion.div>
        ))}
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        {items.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="text-[11px] font-semibold" style={{ color: "var(--cmc-text)" }}>{s.label}</span>
            <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════ */
export default function FearGreedPage() {
  const [fgData, setFgData] = useState<FearGreedData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [series, setSeries] = useState<number[]>([]);
  const [global, setGlobal] = useState<GlobalData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [fgEntries, glRes] = await Promise.all([
        fetchFearGreedHistory(31),
        fetchGlobalData(),
      ]);
      if (fgEntries?.length) {
        const cur = fgEntries[0].value;
        const yd = fgEntries[1] ? fgEntries[1].value : cur;
        const wk = fgEntries[7] ? fgEntries[7].value : cur;
        const mo = fgEntries[30] ? fgEntries[30].value : cur;
        setFgData({ value: cur, classification: fgEntries[0].classification, timestamp: fgEntries[0].timestamp });
        setHistory([
          { label: "Now", value: cur },
          { label: "Yesterday", value: yd, delta: cur - yd },
          { label: "Last Week", value: wk, delta: cur - wk },
          { label: "Last Month", value: mo, delta: cur - mo },
        ]);
        setSeries(fgEntries.slice(0, 30).map((d: FearGreedHistoryEntry) => d.value).reverse());
      }
      if (glRes?.data) {
        const d = glRes.data;
        setGlobal({
          total_market_cap: d.total_market_cap?.usd || 0,
          total_volume: d.total_volume?.usd || 0,
          btc_dominance: d.market_cap_percentage?.btc || 0,
          eth_dominance: d.market_cap_percentage?.eth || 0,
          market_cap_change_24h: 0,
          active_cryptocurrencies: d.active_cryptocurrencies || 0,
        });
      }
    } catch (err) { console.error("Fetch error:", err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1060px] px-4 py-24 flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--cmc-neutral-4)" }} />
        <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>Loading market sentiment…</p>
      </div>
    );
  }

  const guide = [
    { range: "0–20", label: "Extreme Fear", color: "#ea3943", desc: "Investors are very worried — potential buying opportunity." },
    { range: "21–40", label: "Fear", color: "#ef8c22", desc: "Market uncertainty is rising. Proceed with caution." },
    { range: "41–60", label: "Neutral", color: "#93979f", desc: "Market is balanced — no strong directional signal." },
    { range: "61–80", label: "Greed", color: "#16c784", desc: "Optimism is growing. Watch for signs of overheating." },
    { range: "81–100", label: "Extreme Greed", color: "#00d67e", desc: "FOMO territory — corrections may follow historically." },
  ];

  return (
    <div className="mx-auto max-w-[1060px] px-4 py-6 space-y-6">

      {/* ── Header ── */}
      <motion.div className="flex items-center justify-between" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight mb-1" style={{ color: "var(--cmc-text)" }}>Fear & Greed Index</h1>
          <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>Crypto market sentiment · Alternative.me + CoinGecko</p>
        </div>
        <button onClick={fetchData} className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5" style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-neutral-5)" }}>
          <RefreshCw size={14} />
        </button>
      </motion.div>

      {/* ── Hero row: Gauge | Historical | Sparkline ── */}
      {fgData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Gauge */}
          <motion.div className="lg:col-span-4 rounded-xl p-5 flex flex-col items-center justify-center relative overflow-hidden"
            style={{ background: "var(--cmc-neutral-1)", borderTop: `2px solid ${classify(fgData.value).color}`, borderLeft: "1px solid var(--cmc-border)", borderRight: "1px solid var(--cmc-border)", borderBottom: "1px solid var(--cmc-border)" }}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="absolute inset-0 opacity-[0.06]" style={{ background: `radial-gradient(circle at 50% 20%, ${classify(fgData.value).color}, transparent 65%)` }} />
            <SentimentGauge value={fgData.value} />
            <div className="flex items-center gap-2 mt-1">
              <Clock size={10} style={{ color: "var(--cmc-neutral-5)" }} />
              <p className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>
                {new Date(parseInt(fgData.timestamp) * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </motion.div>

          {/* Right column */}
          <div className="lg:col-span-8 flex flex-col gap-4">

            {/* History row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {history.map((h, i) => {
                const c = classify(h.value);
                const isFirst = i === 0;
                return (
                  <motion.div key={h.label} className="rounded-xl p-3 relative overflow-hidden hover:scale-[1.02] transition-transform duration-200 cursor-default"
                    style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}
                    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                    <div className="absolute top-0 left-0 h-[2px]" style={{ background: c.color, width: `${h.value}%`, opacity: 0.7 }} />
                    <p className="text-[9px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--cmc-neutral-5)" }}>{h.label}</p>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: c.color }}>{h.value}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[9px] font-medium" style={{ color: c.color }}>{c.label}</span>
                      {!isFirst && h.delta !== undefined && h.delta !== 0 && (
                        <span className="text-[9px] font-semibold tabular-nums px-1.5 py-0.5 rounded" style={{ color: h.delta > 0 ? "#16c784" : "#ea3943", background: h.delta > 0 ? "rgba(22,199,132,0.1)" : "rgba(234,57,67,0.1)" }}>
                          {h.delta > 0 ? "+" : ""}{h.delta}
                        </span>
                      )}
                    </div>
                    {/* Mini progress bar */}
                    <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "var(--cmc-neutral-2)" }}>
                      <motion.div className="h-full rounded-full" style={{ background: c.color }} initial={{ width: 0 }} animate={{ width: `${h.value}%` }} transition={{ duration: 0.8, delay: 0.2 + i * 0.06, ease: "easeOut" }} />
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Sparkline */}
            {series.length > 0 && (
              <motion.div className="flex-1 rounded-xl p-4 min-h-[150px]"
                style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>30-Day Trend</span>
                  <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>Hover for details</span>
                </div>
                <Sparkline data={series} height={115} />
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* ── Global Market ── */}
      {global && (
        <div className="space-y-4">
          <motion.p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>Global Market</motion.p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Market Cap" value={fmtB(global.total_market_cap)}
              sub={`${global.market_cap_change_24h >= 0 ? "+" : ""}${global.market_cap_change_24h.toFixed(2)}% 24h`}
              icon={<BarChart3 size={14} />} color={global.market_cap_change_24h >= 0 ? "#16c784" : "#ea3943"} i={0} />
            <StatCard label="24h Volume" value={fmtB(global.total_volume)} icon={<Activity size={14} />} color="var(--pf-accent)" i={1} />
            <StatCard label="BTC Dominance" value={`${global.btc_dominance.toFixed(1)}%`} icon={<TrendingUp size={14} />} color="#f7931a" i={2} />
            <StatCard label="Active Coins" value={global.active_cryptocurrencies.toLocaleString()} icon={<Gauge size={14} />} color="var(--pf-accent)" i={3} />
          </div>
          <DominanceSection btc={global.btc_dominance} eth={global.eth_dominance} />
        </div>
      )}

      {/* ── Sentiment Guide ── */}
      <motion.div className="rounded-xl p-5" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <div className="flex items-center gap-1.5 mb-4">
          <Info size={12} style={{ color: "var(--cmc-neutral-5)" }} />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>How to Read the Index</span>
        </div>
        {/* Full-width color bar */}
        <div className="flex rounded-lg overflow-hidden h-2.5 mb-5">
          {guide.map((g) => (
            <div key={g.range} className="flex-1" style={{ background: g.color }} />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {guide.map((g, i) => (
            <motion.div key={g.range} className="rounded-lg p-3 relative overflow-hidden"
              style={{ background: "var(--cmc-neutral-2)", borderLeft: `3px solid ${g.color}` }}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.65 + i * 0.05 }}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-bold tabular-nums" style={{ color: g.color }}>{g.range}</span>
              </div>
              <p className="text-xs font-bold mb-0.5" style={{ color: g.color }}>{g.label}</p>
              <p className="text-[10px] leading-relaxed" style={{ color: "var(--cmc-neutral-5)" }}>{g.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
