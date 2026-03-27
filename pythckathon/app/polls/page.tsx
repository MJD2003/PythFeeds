"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TrendingUp, TrendingDown, Clock, Flame, Trophy, Users, ChevronUp, ChevronDown } from "lucide-react";
import { fetchSimplePrices, fetchPollBatchResults, castPollVote, type PollResult } from "@/lib/api/backend";

const ASSETS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", logo: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png" },
  { id: "solana", symbol: "SOL", name: "Solana", logo: "https://assets.coingecko.com/coins/images/4128/small/solana.png" },
  { id: "bonk", symbol: "BONK", name: "Bonk", logo: "https://assets.coingecko.com/coins/images/28600/small/bonk.jpg" },
  { id: "jupiter", symbol: "JUP", name: "Jupiter", logo: "https://assets.coingecko.com/coins/images/34188/small/jup.png" },
  { id: "pyth-network", symbol: "PYTH", name: "Pyth Network", logo: "https://assets.coingecko.com/coins/images/31924/small/pyth.png" },
];

const TIMEFRAMES = ["1H", "4H", "24H"];

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = localStorage.getItem("pythfeeds_session_id");
  if (!sid) {
    sid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem("pythfeeds_session_id", sid);
  }
  return sid;
}

function fmtPrice(p: number) {
  if (!p) return "—";
  if (p >= 1) return `$${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 0.001) return `$${p.toFixed(4)}`;
  return `$${p.toPrecision(3)}`;
}

function CoinIcon({ src, symbol, size = 36 }: { src: string; symbol: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (err) return (
    <div className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, background: "linear-gradient(135deg, var(--pf-accent), var(--pf-teal))", fontSize: size * 0.35 }}>
      {symbol.slice(0, 2)}
    </div>
  );
  return <img src={src} alt={symbol} width={size} height={size} className="rounded-full shrink-0" onError={() => setErr(true)} />;
}

function PollCard({ asset, timeframe, price, delay, pollData, onVote }: {
  asset: typeof ASSETS[0]; timeframe: string; price: number; delay: number;
  pollData: PollResult; onVote: (assetId: string, side: "bull" | "bear") => void;
}) {
  const total = pollData.bullish + pollData.bearish;
  const bullPct = total > 0 ? (pollData.bullish / total) * 100 : 50;
  const bearPct = 100 - bullPct;

  const vote = (side: "bull" | "bear") => {
    if (pollData.voted) return;
    onVote(asset.id, side);
  };

  return (
    <motion.div
      className="group relative rounded-2xl overflow-hidden transition-all hover:shadow-lg hover:scale-[1.01] duration-200"
      style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      {/* Subtle gradient accent at top */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(to right, #16c784, var(--pf-accent), #ea3943)`, opacity: 0.6 }} />

      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <CoinIcon src={asset.logo} symbol={asset.symbol} size={40} />
            <div>
              <p className="font-bold text-sm sm:text-base" style={{ color: "var(--cmc-text)" }}>{asset.name}</p>
              <p className="text-[11px] font-medium tabular-nums" style={{ color: "var(--cmc-neutral-5)" }}>
                {asset.symbol} · {fmtPrice(price)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
            style={{ background: "rgba(153,69,255,0.1)", color: "var(--pf-accent)" }}>
            <Clock size={10} /> {timeframe}
          </div>
        </div>

        {/* Question */}
        <p className="text-xs font-medium mb-4" style={{ color: "var(--cmc-neutral-5)" }}>
          Where will <strong style={{ color: "var(--cmc-text)" }}>{asset.symbol}</strong> go in the next {timeframe}?
        </p>

        {/* Vote buttons */}
        <div className="flex gap-2.5 mb-4">
          <button onClick={() => vote("bull")} disabled={!!pollData.voted}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:cursor-default"
            style={{
              background: pollData.voted === "bull" ? "rgba(22,199,132,0.18)" : "rgba(22,199,132,0.06)",
              color: "#16c784",
              border: pollData.voted === "bull" ? "2px solid #16c784" : "1.5px solid rgba(22,199,132,0.2)",
              opacity: pollData.voted === "bear" ? 0.35 : 1,
              transform: pollData.voted === "bull" ? "scale(1.02)" : "scale(1)",
            }}>
            <ChevronUp size={16} strokeWidth={3} /> Bullish
          </button>
          <button onClick={() => vote("bear")} disabled={!!pollData.voted}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:cursor-default"
            style={{
              background: pollData.voted === "bear" ? "rgba(234,57,67,0.18)" : "rgba(234,57,67,0.06)",
              color: "#ea3943",
              border: pollData.voted === "bear" ? "2px solid #ea3943" : "1.5px solid rgba(234,57,67,0.2)",
              opacity: pollData.voted === "bull" ? 0.35 : 1,
              transform: pollData.voted === "bear" ? "scale(1.02)" : "scale(1)",
            }}>
            <ChevronDown size={16} strokeWidth={3} /> Bearish
          </button>
        </div>

        {/* Results bar */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-semibold mb-1.5">
            <span style={{ color: "#16c784" }}>{bullPct.toFixed(0)}%</span>
            <span className="flex items-center gap-1" style={{ color: "var(--cmc-neutral-5)" }}>
              <Users size={9} /> {total} votes
            </span>
            <span style={{ color: "#ea3943" }}>{bearPct.toFixed(0)}%</span>
          </div>
          <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5" style={{ background: "var(--cmc-neutral-2)" }}>
            <motion.div className="rounded-l-full" style={{ background: "linear-gradient(90deg, #16c784, #22d1a0)" }}
              animate={{ width: `${bullPct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
            <motion.div className="rounded-r-full" style={{ background: "linear-gradient(90deg, #f04050, #ea3943)" }}
              animate={{ width: `${bearPct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const DEFAULT_POLL: PollResult = { bullish: 0, bearish: 0, voted: null };

export default function PollsPage() {
  const [timeframe, setTimeframe] = useState("24H");
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [pollResults, setPollResults] = useState<Record<string, PollResult>>({});
  const [loading, setLoading] = useState(true);

  // Fetch prices on mount
  useEffect(() => {
    const ids = ASSETS.map(a => a.id);
    fetchSimplePrices(ids)
      .then((data) => {
        const map: Record<string, number> = {};
        Object.entries(data).forEach(([id, v]) => { map[id] = v.usd || 0; });
        setPrices(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch poll results from backend when timeframe changes
  useEffect(() => {
    const sid = getSessionId();
    if (!sid) return;
    fetchPollBatchResults(ASSETS.map(a => a.id), timeframe, sid)
      .then(setPollResults)
      .catch(() => {});
  }, [timeframe]);

  const handleVote = useCallback(async (assetId: string, side: "bull" | "bear") => {
    const sid = getSessionId();
    try {
      const res = await castPollVote(assetId, timeframe, side, sid);
      if (res.success) {
        setPollResults(prev => ({ ...prev, [assetId]: { bullish: res.bullish, bearish: res.bearish, voted: side } }));
      }
    } catch {}
  }, [timeframe]);

  return (
    <div className="mx-auto max-w-[1200px] px-3 sm:px-4 py-5 sm:py-8">
      {/* Header */}
      <div className="mb-5 sm:mb-7">
        <h1 className="text-3xl font-bold font-display tracking-tight mb-1" style={{ color: "var(--cmc-text)" }}>Price Predictions</h1>
        <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
          Vote on where you think each asset is heading · Results reset daily
        </p>
      </div>

      {/* Timeframe selector */}
      <div className="flex items-center gap-1.5 mb-5 sm:mb-7">
        {TIMEFRAMES.map(tf => (
          <button key={tf} onClick={() => setTimeframe(tf)}
            className="flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold transition-all"
            style={{
              background: timeframe === tf ? "var(--cmc-text)" : "var(--cmc-neutral-1)",
              color: timeframe === tf ? "var(--cmc-bg)" : "var(--cmc-neutral-5)",
              border: `1px solid ${timeframe === tf ? "var(--cmc-text)" : "var(--cmc-border)"}`,
            }}>
            <Clock size={10} />
            {tf}
          </button>
        ))}
      </div>

      {/* Poll grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 rounded-full animate-spin" style={{ borderColor: "var(--cmc-border)", borderTopColor: "var(--pf-accent)" }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {ASSETS.map((asset, i) => (
            <PollCard key={asset.id} asset={asset} timeframe={timeframe} price={prices[asset.id] || 0} delay={i * 0.06}
              pollData={pollResults[asset.id] || DEFAULT_POLL} onVote={handleVote} />
          ))}
        </div>
      )}

      {/* Community sentiment summary */}
      {(() => {
        const allPolls = ASSETS.map(a => pollResults[a.id] || DEFAULT_POLL);
        const totalBull = allPolls.reduce((s, p) => s + p.bullish, 0);
        const totalBear = allPolls.reduce((s, p) => s + p.bearish, 0);
        const totalVotes = totalBull + totalBear;
        const overallBullPct = totalVotes > 0 ? (totalBull / totalVotes) * 100 : 50;
        return (
          <motion.div className="mt-6 sm:mt-10 rounded-2xl p-5 relative overflow-hidden"
            style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg" style={{ background: "rgba(245,158,11,0.1)" }}>
                <Trophy size={18} style={{ color: "#f59e0b" }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>Overall Community Sentiment</p>
                <p className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>
                  {totalVotes} total votes across {ASSETS.length} assets · Resets daily
                </p>
              </div>
            </div>
            {totalVotes > 0 && (
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
                  <span className="flex items-center gap-1" style={{ color: "#16c784" }}>
                    <TrendingUp size={12} /> {overallBullPct.toFixed(0)}% Bullish
                  </span>
                  <span className="flex items-center gap-1" style={{ color: "#ea3943" }}>
                    {(100 - overallBullPct).toFixed(0)}% Bearish <TrendingDown size={12} />
                  </span>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden gap-0.5" style={{ background: "var(--cmc-neutral-2)" }}>
                  <motion.div className="rounded-l-full" style={{ background: "linear-gradient(90deg, #16c784, #22d1a0)" }}
                    animate={{ width: `${overallBullPct}%` }} transition={{ duration: 1, ease: "easeOut" }} />
                  <motion.div className="rounded-r-full" style={{ background: "linear-gradient(90deg, #f04050, #ea3943)" }}
                    animate={{ width: `${100 - overallBullPct}%` }} transition={{ duration: 1, ease: "easeOut" }} />
                </div>
              </div>
            )}
          </motion.div>
        );
      })()}
    </div>
  );
}
