"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { TrendingUp, TrendingDown, Loader2, Filter, ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";
import { fetchCoins, type CoinMarketItem } from "@/lib/api/backend";
import { fetchPythPricesBatch } from "@/lib/pyth-prices";

const PERIODS = ["1H", "24H", "7D"] as const;
type Period = (typeof PERIODS)[number];

const TIERS = ["All", "Large Cap", "Mid Cap", "Small Cap"] as const;
type Tier = (typeof TIERS)[number];

function getChange(coin: CoinMarketItem, period: Period): number {
  switch (period) {
    case "1H": return coin.price_change_percentage_1h_in_currency ?? 0;
    case "24H": return coin.price_change_percentage_24h_in_currency ?? coin.price_change_percentage_24h ?? 0;
    case "7D": return coin.price_change_percentage_7d_in_currency ?? 0;
  }
}

function tierFilter(coin: CoinMarketItem, tier: Tier): boolean {
  const mc = coin.market_cap ?? 0;
  switch (tier) {
    case "Large Cap": return mc >= 10e9;
    case "Mid Cap": return mc >= 1e9 && mc < 10e9;
    case "Small Cap": return mc < 1e9;
    default: return true;
  }
}

function fmtPrice(n: number): string {
  if (n >= 1) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(4)}`;
}

function fmtMcap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

const COUNT = 20;

export default function GainersLosersPage() {
  const [coins, setCoins] = useState<CoinMarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("24H");
  const [tier, setTier] = useState<Tier>("All");
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadCoins = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCoins(1, 200);
      if (Array.isArray(data) && data.length > 0) {
        setCoins(data);
        setLastRefresh(new Date());
        const symbols = [...new Set(data.map((c) => c.symbol.toUpperCase()))].slice(0, 50);
        fetchPythPricesBatch(symbols).then(setLivePrices).catch(() => {});
      } else if (coins.length === 0) {
        setError("Market data is temporarily unavailable. Retrying...");
      }
    } catch {
      if (coins.length === 0) setError("Could not load market data. Retrying...");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCoins();
    const iv = setInterval(loadCoins, 30_000);
    return () => clearInterval(iv);
  }, []);

  const filtered = useMemo(() => coins.filter((c) => tierFilter(c, tier)), [coins, tier]);

  const gainers = useMemo(
    () => [...filtered].sort((a, b) => getChange(b, period) - getChange(a, period)).slice(0, COUNT),
    [filtered, period]
  );

  const losers = useMemo(
    () => [...filtered].sort((a, b) => getChange(a, period) - getChange(b, period)).slice(0, COUNT),
    [filtered, period]
  );

  if (loading && coins.length === 0) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-24 flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--cmc-neutral-4)" }} />
        <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>Loading market data…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 text-sm flex items-center justify-between" style={{ borderColor: "#ef8c22", background: "rgba(239,140,34,0.06)", color: "#ef8c22" }}>
          <span>{error}</span>
          <button onClick={loadCoins} className="flex items-center gap-1 font-semibold text-xs hover:opacity-80">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--cmc-text)" }}>Top Gainers & Losers</h1>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--cmc-neutral-5)" }}>
            Top {COUNT} movers from {filtered.length} coins
            {lastRefresh && <span className="ml-2">· Last updated {lastRefresh.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadCoins} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}>
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          {/* Period toggle */}
          <div className="flex rounded-lg p-0.5" style={{ background: "var(--cmc-neutral-2)" }}>
            {PERIODS.map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className="rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all"
                style={{
                  background: period === p ? "var(--cmc-bg)" : "transparent",
                  color: period === p ? "var(--cmc-text)" : "var(--cmc-neutral-5)",
                  boxShadow: period === p ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}>
                {p}
              </button>
            ))}
          </div>
          {/* Tier filter */}
          <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ background: "var(--cmc-neutral-2)" }}>
            <Filter size={12} style={{ color: "var(--cmc-neutral-5)" }} />
            <select value={tier} onChange={(e) => setTier(e.target.value as Tier)}
              className="bg-transparent text-[11px] font-semibold outline-none cursor-pointer"
              style={{ color: "var(--cmc-text)" }}>
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gainers */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} style={{ color: "#16c784" }} />
            <h2 className="text-sm font-bold" style={{ color: "#16c784" }}>Top Gainers</h2>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: "var(--cmc-neutral-1)" }}>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider px-3 py-2" style={{ color: "var(--cmc-neutral-5)" }}>#</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider px-3 py-2" style={{ color: "var(--cmc-neutral-5)" }}>Name</th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wider px-3 py-2" style={{ color: "var(--cmc-neutral-5)" }}>Price</th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wider px-3 py-2" style={{ color: "var(--cmc-neutral-5)" }}>Change</th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wider px-3 py-2 hidden sm:table-cell" style={{ color: "var(--cmc-neutral-5)" }}>MCap</th>
                </tr>
              </thead>
              <tbody>
                {gainers.map((coin, i) => {
                  const chg = getChange(coin, period);
                  return (
                    <tr key={coin.id} className="transition-colors" style={{ borderTop: "1px solid var(--cmc-border)" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--cmc-neutral-1)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <td className="px-3 py-2 text-xs tabular-nums" style={{ color: "var(--cmc-neutral-5)" }}>{i + 1}</td>
                      <td className="px-3 py-2">
                        <Link href={`/coins/${coin.id}`} className="flex items-center gap-2 hover:opacity-80">
                          <Image src={coin.image} alt={coin.name} width={20} height={20} className="rounded-full" />
                          <span className="text-xs font-semibold" style={{ color: "var(--cmc-text)" }}>{coin.name}</span>
                          <span className="text-[10px] uppercase" style={{ color: "var(--cmc-neutral-5)" }}>{coin.symbol}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums font-medium" style={{ color: "var(--cmc-text)" }}>
                        {(() => {
                          const lp = livePrices[coin.symbol.toUpperCase()];
                          return lp && lp > 0 ? (
                            <span className="flex items-center justify-end gap-1">
                              {fmtPrice(lp)}
                              <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: "rgba(153,69,255,0.15)", color: "var(--pf-accent)" }}>PYTH</span>
                            </span>
                          ) : fmtPrice(coin.current_price);
                        })()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums" style={{ color: "#16c784" }}>
                          <ArrowUpRight size={11} />+{chg.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-[11px] tabular-nums hidden sm:table-cell" style={{ color: "var(--cmc-neutral-5)" }}>
                        {fmtMcap(coin.market_cap)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Losers */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={16} style={{ color: "#ea3943" }} />
            <h2 className="text-sm font-bold" style={{ color: "#ea3943" }}>Top Losers</h2>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: "var(--cmc-neutral-1)" }}>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider px-3 py-2" style={{ color: "var(--cmc-neutral-5)" }}>#</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider px-3 py-2" style={{ color: "var(--cmc-neutral-5)" }}>Name</th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wider px-3 py-2" style={{ color: "var(--cmc-neutral-5)" }}>Price</th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wider px-3 py-2" style={{ color: "var(--cmc-neutral-5)" }}>Change</th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wider px-3 py-2 hidden sm:table-cell" style={{ color: "var(--cmc-neutral-5)" }}>MCap</th>
                </tr>
              </thead>
              <tbody>
                {losers.map((coin, i) => {
                  const chg = getChange(coin, period);
                  return (
                    <tr key={coin.id} className="transition-colors" style={{ borderTop: "1px solid var(--cmc-border)" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--cmc-neutral-1)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <td className="px-3 py-2 text-xs tabular-nums" style={{ color: "var(--cmc-neutral-5)" }}>{i + 1}</td>
                      <td className="px-3 py-2">
                        <Link href={`/coins/${coin.id}`} className="flex items-center gap-2 hover:opacity-80">
                          <Image src={coin.image} alt={coin.name} width={20} height={20} className="rounded-full" />
                          <span className="text-xs font-semibold" style={{ color: "var(--cmc-text)" }}>{coin.name}</span>
                          <span className="text-[10px] uppercase" style={{ color: "var(--cmc-neutral-5)" }}>{coin.symbol}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums font-medium" style={{ color: "var(--cmc-text)" }}>
                        {(() => {
                          const lp = livePrices[coin.symbol.toUpperCase()];
                          return lp && lp > 0 ? (
                            <span className="flex items-center justify-end gap-1">
                              {fmtPrice(lp)}
                              <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: "rgba(153,69,255,0.15)", color: "var(--pf-accent)" }}>PYTH</span>
                            </span>
                          ) : fmtPrice(coin.current_price);
                        })()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums" style={{ color: "#ea3943" }}>
                          <ArrowDownRight size={11} />{chg.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-[11px] tabular-nums hidden sm:table-cell" style={{ color: "var(--cmc-neutral-5)" }}>
                        {fmtMcap(coin.market_cap)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
