"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import HomeHero from "./HomeHero";
import TrendingStrip from "./TrendingStrip";
import HomeTable from "./HomeTable";
import { fetchCoins, type CoinMarketItem } from "@/lib/api/backend";
import { fetchPythPricesBatch } from "@/lib/pyth-prices";
import { playPricePing } from "@/lib/price-sound";
import type { CoinData } from "@/lib/types";
import { Loader2 } from "lucide-react";
import GettingStarted from "@/Components/shared/GettingStarted";

/* CoinGecko category IDs for chain filtering */
const CHAIN_CATEGORY_MAP: Record<string, string> = {
  "All Networks": "",
  "BSC": "binance-smart-chain",
  "Solana": "solana-ecosystem",
  "Base": "base-ecosystem",
  "Ethereum": "ethereum-ecosystem",
  "Polygon": "polygon-ecosystem",
  "Arbitrum": "arbitrum-ecosystem",
  "Avalanche": "avalanche-ecosystem",
  "Optimism": "optimism-ecosystem",
};

export interface HomeFilters {
  chain: string;
  sort: string;
  minMcap: number;
  maxMcap: number;
  minVol: number;
  visibleColumns: Set<string>;
}

function parseHumanNumber(s: string): number {
  if (!s) return 0;
  const clean = s.replace(/[$,\s]/g, "").toUpperCase();
  const match = clean.match(/^(\d+\.?\d*)\s*([KMBT]?)$/);
  if (!match) return parseFloat(clean) || 0;
  const num = parseFloat(match[1]);
  switch (match[2]) {
    case "K": return num * 1e3;
    case "M": return num * 1e6;
    case "B": return num * 1e9;
    case "T": return num * 1e12;
    default: return num;
  }
}

interface HomeContentProps {
  initialCoins: CoinData[];
  trendingIds: Set<string>;
}

/** Compute RSI-14 from a price array */
function computeRsi14(prices: number[]): number {
  if (prices.length < 15) return 50;
  const changes = prices.slice(-15).map((p, i, arr) => i === 0 ? 0 : p - arr[i - 1]).slice(1);
  const gains = changes.filter(c => c > 0);
  const losses = changes.filter(c => c < 0).map(Math.abs);
  const avgGain = gains.length ? gains.reduce((s, g) => s + g, 0) / 14 : 0;
  const avgLoss = losses.length ? losses.reduce((s, l) => s + l, 0) / 14 : 0;
  if (avgLoss === 0) return 100;
  return Math.round(100 - 100 / (1 + avgGain / avgLoss));
}

/** Altcoin season: % of top 50 alts that outperformed BTC over 30d */
function computeAltcoinSeason(coins: CoinData[]): number {
  const btc = coins.find(c => c.symbol?.toLowerCase() === 'btc');
  const btcChange = (btc as CoinData & Record<string, number | undefined>)?.price_change_percentage_30d_in_currency
    ?? btc?.price_change_percentage_7d_in_currency ?? 0;
  const alts = coins.filter(c => c.symbol?.toLowerCase() !== 'btc').slice(0, 50);
  if (alts.length === 0) return 50;
  const outperformed = alts.filter(c => {
    const ext = c as CoinData & Record<string, number | undefined>;
    const ch = ext.price_change_percentage_30d_in_currency ?? c.price_change_percentage_7d_in_currency ?? 0;
    return ch > btcChange;
  }).length;
  return Math.round((outperformed / alts.length) * 100);
}

export default function HomeContent({ initialCoins, trendingIds }: HomeContentProps) {
  const [coins, setCoins] = useState<CoinData[]>(initialCoins);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<HomeFilters>({
    chain: "All Networks",
    sort: "mcap_desc",
    minMcap: 0,
    maxMcap: 0,
    minVol: 0,
    visibleColumns: new Set(["price", "1h", "24h", "7d", "mcap", "vol", "supply", "sparkline"]),
  });

  /* Refetch coins when chain filter changes */
  const refetchCoins = useCallback(async (chain: string) => {
    const category = CHAIN_CATEGORY_MAP[chain] || "";
    if (!category && chain === "All Networks") {
      // Use initial SSR data for "All Networks"
      setCoins(initialCoins);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchCoins(1, 100, category);
      setCoins(data as CoinData[]);
    } catch {
      // Keep current coins on error
    } finally {
      setLoading(false);
    }
  }, [initialCoins]);

  const handleChainChange = useCallback((chain: string) => {
    setFilters((f) => ({ ...f, chain }));
    refetchCoins(chain);
  }, [refetchCoins]);

  const handleSortChange = useCallback((sort: string) => {
    setFilters((f) => ({ ...f, sort }));
  }, []);

  const handleFilterApply = useCallback((minMcap: string, maxMcap: string, minVol: string) => {
    setFilters((f) => ({
      ...f,
      minMcap: parseHumanNumber(minMcap),
      maxMcap: parseHumanNumber(maxMcap),
      minVol: parseHumanNumber(minVol),
    }));
  }, []);

  const handleColumnsChange = useCallback((cols: Set<string>) => {
    setFilters((f) => ({ ...f, visibleColumns: cols }));
  }, []);

  // ── Pyth real-time price overlay (polls every 10s) ──
  const [livePrices, setLivePrices] = useState<Record<string, { price: number; prev: number }>>({});
  const livePricesRef = useRef(livePrices);
  livePricesRef.current = livePrices;

  const refreshPythPrices = useCallback(async () => {
    // Extract unique symbols from ALL current coins
    const symbols = [...new Set(coins.map(c => c.symbol.toUpperCase()))];
    if (symbols.length === 0) return;
    try {
      const prices = await fetchPythPricesBatch(symbols);
      setLivePrices(prev => {
        const next = { ...prev };
        let soundDir: "up" | "down" | null = null;
        for (const [sym, price] of Object.entries(prices)) {
          if (price > 0) {
            const old = prev[sym]?.price;
            next[sym] = { price, prev: old ?? price };
            // Sound on significant BTC/ETH/SOL moves (>0.1%)
            if (old && (sym === "BTC" || sym === "ETH" || sym === "SOL")) {
              const pctMove = Math.abs((price - old) / old) * 100;
              if (pctMove > 0.1) soundDir = price > old ? "up" : "down";
            }
          }
        }
        if (soundDir) playPricePing(soundDir);
        return next;
      });
    } catch {}
  }, [coins]);

  useEffect(() => {
    refreshPythPrices();
    const iv = setInterval(refreshPythPrices, 10_000);
    return () => clearInterval(iv);
  }, [refreshPythPrices]);

  // ── Auto-refresh coin data every 60s (background, no loading spinner) ──
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const category = CHAIN_CATEGORY_MAP[filters.chain] || "";
        const data = await fetchCoins(1, 100, category);
        setCoins(data as CoinData[]);
      } catch {}
    }, 60_000);
    return () => clearInterval(iv);
  }, [filters.chain]);

  // Compute altcoin season + avg RSI from coin data
  const altcoinSeason = coins.length > 0 ? computeAltcoinSeason(coins) : null;
  const avgRsi = useMemo(() => {
    const top20 = coins.slice(0, 20).filter(c => c.sparkline_in_7d?.price?.length >= 15);
    if (top20.length === 0) return null;
    const rsiValues = top20.map(c => computeRsi14(c.sparkline_in_7d.price));
    return Math.round(rsiValues.reduce((s, r) => s + r, 0) / rsiValues.length);
  }, [coins]);

  return (
    <>
     
      <HomeHero
        onChainChange={handleChainChange}
        onSortChange={handleSortChange}
        onFilterApply={handleFilterApply}
        onColumnsChange={handleColumnsChange}
        altcoinSeason={altcoinSeason}
        avgRsi={avgRsi}
        trendingSlot={<TrendingStrip />}
      />
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--cmc-neutral-5)" }} />
          <span className="ml-2 text-sm" style={{ color: "var(--cmc-neutral-5)" }}>Loading {filters.chain} coins...</span>
        </div>
      )}
      <HomeTable
        coins={coins}
        trendingIds={trendingIds}
        filters={filters}
        loading={loading}
        pythPrices={livePrices}
      />
    </>
  );
}
