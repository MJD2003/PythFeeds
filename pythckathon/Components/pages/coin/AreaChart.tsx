"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, AreaData, Time, AreaSeries, LineSeries } from "lightweight-charts";
import { useIsDarkMode } from "@/lib/theme-client";

interface AreaChartProps {
  symbol: string;
  coinId?: string;
  interval?: string;
  currentPrice?: number;
  compareId?: string;
  compareSymbol?: string;
  dataMode?: "Price" | "Market cap";
}

function intervalToDays(interval: string): number {
  switch (interval) {
    case "1D": return 1;
    case "7D": return 7;
    case "1M": return 30;
    case "3M": return 90;
    case "1Y": return 365;
    case "ALL": return "max" as unknown as number;
    default: return 7;
  }
}

// Auto-detect precision based on price magnitude
function pricePrecision(price: number): number {
  if (price >= 10000) return 0;
  if (price >= 100) return 2;
  if (price >= 1) return 3;
  if (price >= 0.01) return 5;
  if (price >= 0.0001) return 6;
  return 8;
}

// Client-side cache to avoid 429 rate limits from CoinGecko
const chartCache = new Map<string, { data: AreaData<Time>[]; ts: number }>();
const CACHE_TTL = 120_000; // 2 minutes

async function fetchChartData(id: string, interval: string, fallbackPrice: number, mode: "Price" | "Market cap" = "Price"): Promise<AreaData<Time>[]> {
  const days = intervalToDays(interval);
  const daysParam = days === ("max" as unknown as number) ? "max" : days;
  const modeKey = mode === "Market cap" ? "mcap" : "price";
  const cacheKey = `${id}_${daysParam}_${modeKey}`;
  const cached = chartCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  try {
    const res = await fetch(`/api/cryptoserve/coins/${id}/chart?days=${daysParam}`);
    if (!res.ok) throw new Error(`Failed ${res.status}`);
    const json = await res.json();
    const source = mode === "Market cap" && json?.market_caps && Array.isArray(json.market_caps) && json.market_caps.length > 0
      ? json.market_caps
      : json?.prices;
    if (source && Array.isArray(source) && source.length > 0) {
      const seen = new Set<number>();
      const mapped: AreaData<Time>[] = [];
      for (const p of source) {
        const t = Math.floor(p[0] / 1000);
        if (!seen.has(t)) {
          seen.add(t);
          mapped.push({ time: t as Time, value: p[1] });
        }
      }
      mapped.sort((a, b) => (a.time as number) - (b.time as number));
      if (mapped.length > 0) {
        chartCache.set(cacheKey, { data: mapped, ts: Date.now() });
        return mapped;
      }
    }
  } catch {
    // API failed — try stale cache, then sparkline fallback
  }
  if (cached) return cached.data;
  return [];
}

export default function AreaChart({ symbol, coinId, interval = "1D", currentPrice = 0, compareId, compareSymbol, dataMode = "Price" }: AreaChartProps) {
  const chartId = coinId || symbol;
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const isDark = useIsDarkMode();
  const [noData, setNoData] = useState(false);
  const [legend, setLegend] = useState<{ primary: string; compare: string } | null>(null);
  const isComparing = !!compareId;

  useEffect(() => {
    if (!containerRef.current) return;
    setNoData(false);

    // Cleanup previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Resolve actual theme background from CSS variables for correct degen/standard mode
    const computed = getComputedStyle(document.documentElement);
    const bgColor = computed.getPropertyValue("--cmc-neutral-1").trim() || (isDark ? "#17171a" : "#ffffff");
    const textColor = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
    const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";

    const precision = pricePrecision(currentPrice || 1);

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 11,
      },
      width: containerRef.current.clientWidth,
      height: 420,
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      rightPriceScale: {
        borderColor: gridColor,
      },
      timeScale: {
        borderColor: gridColor,
        timeVisible: interval === "1D" || interval === "7D",
        secondsVisible: interval === "1D",
      },
      crosshair: {
        horzLine: {
          color: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
          labelBackgroundColor: isDark ? "#333" : "#555",
        },
        vertLine: {
          color: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
          labelBackgroundColor: isDark ? "#333" : "#555",
        },
      },
      localization: {
        priceFormatter: (price: number) => {
          const p = pricePrecision(price);
          return price.toFixed(p);
        },
      },
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      topColor: "rgba(22, 199, 132, 0.4)",
      bottomColor: "rgba(22, 199, 132, 0.02)",
      lineColor: "#16c784",
      lineWidth: 2,
      crosshairMarkerBackgroundColor: "#16c784",
      crosshairMarkerBorderColor: "#fff",
      crosshairMarkerBorderWidth: 2,
      crosshairMarkerRadius: 5,
      priceFormat: {
        type: "price" as const,
        precision,
        minMove: 1 / Math.pow(10, precision),
      },
    });

    chartRef.current = chart;

    // Fetch real data async
    (async () => {
      const data = await fetchChartData(chartId, interval, currentPrice, dataMode);
      if (!chartRef.current) return;

      if (data.length === 0) {
        setNoData(true);
        return;
      }

      // ── Compare mode: normalize to % change ──
      if (isComparing && compareId) {
        const compareData = await fetchChartData(compareId, interval, 0);
        if (!chartRef.current) return;

        // Normalize both to percentage change from first data point
        const normalizeToPct = (d: AreaData<Time>[]): AreaData<Time>[] => {
          if (d.length === 0) return [];
          const base = d[0].value;
          if (base === 0) return d;
          return d.map(pt => ({ time: pt.time, value: ((pt.value - base) / base) * 100 }));
        };

        const pctPrimary = normalizeToPct(data);
        const pctCompare = normalizeToPct(compareData);

        // Switch to percentage formatting — use high-contrast resolved colors
        const primaryColor = "#3B82F6"; // bright blue
        const compareColor = "#F59E0B"; // amber/gold — max contrast vs blue
        areaSeries.applyOptions({
          topColor: "rgba(59, 130, 246, 0.25)",
          bottomColor: "rgba(59, 130, 246, 0.02)",
          lineColor: primaryColor,
          crosshairMarkerBackgroundColor: primaryColor,
          priceFormat: { type: "price" as const, precision: 2, minMove: 0.01 },
        });
        areaSeries.setData(pctPrimary);

        // Add compare line series — amber for maximum distinction
        const compareSeries = chart.addSeries(LineSeries, {
          color: compareColor,
          lineWidth: 3,
          crosshairMarkerBackgroundColor: compareColor,
          crosshairMarkerBorderColor: "#fff",
          crosshairMarkerBorderWidth: 2,
          crosshairMarkerRadius: 4,
          priceFormat: { type: "price" as const, precision: 2, minMove: 0.01 },
        });
        compareSeries.setData(pctCompare);

        // Update legend
        const primaryLast = pctPrimary.length > 0 ? pctPrimary[pctPrimary.length - 1].value : 0;
        const compareLast = pctCompare.length > 0 ? pctCompare[pctCompare.length - 1].value : 0;
        setLegend({
          primary: `${symbol.toUpperCase()} ${primaryLast >= 0 ? "+" : ""}${primaryLast.toFixed(2)}%`,
          compare: `${compareSymbol?.toUpperCase()} ${compareLast >= 0 ? "+" : ""}${compareLast.toFixed(2)}%`,
        });

        chart.applyOptions({
          localization: {
            priceFormatter: (price: number) => `${price >= 0 ? "+" : ""}${price.toFixed(2)}%`,
          },
        });

        chart.timeScale().fitContent();
        return;
      }

      // ── Normal mode (no compare) ──
      setLegend(null);

      // Detect price range and re-apply precision if needed
      const avgPrice = data.reduce((s, d) => s + d.value, 0) / data.length;
      const autoPrecision = pricePrecision(avgPrice);
      areaSeries.applyOptions({
        priceFormat: {
          type: "price" as const,
          precision: autoPrecision,
          minMove: 1 / Math.pow(10, autoPrecision),
        },
      });

      // Color based on price direction
      const firstVal = data[0].value;
      const lastVal = data[data.length - 1].value;
      const isUp = lastVal >= firstVal;
      areaSeries.applyOptions({
        topColor: isUp ? "rgba(22, 199, 132, 0.4)" : "rgba(234, 57, 67, 0.4)",
        bottomColor: isUp ? "rgba(22, 199, 132, 0.02)" : "rgba(234, 57, 67, 0.02)",
        lineColor: isUp ? "#16c784" : "#ea3943",
        crosshairMarkerBackgroundColor: isUp ? "#16c784" : "#ea3943",
      });

      areaSeries.setData(data);
      chart.timeScale().fitContent();
    })();

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [symbol, coinId, chartId, interval, currentPrice, isComparing, compareId, compareSymbol, dataMode]);

  // Theme toggle: update colors only — avoid destroying the chart + refetching data (was blocking UI).
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const computed = getComputedStyle(document.documentElement);
    const bgColor = computed.getPropertyValue("--cmc-neutral-1").trim() || (isDark ? "#17171a" : "#ffffff");
    const textColor = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
    const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
    chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      rightPriceScale: { borderColor: gridColor },
      timeScale: { borderColor: gridColor },
      crosshair: {
        horzLine: {
          color: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
          labelBackgroundColor: isDark ? "#333" : "#555",
        },
        vertLine: {
          color: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
          labelBackgroundColor: isDark ? "#333" : "#555",
        },
      },
    });
  }, [isDark]);

  return (
    <div className="relative w-full rounded-lg overflow-hidden">
      <div ref={containerRef} className="w-full" />
      {/* Compare legend overlay */}
      {legend && (
        <div className="absolute top-3 left-3 flex items-center gap-3 rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: isDark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)", zIndex: 10, border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)" }}>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "#3B82F6" }} /><span style={{ color: "#3B82F6" }}>{legend.primary}</span></span>
          <span style={{ color: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }}>|</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: "#F59E0B" }} /><span style={{ color: "#F59E0B" }}>{legend.compare}</span></span>
        </div>
      )}
      {/* Data mode label */}
      {dataMode === "Market cap" && !legend && (
        <div className="absolute top-3 left-3 rounded-lg px-2.5 py-1 text-[10px] font-bold" style={{ background: isDark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)", zIndex: 10, color: "var(--pf-accent)", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)" }}>
          Market Cap
        </div>
      )}
      {noData && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>
            Chart data unavailable — try again shortly
          </span>
        </div>
      )}
    </div>
  );
}
