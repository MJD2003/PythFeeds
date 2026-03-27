"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Star, Share2, CandlestickChart, Loader2, Shield, Activity, Radio } from "lucide-react";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { toast } from "sonner";
import FeedIcon from "@/Components/shared/FeedIcon";

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
  change?: number;
}

const TIME_RANGES = ["1D", "5D", "1M", "3M", "1Y", "5Y"] as const;

function fmtPrice(p: number, quote?: string): string {
  if (p === 0) return "—";
  const prefix = quote === "JPY" ? "¥" : "$";
  if (p >= 100) return `${prefix}${p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 1) return `${prefix}${p.toFixed(4)}`;
  return `${prefix}${p.toFixed(6)}`;
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

function assetClassTab(ac: string) {
  if (ac === "metal") return "metals";
  if (ac === "commodity") return "commodities";
  if (ac === "fx") return "forex";
  return "metals";
}

function assetClassType(ac: string) {
  if (ac === "metal") return "Metal";
  if (ac === "commodity") return "Commodities";
  if (ac === "fx") return "FX";
  return "Metal";
}

function getTVSymbol(ticker: string, assetClass: string): string {
  const metalMap: Record<string, string> = {
    XAU: "TVC:GOLD", XAG: "TVC:SILVER", XPT: "TVC:PLATINUM", XPD: "TVC:PALLADIUM",
    XCU: "COMEX:HG1!", XAL: "LME:MAL1!", XNI: "LME:MNI1!",
    XTI: "NYMEX:TI1!", XLI: "COMEX:LI1!", XCO: "LME:MCA1!", XGR: "TVC:GRAPHITE",
  };
  if (metalMap[ticker]) return metalMap[ticker];
  if (ticker === "USOILSPOT") return "TVC:USOIL";
  if (ticker === "UKOILSPOT") return "TVC:UKOIL";
  if (ticker.includes("/")) return `FX:${ticker.replace("/", "")}`;
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
      width: "100%", height: 500, symbol,
      interval: INTERVAL_MAP[interval] || "D",
      timezone: "Etc/UTC",
      theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
      style: "1", locale: "en", allow_symbol_change: true, calendar: false,
      hide_side_toolbar: false, details: true,
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
    async function findAsset() {
      setLoading(true);
      for (const endpoint of ["metals", "commodities", "fx"]) {
        try {
          const res = await fetch(`/api/cryptoserve/assets/${endpoint}`);
          const data = await res.json();
          if (Array.isArray(data)) {
            const found = data.find((a: AssetData) => a.ticker === ticker);
            if (found) { setAsset(found); setLoading(false); return; }
          }
        } catch { /* try next endpoint */ }
      }
      setLoading(false);
    }
    findAsset();
  }, [ticker]);

  useEffect(() => {
    if (asset) {
      document.title = `${asset.name} (${asset.symbol}) — PythFeeds`;
    }
  }, [asset]);

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
        <p className="text-sm mb-4" style={{ color: "var(--cmc-neutral-5)" }}>Could not find data for &ldquo;{ticker}&rdquo;</p>
        <Link href="/stocks" className="text-sm font-medium underline" style={{ color: "var(--pf-accent)" }}>Back to Assets</Link>
      </div>
    );
  }

  const badge = sourceBadge(asset.source);
  const tvSymbol = getTVSymbol(asset.ticker, asset.assetClass);
  const tabHref = `/stocks?tab=${assetClassTab(asset.assetClass)}`;
  const confPct = asset.price > 0 && asset.confidence > 0 ? (asset.confidence / asset.price) * 100 : 0;
  const barColor = confPct < 0.01 ? "#16c784" : confPct < 0.05 ? "var(--pf-teal)" : confPct < 0.1 ? "#f5d100" : "#ea3943";

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4 animate-fade-in-up">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-1.5 text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
        <Link href="/stocks" className="hover:underline transition-colors hover:text-(--pf-accent)">Assets</Link>
        <ChevronRight size={10} />
        <Link href={tabHref} className="hover:underline transition-colors hover:text-(--pf-accent)">{assetClassLabel(asset.assetClass)}</Link>
        <ChevronRight size={10} />
        <span style={{ color: "var(--cmc-text)" }}>{asset.name}</span>
      </div>

      {/* Hero header */}
      <div className="rounded-2xl p-5 mb-6 relative overflow-hidden" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ background: "radial-gradient(ellipse at 20% 50%, var(--pf-accent), transparent 60%), radial-gradient(ellipse at 80% 50%, var(--pf-up), transparent 60%)" }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1">
            <FeedIcon base={asset.ticker} assetType={assetClassType(asset.assetClass)} size={56} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold font-display tracking-tight" style={{ color: "var(--cmc-text)" }}>{asset.name}</h1>
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>{asset.symbol}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <Badge variant="outline" className="text-[9px] px-1.5 py-0">{assetClassLabel(asset.assetClass)}</Badge>
                {asset.unit && <Badge variant="outline" className="text-[9px] px-1.5 py-0">per {asset.unit}</Badge>}
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:text-right">
            <div>
              <span className="text-3xl font-bold font-data tracking-tight" style={{ color: "var(--cmc-text)" }}>
                {fmtPrice(asset.price, asset.quoteCurrency)}
              </span>
              {asset.confidence > 0 && (
                <div className="flex items-center gap-3 mt-1 sm:justify-end">
                  <p className="text-[11px] font-mono" style={{ color: barColor }}>
                    ±{fmtPrice(asset.confidence, asset.quoteCurrency)} ({confPct.toFixed(4)}%)
                  </p>
                </div>
              )}
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

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6 stagger-grid">
        {[
          { icon: Radio, label: "Oracle", value: "Pyth Network", color: "var(--pf-accent)" },
          { icon: Shield, label: "Confidence", value: confPct > 0 ? `±${confPct.toFixed(4)}%` : "—", color: barColor },
          { icon: Activity, label: "Status", value: badge.label, color: badge.color },
          { icon: CandlestickChart, label: "Quote", value: asset.quoteCurrency || "USD", color: "var(--cmc-text)" },
        ].map(s => (
          <div key={s.label} className="card-interactive rounded-xl p-3">
            <div className="flex items-center gap-1 mb-1">
              <s.icon size={10} style={{ color: "var(--cmc-neutral-5)" }} />
              <p className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>{s.label}</p>
            </div>
            <p className="text-sm font-bold font-data" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Confidence band visualization */}
      {asset.confidence > 0 && (
        <div className="rounded-xl p-4 mb-6" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: "var(--cmc-text)" }}>Confidence Interval</span>
            <span className="text-[10px] font-bold" style={{ color: barColor }}>±{confPct.toFixed(4)}%</span>
          </div>
          <div className="relative h-10 rounded-lg overflow-hidden" style={{ background: "var(--cmc-neutral-2)" }}>
            <div className="absolute top-0 bottom-0 rounded-lg opacity-25" style={{
              left: `${Math.max(50 - confPct * 500, 5)}%`,
              right: `${Math.max(50 - confPct * 500, 5)}%`,
              background: barColor,
            }} />
            <div className="absolute top-0 bottom-0 w-0.5 left-1/2 -translate-x-1/2" style={{ background: "var(--cmc-text)" }} />
            <div className="absolute inset-0 flex items-center justify-between px-4">
              <span className="text-[10px] font-mono tabular-nums" style={{ color: "var(--cmc-neutral-5)" }}>
                {fmtPrice(asset.price - asset.confidence, asset.quoteCurrency)}
              </span>
              <span className="text-sm font-bold tabular-nums" style={{ color: "var(--cmc-text)" }}>
                {fmtPrice(asset.price, asset.quoteCurrency)}
              </span>
              <span className="text-[10px] font-mono tabular-nums" style={{ color: "var(--cmc-neutral-5)" }}>
                {fmtPrice(asset.price + asset.confidence, asset.quoteCurrency)}
              </span>
            </div>
          </div>
          <div className="h-1.5 rounded-full mt-2" style={{ background: "var(--cmc-neutral-2)" }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(confPct * 1000, 100)}%`, background: barColor }} />
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* LEFT: Chart */}
        <div>
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
                  }}>{r}</button>
              ))}
            </div>
          </div>
          <TradingViewWidget symbol={tvSymbol} interval={activeRange} />

          {/* Key info */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 stagger-children">
            {[
              { label: "Ticker", value: asset.ticker },
              { label: "Symbol", value: asset.symbol },
              { label: "Asset Class", value: assetClassLabel(asset.assetClass) },
              ...(asset.unit ? [{ label: "Unit", value: asset.unit }] : []),
              { label: "Quote Currency", value: asset.quoteCurrency || "USD" },
              { label: "Last Updated", value: asset.publishTime > 0 ? new Date(asset.publishTime * 1000).toLocaleTimeString() : "—" },
            ].map((m) => (
              <div key={m.label} className="card-interactive rounded-xl p-3">
                <p className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>{m.label}</p>
                <p className="text-sm font-bold font-data mt-0.5" style={{ color: "var(--cmc-text)" }}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Sidebar */}
        <div className="space-y-4">
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

          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
            <div className="px-4 py-2.5" style={{ background: "var(--pf-accent-muted)", borderBottom: "1px solid var(--cmc-border)" }}>
              <p className="text-xs font-bold" style={{ color: "var(--pf-accent)" }}>Data Source</p>
            </div>
            <div className="p-4 space-y-3" style={{ background: "var(--cmc-neutral-1)" }}>
              {[
                { label: "Oracle", value: "Pyth Network", color: "var(--pf-accent)" },
                { label: "Status", value: badge.label, color: badge.color },
                { label: "Quote", value: asset.quoteCurrency || "USD", color: "var(--cmc-text)" },
                { label: "Confidence", value: confPct > 0 ? `±${confPct.toFixed(4)}%` : "—", color: barColor },
              ].map((item, i) => (
                <div key={item.label}>
                  {i > 0 && <div className="gradient-divider mb-3" />}
                  <div className="flex items-center justify-between text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
                    <span>{item.label}</span>
                    <span className="font-semibold" style={{ color: item.color }}>{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <a href="https://pyth.network/price-feeds" target="_blank" rel="noopener noreferrer"
            className="block rounded-xl p-4 text-center text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: "var(--pf-accent-muted)", color: "var(--pf-accent)", border: "1px solid var(--cmc-border)" }}>
            View on Pyth Network &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
