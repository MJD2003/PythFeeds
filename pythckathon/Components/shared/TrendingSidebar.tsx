"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { TrendingUp, TrendingDown, X, Flame, ChevronRight } from "lucide-react";
import { fetchCoins, type CoinMarketItem } from "@/lib/api/backend";

function fmtPrice(p: number) {
  if (p >= 1000) return `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toPrecision(4)}`;
}

interface TrendingSidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function TrendingSidebar({ open, onClose }: TrendingSidebarProps) {
  const [coins, setCoins] = useState<CoinMarketItem[]>([]);
  const [tab, setTab] = useState<"gainers" | "losers">("gainers");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchCoins(1, 100)
      .then(setCoins)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const sorted = [...coins]
    .filter((c) => c.price_change_percentage_24h_in_currency != null)
    .sort((a, b) =>
      tab === "gainers"
        ? (b.price_change_percentage_24h_in_currency ?? 0) - (a.price_change_percentage_24h_in_currency ?? 0)
        : (a.price_change_percentage_24h_in_currency ?? 0) - (b.price_change_percentage_24h_in_currency ?? 0)
    )
    .slice(0, 20);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-1000 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className="fixed top-0 right-0 z-1001 h-full w-[360px] flex flex-col transition-transform duration-400"
        style={{
          transform: open ? "translateX(0)" : "translateX(100%)",
          transitionTimingFunction: open ? "cubic-bezier(0.16, 1, 0.3, 1)" : "cubic-bezier(0.7, 0, 0.84, 0)",
          background: "color-mix(in srgb, var(--cmc-bg) 88%, transparent)",
          backdropFilter: "blur(24px) saturate(1.4)",
          WebkitBackdropFilter: "blur(24px) saturate(1.4)",
          borderLeft: "1px solid color-mix(in srgb, var(--cmc-border) 50%, transparent)",
          boxShadow: open ? "-12px 0 48px rgba(0,0,0,0.25), 0 0 0 1px rgba(139,92,246,0.04)" : "none",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(245,158,11,0.12)" }}>
              <Flame size={14} style={{ color: "#f59e0b" }} />
            </div>
            <h2 className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>Trending Now</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-all hover:bg-white/10 hover:scale-105 active:scale-95">
            <X size={15} style={{ color: "var(--cmc-neutral-5)" }} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 px-5 py-2.5 shrink-0" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
          {(["gainers", "losers"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all"
              style={{
                background: tab === t ? (t === "gainers" ? "rgba(22,199,132,0.12)" : "rgba(234,57,67,0.12)") : "transparent",
                color: tab === t ? (t === "gainers" ? "#16c784" : "#ea3943") : "var(--cmc-neutral-5)",
                border: tab === t ? `1px solid ${t === "gainers" ? "rgba(22,199,132,0.25)" : "rgba(234,57,67,0.25)"}` : "1px solid transparent",
                boxShadow: tab === t ? (t === "gainers" ? "0 2px 8px rgba(22,199,132,0.1)" : "0 2px 8px rgba(234,57,67,0.1)") : "none",
              }}
            >
              {t === "gainers" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              Top {t === "gainers" ? "Gainers" : "Losers"}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-5 w-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--cmc-neutral-5)", borderTopColor: "transparent" }} />
            </div>
          ) : (
            <div className="py-1">
              {sorted.map((coin, i) => {
                const change = coin.price_change_percentage_24h_in_currency ?? 0;
                const isUp = change >= 0;
                return (
                  <Link
                    key={coin.id}
                    href={`/coins/${coin.id}`}
                    onClick={onClose}
                    className="group flex items-center gap-3 px-5 py-2.5 transition-all hover:bg-white/[0.04]"
                    style={{ borderLeft: "2px solid transparent" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderLeftColor = isUp ? "#16c784" : "#ea3943"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderLeftColor = "transparent"; }}
                  >
                    <span className="text-[10px] font-bold w-5 text-center" style={{ color: "var(--cmc-neutral-5)" }}>
                      {i + 1}
                    </span>
                    {coin.image && (
                      <Image src={coin.image} alt={coin.name} width={28} height={28} className="rounded-full shrink-0 transition-transform group-hover:scale-110" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate" style={{ color: "var(--cmc-text)" }}>
                          {coin.symbol.toUpperCase()}
                        </span>
                        <span className="text-[10px] truncate" style={{ color: "var(--cmc-neutral-5)" }}>
                          {coin.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-data" style={{ color: "var(--cmc-neutral-5)" }}>
                        {fmtPrice(coin.current_price)}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className="text-xs font-bold font-data flex items-center gap-0.5"
                        style={{ color: isUp ? "#16c784" : "#ea3943" }}
                      >
                        {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {isUp ? "+" : ""}{change.toFixed(2)}%
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 flex items-center gap-2" style={{ borderTop: "1px solid var(--cmc-border)" }}>
          <Link
            href="/gainers-losers"
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold transition-all hover:brightness-110"
            style={{ color: "var(--pf-accent)", background: "var(--pf-accent-muted)" }}
          >
            All Movers <ChevronRight size={12} />
          </Link>
          <Link
            href="/heatmap"
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold transition-all hover:brightness-110"
            style={{ color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}
          >
            Heatmap <ChevronRight size={12} />
          </Link>
        </div>
      </div>
    </>
  );
}
