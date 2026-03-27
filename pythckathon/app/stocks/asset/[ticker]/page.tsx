"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Star, Share2, CandlestickChart, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { toast } from "sonner";

interface AssetData {
  ticker: string;
  name: string;
  symbol: string;
  price: number;
  confidence: number;
  publishTime: number;
  source: string;
  description: string;
  assetClass: string;
  unit?: string;
  quoteCurrency?: string;
}

const TIME_RANGES = ["1D", "5D", "1M", "3M", "1Y", "5Y"] as const;

function fmtPrice(p: number): string {
  if (p === 0) return "—";
  if (p >= 100) return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(4);
  return p.toFixed(6);
}

function sourceBadge(source: string) {
  if (source === "pyth") return { label: "Live", bg: "rgba(22,199,132,0.12)", color: "#16c784" };
  if (source === "cached") return { label: "Cached", bg: "rgba(245,209,0,0.12)", color: "#f5d100" };
  return { label: "Unavailable", bg: "rgba(153,69,255,0.1)", color: "var(--pf-accent)" };
}

function assetClassLabel(ac: string) {
  if (ac === "metal") return "Metals";
  if (ac === "commodity") return "Commodities";
  if (ac === "fx") return "Forex";
  return "Assets";
}

// TradingView symbol mapping for metals/commodities/fx
function getTVSymbol(ticker: string, assetClass: string): string {
  // Metals — explicit TradingView symbols
  const metalMap: Record<string, string> = {
    XAU: "TVC:GOLD", XAG: "TVC:SILVER", XPT: "TVC:PLATINUM", XPD: "TVC:PALLADIUM",
    XCU: "COMEX:HG1!", XAL: "LME:MAL1!", XNI: "LME:MNI1!",
    XTI: "NYMEX:TI1!", XLI: "COMEX:LI1!", XCO: "LME:MCA1!", XGR: "TVC:GRAPHITE",
  };
  if (metalMap[ticker]) return metalMap[ticker];

  // Commodities
  if (ticker === "USOILSPOT") return "TVC:USOIL";
  if (ticker === "UKOILSPOT") return "TVC:UKOIL";

  // FX pairs — any "XXX/YYY" format → "FX:XXXYYY"
  if (ticker.includes("/")) {
    const pair = ticker.replace("/", "");
    return `FX:${pair}`;
  }

  // Fallback
  return `TVC:${ticker}`;
}

const INTERVAL_MAP: Record<string, string> = {
  "1D": "D", "5D": "W", "1M": "M", "3M": "3M", "1Y": "12M", "5Y": "60M",
};

function TradingViewWidget({ symbol, interval = "1M" }: { symbol: string; interval: string }) {
  const containerRef = { current: null as HTMLDivElement | null };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      width: "100%",
      height: 500,
      symbol,
      interval: INTERVAL_MAP[interval] || "D",
      timezone: "Etc/UTC",
      theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
      style: "1",
      locale: "en",
      allow_symbol_change: true,
      calendar: false,
      hide_side_toolbar: false,
      details: true,
      support_host: "https://www.tradingview.com",
    });

    el.appendChild(script);
    return () => { if (el) el.innerHTML = ""; };
  }, [symbol, interval]);

  return (
    <div className="tradingview-widget-container w-full" style={{ minHeight: 520 }}
      ref={(node) => { containerRef.current = node; }}>
      <div className="tradingview-widget-container__widget" style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

export default function AssetDetailPage() {
  const params = useParams();
  const ticker = decodeURIComponent(params.ticker as string);

  const [asset, setAsset] = useState<AssetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRange, setActiveRange] = useState<string>("1M");
  const [starred, setStarred] = useState(false);

  useEffect(() => {
    // Try each endpoint to find this asset
    async function findAsset() {
      setLoading(true);
      for (const endpoint of ["metals", "commodities", "fx"]) {
        try {
          const res = await fetch(`/api/cryptoserve/assets/${endpoint}`);
          const data = await res.json();
          if (Array.isArray(data)) {
            const found = data.find((a: AssetData) => a.ticker === ticker);
            if (found) {
              setAsset(found);
              setLoading(false);
              return;
            }
          }
        } catch {}
      }
      setLoading(false);
    }
    findAsset();
  }, [ticker]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-16 text-center">
        <Loader2 size={32} className="mx-auto animate-spin mb-3" style={{ color: "var(--cmc-neutral-5)" }} />
        <p className="text-sm" style={{ color: "var(--cmc-neutral-5)" }}>Loading asset data...</p>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-16 text-center">
        <p className="text-lg font-bold mb-2" style={{ color: "var(--cmc-text)" }}>Asset not found</p>
        <p className="text-sm mb-4" style={{ color: "var(--cmc-neutral-5)" }}>Could not find data for "{ticker}"</p>
        <Link href="/stocks" className="text-sm font-medium underline" style={{ color: "var(--pf-accent)" }}>Back to Assets</Link>
      </div>
    );
  }

  const badge = sourceBadge(asset.source);
  const tvSymbol = getTVSymbol(asset.ticker, asset.assetClass);
  const tabHref = asset.assetClass === "metal" ? "/stocks?tab=metals" : asset.assetClass === "commodity" ? "/stocks?tab=commodities" : "/stocks?tab=forex";

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4 animate-fade-in-up">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-1.5 text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
        <Link href={tabHref} className="hover:underline transition-colors hover:text-(--pf-accent)">{assetClassLabel(asset.assetClass)}</Link>
        <ChevronRight size={10} />
        <span style={{ color: "var(--cmc-text)" }}>{asset.name}</span>
      </div>

      {/* Full-width hero header */}
      <div className="rounded-2xl p-5 mb-6 relative overflow-hidden" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
        {/* Subtle gradient mesh background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ background: "radial-gradient(ellipse at 20% 50%, var(--pf-accent), transparent 60%), radial-gradient(ellipse at 80% 50%, var(--pf-up), transparent 60%)" }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold font-display shrink-0"
              style={{ background: "linear-gradient(135deg, var(--pf-accent), var(--pf-up))", color: "#fff", boxShadow: "0 4px 16px rgba(139,92,246,0.2)" }}>
              {asset.ticker.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold font-display tracking-tight" style={{ color: "var(--cmc-text)" }}>{asset.name}</h1>
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>{asset.symbol}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Badge variant="outline" className="text-[9px] px-1.5 py-0">{assetClassLabel(asset.assetClass)}</Badge>
                {asset.unit && <Badge variant="outline" className="text-[9px] px-1.5 py-0">per {asset.unit}</Badge>}
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:text-right">
            <div>
              <span className="text-3xl font-bold font-data tracking-tight" style={{ color: "var(--cmc-text)" }}>
                {asset.quoteCurrency === "JPY" ? "¥" : "$"}{fmtPrice(asset.price)}
              </span>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>
                  ±{asset.quoteCurrency === "JPY" ? "¥" : "$"}{fmtPrice(asset.confidence)}
                </p>
                {asset.publishTime > 0 && (
                  <p className="text-[11px]" style={{ color: "var(--cmc-neutral-4)" }}>
                    {new Date(asset.publishTime * 1000).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setStarred(!starred)}>
                <Star size={16} className={starred ? "fill-yellow-400 text-yellow-400" : ""} style={{ color: starred ? undefined : "var(--cmc-neutral-5)" }} />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied!");
              }}>
                <Share2 size={16} style={{ color: "var(--cmc-neutral-5)" }} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* LEFT — CHART (now primary) */}
        <div>
          {/* Chart controls */}
          <div className="flex items-center gap-2 py-3">
            <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--cmc-neutral-5)" }}>
              <CandlestickChart size={13} /> TradingView Chart
            </div>
            <div className="ml-auto flex gap-1 p-1 rounded-lg" style={{ background: "var(--cmc-neutral-1)" }}>
              {TIME_RANGES.map((r) => (
                <button key={r} onClick={() => setActiveRange(r)}
                  className="rounded-md px-2.5 py-1 text-xs font-semibold transition-all duration-200"
                  style={{
                    background: activeRange === r ? "var(--pf-accent)" : "transparent",
                    color: activeRange === r ? "#fff" : "var(--cmc-neutral-5)",
                    boxShadow: activeRange === r ? "0 2px 8px rgba(139,92,246,0.25)" : "none",
                  }}
                >{r}</button>
              ))}
            </div>
          </div>

          {/* TradingView Chart */}
          <TradingViewWidget symbol={tvSymbol} interval={activeRange} />

          {/* Key info below chart */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 stagger-children">
            {[
              { label: "Ticker", value: asset.ticker },
              { label: "Symbol", value: asset.symbol },
              { label: "Asset Class", value: assetClassLabel(asset.assetClass) },
              ...(asset.unit ? [{ label: "Unit", value: asset.unit }] : []),
              { label: "Quote Currency", value: asset.quoteCurrency || "USD" },
              { label: "Source", value: asset.source === "pyth" ? "Pyth Network (Live)" : asset.source },
            ].map((m) => (
              <div key={m.label} className="card-interactive rounded-xl p-3">
                <p className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>{m.label}</p>
                <p className="text-sm font-bold font-data mt-0.5" style={{ color: "var(--cmc-text)" }}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="space-y-4">
          {/* About card */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
            <div className="px-4 py-2.5" style={{ background: "var(--pf-accent-muted)", borderBottom: "1px solid var(--cmc-border)" }}>
              <p className="text-xs font-bold" style={{ color: "var(--pf-accent)" }}>About</p>
            </div>
            <div className="p-4" style={{ background: "var(--cmc-neutral-1)" }}>
              <p className="text-xs leading-relaxed" style={{ color: "var(--cmc-neutral-5)" }}>
                {asset.description || `${asset.name} price feed powered by Pyth Network oracle data. This feed provides real-time ${assetClassLabel(asset.assetClass).toLowerCase()} pricing.`}
              </p>
            </div>
          </div>

          {/* Data source card */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
            <div className="px-4 py-2.5" style={{ background: "var(--pf-accent-muted)", borderBottom: "1px solid var(--cmc-border)" }}>
              <p className="text-xs font-bold" style={{ color: "var(--pf-accent)" }}>Data Source</p>
            </div>
            <div className="p-4 space-y-3" style={{ background: "var(--cmc-neutral-1)" }}>
              <div className="flex items-center justify-between text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
                <span>Oracle</span>
                <span className="font-semibold" style={{ color: "var(--pf-accent)" }}>Pyth Network</span>
              </div>
              <div className="gradient-divider" />
              <div className="flex items-center justify-between text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
                <span>Status</span>
                <span className="font-semibold" style={{ color: badge.color }}>{badge.label}</span>
              </div>
              <div className="gradient-divider" />
              <div className="flex items-center justify-between text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
                <span>Quote</span>
                <span className="font-semibold" style={{ color: "var(--cmc-text)" }}>{asset.quoteCurrency || "USD"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
