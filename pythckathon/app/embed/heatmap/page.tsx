"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { fetchCoins, type CoinMarketItem } from "@/lib/api/backend";

const PERIODS = ["1H", "24H", "7D"] as const;

function getChange(coin: CoinMarketItem, period: string): number {
  switch (period) {
    case "1H": return coin.price_change_percentage_1h_in_currency ?? 0;
    case "24H": return coin.price_change_percentage_24h_in_currency ?? coin.price_change_percentage_24h ?? 0;
    case "7D": return coin.price_change_percentage_7d_in_currency ?? 0;
    default: return coin.price_change_percentage_24h ?? 0;
  }
}

function getColor(change: number): string {
  if (change >= 5) return "#16c784";
  if (change >= 2) return "#22ab6f";
  if (change >= 0) return "#2d8a5e";
  if (change >= -2) return "#c04040";
  if (change >= -5) return "#d43d3d";
  return "#ea3943";
}

export default function EmbedHeatmapPage() {
  const [coins, setCoins] = useState<CoinMarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>("24H");

  useEffect(() => {
    // Read period from URL param
    const params = new URLSearchParams(window.location.search);
    const p = params.get("period");
    if (p && PERIODS.includes(p as any)) setPeriod(p);

    fetchCoins(1, 50)
      .then(setCoins)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() =>
    [...coins].sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0)).slice(0, 50),
    [coins]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "#0d1117" }}>
        <Loader2 size={24} className="animate-spin" style={{ color: "#555" }} />
      </div>
    );
  }

  return (
    <div style={{ background: "#0d1117", minHeight: "100vh", padding: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {sorted.map((coin) => {
          const change = getChange(coin, period);
          const size = Math.max(40, Math.min(120, Math.sqrt(coin.market_cap / 1e9) * 8));
          return (
            <div key={coin.id} style={{
              width: size, height: size, background: getColor(change),
              borderRadius: 4, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", overflow: "hidden",
              fontSize: Math.max(8, size * 0.12), color: "white", fontWeight: 600,
            }}>
              <span>{coin.symbol.toUpperCase()}</span>
              <span style={{ fontSize: "0.8em", opacity: 0.8 }}>{change >= 0 ? "+" : ""}{change.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, textAlign: "center", fontSize: 10, color: "#555" }}>
        PythFeeds
      </div>
    </div>
  );
}
