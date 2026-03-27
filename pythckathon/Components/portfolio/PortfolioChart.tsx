"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { LineChart } from "@mui/x-charts/LineChart";
import { PieChart as MuiPieChart } from "@mui/x-charts/PieChart";
import { BarChart3, PieChart, Loader2 } from "lucide-react";
import { fetchCoinChart } from "@/lib/api/backend";
import type { Snapshot } from "@/lib/portfolio-history";
import { useResolvedColors } from "@/lib/hooks/useResolvedColors";
import { fmtCurrency as fmtUsd } from "@/lib/format";

const COLORS = [
  "#6366f1",
  "#818cf8",
  "#a5b4fc",
  "#94a3b8",
  "#64748b",
  "#475569",
  "#6b7280",
  "#a78bfa",
];

/**
 * Normalize benchmark price series to match portfolio chart data points.
 * Aligns timestamps, then scales so benchmark[0] = portfolio[0].
 */
function normalizeBenchmark(
  chartData: { label: string; value: number }[],
  rawPrices: number[][], // [timestamp_ms, price][]
  snapshots: Snapshot[],
  period: "1W" | "1M" | "3M"
): number[] {
  if (chartData.length < 2 || rawPrices.length < 2) return [];

  const now = Date.now();
  const msMap = { "1W": 7 * 86400000, "1M": 30 * 86400000, "3M": 90 * 86400000 };
  const cutoff = now - msMap[period];

  // Filter snapshots for the period (same logic as chartData)
  const filtered = snapshots.filter((s) => s.t >= cutoff);
  const src = filtered.length >= 2 ? filtered : snapshots;

  // For each portfolio snapshot timestamp, find the closest benchmark price
  const portfolioStart = chartData[0].value || 1;
  const sortedBenchmark = rawPrices.sort((a, b) => a[0] - b[0]);

  // Binary search helper
  const findClosest = (ts: number): number => {
    let lo = 0, hi = sortedBenchmark.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (sortedBenchmark[mid][0] < ts) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0 && Math.abs(sortedBenchmark[lo - 1][0] - ts) < Math.abs(sortedBenchmark[lo][0] - ts)) {
      return sortedBenchmark[lo - 1][1];
    }
    return sortedBenchmark[lo][1];
  };

  const benchmarkStartPrice = findClosest(src[0]?.t ?? cutoff);
  if (benchmarkStartPrice <= 0) return [];

  return src.map((snap) => {
    const bmPrice = findClosest(snap.t);
    // Scale: benchmark performance applied to portfolio start value
    return Math.round((portfolioStart * (bmPrice / benchmarkStartPrice)) * 100) / 100;
  });
}

export interface TokenAllocation {
  symbol: string;
  value: number;
  logo?: string;
  apy?: number;
}

type TabMode = "chart" | "breakdown";
type TimePeriod = "1W" | "1M" | "3M";


export interface PlatformAllocation {
  name: string;
  value: number;
  icon?: string;
}

interface PortfolioChartProps {
  totalValue: number;
  allocations: TokenAllocation[];
  platformAllocations: PlatformAllocation[];
  tokenCount: number;
  snapshots: Snapshot[];
}

export default function PortfolioChart({
  totalValue,
  allocations,
  platformAllocations,
  tokenCount,
  snapshots,
}: PortfolioChartProps) {
  const [tab, setTab] = useState<TabMode>("chart");
  const [period, setPeriod] = useState<TimePeriod>("3M");
  const [breakdownView, setBreakdownView] = useState<"tokens" | "platforms">(
    "tokens"
  );
  const [showBenchmark, setShowBenchmark] = useState<"none" | "BTC" | "SOL">("none");
  const [benchmarkData, setBenchmarkData] = useState<number[] | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const benchmarkCacheRef = useMemo(() => ({ BTC: null as number[][] | null, SOL: null as number[][] | null }), []);

  // M8: Theme detection for chart axis colors + resolved colors for MUI
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  const axisColor = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.5)";
  const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";

  // Resolve CSS variables to hex for MUI Charts (which can't parse var())
  const resolvedColors = useResolvedColors(["--pf-up", "--pf-accent"]);
  const chartGreen = resolvedColors["--pf-up"] || (isDark ? "#00E59B" : "#00D18C");
  const chartAccent = resolvedColors["--pf-accent"] || (isDark ? "#8B5CF6" : "#7B3FE4");

  const chartData = useMemo(() => {
    const fmtDate = (ts: number) => {
      const d = new Date(ts);
      const now = new Date();
      const diffMs = now.getTime() - ts;
      if (diffMs < 86400000 && d.getDate() === now.getDate()) {
        return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      }
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    if (snapshots.length >= 2) {
      const now = Date.now();
      const msMap: Record<TimePeriod, number> = { "1W": 7 * 86400000, "1M": 30 * 86400000, "3M": 90 * 86400000 };
      const cutoff = now - msMap[period];
      const filtered = snapshots.filter((s) => s.t >= cutoff);
      const src = filtered.length >= 2 ? filtered : snapshots;
      return src.map((s) => ({
        label: fmtDate(s.t),
        value: Math.round(s.v * 100) / 100,
      }));
    }
    if (totalValue > 0) {
      return [{ label: fmtDate(Date.now()), value: totalValue }];
    }
    return [];
  }, [snapshots, totalValue, period]);

  // Fetch real benchmark data when benchmark mode or period changes
  useEffect(() => {
    if (showBenchmark === "none" || chartData.length < 2) {
      setBenchmarkData(null);
      return;
    }
    const coinId = showBenchmark === "BTC" ? "bitcoin" : "solana";
    const daysMap: Record<TimePeriod, number> = { "1W": 7, "1M": 30, "3M": 90 };
    const days = daysMap[period];

    const cached = benchmarkCacheRef[showBenchmark];
    if (cached) {
      // Normalize cached data against portfolio
      const normalized = normalizeBenchmark(chartData, cached, snapshots, period);
      setBenchmarkData(normalized);
      return;
    }

    setBenchmarkLoading(true);
    fetchCoinChart(coinId, days)
      .then((data) => {
        if (data?.prices && data.prices.length > 0) {
          benchmarkCacheRef[showBenchmark] = data.prices;
          const normalized = normalizeBenchmark(chartData, data.prices, snapshots, period);
          setBenchmarkData(normalized);
        } else {
          setBenchmarkData(null);
        }
      })
      .catch(() => setBenchmarkData(null))
      .finally(() => setBenchmarkLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBenchmark, period, chartData.length]);

  const totalAlloc = allocations.reduce((s, a) => s + a.value, 0);
  const allocWithPct = allocations
    .map((a, i) => ({
      ...a,
      pct: totalAlloc > 0 ? (a.value / totalAlloc) * 100 : 0,
      color: COLORS[i % COLORS.length],
    }))
    .sort((a, b) => b.pct - a.pct);

  const totalPlatformAlloc = platformAllocations.reduce((s, a) => s + a.value, 0);
  const platformsWithPct = platformAllocations
    .map((a, i) => ({
      ...a,
      symbol: a.name,
      logo: a.icon,
      pct: totalPlatformAlloc > 0 ? (a.value / totalPlatformAlloc) * 100 : 0,
      color: COLORS[i % COLORS.length],
    }))
    .sort((a, b) => b.pct - a.pct);

  const breakdownItems = breakdownView === "tokens" ? allocWithPct : platformsWithPct;
  const breakdownLabel = breakdownView === "tokens"
    ? `${tokenCount} token${tokenCount !== 1 ? "s" : ""} detected`
    : `${platformsWithPct.length} platform${platformsWithPct.length !== 1 ? "s" : ""} detected`;

  // Pie data for MUI
  const pieData = useMemo(() => {
    const top = breakdownItems.slice(0, 7);
    const rest = breakdownItems.slice(7);
    const items = top.map((a, i) => ({
      id: i,
      value: a.value,
      label: a.symbol,
      color: a.color,
    }));
    if (rest.length > 0) {
      items.push({
        id: 99,
        value: rest.reduce((s, a) => s + a.value, 0),
        label: `Others (${rest.length})`,
        color: "#475569",
      });
    }
    return items;
  }, [breakdownItems]);

  const tabs: { mode: TabMode; icon: React.ReactNode; label: string }[] = [
    { mode: "chart", icon: <BarChart3 size={13} />, label: "Chart" },
    { mode: "breakdown", icon: <PieChart size={13} />, label: "Allocation" },
  ];

  return (
    <div
      className="rounded-2xl h-full flex flex-col min-h-[340px] overflow-hidden"
      style={{
        background: "var(--cmc-neutral-1)",
        border: "1px solid var(--cmc-border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      {/* Tab header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div
          className="flex items-center gap-0.5 rounded-full p-1"
          style={{ background: "var(--cmc-neutral-2)" }}
        >
          {tabs.map((t) => (
            <button
              key={t.mode}
              onClick={() => setTab(t.mode)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all"
              style={{
                background: tab === t.mode ? "var(--cmc-bg)" : "transparent",
                color: tab === t.mode ? "var(--cmc-text)" : "var(--cmc-neutral-5)",
              }}
            >
              {t.icon}
              {tab === t.mode && <span>{t.label}</span>}
            </button>
          ))}
        </div>
        {tab === "chart" && (
          <>
            <div className="flex items-center gap-1">
              {(["1W", "1M", "3M"] as TimePeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                  style={{
                    background: period === p ? "var(--pf-accent)" : "transparent",
                    color: period === p ? "#fff" : "var(--cmc-neutral-5)",
                    boxShadow: period === p ? "0 2px 8px rgba(139,92,246,0.2)" : "none",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 ml-2">
              {(["none", "BTC", "SOL"] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setShowBenchmark(b)}
                  className="px-2 py-1 rounded-full text-[10px] font-semibold transition-all"
                  style={{
                    background: showBenchmark === b ? (b === "BTC" ? "#f7931a" : b === "SOL" ? "var(--pf-accent)" : "var(--cmc-neutral-2)") : "transparent",
                    color: showBenchmark === b ? (b === "none" ? "var(--cmc-text)" : "#fff") : "var(--cmc-neutral-5)",
                  }}
                >
                  {b === "none" ? "Solo" : `vs ${b}`}
                </button>
              ))}
              {benchmarkLoading && <Loader2 size={10} className="animate-spin ml-1" style={{ color: "var(--cmc-neutral-5)" }} />}
            </div>
          </>
        )}
        {tab === "breakdown" && (
          <div className="flex items-center gap-1 rounded-full p-0.5" style={{ border: "1px solid var(--cmc-border)" }}>
            {(["tokens", "platforms"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setBreakdownView(v)}
                className="px-3 py-1 rounded-full text-[11px] font-semibold capitalize transition-all"
                style={{
                  background: breakdownView === v ? "var(--cmc-bg)" : "transparent",
                  color: breakdownView === v ? "var(--cmc-text)" : "var(--cmc-neutral-5)",
                }}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Chart Tab — MUI LineChart ── */}
      {tab === "chart" && (
        <div className="flex-1 px-1 pb-2 min-h-[220px]">
          {chartData.length >= 2 ? (
            <LineChart
              xAxis={[{
                data: chartData.map((_, i) => i),
                scaleType: "point",
                valueFormatter: (v: number) => chartData[v]?.label ?? "",
                tickLabelStyle: { fontSize: 10, fill: axisColor },
              }]}
              yAxis={[{
                valueFormatter: (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`,
                tickLabelStyle: { fontSize: 9, fill: axisColor },
              }]}
              series={[
                {
                  data: chartData.map((d) => d.value),
                  area: true,
                  color: chartGreen,
                  showMark: false,
                  label: "Portfolio",
                  valueFormatter: (v) => v !== null ? fmtUsd(v) : "",
                },
                ...(showBenchmark !== "none" && benchmarkData && benchmarkData.length === chartData.length ? [{
                  data: benchmarkData,
                  color: showBenchmark === "BTC" ? "#f7931a" : chartAccent,
                  showMark: false,
                  label: showBenchmark,
                  valueFormatter: (v: number | null) => v !== null ? fmtUsd(v) : "",
                }] : []),
              ]}
              height={260}
              margin={{ top: 10, right: 12, bottom: 24, left: 50 }}
              hideLegend
              sx={{
                "& .MuiLineElement-root": { strokeWidth: 2 },
                "& .MuiAreaElement-root": { fillOpacity: 0.06 },
                "& .MuiChartsAxis-line": { stroke: "transparent" },
                "& .MuiChartsAxis-tick": { stroke: "transparent" },
                "& .MuiChartsGrid-line": { stroke: gridColor },
              }}
            />
          ) : (
            <div className="h-[260px] flex items-center justify-center">
              <div className="text-center">
                <p className="text-xs font-medium" style={{ color: "var(--cmc-neutral-5)" }}>
                  Chart builds over time
                </p>
                <p className="text-[10px] mt-1" style={{ color: "var(--cmc-neutral-4)" }}>
                  Portfolio snapshots are recorded on each visit
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Breakdown Tab — MUI PieChart + legend ── */}
      {tab === "breakdown" && (
        <div className="flex-1 px-4 pb-4 flex flex-col">
          {pieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="shrink-0" style={{ width: 160, height: 160 }}>
                <MuiPieChart
                  series={[{
                    data: pieData,
                    innerRadius: 40,
                    outerRadius: 72,
                    paddingAngle: 2,
                    cornerRadius: 4,
                    highlightScope: { fade: "global", highlight: "item" },
                    valueFormatter: (v) => fmtUsd(v.value),
                  }]}
                  width={160}
                  height={160}
                  margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                  hideLegend
                  sx={{
                    "& .MuiPieArc-root": { strokeWidth: 0 },
                  }}
                />
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                {breakdownItems.slice(0, 6).map((a) => (
                  <div key={a.symbol} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: a.color }} />
                    <span className="text-[11px] font-medium truncate" style={{ color: "var(--cmc-text)" }}>
                      {a.symbol}
                    </span>
                    <span className="text-[10px] ml-auto shrink-0" style={{ color: "var(--cmc-neutral-5)" }}>
                      {a.pct.toFixed(1)}%
                    </span>
                  </div>
                ))}
                {breakdownItems.length > 6 && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "#475569" }} />
                    <span className="text-[11px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>
                      Others ({breakdownItems.length - 6})
                    </span>
                    <span className="text-[10px] ml-auto" style={{ color: "var(--cmc-neutral-5)" }}>
                      {breakdownItems.slice(6).reduce((s, a) => s + a.pct, 0).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>No allocation data</p>
            </div>
          )}
          <p className="text-[10px] mt-auto pt-3" style={{ color: "var(--cmc-neutral-5)" }}>
            {breakdownLabel}
          </p>
        </div>
      )}
    </div>
  );
}
