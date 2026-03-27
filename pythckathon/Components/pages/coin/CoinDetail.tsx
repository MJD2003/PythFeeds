"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Sparklines, SparklinesLine, SparklinesCurve } from "react-sparklines";
import {
  Star,
  Share2,
  Globe,
  Search,
  FileText,
  MessageSquare,
  Info,
  ChevronRight,
  Github,
  Wallet,
  Bot,
  Settings,
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  Activity,
  Layers,
  AreaChart as AreaChartIcon,
  CandlestickChart,
  Bell,
  ArrowLeftRight,
  X as XIcon,
  Loader2,
  ExternalLink,
  Clock,
} from "lucide-react";
import type { ReactNode } from "react";
import type { CoinInfo } from "@/lib/types";
import { formatPrice, formatLargeValue, removeHttp } from "@/lib/format";
import TradingViewChart from "./TradingViewChart";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/Components/ui/tabs";
import { Button } from "@/Components/ui/button";
import { Separator } from "@/Components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/Components/ui/tooltip";
import { fetchCryptoNews, fetchAIAnalysis, fetchDexSearch, type DexPair } from "@/lib/api/backend";
import type { NewsArticle } from "@/lib/api/backend";
import { addAlert } from "@/lib/price-alerts";
import { fetchPythPrice } from "@/lib/pyth-prices";
import { toast } from "sonner";
import { useWallet } from "@solana/wallet-adapter-react";
import { toggleWatchlist, isInWatchlist } from "@/lib/watchlist";

function sentimentStyle(title: string) {
  const t = title.toLowerCase();
  const bull = ["surge", "soar", "rally", "gain", "bull", "breakout", "high", "rise", "jump", "moon", "pump", "ath", "launch"];
  const bear = ["crash", "dump", "bear", "drop", "fall", "sink", "plunge", "hack", "ban", "loss", "fear", "sell", "low"];
  if (bull.some(w => t.includes(w))) return { label: "Bullish", bg: "rgba(22,199,132,0.12)", color: "#16c784" };
  if (bear.some(w => t.includes(w))) return { label: "Bearish", bg: "rgba(234,57,67,0.12)", color: "#ea3943" };
  return { label: "Neutral", bg: "rgba(133,140,162,0.1)", color: "var(--cmc-neutral-5)" };
}

const AreaChartLazy = dynamic(() => import("./AreaChart"), { ssr: false });

interface TrendingCoinItem {
  item: { id: string; name: string; symbol: string; thumb: string; market_cap_rank: number };
}

interface ExtendedCoinInfo extends CoinInfo {
  description?: string;
  price_source?: string;
  market_data: CoinInfo["market_data"] & {
    price_change_percentage_7d?: number;
    price_change_percentage_30d?: number;
    total_supply?: number | null;
    max_supply?: number | null;
    ath?: { usd: number };
    ath_date?: { usd: string };
    ath_change_percentage?: { usd: number };
    atl?: { usd: number };
    atl_date?: { usd: string };
    atl_change_percentage?: { usd: number };
    sparkline_7d?: { price: number[] };
  };
}

interface CoinDetailProps {
  info: ExtendedCoinInfo;
  trendingCoins?: TrendingCoinItem[];
}

const TIME_RANGES = ["1D", "7D", "1M", "3M", "1Y", "ALL"] as const;
const MARKET_FILTERS = ["ALL", "CEX", "DEX", "Spot", "Perpetual", "Futures"] as const;

function computeEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] ?? 0;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((s, p) => s + p, 0) / period;
  for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
  return ema;
}

function computeTWAP(prices: number[]): number {
  if (!prices.length) return 0;
  return prices.reduce((s, p) => s + p, 0) / prices.length;
}

function fmtCompact(n: number): string {
  if (!n && n !== 0) return "???";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
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

export default function CoinDetail({ info, trendingCoins = [] }: CoinDetailProps) {
  const [activeRange, setActiveRange] = useState<string>("1D");
  const [chartMode, setChartMode] = useState<"Price" | "Market cap">("Price");
  const [chartType, setChartType] = useState<"tradingview" | "area">("area");
  const { publicKey, connected } = useWallet();
  const wallet = publicKey?.toBase58() || "";
  const [starred, setStarred] = useState(false);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [alertPrice, setAlertPrice] = useState("");
  const [alertDir, setAlertDir] = useState<"above" | "below">("above");
  const [dexPairs, setDexPairs] = useState<DexPair[]>([]);
  const [dexLoading, setDexLoading] = useState(false);

  // ── Chart comparison state ──
  const [compareId, setCompareId] = useState<string | null>(null);
  const [compareSymbol, setCompareSymbol] = useState<string | null>(null);
  const [showComparePicker, setShowComparePicker] = useState(false);
  const [compareSearch, setCompareSearch] = useState("");
  const compareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (wallet) setStarred(isInWatchlist(wallet, info.id, "coin"));
  }, [wallet, info.id]);

  const handleStar = () => {
    if (!connected) { toast.info("Connect wallet to use watchlist"); return; }
    const { added } = toggleWatchlist(wallet, { id: info.id, type: "coin", symbol: info.symbol, name: info.name, image: info.image?.small });
    setStarred(added);
    toast.success(added ? `${info.name} added to watchlist` : `${info.name} removed from watchlist`);
  };

  useEffect(() => {
    setNewsLoading(true);
    fetchCryptoNews([info.symbol.toUpperCase()], 10)
      .then(setNews)
      .finally(() => setNewsLoading(false));
  }, [info.symbol]);

  // ── DEX pairs discovery ──
  useEffect(() => {
    setDexLoading(true);
    fetchDexSearch(info.symbol.toUpperCase())
      .then((pairs) => setDexPairs(pairs.slice(0, 20)))
      .catch(() => setDexPairs([]))
      .finally(() => setDexLoading(false));
  }, [info.symbol]);

  // ── Pyth real-time price polling (every 10s) ──
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [pythConfidence, setPythConfidence] = useState<number | null>(null);
  const [pythPublishTime, setPythPublishTime] = useState<number | null>(null);
  const [confHistory, setConfHistory] = useState<number[]>([]);
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);
  const prevPriceRef = useRef<number>(info.market_data.current_price.usd);

  const refreshPythPrice = useCallback(async () => {
    try {
      const p = await fetchPythPrice(info.symbol.toUpperCase());
      if (p && p.price > 0) {
        const prev = prevPriceRef.current;
        setPriceFlash(p.price > prev ? "up" : p.price < prev ? "down" : null);
        prevPriceRef.current = p.price;
        setLivePrice(p.price);
        if (p.confidence) {
          setPythConfidence(p.confidence);
          setConfHistory(h => [...h.slice(-29), (p.confidence / p.price) * 100]);
        }
        if (p.publishTime) setPythPublishTime(p.publishTime);
        // Clear flash after 700ms
        setTimeout(() => setPriceFlash(null), 700);
      }
    } catch {}
  }, [info.symbol]);

  useEffect(() => {
    refreshPythPrice();
    const iv = setInterval(refreshPythPrice, 10_000);
    return () => clearInterval(iv);
  }, [refreshPythPrice]);

  const md = info.market_data;
  const change24h = md.price_change_percentage_24h;
  const isUp = change24h >= 0;
  const current = livePrice ?? md.current_price.usd;
  const sym = info.symbol.toUpperCase();

  const volMktCapRatio = md.total_volume.usd / md.market_cap.usd * 100;
  const dollarChange = current * (change24h / 100);

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-[1400px] px-4 py-4">
        {/* ── Breadcrumb ── */}
        <div className="mb-3 flex items-center gap-1.5 text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
          <Link href="/" className="hover:underline transition-colors hover:text-[var(--pf-accent)]">Cryptocurrencies</Link>
          <ChevronRight size={10} />
          <span className="font-medium" style={{ color: "var(--cmc-text)" }}>{info.name}</span>
        </div>

        {/* ═══════ MAIN GRID ═══════ */}
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr]">
          {/* Mobile: right content first, sidebar second */}

          {/* ── LEFT SIDEBAR ── */}
          <div className="space-y-4">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2">
                <Image src={info.image.small} alt={info.name} width={36} height={36} className="rounded-full" />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold font-display tracking-tight" style={{ color: "var(--cmc-text)" }}>{info.name}</h1>
                    <Badge variant="secondary" className="text-[10px]">{sym}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">Rank #{info.market_cap_rank}</Badge>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">Coin</Badge>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleStar}>
                    <Star size={16} className={starred ? "fill-yellow-400 text-yellow-400" : ""} style={{ color: starred ? undefined : "var(--cmc-neutral-5)" }} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowAlertForm(!showAlertForm)}>
                    <Bell size={16} style={{ color: showAlertForm ? "#f59e0b" : "var(--cmc-neutral-5)" }} />
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
                    className="text-xl sm:text-2xl font-bold font-display tabular-nums transition-colors duration-700"
                    style={{
                      color: priceFlash === "up" ? "#16c784" : priceFlash === "down" ? "#ea3943" : "var(--cmc-text)",
                      background: priceFlash === "up" ? "rgba(22,199,132,0.08)" : priceFlash === "down" ? "rgba(234,57,67,0.08)" : "transparent",
                      borderRadius: 4, padding: "0 4px",
                    }}
                  >
                    ${formatPrice(current)}
                  </span>
                  {livePrice !== null && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(22,199,132,0.1)", color: "#16c784" }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#16c784" }} />
                      PYTH LIVE
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <PctBadge value={change24h} size="lg" />
                  <span className="text-sm" style={{ color: isUp ? "#16c784" : "#ea3943" }}>
                    {isUp ? "+" : ""}{dollarChange.toFixed(2)} today
                  </span>
                </div>
                {/* AI Explanation Button */}
                <button
                  onClick={() => {
                    setAiModalOpen(true);
                    if (!aiAnalysis) {
                      setAiLoading(true);
                      fetchAIAnalysis({
                        symbol: sym, name: info.name, price: current,
                        change24h: change24h, change7d: md.price_change_percentage_7d,
                        marketCap: md.market_cap?.usd, volume: md.total_volume?.usd,
                      }).then(t => { setAiAnalysis(t); setAiLoading(false); })
                        .catch(e => { setAiError(e.message); setAiLoading(false); });
                    }
                  }}
                  className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:opacity-80"
                  style={{ background: "rgba(153,69,255,0.1)", color: "var(--pf-accent)" }}
                >
                  <img src="/pyth.png" alt="Pyth AI" className="w-3.5 h-3.5 object-contain" />
                  Why is {sym} {isUp ? "up" : "down"}?
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
                            <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>Analyzing {sym} with live news &amp; market data...</p>
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
                        <span>Not financial advice</span>
                        {aiAnalysis && !aiLoading && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setAiAnalysis(null); setAiLoading(true); fetchAIAnalysis({ symbol: sym, name: info.name, price: current, change24h, change7d: md.price_change_percentage_7d, marketCap: md.market_cap?.usd, volume: md.total_volume?.usd }).then(t => { setAiAnalysis(t); setAiLoading(false); }).catch(err => { setAiError(err.message); setAiLoading(false); }); }}
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
                {pythConfidence != null && pythConfidence > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span style={{ color: "var(--cmc-neutral-5)" }}>Pyth Confidence</span>
                      <span className="font-mono font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>
                        ± ${pythConfidence >= 1 ? pythConfidence.toFixed(2) : pythConfidence.toFixed(6)}
                        <span className="ml-1" style={{ color: "var(--cmc-neutral-4)" }}>({((pythConfidence / current) * 100).toFixed(3)}%)</span>
                      </span>
                    </div>
                    <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "var(--cmc-neutral-2)" }}>
                      <div
                        className="absolute top-0 h-full rounded-full"
                        style={{
                          left: `${Math.max(0, 50 - (pythConfidence / current) * 500)}%`,
                          right: `${Math.max(0, 50 - (pythConfidence / current) * 500)}%`,
                          background: "rgba(153,69,255,0.5)",
                        }}
                      />
                      <div className="absolute top-0 left-1/2 w-0.5 h-full -translate-x-0.5" style={{ background: "var(--pf-accent)" }} />
                    </div>
                    {confHistory.length > 3 && (
                      <div className="mt-1">
                        <p className="text-[9px] mb-0.5" style={{ color: "var(--cmc-neutral-4)" }}>Confidence% history (last {confHistory.length} readings)</p>
                        <div className="h-8 relative">
                          <svg width="100%" height="100%" viewBox={`0 0 ${confHistory.length} 32`} preserveAspectRatio="none">
                            <polyline
                              points={confHistory.map((v, i) => {
                                const min = Math.min(...confHistory);
                                const max = Math.max(...confHistory);
                                const range = max - min || 0.001;
                                const y = 28 - ((v - min) / range) * 24;
                                return `${i},${y}`;
                              }).join(" ")}
                              fill="none"
                              stroke="rgba(153,69,255,0.7)"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      </div>
                    )}
                    {pythPublishTime != null && (
                      <p className="text-[9px]" style={{ color: "var(--cmc-neutral-4)" }}>
                        Updated {Math.max(0, Math.round((Date.now() / 1000 - pythPublishTime)))}s ago
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Inline Price Alert Form */}
              {showAlertForm && (
                <div className="mt-2 rounded-xl p-3 space-y-2" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
                  <p className="text-[11px] font-semibold flex items-center gap-1" style={{ color: "var(--cmc-text)" }}>
                    <Bell size={11} style={{ color: "#f59e0b" }} /> Set Price Alert
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
                      <button onClick={() => setAlertDir("above")}
                        className="px-2.5 py-1 text-[10px] font-semibold transition-all"
                        style={{ background: alertDir === "above" ? "rgba(22,199,132,0.15)" : "transparent", color: alertDir === "above" ? "#16c784" : "var(--cmc-neutral-5)" }}
                      >Above</button>
                      <button onClick={() => setAlertDir("below")}
                        className="px-2.5 py-1 text-[10px] font-semibold transition-all"
                        style={{ background: alertDir === "below" ? "rgba(234,57,67,0.15)" : "transparent", color: alertDir === "below" ? "#ea3943" : "var(--cmc-neutral-5)" }}
                      >Below</button>
                    </div>
                    <input
                      type="number" step="any" value={alertPrice} onChange={(e) => setAlertPrice(e.target.value)}
                      placeholder={`e.g. ${Math.round(current * (alertDir === "above" ? 1.1 : 0.9))}`}
                      className="flex-1 rounded-lg px-2.5 py-1 text-[11px] outline-none"
                      style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}
                    />
                    <button
                      onClick={() => {
                        if (!alertPrice) { toast.error("Enter a target price"); return; }
                        addAlert({ symbol: sym, name: info.name, targetPrice: parseFloat(alertPrice), direction: alertDir });
                        setAlertPrice(""); setShowAlertForm(false);
                      }}
                      className="px-3 py-1 rounded-lg text-[10px] font-bold transition-colors"
                      style={{ background: "#16c784", color: "#000" }}
                    >Set</button>
                  </div>
                  <p className="text-[9px]" style={{ color: "var(--cmc-neutral-5)" }}>
                    Current: ${formatPrice(current)} · Alert when {sym} goes {alertDir} your target
                  </p>
                </div>
              )}

           
            </div>

            <Separator />

            {/* Key Statistics */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Key Statistics</h3>

              <Card className="border-(--cmc-border) bg-transparent">
                <CardContent className="grid grid-cols-2 gap-3 p-3">
                  <StatItem label="Market Cap" value={fmtCompact(md.market_cap.usd)} icon={<Layers size={11} />} />
                  <StatItem label="Volume (24h)" value={fmtCompact(md.total_volume.usd)} icon={<BarChart3 size={11} />} />
                  <StatItem label="FDV" value={fmtCompact(md.fully_diluted_valuation.usd)} icon={<DollarSign size={11} />} />
                  <StatItem label="Vol/Mkt Cap" value={`${volMktCapRatio.toFixed(2)}%`} icon={<Activity size={11} />} />
                </CardContent>
              </Card>

              {/* 7d Sparkline mini chart */}
              {(info.market_data as any).sparkline_7d?.price?.length > 4 && (
                <Card className="border-(--cmc-border) bg-transparent">
                  <CardContent className="p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--cmc-neutral-5)" }}>7-Day Price</p>
                    <div className="h-12">
                      <Sparklines data={(info.market_data as any).sparkline_7d.price} width={260} height={48} margin={2}>
                        <SparklinesLine color={isUp ? "#16c784" : "#ea3943"} style={{ fill: "none", strokeWidth: "1.5px" }} />
                      </Sparklines>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Supply stats */}
              <Card className="border-(--cmc-border) bg-transparent">
                <CardContent className="space-y-2.5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>Circulating Supply</span>
                    <span className="text-xs font-semibold" style={{ color: "var(--cmc-text)" }}>{formatLargeValue(md.circulating_supply)} {sym}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>Max Supply</span>
                    <span className="text-xs font-semibold" style={{ color: "var(--cmc-text)" }}>{md.max_supply ? `${formatLargeValue(md.max_supply)} ${sym}` : "∞"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>Total Supply</span>
                    <span className="text-xs font-semibold" style={{ color: "var(--cmc-text)" }}>{md.total_supply ? `${formatLargeValue(md.total_supply)} ${sym}` : "N/A"}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 24h Range */}
            <Card className="border-(--cmc-border) bg-transparent">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>24h Range</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold" style={{ color: "#ea3943" }}>${formatPrice(md.low_24h.usd)}</span>
                  <span className="text-[10px] font-semibold" style={{ color: "var(--cmc-text)" }}>${formatPrice(current)}</span>
                  <span className="text-[10px] font-semibold" style={{ color: "#16c784" }}>${formatPrice(md.high_24h.usd)}</span>
                </div>
                {(() => {
                  const lo = md.low_24h.usd;
                  const hi = md.high_24h.usd;
                  const range = hi - lo;
                  const pct = range > 0 ? Math.min(100, Math.max(0, ((current - lo) / range) * 100)) : 50;
                  return (
                    <div className="relative h-2.5 rounded-full overflow-visible" style={{ background: "linear-gradient(to right, #ea3943 0%, #f5d100 50%, #16c784 100%)" }}>
                      <div
                        className="absolute rounded-full"
                        style={{
                          width: 16,
                          height: 16,
                          top: "50%",
                          left: `${pct}%`,
                          transform: "translate(-50%, -50%)",
                          background: "#1a1a2e",
                          border: "2.5px solid #fff",
                          boxShadow: "0 0 6px rgba(0,0,0,0.5)",
                        }}
                      />
                    </div>
                  );
                })()}
                <div className="mt-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>24h High</span>
                    <span className="text-[10px] font-bold" style={{ color: "#16c784" }}>${formatPrice(md.high_24h.usd)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>24h Low</span>
                    <span className="text-[10px] font-bold" style={{ color: "#ea3943" }}>${formatPrice(md.low_24h.usd)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>24h Change</span>
                    <span className="text-[10px] font-semibold" style={{ color: md.high_24h.usd > 0 && current >= md.low_24h.usd ? (current >= md.high_24h.usd ? "#16c784" : "#f5d100") : "#ea3943" }}>
                      {md.high_24h.usd > 0 ? `${(((current - md.low_24h.usd) / md.low_24h.usd) * 100).toFixed(2)}%` : "—"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ATH / ATL */}
            {(md.ath?.usd || md.atl?.usd) && (
              <Card className="border-(--cmc-border) bg-transparent">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>All-Time</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5 p-3 pt-0">
                  {md.ath?.usd && (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>All-Time High</span>
                        <span className="text-xs font-bold" style={{ color: "#16c784" }}>${formatPrice(md.ath.usd)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[9px]" style={{ color: "var(--cmc-neutral-4)" }}>
                          {md.ath_date?.usd ? new Date(md.ath_date.usd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                        </span>
                        {md.ath_change_percentage?.usd != null && (
                          <span className="text-[10px] font-semibold" style={{ color: "#ea3943" }}>
                            {md.ath_change_percentage.usd.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {md.atl?.usd && (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>All-Time Low</span>
                        <span className="text-xs font-bold" style={{ color: "#ea3943" }}>${formatPrice(md.atl.usd)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[9px]" style={{ color: "var(--cmc-neutral-4)" }}>
                          {md.atl_date?.usd ? new Date(md.atl_date.usd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                        </span>
                        {md.atl_change_percentage?.usd != null && (
                          <span className="text-[10px] font-semibold" style={{ color: "#16c784" }}>
                            +{md.atl_change_percentage.usd.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* TWAP / EMA Overlay */}
            {(() => {
              const sp: number[] = (info.market_data as any).sparkline_7d?.price ?? [];
              if (sp.length < 14) return null;
              const ema7 = computeEMA(sp, 7);
              const ema14 = computeEMA(sp, 14);
              const twap = computeTWAP(sp);
              const price = livePrice ?? current;
              const vs = (ref: number) => {
                const d = ((price - ref) / ref) * 100;
                return { d, color: d >= 0 ? "#16c784" : "#ea3943", sign: d >= 0 ? "+" : "" };
              };
              const e7 = vs(ema7), e14 = vs(ema14), tw = vs(twap);
              return (
                <Card className="border-(--cmc-border) bg-transparent">
                  <CardHeader className="pb-1 pt-3 px-3">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Technical Indicators (7d)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 p-3 pt-1">
                    {[{label:"EMA 7",val:ema7,vs:e7},{label:"EMA 14",val:ema14,vs:e14},{label:"TWAP 7d",val:twap,vs:tw}].map(row => (
                      <div key={row.label} className="flex items-center justify-between">
                        <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>{row.label}</span>
                        <div className="text-right">
                          <span className="text-[11px] font-bold" style={{ color: "var(--cmc-text)" }}>${formatPrice(row.val)}</span>
                          <span className="ml-1.5 text-[10px] font-semibold" style={{ color: row.vs.color }}>{row.vs.sign}{row.vs.d.toFixed(2)}%</span>
                        </div>
                      </div>
                    ))}
                    <p className="text-[9px] mt-1" style={{ color: "var(--cmc-neutral-4)" }}>% = current price vs indicator</p>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Performance */}
            <Card className="border-(--cmc-border) bg-transparent">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {[
                  { label: "24h", value: change24h },
                  { label: "7d", value: md.price_change_percentage_7d ?? 0 },
                  { label: "30d", value: md.price_change_percentage_30d ?? 0 },
                ].map((p) => (
                  <div key={p.label} className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>{p.label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--cmc-neutral-2)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.abs(p.value) * 5)}%`,
                            background: p.value >= 0 ? "#16c784" : "#ea3943",
                          }}
                        />
                      </div>
                      <PctBadge value={p.value} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Links */}
            <Card className="border-(--cmc-border) bg-transparent">
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Info</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 divide-y" style={{ borderColor: "var(--cmc-border)" }}>
                <LinkRow label="Website" pills={[
                  ...(info.links.homepage.filter(Boolean).length > 0 ? [{ text: "Website", icon: <Globe size={10} />, href: info.links.homepage[0] }] : []),
                  { text: "Whitepaper", icon: <FileText size={10} />, href: "#" },
                ]} />
                <LinkRow label="Socials" pills={[
                  ...(info.links.subreddit_url ? [{ text: "Reddit", icon: <MessageSquare size={10} />, href: info.links.subreddit_url }] : []),
                  ...(info.links.repos_url.github.filter(Boolean).length > 0 ? [{ text: "GitHub", icon: <Github size={10} />, href: info.links.repos_url.github[0] }] : []),
                ]} />
                <LinkRow label="Explorers" pills={
                  info.links.blockchain_site.filter(Boolean).slice(0, 2).map(url => {
                    const domain = removeHttp(url).split("/")[0];
                    const short = domain.length > 20 ? domain.slice(0, 18) + "…" : domain;
                    return { text: short, icon: <Search size={10} />, href: url };
                  })
                } />
                <LinkRow label="Wallets" pills={[
                  { text: "Ledger", icon: <Wallet size={10} />, href: "#" },
                  { text: "MetaMask", icon: <Wallet size={10} />, href: "#" },
                ]} />
              </CardContent>
            </Card>

            {/* Converter */}
            <ConverterCard sym={sym} price={current} />
          </div>

          {/* ── RIGHT CONTENT ── */}
          <div>
            <Tabs defaultValue="chart" className="w-full">
              <TabsList className="w-full h-11 p-1 bg-transparent border-b flex gap-6" style={{ borderColor: "var(--cmc-border)" }}>
                <TabsTrigger value="chart" className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-(--pf-accent) data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-(--pf-accent) text-sm font-semibold text-(--cmc-neutral-5)">Chart</TabsTrigger>
                <TabsTrigger value="news" className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-(--pf-accent) data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-(--pf-accent) text-sm font-semibold text-(--cmc-neutral-5)">News</TabsTrigger>
                <TabsTrigger value="about" className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-(--pf-accent) data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-(--pf-accent) text-sm font-semibold text-(--cmc-neutral-5)">About</TabsTrigger>
                <TabsTrigger value="dex" className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-(--pf-accent) data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-(--pf-accent) text-sm font-semibold text-(--cmc-neutral-5)">DEX Pairs</TabsTrigger>
              </TabsList>

              {/* CHART TAB */}
              <TabsContent value="chart" className="mt-0">
                <div className="flex flex-wrap items-center gap-2 py-3">
                  {/* Price / Market cap toggle */}
                  <div className="flex rounded-lg p-0.5" style={{ background: "var(--cmc-neutral-2)" }}>
                    {(["Price", "Market cap"] as const).map((m) => (
                      <button key={m} onClick={() => setChartMode(m)}
                        className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${chartMode === m ? "shadow-sm" : ""}`}
                        style={{ background: chartMode === m ? "var(--cmc-bg)" : "transparent", color: chartMode === m ? "var(--cmc-text)" : "var(--cmc-neutral-5)" }}
                      >{m}</button>
                    ))}
                  </div>

                  {/* Chart type toggle */}
                  <div className="flex rounded-lg p-0.5" style={{ background: "var(--cmc-neutral-2)" }}>
                    <button onClick={() => setChartType("area")}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${chartType === "area" ? "shadow-sm" : ""}`}
                      style={{ background: chartType === "area" ? "var(--cmc-bg)" : "transparent", color: chartType === "area" ? "var(--cmc-text)" : "var(--cmc-neutral-5)" }}
                    ><AreaChartIcon size={13} /> Area</button>
                    <button onClick={() => setChartType("tradingview")}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${chartType === "tradingview" ? "shadow-sm" : ""}`}
                      style={{ background: chartType === "tradingview" ? "var(--cmc-bg)" : "transparent", color: chartType === "tradingview" ? "var(--cmc-text)" : "var(--cmc-neutral-5)" }}
                    ><CandlestickChart size={13} /> TradingView</button>
                  </div>

                  {/* Compare button */}
                  <div className="relative" ref={compareRef}>
                    {compareSymbol ? (
                      <div className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: "rgba(20,241,149,0.1)", color: "var(--pf-teal)", border: "1px solid rgba(20,241,149,0.25)" }}>
                        vs {compareSymbol.toUpperCase()}
                        <button onClick={() => { setCompareId(null); setCompareSymbol(null); }} className="ml-0.5 hover:opacity-70">
                          <XIcon size={11} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowComparePicker(!showComparePicker)}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all"
                        style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}
                      >
                        <ArrowLeftRight size={11} /> Compare
                      </button>
                    )}
                    {showComparePicker && (
                      <div className="absolute top-full left-0 mt-1 w-56 rounded-xl p-3 z-50 shadow-xl" style={{ background: "var(--cmc-bg)", border: "1px solid var(--cmc-border)" }}>
                        <input
                          type="text"
                          placeholder="Search coin..."
                          value={compareSearch}
                          onChange={(e) => setCompareSearch(e.target.value)}
                          className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none mb-2"
                          style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}
                          autoFocus
                        />
                        <div className="space-y-0.5 max-h-48 overflow-y-auto">
                          {[
                            { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
                            { id: "ethereum", symbol: "ETH", name: "Ethereum" },
                            { id: "solana", symbol: "SOL", name: "Solana" },
                            { id: "binancecoin", symbol: "BNB", name: "BNB" },
                            { id: "ripple", symbol: "XRP", name: "XRP" },
                            { id: "cardano", symbol: "ADA", name: "Cardano" },
                            { id: "dogecoin", symbol: "DOGE", name: "Dogecoin" },
                            { id: "chainlink", symbol: "LINK", name: "Chainlink" },
                            { id: "avalanche-2", symbol: "AVAX", name: "Avalanche" },
                            { id: "polkadot", symbol: "DOT", name: "Polkadot" },
                            { id: "matic-network", symbol: "MATIC", name: "Polygon" },
                            { id: "tron", symbol: "TRX", name: "TRON" },
                            { id: "litecoin", symbol: "LTC", name: "Litecoin" },
                            { id: "uniswap", symbol: "UNI", name: "Uniswap" },
                            { id: "near", symbol: "NEAR", name: "NEAR Protocol" },
                            { id: "render-token", symbol: "RENDER", name: "Render" },
                            { id: "sui", symbol: "SUI", name: "Sui" },
                            { id: "aptos", symbol: "APT", name: "Aptos" },
                            { id: "jupiter-exchange-solana", symbol: "JUP", name: "Jupiter" },
                            { id: "pyth-network", symbol: "PYTH", name: "Pyth Network" },
                          ]
                            .filter((c) => c.id !== info.id)
                            .filter((c) => !compareSearch || c.name.toLowerCase().includes(compareSearch.toLowerCase()) || c.symbol.toLowerCase().includes(compareSearch.toLowerCase()))
                            .map((c) => (
                              <button
                                key={c.id}
                                onClick={() => {
                                  setCompareId(c.id);
                                  setCompareSymbol(c.symbol);
                                  setShowComparePicker(false);
                                  setCompareSearch("");
                                }}
                                className="flex items-center gap-2 w-full rounded-lg px-2.5 py-2 text-xs font-medium transition-colors hover:bg-white/5"
                                style={{ color: "var(--cmc-text)" }}
                              >
                                <span className="font-bold">{c.symbol}</span>
                                <span style={{ color: "var(--cmc-neutral-5)" }}>{c.name}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
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

                {/* Chart */}
                {chartType === "tradingview" ? (
                  <TradingViewChart symbol={info.symbol} interval={activeRange} compareSymbol={compareSymbol ?? undefined} />
                ) : (
                  <AreaChartLazy symbol={info.symbol} coinId={info.id} interval={activeRange} currentPrice={current} compareId={compareId ?? undefined} compareSymbol={compareSymbol ?? undefined} dataMode={chartMode} />
                )}

                {/* Key metrics below chart */}
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Market Cap", value: fmtCompact(md.market_cap.usd) },
                    { label: "24h Volume", value: fmtCompact(md.total_volume.usd) },
                    { label: "FDV", value: fmtCompact(md.fully_diluted_valuation.usd) },
                    { label: "Circ. Supply", value: `${formatLargeValue(md.circulating_supply)} ${sym}` },
                  ].map((m) => (
                    <Card key={m.label} className="border-(--cmc-border) bg-transparent hover:scale-[1.02] transition-transform duration-200 cursor-default">
                      <CardContent className="p-3">
                        <p className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>{m.label}</p>
                        <p className="text-sm font-bold mt-0.5" style={{ color: "var(--cmc-text)" }}>{m.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Markets table inline */}
                <div className="mt-6">
                  <MarketsSection name={info.name} symbol={sym} coinId={info.id} />
                </div>
              </TabsContent>

              {/* MARKETS TAB */}
              <TabsContent value="markets" className="mt-0">
                <MarketsSection name={info.name} symbol={sym} coinId={info.id} />
              </TabsContent>

              {/* NEWS TAB */}
              <TabsContent value="news" className="mt-0 pt-4">
                {newsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="rounded-xl p-4 space-y-2" style={{ border: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
                        <div className="flex gap-2">
                          <div className="h-4 w-16 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
                          <div className="h-4 w-12 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
                        </div>
                        <div className="h-4 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)", width: "80%" }} />
                        <div className="h-3 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)", width: "55%" }} />
                      </div>
                    ))}
                  </div>
                ) : news.length === 0 ? (
                  <p className="py-8 text-center text-sm" style={{ color: "var(--cmc-neutral-5)" }}>No news available for {sym}.</p>
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


              {/* ABOUT TAB */}
              <TabsContent value="about" className="mt-0">
                <div className="py-4 space-y-4">
                  <div>
                    <h3 className="text-base font-bold mb-2" style={{ color: "var(--cmc-text)" }}>What Is {info.name} ({sym})?</h3>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--cmc-text-sub)" }}
                      dangerouslySetInnerHTML={{ __html: info.description || `${info.name} is a cryptocurrency valued at a market cap of ${fmtCompact(md.market_cap.usd)}.` }}
                    />
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>Symbol</span>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--cmc-text)" }}>{sym}</p>
                    </div>
                    <div>
                      <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>Rank</span>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--cmc-text)" }}>#{info.market_cap_rank}</p>
                    </div>
                    <div>
                      <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>Category</span>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--cmc-text)" }}>Cryptocurrency</p>
                    </div>
                    <div>
                      <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>Genesis Date</span>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--cmc-text)" }}>{info.genesis_date || "N/A"}</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* DEX PAIRS TAB */}
              <TabsContent value="dex" className="mt-0 pt-4">
                {dexLoading ? (
                  <div className="py-10 text-center">
                    <Loader2 size={20} className="mx-auto mb-2 animate-spin" style={{ color: "var(--pf-accent)" }} />
                    <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>Searching DEX pairs...</p>
                  </div>
                ) : dexPairs.length === 0 ? (
                  <div className="py-10 text-center rounded-xl" style={{ border: "1px dashed var(--cmc-border)" }}>
                    <Layers size={24} className="mx-auto mb-2" style={{ color: "var(--cmc-neutral-5)" }} />
                    <p className="text-sm font-semibold" style={{ color: "var(--cmc-text)" }}>No DEX pairs found</p>
                    <p className="text-xs mt-1" style={{ color: "var(--cmc-neutral-5)" }}>This token may not have active DEX liquidity pools</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--cmc-border)" }}>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                          <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Pair</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Price</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-5)" }}>24h</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Volume</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Liquidity</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-5)" }}>DEX</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dexPairs.map((p) => {
                          const chg = p.priceChange.h24;
                          const chgColor = chg > 0 ? "#16c784" : chg < 0 ? "#ea3943" : "var(--cmc-neutral-5)";
                          const priceNum = parseFloat(p.priceUsd);
                          const liqColor = p.liquidity.usd >= 100000 ? "#16c784" : p.liquidity.usd >= 10000 ? "#f0b90b" : "#ea3943";
                          return (
                            <tr key={p.pairAddress} className="transition-colors hover:bg-white/2" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                              <td className="px-3 py-2.5">
                                <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:opacity-80">
                                  <span className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>{p.baseToken.symbol}</span>
                                  <span className="text-[9px]" style={{ color: "var(--cmc-neutral-5)" }}>/ {p.quoteToken.symbol}</span>
                                  <ExternalLink size={9} style={{ color: "var(--cmc-neutral-5)" }} />
                                </a>
                                <span className="text-[9px]" style={{ color: "var(--cmc-neutral-5)" }}>{p.chainId}</span>
                              </td>
                              <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums" style={{ color: "var(--cmc-text)" }}>
                                {priceNum >= 1 ? `$${priceNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : priceNum >= 0.0001 ? `$${priceNum.toFixed(6)}` : `$${priceNum.toExponential(2)}`}
                              </td>
                              <td className="px-3 py-2.5 text-right text-[11px] font-bold tabular-nums" style={{ color: chgColor }}>
                                {chg > 0 ? "+" : ""}{chg.toFixed(2)}%
                              </td>
                              <td className="px-3 py-2.5 text-right text-[11px] font-medium tabular-nums" style={{ color: "var(--cmc-text)" }}>
                                {p.volume.h24 >= 1e6 ? `$${(p.volume.h24 / 1e6).toFixed(2)}M` : p.volume.h24 >= 1e3 ? `$${(p.volume.h24 / 1e3).toFixed(1)}K` : `$${p.volume.h24.toFixed(0)}`}
                              </td>
                              <td className="px-3 py-2.5 text-right text-[11px] font-medium tabular-nums" style={{ color: "var(--cmc-text)" }}>
                                <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ background: liqColor }} />
                                {p.liquidity.usd >= 1e6 ? `$${(p.liquidity.usd / 1e6).toFixed(2)}M` : p.liquidity.usd >= 1e3 ? `$${(p.liquidity.usd / 1e3).toFixed(1)}K` : `$${p.liquidity.usd.toFixed(0)}`}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>{p.dexId}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <Separator className="my-6" />

        {/* ═══════ SIMILAR COINS (by rank proximity) ═══════ */}
        {trendingCoins.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base font-bold mb-1" style={{ color: "var(--cmc-text)" }}>Similar Coins</h2>
            <p className="text-[11px] mb-3" style={{ color: "var(--cmc-neutral-5)" }}>
              Coins you might also be interested in based on market trends
            </p>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {trendingCoins
                .filter((tc) => tc.item.id !== info.id)
                .slice(0, 6)
                .map((tc) => (
                  <Link key={tc.item.id} href={`/coins/${tc.item.id}`} className="shrink-0">
                    <Card className="border-(--cmc-border) bg-transparent hover:border-(--pf-accent) transition-colors cursor-pointer w-[140px]">
                      <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                        {tc.item.thumb && (
                          <Image src={tc.item.thumb} alt={tc.item.name} width={32} height={32} className="rounded-full" />
                        )}
                        <p className="text-xs font-semibold truncate w-full" style={{ color: "var(--cmc-text)" }}>{tc.item.name}</p>
                        <p className="text-[10px] uppercase" style={{ color: "var(--cmc-neutral-5)" }}>{tc.item.symbol}</p>
                        {tc.item.market_cap_rank > 0 && (
                          <Badge variant="secondary" className="text-[8px]">#{tc.item.market_cap_rank}</Badge>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
            </div>
          </div>
        )}

        {/* ═══════ TRENDING COINS ═══════ */}
        {trendingCoins.length > 0 && (
          <div>
            <h2 className="text-base font-bold mb-3" style={{ color: "var(--cmc-text)" }}>Trending Coins</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {trendingCoins.map((tc) => (
                <Link key={tc.item.id} href={`/coins/${tc.item.id}`}>
                  <Card className="border-(--cmc-border) bg-transparent hover:border-(--pf-accent) transition-colors cursor-pointer">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        {tc.item.thumb && (
                          <Image src={tc.item.thumb} alt={tc.item.name} width={24} height={24} className="rounded-full" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: "var(--cmc-text)" }}>{tc.item.name}</p>
                          <p className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{tc.item.symbol?.toUpperCase()}</p>
                        </div>
                      </div>
                      {tc.item.market_cap_rank && (
                        <Badge variant="secondary" className="text-[9px]">Rank #{tc.item.market_cap_rank}</Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ═══════ PRICE SUMMARY TEXT ═══════ */}
        <Card className="mt-6 border-(--cmc-border) bg-transparent">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>
              {info.name} ({sym}) price has {isUp ? "increased" : "declined"} today.
            </h3>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--cmc-text-sub)" }}>
              The price of {info.name} ({sym}) is ${formatPrice(current)} today with a 24-hour trading volume
              of {fmtCompact(md.total_volume.usd)}. This represents a {isUp ? "+" : ""}{change24h.toFixed(2)}% price {isUp ? "increase" : "decline"} in
              the last 24 hours. With a circulating supply of {formatLargeValue(md.circulating_supply)} {sym},
              {info.name} is valued at a market cap of {fmtCompact(md.market_cap.usd)}.
            </p>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

/* ═══════ HELPER COMPONENTS ═══════ */

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

function LinkRow({ label, pills }: { label: string; pills: { text: string; icon: ReactNode; href: string }[] }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>{label}</span>
      <div className="flex items-center gap-1">
        {pills.map((p, i) => (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer">
            <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer hover:opacity-80">
              {p.icon} {p.text}
            </Badge>
          </a>
        ))}
      </div>
    </div>
  );
}

function CoinCard({ name, sym, price, change, spark }: { name: string; sym: string; price: number; change: number; spark: number[] }) {
  const up = change >= 0;
  return (
    <Card className="border-(--cmc-border) bg-transparent hover:border-(--pf-accent) transition-colors cursor-pointer">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}>
            {sym.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: "var(--cmc-text)" }}>{name}</p>
            <p className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{sym}</p>
          </div>
        </div>
        <p className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>${formatPrice(price)}</p>
        <PctBadge value={change} />
        <div className="mt-1.5 h-6">
          <Sparklines data={spark} width={100} height={24} margin={1} svgWidth={100} svgHeight={24} preserveAspectRatio="none">
            <SparklinesCurve color={up ? "#16c784" : "#ea3943"} style={{ fill: "none", strokeWidth: "1.2px" }} />
          </Sparklines>
        </div>
      </CardContent>
    </Card>
  );
}

function ConverterCard({ sym, price }: { sym: string; price: number }) {
  const TARGETS = [
    { symbol: "USD", label: "US Dollar", rate: 1 },
    { symbol: "EUR", label: "Euro", rate: 1.09 },
    { symbol: "GBP", label: "Pound", rate: 1.27 },
    { symbol: "BTC", label: "Bitcoin", rate: 0 },
    { symbol: "ETH", label: "Ethereum", rate: 0 },
    { symbol: "SOL", label: "Solana", rate: 0 },
  ];
  const [amount, setAmount] = useState("1");
  const [targetIdx, setTargetIdx] = useState(0);
  const [reversed, setReversed] = useState(false);
  const target = TARGETS[targetIdx];
  const isFiat = ["USD", "EUR", "GBP"].includes(target.symbol);

  const getResult = () => {
    const n = parseFloat(amount || "0");
    if (!n || !price) return "0";
    if (isFiat) {
      const usdVal = reversed ? n / (price * target.rate) : n * price * target.rate;
      if (usdVal >= 1) return usdVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (usdVal >= 0.0001) return usdVal.toFixed(6);
      return usdVal.toPrecision(4);
    }
    return (reversed ? n / price : n * price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  const QUICK = ["1", "10", "100", "1000"];
  const fromSym = reversed ? target.symbol : sym;
  const toSym = reversed ? sym : target.symbol;

  return (
    <Card className="border-(--cmc-border) bg-transparent">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>{fromSym} → {toSym}</p>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Live</span>
          </div>
        </div>

        {/* From row */}
        <div className="flex items-center justify-between py-2 rounded-lg px-2" style={{ background: "var(--cmc-neutral-1)" }}>
          <span className="text-xs font-bold" style={{ color: "var(--pf-accent)" }}>{fromSym}</span>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-24 text-right text-xs font-semibold outline-none bg-transparent tabular-nums"
            style={{ color: "var(--cmc-text)" }} step="any" min="0" />
        </div>

        {/* Swap button */}
        <div className="flex justify-center -my-1 relative z-10">
          <button onClick={() => setReversed(!reversed)}
            className="p-1 rounded-full transition-all hover:scale-110"
            style={{ background: "var(--cmc-neutral-2)", border: "2px solid var(--cmc-bg)" }}>
            <ArrowLeftRight size={10} style={{ color: "var(--pf-accent)" }} />
          </button>
        </div>

        {/* To row */}
        <div className="flex items-center justify-between py-2 rounded-lg px-2" style={{ background: "var(--cmc-neutral-1)" }}>
          <select value={targetIdx} onChange={(e) => setTargetIdx(Number(e.target.value))}
            className="text-xs font-bold bg-transparent outline-none cursor-pointer"
            style={{ color: "var(--pf-accent)" }}>
            {TARGETS.map((t, i) => (
              <option key={t.symbol} value={i} style={{ background: "var(--cmc-bg)", color: "var(--cmc-text)" }}>{t.symbol}</option>
            ))}
          </select>
          <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--cmc-text)" }}>
            {getResult()}
          </span>
        </div>

        {/* Quick amounts */}
        <div className="flex gap-1 mt-2">
          {QUICK.map(q => (
            <button key={q} onClick={() => setAmount(q)}
              className="flex-1 py-1 rounded text-[9px] font-bold transition-all hover:opacity-80"
              style={{ background: amount === q ? "rgba(153,69,255,0.15)" : "var(--cmc-neutral-1)", color: amount === q ? "var(--pf-accent)" : "var(--cmc-neutral-5)" }}>
              {q}
            </button>
          ))}
        </div>

        {/* Rate */}
        <p className="text-[9px] mt-2 text-center" style={{ color: "var(--cmc-neutral-4)" }}>
          1 {sym} = ${price >= 1 ? price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : price.toPrecision(4)}
        </p>
      </CardContent>
    </Card>
  );
}

function MarketsSection({ name, symbol, coinId }: {
  name: string; symbol: string; coinId?: string;
  marketFilter?: string; setMarketFilter?: (f: string) => void;
}) {
  const [tickers, setTickers] = useState<{ exchange: string; base: string; target: string; last: number; volume: number; trade_url: string; trust_score: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = coinId || name.toLowerCase();
    fetch(`/api/cryptoserve/coins/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data?.tickers && Array.isArray(data.tickers)) {
          const top = data.tickers
            .filter((t: any) => t.target === "USDT" || t.target === "USD" || t.target === "BUSD")
            .slice(0, 15)
            .map((t: any) => ({
              exchange: t.market?.name || "Unknown",
              base: t.base,
              target: t.target,
              last: t.last || 0,
              volume: t.converted_volume?.usd || 0,
              trade_url: t.trade_url || "#",
              trust_score: t.trust_score || "green",
            }));
          setTickers(top);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [coinId, name]);

  if (loading) {
    return (
      <div className="mt-4 py-8 text-center text-xs" style={{ color: "var(--cmc-neutral-5)" }}>Loading markets...</div>
    );
  }

  if (tickers.length === 0) {
    return (
      <div className="mt-4 py-8 text-center text-xs" style={{ color: "var(--cmc-neutral-5)" }}>No market data available.</div>
    );
  }

  return (
    <div className="mt-4">
      <h2 className="text-base font-bold mb-3" style={{ color: "var(--cmc-text)" }}>{name} Markets</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--cmc-border)" }}>
              {["#", "Exchange", "Pair", "Price", "24h Volume", ""].map((h, i) => (
                <th key={h} className={`px-3 py-2.5 text-xs font-semibold ${i < 2 ? "text-left" : "text-right"}`} style={{ color: "var(--cmc-neutral-5)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map((t, idx) => (
              <tr key={`${t.exchange}-${t.target}-${idx}`} className="transition-colors hover:opacity-80" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                <td className="px-3 py-3 text-xs" style={{ color: "var(--cmc-text-sub)" }}>{idx + 1}</td>
                <td className="px-3 py-3 font-medium text-sm" style={{ color: "var(--cmc-text)" }}>
                  {t.exchange}
                  {t.trust_score === "green" && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#16c784]" />}
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="font-medium" style={{ color: "var(--pf-accent)" }}>{t.base}/{t.target}</span>
                </td>
                <td className="px-3 py-3 text-right text-sm" style={{ color: "var(--cmc-text)" }}>
                  ${t.last >= 1 ? t.last.toLocaleString("en-US", { maximumFractionDigits: 2 }) : t.last.toFixed(6)}
                </td>
                <td className="px-3 py-3 text-right text-xs" style={{ color: "var(--cmc-text-sub)" }}>
                  {t.volume > 0 ? `$${(t.volume >= 1e9 ? (t.volume/1e9).toFixed(2)+"B" : t.volume >= 1e6 ? (t.volume/1e6).toFixed(2)+"M" : t.volume.toLocaleString())}` : "—"}
                </td>
                <td className="px-3 py-3 text-right">
                  <a href={t.trade_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium hover:underline" style={{ color: "var(--pf-accent)" }}>
                    Trade →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
