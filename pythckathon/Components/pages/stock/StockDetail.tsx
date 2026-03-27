"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Sparklines, SparklinesCurve } from "react-sparklines";
import {
  TrendingUp, TrendingDown, Star, Share2, Info, ExternalLink, Clock, Bot,
  Building2, BarChart3, DollarSign, Activity, ChevronRight, X as XIcon, Loader2,
  AreaChart as AreaChartIcon, CandlestickChart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/Components/ui/tabs";
import { Button } from "@/Components/ui/button";
import { Separator } from "@/Components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/Components/ui/tooltip";
import { useWallet } from "@solana/wallet-adapter-react";
import { toggleWatchlist, isInWatchlist } from "@/lib/watchlist";
import { toast } from "sonner";
import { fetchStockNews, fetchAIAnalysis } from "@/lib/api/backend";
import type { NewsArticle } from "@/lib/api/backend";
import { fetchPythPrice } from "@/lib/pyth-prices";
import { useCallback, useRef } from "react";

function sentimentStyle(title: string) {
  const t = title.toLowerCase();
  const bull = ["surge", "soar", "rally", "gain", "bull", "breakout", "high", "rise", "jump", "beat", "record", "profit", "upgrade"];
  const bear = ["crash", "dump", "bear", "drop", "fall", "sink", "plunge", "miss", "loss", "fear", "sell", "downgrade", "warn"];
  if (bull.some(w => t.includes(w))) return { label: "Bullish", bg: "rgba(22,199,132,0.12)", color: "#16c784" };
  if (bear.some(w => t.includes(w))) return { label: "Bearish", bg: "rgba(234,57,67,0.12)", color: "#ea3943" };
  return { label: "Neutral", bg: "rgba(133,140,162,0.1)", color: "var(--cmc-neutral-5)" };
}

const AreaChartLazy = dynamic(() => import("@/Components/pages/coin/AreaChart"), { ssr: false });
const StockTradingViewChart = dynamic(() => import("@/Components/pages/stock/StockTradingView"), { ssr: false }) as React.ComponentType<{ symbol: string; interval: string }>;

interface StockData {
  ticker: string; name: string; price: number; change1d: number;
  previousClose: number; marketOpen: boolean;
  marketCap: number; volume: number;
  pe: number; eps: number; dividend: number; beta: number;
  high52w: number; low52w: number;
  sector: string; exchange: string; description: string;
  logo?: string; priceSource?: string; source?: string;
}

interface RelatedStock {
  ticker: string; name: string; price: number; change: number; logo: string;
}

interface StockDetailProps {
  stock: StockData;
  relatedStocks?: RelatedStock[];
}

const TIME_RANGES = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y"] as const;

function fmtCompact(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtPrice(p: number): string {
  return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PctBadge({ value, size = "sm" }: { value: number; size?: "sm" | "lg" }) {
  const up = value >= 0;
  const color = up ? "#16c784" : "#ea3943";
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${size === "lg" ? "text-sm" : "text-xs"}`} style={{ color }}>
      <Icon size={size === "lg" ? 14 : 11} />
      {up ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}


export default function StockDetail({ stock, relatedStocks = [] }: StockDetailProps) {
  const [activeRange, setActiveRange] = useState<string>("1M");
  const [chartType, setChartType] = useState<"area" | "tradingview">("tradingview");
  const { publicKey, connected } = useWallet();
  const wallet = publicKey?.toBase58() || "";
  const [starred, setStarred] = useState(false);

  useEffect(() => {
    if (wallet) setStarred(isInWatchlist(wallet, stock.ticker, "stock"));
  }, [wallet, stock.ticker]);

  const handleStar = () => {
    if (!connected) { toast.info("Connect wallet to use watchlist"); return; }
    const { added } = toggleWatchlist(wallet, { id: stock.ticker, type: "stock", symbol: stock.ticker, name: stock.name });
    setStarred(added);
    toast.success(added ? `${stock.name} added to watchlist` : `${stock.name} removed from watchlist`);
  };

  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);

  useEffect(() => {
    setNewsLoading(true);
    fetchStockNews(stock.ticker, 10)
      .then(setNews)
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false));
  }, [stock.ticker]);

  // ── Pyth live price polling ──
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [pythConfidence, setPythConfidence] = useState<number | null>(null);
  const [pythPublishTime, setPythPublishTime] = useState<number | null>(null);
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);
  const prevPriceRef = useRef<number>(stock.price);

  const refreshPythPrice = useCallback(async () => {
    try {
      const p = await fetchPythPrice(stock.ticker);
      if (p && p.price > 0) {
        const prev = prevPriceRef.current;
        setPriceFlash(p.price > prev ? "up" : p.price < prev ? "down" : null);
        prevPriceRef.current = p.price;
        setLivePrice(p.price);
        if (p.confidence) setPythConfidence(p.confidence);
        if (p.publishTime) setPythPublishTime(p.publishTime);
        setTimeout(() => setPriceFlash(null), 700);
      }
    } catch {}
  }, [stock.ticker]);

  useEffect(() => {
    refreshPythPrice();
    const iv = setInterval(refreshPythPrice, 10_000);
    return () => clearInterval(iv);
  }, [refreshPythPrice]);

  const currentPrice = livePrice ?? stock.price;
  // Recompute change from previousClose when we have live price
  const prevClose = stock.previousClose || stock.price;
  const liveChange1d = prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : stock.change1d;
  const change1d = Math.round(liveChange1d * 100) / 100;
  const isUp = change1d >= 0;
  const dollarChange = currentPrice - prevClose;

  /* 52-week range bar position — clamped to 2-98% to keep dot visible */
  const range52 = stock.high52w - stock.low52w;
  const rawPos = range52 > 0 ? ((stock.price - stock.low52w) / range52) * 100 : 50;
  const pricePos = Math.max(2, Math.min(98, rawPos));

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-[1400px] px-4 py-4">
        {/* ── Breadcrumb ── */}
        <div className="mb-3 flex items-center gap-1.5 text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
          <Link href="/stocks" className="hover:underline">Stocks</Link>
          <ChevronRight size={10} />
          <span style={{ color: "var(--cmc-text)" }}>{stock.name}</span>
        </div>

        {/* ═══════ MAIN GRID ═══════ */}
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr]">

          {/* ── LEFT SIDEBAR ── */}
          <div className="space-y-4">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2">
                {stock.logo ? (
                  <img src={stock.logo} alt={stock.ticker} width={40} height={40} className="rounded-xl object-cover" style={{ background: "var(--cmc-neutral-2)" }} />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl font-bold text-sm" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}>
                    {stock.ticker.slice(0, 2)}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold" style={{ color: "var(--cmc-text)" }}>{stock.name}</h1>
                    <Badge variant="secondary" className="text-[10px]">{stock.ticker}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">{stock.exchange}</Badge>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">{stock.sector}</Badge>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleStar}>
                    <Star size={16} className={starred ? "fill-yellow-400 text-yellow-400" : ""} style={{ color: starred ? undefined : "var(--cmc-neutral-5)" }} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success("Link copied to clipboard!");
                  }}>
                    <Share2 size={16} style={{ color: "var(--cmc-neutral-5)" }} />
                  </Button>
                </div>
              </div>

              {/* Price */}
              <div className="mt-3">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span
                    className="text-xl sm:text-2xl font-bold transition-colors duration-700"
                    style={{
                      color: priceFlash === "up" ? "#16c784" : priceFlash === "down" ? "#ea3943" : "var(--cmc-text)",
                      background: priceFlash === "up" ? "rgba(22,199,132,0.08)" : priceFlash === "down" ? "rgba(234,57,67,0.08)" : "transparent",
                      borderRadius: 4, padding: "0 4px",
                    }}
                  >
                    ${fmtPrice(currentPrice)}
                  </span>
                  {livePrice !== null && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: stock.marketOpen ? "rgba(22,199,132,0.1)" : "rgba(245,209,0,0.1)", color: stock.marketOpen ? "#16c784" : "#f5d100" }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: stock.marketOpen ? "#16c784" : "#f5d100" }} />
                      {stock.marketOpen ? "PYTH LIVE" : "MARKET CLOSED"}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <PctBadge value={change1d} size="lg" />
                  <span className="text-sm" style={{ color: isUp ? "#16c784" : "#ea3943" }}>
                    {isUp ? "+" : ""}{dollarChange.toFixed(2)} today
                  </span>
                  {prevClose > 0 && (
                    <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>Prev Close: ${fmtPrice(prevClose)}</span>
                  )}
                </div>

                {/* AI Explanation Button */}
                <button
                  onClick={() => {
                    setAiModalOpen(true);
                    if (!aiAnalysis) {
                      setAiLoading(true);
                      fetchAIAnalysis({ symbol: stock.ticker, name: stock.name, price: currentPrice,
                        change24h: stock.change1d, marketCap: stock.marketCap, volume: stock.volume })
                        .then(t => { setAiAnalysis(t); setAiLoading(false); })
                        .catch(e => { setAiError(e.message); setAiLoading(false); });
                    }
                  }}
                  className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:opacity-80"
                  style={{ background: "rgba(153,69,255,0.1)", color: "var(--pf-accent)" }}
                >
                  <img src="/pyth.png" alt="Pyth AI" className="w-3.5 h-3.5 object-contain" />
                  Why is {stock.ticker} {stock.change1d >= 0 ? "up" : "down"}?
                </button>

                {/* AI Explanation Modal */}
                {aiModalOpen && (
                  <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setAiModalOpen(false)}>
                    <div className="w-full max-w-[500px] rounded-2xl overflow-hidden shadow-2xl relative" style={{ background: "var(--cmc-bg)", border: "1px solid var(--cmc-border)" }} onClick={e => e.stopPropagation()}>
                      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
                        <div className="flex items-center gap-2">
                          <img src="/pyth.png" alt="Pyth AI" className="w-4 h-4 object-contain" />
                          <h3 className="font-bold text-sm" style={{ color: "var(--cmc-text)" }}>AI Analysis</h3>
                        </div>
                        <button onClick={() => setAiModalOpen(false)} className="p-1 rounded-full hover:bg-black/5">
                          <XIcon size={16} style={{ color: "var(--cmc-neutral-5)" }} />
                        </button>
                      </div>
                      <div className="p-5 max-h-[60vh] overflow-y-auto">
                        {aiLoading ? (
                          <div className="flex flex-col items-center justify-center py-8 gap-3">
                            <div className="relative">
                              <div className="w-10 h-10 rounded-full border-2 border-transparent" style={{ borderTopColor: "var(--pf-accent)", animation: "spin 0.8s linear infinite" }} />
                              <img src="/pyth.png" alt="" className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 object-contain" />
                            </div>
                            <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>Analyzing {stock.ticker} with live news &amp; market data...</p>
                          </div>
                        ) : aiError ? (
                          <div className="p-4 rounded-xl flex items-center justify-center text-sm font-medium" style={{ background: "rgba(234,57,67,0.1)", color: "#ea3943" }}>
                            {aiError}
                          </div>
                        ) : (
                          <div className="text-sm leading-[1.75] space-y-2" style={{ color: "var(--cmc-text)" }}>
                            {aiAnalysis?.split('\n').filter(Boolean).map((line: string, i: number) => {
                              const trimmed = line.trim();
                              if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                                return <p key={i} className="font-bold text-sm mt-1" style={{ color: "var(--cmc-text)" }}>{trimmed.replace(/\*\*/g, '')}</p>;
                              }
                              if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
                                return (
                                  <div key={i} className="flex gap-2 pl-1">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--pf-accent)" }} />
                                    <span>{trimmed.replace(/^[-•*]\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1')}</span>
                                  </div>
                                );
                              }
                              return <p key={i}>{trimmed.replace(/\*\*(.*?)\*\*/g, '$1')}</p>;
                            })}
                          </div>
                        )}
                      </div>
                      <div className="px-5 py-3 border-t text-[10px] flex items-center justify-between" style={{ borderColor: "var(--cmc-border)", background: "var(--cmc-neutral-1)", color: "var(--cmc-neutral-5)" }}>
                        <span>Powered by Gemini • Not financial advice</span>
                        {aiAnalysis && !aiLoading && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setAiAnalysis(null); setAiLoading(true); fetchAIAnalysis({ symbol: stock.ticker, name: stock.name, price: currentPrice, change24h: stock.change1d, marketCap: stock.marketCap, volume: stock.volume }).then(t => { setAiAnalysis(t); setAiLoading(false); }).catch(err => { setAiError(err.message); setAiLoading(false); }); }}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md hover:opacity-80 transition-opacity"
                            style={{ background: "rgba(153,69,255,0.1)", color: "var(--pf-accent)" }}
                          >
                            Refresh
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {/* Pyth Confidence Interval */}
                {pythConfidence != null && pythConfidence > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span style={{ color: "var(--cmc-neutral-5)" }}>Pyth Confidence</span>
                      <span className="font-mono font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>
                        ± ${pythConfidence >= 1 ? pythConfidence.toFixed(2) : pythConfidence.toFixed(4)}
                        <span className="ml-1" style={{ color: "var(--cmc-neutral-4)" }}>({((pythConfidence / currentPrice) * 100).toFixed(3)}%)</span>
                      </span>
                    </div>
                    <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "var(--cmc-neutral-2)" }}>
                      <div
                        className="absolute top-0 h-full rounded-full"
                        style={{
                          left: `${Math.max(0, 50 - (pythConfidence / currentPrice) * 500)}%`,
                          right: `${Math.max(0, 50 - (pythConfidence / currentPrice) * 500)}%`,
                          background: "rgba(153,69,255,0.5)",
                        }}
                      />
                      <div className="absolute top-0 left-1/2 w-0.5 h-full -translate-x-0.5" style={{ background: "var(--pf-accent)" }} />
                    </div>
                    {pythPublishTime != null && (
                      <p className="text-[9px]" style={{ color: "var(--cmc-neutral-4)" }}>
                        Updated {Math.max(0, Math.round((Date.now() / 1000 - pythPublishTime)))}s ago
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Key Stats */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Key Statistics</h3>

              <Card className="border-(--cmc-border) bg-transparent">
                <CardContent className="grid grid-cols-2 gap-3 p-3">
                  <StatItem label="Market Cap" value={fmtCompact(stock.marketCap)} icon={<Building2 size={11} />} />
                  <StatItem label="Volume" value={fmtCompact(stock.volume)} icon={<BarChart3 size={11} />} />
                  <StatItem label="P/E Ratio" value={stock.pe.toFixed(1)} icon={<Activity size={11} />} />
                  <StatItem label="EPS" value={`$${stock.eps.toFixed(2)}`} icon={<DollarSign size={11} />} />
                  <StatItem label="Dividend Yield" value={stock.dividend > 0 ? `${stock.dividend.toFixed(2)}%` : "N/A"} icon={<DollarSign size={11} />} />
                  <StatItem label="Beta" value={stock.beta.toFixed(2)} icon={<Activity size={11} />} />
                </CardContent>
              </Card>

              {/* Price stats */}
              <Card className="border-(--cmc-border) bg-transparent">
                <CardContent className="space-y-2.5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>Volume</span>
                    <span className="text-xs font-semibold" style={{ color: "var(--cmc-text)" }}>{fmtCompact(stock.volume)}</span>
                  </div>
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>52-Week Range</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>
                      <span style={{ color: "#ea3943" }}>${fmtPrice(stock.low52w)}</span>
                      <div className="relative flex-1 h-2.5 rounded-full overflow-visible" style={{ background: "linear-gradient(90deg, #ea3943, #f5d100, #16c784)" }}>
                        <div
                          className="absolute rounded-full"
                          style={{
                            width: 14,
                            height: 14,
                            top: "50%",
                            left: `${pricePos}%`,
                            transform: "translate(-50%, -50%)",
                            background: "var(--cmc-bg)",
                            border: "2.5px solid var(--pf-accent)",
                            boxShadow: "0 0 6px rgba(0,0,0,0.4)",
                          }}
                        />
                      </div>
                      <span style={{ color: "#16c784" }}>${fmtPrice(stock.high52w)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance */}
            <Card className="border-(--cmc-border) bg-transparent">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {[
                  { label: "1 Day", value: stock.change1d },
                ].map((p) => (
                  <div key={p.label} className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>{p.label}</span>
                    <PctBadge value={p.value} />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Price Source */}
            {stock.priceSource && (
              <Card className="border-(--cmc-border) bg-transparent">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>Price Source</span>
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        background: stock.priceSource === "pyth" ? "rgba(22,199,132,0.12)" : "rgba(153,69,255,0.1)",
                        color: stock.priceSource === "pyth" ? "#16c784" : "var(--pf-accent)",
                      }}
                    >
                      {stock.priceSource === "pyth" ? "Pyth Live" : stock.priceSource === "cached" ? "Cached" : "Reference"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── RIGHT CONTENT ── */}
          <div>
            <Tabs defaultValue="chart" className="w-full">
              <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto overflow-x-auto" style={{ borderColor: "var(--cmc-border)", scrollbarWidth: "none" }}>
                {["chart", "news", "financials", "earnings", "about"].map((t) => (
                  <TabsTrigger key={t} value={t}
                    className="rounded-none border-b-2 border-transparent px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold capitalize shrink-0 data-[state=active]:border-(--pf-accent) data-[state=active]:text-(--pf-accent) data-[state=active]:shadow-none"
                    style={{ color: "var(--cmc-neutral-5)" }}
                  >{t}</TabsTrigger>
                ))}
              </TabsList>

              {/* CHART TAB */}
              <TabsContent value="chart" className="mt-0">
                <div className="flex items-center gap-2 py-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--cmc-neutral-5)" }}>
                    <CandlestickChart size={13} /> TradingView Chart
                  </div>

                  {/* Time range pills */}
                  <div className="ml-auto flex gap-1">
                    {TIME_RANGES.map((r) => (
                      <button key={r} onClick={() => setActiveRange(r)}
                        className="rounded-md px-2.5 py-1 text-xs font-semibold transition-all"
                        style={{
                          background: activeRange === r ? "var(--pf-accent)" : "transparent",
                          color: activeRange === r ? "#fff" : "var(--cmc-neutral-5)",
                        }}
                      >{r}</button>
                    ))}
                  </div>
                </div>

                {/* Chart — TradingView only for stocks */}
                <StockTradingViewChart symbol={stock.ticker} interval={activeRange} />

                {/* Key metrics below chart */}
                <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
                  {[
                    { label: "Market Cap", value: fmtCompact(stock.marketCap) },
                    { label: "24h Volume", value: fmtCompact(stock.volume) },
                    { label: "P/E Ratio", value: stock.pe.toFixed(1) },
                    { label: "EPS", value: `$${stock.eps.toFixed(2)}` },
                  ].map((m) => (
                    <Card key={m.label} className="border-(--cmc-border) bg-transparent">
                      <CardContent className="p-3">
                        <p className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>{m.label}</p>
                        <p className="text-sm font-bold mt-0.5" style={{ color: "var(--cmc-text)" }}>{m.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* AI TAB */}
              <TabsContent value="ai" className="mt-0 pt-4">
                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--cmc-border)", background: "linear-gradient(135deg, rgba(153,69,255,0.06) 0%, rgba(153,69,255,0.06) 100%)" }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--pf-accent), var(--pf-accent))" }}>
                        <Info size={14} className="text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>AI Price Analysis</p>
                        <p className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>Powered by Google Gemini • Cached 30min</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setAiAnalysis(null); setAiError(null); setAiLoading(true);
                        fetchAIAnalysis({ symbol: stock.ticker, name: stock.name, price: livePrice || stock.price,
                          change24h: stock.change1d, marketCap: stock.marketCap, volume: stock.volume })
                          .then(t => { setAiAnalysis(t); setAiLoading(false); })
                          .catch(e => { setAiError(e.message); setAiLoading(false); });
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold hover:opacity-80"
                      style={{ background: "rgba(153,69,255,0.12)", color: "var(--pf-accent)" }}
                    >{aiLoading ? "Analyzing..." : aiAnalysis ? "Refresh" : "Analyze"}</button>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                    {[
                      { label: "Price", value: `$${(livePrice || stock.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
                      { label: "24h", value: `${stock.change1d >= 0 ? "+" : ""}${stock.change1d.toFixed(2)}%`, color: stock.change1d >= 0 ? "#16c784" : "#ea3943" },
                      { label: "Mkt Cap", value: `$${(stock.marketCap / 1e9).toFixed(2)}B` },
                      { label: "Sector", value: stock.sector },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-1">
                        <span className="text-[9px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>{item.label}</span>
                        <span className="text-[11px] font-bold" style={{ color: (item as any).color || "var(--cmc-text)" }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 min-h-[100px]">
                    {!aiAnalysis && !aiLoading && !aiError && (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: "rgba(153,69,255,0.08)" }}>
                          <BarChart3 size={22} style={{ color: "var(--pf-accent)" }} />
                        </div>
                        <p className="text-sm font-semibold mb-1" style={{ color: "var(--cmc-text)" }}>Why is {stock.ticker} {stock.change1d >= 0 ? "up" : "down"} today?</p>
                        <p className="text-xs mb-4" style={{ color: "var(--cmc-neutral-5)" }}>Get an AI-powered analysis of the current price movement</p>
                        <button
                          onClick={() => {
                            setAiLoading(true);
                            fetchAIAnalysis({ symbol: stock.ticker, name: stock.name, price: livePrice || stock.price,
                              change24h: stock.change1d, marketCap: stock.marketCap, volume: stock.volume })
                              .then(t => { setAiAnalysis(t); setAiLoading(false); })
                              .catch(e => { setAiError(e.message); setAiLoading(false); });
                          }}
                          className="px-5 py-2 rounded-xl text-sm font-semibold hover:-translate-y-px transition-all"
                          style={{ background: "linear-gradient(135deg, var(--pf-accent), var(--pf-accent))", color: "#fff" }}
                        >Analyze with Gemini</button>
                      </div>
                    )}
                    {aiLoading && (
                      <div className="space-y-3 py-2">
                        {["90%", "80%", "70%", "85%"].map((w, i) => (
                          <div key={i} className="h-3.5 rounded-full animate-pulse" style={{ width: w, background: "var(--cmc-neutral-2)" }} />
                        ))}
                        <p className="text-[11px] text-center pt-2" style={{ color: "var(--cmc-neutral-5)" }}>Gemini is analyzing {stock.ticker}...</p>
                      </div>
                    )}
                    {aiError && (
                      <div className="flex flex-col items-center py-6 text-center">
                        <p className="text-sm text-red-400 mb-3">{aiError}</p>
                        <button onClick={() => setAiError(null)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}>Retry</button>
                      </div>
                    )}
                    {aiAnalysis && !aiLoading && (
                      <div>
                        <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--cmc-text)" }}>{aiAnalysis}</p>
                        <p className="text-[9px] mt-3" style={{ color: "var(--cmc-neutral-4)" }}>⚠ AI-generated analysis for informational purposes only. Not financial advice.</p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* NEWS TAB */}
              <TabsContent value="news" className="mt-0 pt-4">
                {newsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="rounded-xl p-4 space-y-2" style={{ border: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
                        <div className="flex gap-2">
                          <div className="h-4 w-20 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
                          <div className="h-4 w-14 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
                        </div>
                        <div className="h-4 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)", width: "80%" }} />
                        <div className="h-3 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)", width: "50%" }} />
                      </div>
                    ))}
                  </div>
                ) : news.length === 0 ? (
                  <p className="py-8 text-center text-sm" style={{ color: "var(--cmc-neutral-5)" }}>No news available for {stock.ticker}.</p>
                ) : (
                  <div className="space-y-2">
                    {news.map((n, i) => {
                      const s = sentimentStyle(n.title);
                      return (
                        <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
                          className="group flex items-start gap-3 rounded-xl p-3.5 transition-all hover:-translate-y-px"
                          style={{ border: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                              <span className="text-[9px] font-semibold rounded px-1.5 py-0.5" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                              <span className="text-[10px] font-medium ml-auto" style={{ color: "var(--cmc-neutral-5)" }}>{n.source}</span>
                            </div>
                            <p className="text-sm font-medium leading-snug group-hover:opacity-80 transition-opacity" style={{ color: "var(--cmc-text)" }}>{n.title}</p>
                            {n.timeAgo && (
                              <span className="flex items-center gap-1 mt-1.5 text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>
                                <Clock size={9} />{n.timeAgo}
                              </span>
                            )}
                          </div>
                          <ExternalLink size={12} className="shrink-0 mt-1" style={{ color: "var(--cmc-neutral-5)" }} />
                        </a>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* FINANCIALS TAB */}
              <TabsContent value="financials" className="mt-0">
                <div className="py-4">
                  <h3 className="text-base font-bold mb-4" style={{ color: "var(--cmc-text)" }}>Financial Overview</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[
                      { label: "Revenue (TTM)", value: fmtCompact(stock.marketCap * 0.08) },
                      { label: "Net Income (TTM)", value: fmtCompact(stock.marketCap * 0.025) },
                      { label: "Gross Margin", value: "42.5%" },
                      { label: "Operating Margin", value: "28.3%" },
                      { label: "Debt/Equity", value: "1.45" },
                      { label: "Return on Equity", value: "34.2%" },
                      { label: "P/E Ratio", value: stock.pe.toFixed(1) },
                      { label: "P/S Ratio", value: (stock.pe * 0.32).toFixed(1) },
                      { label: "P/B Ratio", value: (stock.pe * 0.45).toFixed(1) },
                    ].map((f) => (
                      <Card key={f.label} className="border-(--cmc-border) bg-transparent">
                        <CardContent className="p-3">
                          <p className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{f.label}</p>
                          <p className="text-sm font-bold mt-0.5" style={{ color: "var(--cmc-text)" }}>{f.value}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* EARNINGS TAB */}
              <TabsContent value="earnings" className="mt-0">
                <div className="py-4 space-y-5">
                  <h3 className="text-base font-bold" style={{ color: "var(--cmc-text)" }}>Earnings Calendar</h3>

                  {/* Upcoming Earnings */}
                  <Card className="border-(--cmc-border) bg-transparent">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>Upcoming Earnings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { date: "Apr 24, 2025", quarter: "Q2 FY2025", estEPS: `$${(stock.eps * 1.05).toFixed(2)}`, consensus: "Beat expected" },
                        { date: "Jul 31, 2025", quarter: "Q3 FY2025", estEPS: `$${(stock.eps * 1.08).toFixed(2)}`, consensus: "In line" },
                        { date: "Oct 30, 2025", quarter: "Q4 FY2025", estEPS: `$${(stock.eps * 1.12).toFixed(2)}`, consensus: "Above consensus" },
                      ].map((e) => (
                        <div key={e.quarter} className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--cmc-border)" }}>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "var(--cmc-text)" }}>{e.quarter}</p>
                            <p className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>{e.date}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>{e.estEPS}</p>
                            <p className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>Est. EPS</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Past Earnings */}
                  <Card className="border-(--cmc-border) bg-transparent">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>Past Earnings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                            <th className="py-2 text-left text-[10px] font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>Quarter</th>
                            <th className="py-2 text-right text-[10px] font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>Date</th>
                            <th className="py-2 text-right text-[10px] font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>EPS Est.</th>
                            <th className="py-2 text-right text-[10px] font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>EPS Actual</th>
                            <th className="py-2 text-right text-[10px] font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>Surprise</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { q: "Q1 FY2025", date: "Jan 30, 2025", est: stock.eps * 0.98, actual: stock.eps * 1.02, surprise: 4.1 },
                            { q: "Q4 FY2024", date: "Oct 31, 2024", est: stock.eps * 0.95, actual: stock.eps * 0.99, surprise: 4.2 },
                            { q: "Q3 FY2024", date: "Jul 25, 2024", est: stock.eps * 0.92, actual: stock.eps * 0.95, surprise: 3.3 },
                            { q: "Q2 FY2024", date: "Apr 25, 2024", est: stock.eps * 0.88, actual: stock.eps * 0.91, surprise: 3.4 },
                          ].map((e) => (
                            <tr key={e.q} style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                              <td className="py-2.5 font-medium" style={{ color: "var(--cmc-text)" }}>{e.q}</td>
                              <td className="py-2.5 text-right" style={{ color: "var(--cmc-neutral-5)" }}>{e.date}</td>
                              <td className="py-2.5 text-right" style={{ color: "var(--cmc-text)" }}>${e.est.toFixed(2)}</td>
                              <td className="py-2.5 text-right font-semibold" style={{ color: "var(--cmc-up)" }}>${e.actual.toFixed(2)}</td>
                              <td className="py-2.5 text-right font-semibold" style={{ color: "var(--cmc-up)" }}>+{e.surprise.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>

                  {/* Dividend Info */}
                  <Card className="border-(--cmc-border) bg-transparent">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>Dividend Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div>
                          <p className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>Annual Dividend</p>
                          <p className="text-sm font-bold mt-0.5" style={{ color: "var(--cmc-text)" }}>${(stock.price * 0.006).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>Dividend Yield</p>
                          <p className="text-sm font-bold mt-0.5" style={{ color: "var(--cmc-text)" }}>0.60%</p>
                        </div>
                        <div>
                          <p className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>Ex-Dividend Date</p>
                          <p className="text-sm font-bold mt-0.5" style={{ color: "var(--cmc-text)" }}>Feb 7, 2025</p>
                        </div>
                        <div>
                          <p className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>Next Payment</p>
                          <p className="text-sm font-bold mt-0.5" style={{ color: "var(--cmc-text)" }}>May 15, 2025</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ABOUT TAB */}
              <TabsContent value="about" className="mt-0">
                <div className="py-4 space-y-4">
                  <div>
                    <h3 className="text-base font-bold mb-2" style={{ color: "var(--cmc-text)" }}>About {stock.name}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--cmc-text-sub)" }}>{stock.description}</p>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>Sector</span>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--cmc-text)" }}>{stock.sector}</p>
                    </div>
                    <div>
                      <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>Exchange</span>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--cmc-text)" }}>{stock.exchange}</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <Separator className="my-6" />

        {/* ═══════ RELATED STOCKS ═══════ */}
        <div>
          <h2 className="text-base font-bold mb-3" style={{ color: "var(--cmc-text)" }}>Similar Stocks</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {relatedStocks.map((s) => (
                <Link key={s.ticker} href={`/stocks/${s.ticker}`}>
                  <Card className="border-(--cmc-border) bg-transparent hover:border-(--pf-accent) transition-colors cursor-pointer">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        {s.logo ? (
                          <img src={s.logo} alt={s.ticker} width={24} height={24} className="rounded-md object-cover" style={{ background: "var(--cmc-neutral-2)" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-md text-[9px] font-bold" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}>
                            {s.ticker.slice(0, 2)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: "var(--cmc-text)" }}>{s.name}</p>
                          <p className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{s.ticker}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>${fmtPrice(s.price)}</p>
                      <PctBadge value={s.change} />
                    </CardContent>
                  </Card>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

/* Helper stat item */
function StatItem({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-0.5">
        <span style={{ color: "var(--cmc-neutral-5)" }}>{icon}</span>
        <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{label}</span>
      </div>
      <p className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>{value}</p>
    </div>
  );
}
