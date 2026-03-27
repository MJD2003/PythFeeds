"use client";

import { useState, useEffect, useMemo } from "react";
import { Unlock, Clock, AlertTriangle, DollarSign, LayoutGrid, Table2, ArrowUpDown, TrendingDown } from "lucide-react";
import { MagicCard } from "@/Components/magicui/magic-card";
import { BorderBeam } from "@/Components/magicui/border-beam";
import { fetchCoinsByIds } from "@/lib/api/backend";

type ViewMode = "cards" | "table";
type SortBy = "date" | "value" | "pct";

interface TokenUnlock {
  id: string;
  token: string;
  symbol: string;
  logo: string;
  cgId: string;
  unlockDate: string;
  amount: number;
  pctOfSupply: number;
  category: "cliff" | "linear" | "team" | "investor" | "ecosystem";
  status: "upcoming" | "ongoing" | "completed";
}

const UNLOCK_DATA: TokenUnlock[] = [
  { id: "1", token: "Pyth Network", symbol: "PYTH", cgId: "pyth-network", logo: "", unlockDate: "2026-05-20", amount: 200_000_000, pctOfSupply: 2.0, category: "ecosystem", status: "upcoming" },
  { id: "2", token: "Jupiter", symbol: "JUP", cgId: "jupiter-exchange-solana", logo: "", unlockDate: "2026-04-05", amount: 150_000_000, pctOfSupply: 1.5, category: "team", status: "upcoming" },
  { id: "3", token: "Jito", symbol: "JTO", cgId: "jito-governance-token", logo: "", unlockDate: "2026-03-15", amount: 30_000_000, pctOfSupply: 3.0, category: "investor", status: "upcoming" },
  { id: "4", token: "Wormhole", symbol: "W", cgId: "wormhole", logo: "", unlockDate: "2026-04-01", amount: 600_000_000, pctOfSupply: 6.0, category: "cliff", status: "upcoming" },
  { id: "5", token: "Tensor", symbol: "TNSR", cgId: "tensor", logo: "", unlockDate: "2026-03-28", amount: 100_000_000, pctOfSupply: 10.0, category: "team", status: "upcoming" },
  { id: "6", token: "Drift Protocol", symbol: "DRIFT", cgId: "drift-protocol", logo: "", unlockDate: "2026-03-10", amount: 50_000_000, pctOfSupply: 5.0, category: "investor", status: "ongoing" },
  { id: "7", token: "Marinade", symbol: "MNDE", cgId: "marinade", logo: "", unlockDate: "2026-06-01", amount: 40_000_000, pctOfSupply: 4.0, category: "linear", status: "upcoming" },
  { id: "8", token: "Render", symbol: "RENDER", cgId: "render-token", logo: "", unlockDate: "2026-03-15", amount: 10_000_000, pctOfSupply: 1.8, category: "ecosystem", status: "upcoming" },
  { id: "9", token: "Helium", symbol: "HNT", cgId: "helium", logo: "", unlockDate: "2026-08-01", amount: 5_000_000, pctOfSupply: 3.2, category: "linear", status: "upcoming" },
  { id: "10", token: "Bonk", symbol: "BONK", cgId: "bonk", logo: "", unlockDate: "2026-04-15", amount: 5_000_000_000_000, pctOfSupply: 5.0, category: "ecosystem", status: "upcoming" },
  { id: "11", token: "Solana", symbol: "SOL", cgId: "solana", logo: "", unlockDate: "2026-04-10", amount: 2_000_000, pctOfSupply: 0.3, category: "ecosystem", status: "upcoming" },
  { id: "12", token: "Raydium", symbol: "RAY", cgId: "raydium", logo: "", unlockDate: "2026-05-01", amount: 20_000_000, pctOfSupply: 3.6, category: "team", status: "upcoming" },
  { id: "13", token: "Orca", symbol: "ORCA", cgId: "orca", logo: "", unlockDate: "2026-06-15", amount: 10_000_000, pctOfSupply: 2.0, category: "investor", status: "upcoming" },
  { id: "14", token: "Parcl", symbol: "PRCL", cgId: "parcl", logo: "", unlockDate: "2026-04-20", amount: 50_000_000, pctOfSupply: 5.0, category: "cliff", status: "upcoming" },
  { id: "15", token: "Kamino", symbol: "KMNO", cgId: "kamino", logo: "", unlockDate: "2026-07-01", amount: 100_000_000, pctOfSupply: 4.5, category: "linear", status: "upcoming" },
  { id: "16", token: "Sanctum", symbol: "CLOUD", cgId: "sanctum-2", logo: "", unlockDate: "2026-05-15", amount: 80_000_000, pctOfSupply: 8.0, category: "cliff", status: "upcoming" },
];

function fmtVal(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtAmount(n: number) {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  return n.toLocaleString();
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const CAT_COLORS: Record<string, { bg: string; text: string; gradient: string }> = {
  cliff: { bg: "rgba(234,57,67,0.08)", text: "#ea3943", gradient: "#ea394322" },
  linear: { bg: "rgba(20,241,149,0.08)", text: "var(--pf-teal)", gradient: "var(--pf-teal)22" },
  team: { bg: "rgba(153,69,255,0.08)", text: "var(--pf-accent)", gradient: "var(--pf-accent)22" },
  investor: { bg: "rgba(239,140,34,0.08)", text: "#ef8c22", gradient: "#ef8c2222" },
  ecosystem: { bg: "rgba(22,199,132,0.08)", text: "#16c784", gradient: "#16c78422" },
};

function CoinIcon({ src, symbol, size = 40 }: { src: string; symbol: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (err || !src) return (
    <div className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, background: "linear-gradient(135deg, var(--pf-accent), var(--pf-teal))", fontSize: size * 0.32 }}>
      {symbol.slice(0, 2)}
    </div>
  );
  return <img src={src} alt={symbol} width={size} height={size} className="rounded-full shrink-0 object-cover" onError={() => setErr(true)} />;
}

export default function UnlocksPage() {
  const [catFilter, setCatFilter] = useState("All");
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const categories = ["All", "cliff", "linear", "team", "investor", "ecosystem"];

  // Fetch real-time prices AND images via backend proxy
  useEffect(() => {
    const ids = UNLOCK_DATA.map(u => u.cgId);
    fetchCoinsByIds(ids)
      .then((data) => {
        const priceMap: Record<string, number> = {};
        const logoMap: Record<string, string> = {};
        for (const coin of data) {
          priceMap[coin.id] = coin.current_price || 0;
          if (coin.image) logoMap[coin.id] = coin.image;
        }
        setPrices(priceMap);
        setLogos(logoMap);
      })
      .catch(() => {})
      .finally(() => setLoadingPrices(false));
  }, []);

  const filtered = useMemo(() => {
    const arr = catFilter === "All" ? UNLOCK_DATA : UNLOCK_DATA.filter(u => u.category === catFilter);
    return [...arr].sort((a, b) => {
      if (sortBy === "value") return (b.amount * (prices[b.cgId] || 0)) - (a.amount * (prices[a.cgId] || 0));
      if (sortBy === "pct") return b.pctOfSupply - a.pctOfSupply;
      return new Date(a.unlockDate).getTime() - new Date(b.unlockDate).getTime();
    });
  }, [catFilter, sortBy, prices]);

  const totalValue = filtered.reduce((s, u) => s + u.amount * (prices[u.cgId] || 0), 0);
  const imminentCount = filtered.filter(u => daysUntil(u.unlockDate) <= 14 && daysUntil(u.unlockDate) >= 0).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight mb-1" style={{ color: "var(--cmc-text)" }}>Token Unlocks</h1>
          <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>Upcoming vesting events across Solana ecosystem</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
            {(["date", "value", "pct"] as SortBy[]).map(s => (
              <button key={s} onClick={() => setSortBy(s)} className="px-2.5 py-1.5 text-[10px] font-bold capitalize flex items-center gap-1"
                style={{ background: sortBy === s ? "var(--pf-accent)" : "var(--cmc-neutral-1)", color: sortBy === s ? "#fff" : "var(--cmc-neutral-5)" }}>
                {s === "date" ? "Date" : s === "value" ? "Value" : "% Supply"}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
            <button onClick={() => setViewMode("cards")} className="p-1.5" style={{ background: viewMode === "cards" ? "var(--pf-accent)" : "var(--cmc-neutral-1)", color: viewMode === "cards" ? "#fff" : "var(--cmc-neutral-5)" }}><LayoutGrid size={12} /></button>
            <button onClick={() => setViewMode("table")} className="p-1.5" style={{ background: viewMode === "table" ? "var(--pf-accent)" : "var(--cmc-neutral-1)", color: viewMode === "table" ? "#fff" : "var(--cmc-neutral-5)" }}><Table2 size={12} /></button>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 mb-5">
        {[
          { label: "Total Value", value: loadingPrices ? "..." : fmtVal(totalValue), icon: DollarSign, color: "var(--cmc-text)" },
          { label: "Upcoming", value: `${filtered.length} events`, icon: Clock, color: "var(--pf-accent)" },
          { label: "Imminent (<14d)", value: `${imminentCount}`, icon: AlertTriangle, color: imminentCount > 0 ? "#ef8c22" : "var(--cmc-neutral-5)" },
        ].map(s => (
          <div key={s.label} className="rounded-xl px-4 py-3 relative overflow-hidden" style={{ background: "var(--cmc-bg)", border: "1px solid var(--cmc-border)" }}>
            <div className="flex items-center gap-1.5 mb-1">
              <s.icon size={11} style={{ color: "var(--cmc-neutral-5)" }} />
              <span className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>{s.label}</span>
            </div>
            <p className="text-base font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 no-scrollbar">
        {categories.map(c => {
          const catStyle = c !== "All" ? CAT_COLORS[c] : null;
          return (
            <button key={c} onClick={() => setCatFilter(c)}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold capitalize transition-all whitespace-nowrap shrink-0"
              style={{
                background: catFilter === c ? (catStyle ? catStyle.bg : "var(--cmc-text)") : "transparent",
                color: catFilter === c ? (catStyle ? catStyle.text : "var(--cmc-bg)") : "var(--cmc-neutral-5)",
                border: catFilter === c ? "none" : "1px solid var(--cmc-border)",
              }}>{c}</button>
          );
        })}
      </div>

      {/* Table View */}
      {viewMode === "table" ? (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--cmc-border)" }}>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
                <th className="px-3 py-2 text-left text-[9px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Token</th>
                <th className="px-3 py-2 text-right text-[9px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Date</th>
                <th className="px-3 py-2 text-right text-[9px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Countdown</th>
                <th className="px-3 py-2 text-right text-[9px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Tokens</th>
                <th className="px-3 py-2 text-right text-[9px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Value</th>
                <th className="px-3 py-2 text-right text-[9px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-5)" }}>% Supply</th>
                <th className="px-3 py-2 text-center text-[9px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Type</th>
                <th className="px-3 py-2 text-center text-[9px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Impact</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(unlock => {
                const days = daysUntil(unlock.unlockDate);
                const isImminent = days <= 14 && days >= 0;
                const catStyle = CAT_COLORS[unlock.category] || CAT_COLORS.ecosystem;
                const price = prices[unlock.cgId] || 0;
                const valueUsd = unlock.amount * price;
                const logo = logos[unlock.cgId] || unlock.logo;
                const impact = unlock.pctOfSupply >= 5 ? "High" : unlock.pctOfSupply >= 2 ? "Medium" : "Low";
                const impactColor = impact === "High" ? "#ea3943" : impact === "Medium" ? "#ef8c22" : "#16c784";
                return (
                  <tr key={unlock.id} className="transition-colors hover:bg-(--cmc-neutral-1)" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <CoinIcon src={logo} symbol={unlock.symbol} size={28} />
                        <div>
                          <span className="font-bold text-[11px]" style={{ color: "var(--cmc-text)" }}>{unlock.symbol}</span>
                          <span className="block text-[9px]" style={{ color: "var(--cmc-neutral-5)" }}>{unlock.token}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[11px]" style={{ color: "var(--cmc-text)" }}>
                      {new Date(unlock.unlockDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{
                        background: isImminent ? "rgba(239,140,34,0.12)" : days < 0 ? "rgba(234,57,67,0.1)" : "var(--cmc-neutral-2)",
                        color: isImminent ? "#ef8c22" : days < 0 ? "#ea3943" : "var(--cmc-neutral-5)",
                      }}>
                        {days < 0 ? "Passed" : days === 0 ? "Today" : `${days}d`}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[11px] tabular-nums" style={{ color: "var(--cmc-text)" }}>{fmtAmount(unlock.amount)}</td>
                    <td className="px-3 py-2.5 text-right text-[11px] font-semibold tabular-nums" style={{ color: price > 0 ? "var(--cmc-text)" : "var(--cmc-neutral-5)" }}>
                      {price > 0 ? fmtVal(valueUsd) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-[10px] font-bold tabular-nums" style={{ color: unlock.pctOfSupply >= 5 ? "#ea3943" : "var(--cmc-text)" }}>{unlock.pctOfSupply.toFixed(1)}%</span>
                        <div className="w-10 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--cmc-neutral-2)" }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(unlock.pctOfSupply * 10, 100)}%`, background: unlock.pctOfSupply >= 5 ? "#ea3943" : unlock.pctOfSupply >= 3 ? "#ef8c22" : "#16c784" }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize" style={{ background: catStyle.bg, color: catStyle.text }}>{unlock.category}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-[9px] font-bold flex items-center justify-center gap-0.5" style={{ color: impactColor }}>
                        {impact === "High" && <TrendingDown size={9} />} {impact}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Cards grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((unlock) => {
            const days = daysUntil(unlock.unlockDate);
            const isImminent = days <= 14 && days >= 0;
            const catStyle = CAT_COLORS[unlock.category] || CAT_COLORS.ecosystem;
            const price = prices[unlock.cgId] || 0;
            const valueUsd = unlock.amount * price;
            const logo = logos[unlock.cgId] || unlock.logo;

            return (
              <MagicCard
                key={unlock.id}
                className="rounded-xl overflow-hidden"
                gradientColor="rgba(153,69,255,0.04)"
                gradientFrom={catStyle.gradient}
                gradientTo="transparent"
              >
                <BorderBeam size={80} duration={8} colorFrom={catStyle.text} colorTo="var(--pf-accent)" borderWidth={1.5} />
                <div className="p-4">
                  {/* Top row: icon + name + badge */}
                  <div className="flex items-center gap-3 mb-3">
                    <CoinIcon src={logo} symbol={unlock.symbol} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm truncate" style={{ color: "var(--cmc-text)" }}>{unlock.token}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize shrink-0" style={{ background: catStyle.bg, color: catStyle.text }}>{unlock.category}</span>
                      </div>
                      <span className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>{unlock.symbol}</span>
                    </div>
                    {isImminent && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold px-2 py-1 rounded-full shrink-0" style={{ background: "rgba(239,140,34,0.12)", color: "#ef8c22" }}>
                        <AlertTriangle size={9} /> {days}d
                      </span>
                    )}
                  </div>

                  {/* Stats in 2x2 grid */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="rounded-lg px-3 py-2" style={{ background: "var(--cmc-neutral-1)" }}>
                      <p className="text-[9px] font-medium uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Date</p>
                      <p className="text-xs font-semibold mt-0.5" style={{ color: "var(--cmc-text)" }}>
                        {new Date(unlock.unlockDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <div className="rounded-lg px-3 py-2" style={{ background: "var(--cmc-neutral-1)" }}>
                      <p className="text-[9px] font-medium uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Tokens</p>
                      <p className="text-xs font-semibold mt-0.5" style={{ color: "var(--cmc-text)" }}>{fmtAmount(unlock.amount)}</p>
                    </div>
                    <div className="rounded-lg px-3 py-2" style={{ background: "var(--cmc-neutral-1)" }}>
                      <p className="text-[9px] font-medium uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Value</p>
                      <p className="text-xs font-bold mt-0.5" style={{ color: price > 0 ? "var(--cmc-text)" : "var(--cmc-neutral-5)" }}>
                        {price > 0 ? fmtVal(valueUsd) : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg px-3 py-2" style={{ background: "var(--cmc-neutral-1)" }}>
                      <p className="text-[9px] font-medium uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Price</p>
                      <p className="text-xs font-semibold mt-0.5" style={{ color: price > 0 ? "var(--cmc-text)" : "var(--cmc-neutral-5)" }}>
                        {price > 0 ? `$${price < 0.01 ? price.toFixed(6) : price < 1 ? price.toFixed(4) : price.toFixed(2)}` : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Supply bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-semibold shrink-0" style={{ color: unlock.pctOfSupply >= 5 ? "#ea3943" : "var(--cmc-neutral-5)" }}>
                      {unlock.pctOfSupply.toFixed(1)}% supply
                    </span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--cmc-neutral-2)" }}>
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${Math.min(unlock.pctOfSupply * 10, 100)}%`,
                        background: unlock.pctOfSupply >= 5 ? "#ea3943" : unlock.pctOfSupply >= 3 ? "#ef8c22" : "#16c784",
                      }} />
                    </div>
                  </div>
                </div>
              </MagicCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
