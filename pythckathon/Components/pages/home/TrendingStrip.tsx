"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Flame, TrendingUp as TrendIcon, Rocket } from "lucide-react";
import { fetchCoinGeckoTrending, fetchDexTrending, fetchPumpGraduated } from "@/lib/api/backend";
import { fmtUsd } from "@/lib/format";
import { Marquee } from "@/Components/magicui/marquee";

interface TrendingItem {
  id: string;
  symbol: string;
  name: string;
  logo: string;
  detailLink: string;
  change: string;
  isPercent: boolean;
}

type Category = "trending" | "dexscreener" | "pumpfun";

const CATS: { key: Category; label: string; icon: React.ReactNode; accent: string }[] = [
  { key: "trending", label: "Trending", icon: <TrendIcon size={11} />, accent: "#c7f284" },
  { key: "dexscreener", label: "Boosted", icon: <Flame size={11} />, accent: "#16c784" },
  { key: "pumpfun", label: "Memecoins", icon: <Rocket size={11} />, accent: "#f0b90b" },
];

function TokenChip({ item, accent }: { item: TrendingItem; accent: string }) {
  return (
    <Link
      href={item.detailLink}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-all duration-150 hover:brightness-125 hover:scale-[1.03] shrink-0"
      style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}
    >
      {item.logo ? (
        <img
          src={item.logo}
          alt={item.symbol}
          className="w-4 h-4 rounded-full shrink-0 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div
          className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0"
          style={{ background: `${accent}25`, color: accent }}
        >
          {item.symbol.slice(0, 2)}
        </div>
      )}
      <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: "var(--cmc-text)" }}>
        {item.symbol}
      </span>
      {item.change && (
        <span
          className="text-[10px] font-bold tabular-nums whitespace-nowrap"
          style={{
            color: item.isPercent
              ? item.change.startsWith("+") ? "var(--pf-up)" : item.change.startsWith("-") ? "var(--pf-down)" : "var(--cmc-neutral-5)"
              : "var(--cmc-neutral-5)",
          }}
        >
          {item.change}
        </span>
      )}
    </Link>
  );
}

export default function TrendingStrip() {
  const [tab, setTab] = useState<Category>("trending");
  const [cgItems, setCgItems] = useState<TrendingItem[]>([]);
  const [dexItems, setDexItems] = useState<TrendingItem[]>([]);
  const [pumpItems, setPumpItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [cg, dex, pump] = await Promise.allSettled([
        fetchCoinGeckoTrending(),
        fetchDexTrending(),
        fetchPumpGraduated(10),
      ]);

      if (cg.status === "fulfilled") {
        setCgItems(cg.value.slice(0, 15).map((t) => {
          const ch = t.data?.price_change_percentage_24h?.usd;
          return {
            id: `cg-${t.id}`,
            symbol: t.symbol.toUpperCase(),
            name: t.name,
            logo: t.large || t.small || t.thumb || "",
            detailLink: `/coins/${t.slug || t.id}`,
            change: ch != null ? `${ch > 0 ? "+" : ""}${ch.toFixed(1)}%` : "",
            isPercent: ch != null,
          };
        }));
      }

      if (dex.status === "fulfilled") {
        setDexItems((dex.value || []).slice(0, 15).map((t) => {
          const p = t.pair;
          const ch = p?.priceChange?.h24 || 0;
          return {
            id: `dex-${t.tokenAddress}`,
            symbol: p?.baseToken?.symbol || t.tokenAddress?.slice(0, 6) || "???",
            name: p?.baseToken?.name || "",
            logo: p?.info?.imageUrl || t.icon || "",
            detailLink: `/token/${t.chainId || "solana"}/${p?.baseToken?.address || t.tokenAddress}`,
            change: p ? `${ch > 0 ? "+" : ""}${ch.toFixed(1)}%` : "",
            isPercent: true,
          };
        }));
      }

      if (pump.status === "fulfilled") {
        setPumpItems(pump.value.slice(0, 15).map((t) => ({
          id: `pump-${t.mint}`,
          symbol: t.symbol,
          name: t.name,
          logo: t.imageUri || "",
          detailLink: `/token/solana/${t.mint}`,
          change: t.usdMarketCap > 0 ? fmtUsd(t.usdMarketCap) : "",
          isPercent: false,
        })));
      }
    } catch (err) {
      console.error("[TrendingStrip]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 60000); return () => clearInterval(iv); }, [load]);

  const items = tab === "trending" ? cgItems : tab === "dexscreener" ? dexItems : pumpItems;
  const cat = CATS.find((c) => c.key === tab)!;

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-2.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-7 w-24 rounded-full animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
        ))}
      </div>
    );
  }

  if (cgItems.length === 0 && dexItems.length === 0 && pumpItems.length === 0) return null;

  return (
    <div className="mt-3 mb-1">
      {/* Header row: label + category tabs */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider shrink-0" style={{ color: "var(--cmc-neutral-4)" }}>
          Trending
        </span>
        <div className="flex items-center gap-0.5">
          {CATS.map((c) => {
            const active = tab === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setTab(c.key)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-150"
                style={{
                  background: active ? `${c.accent}15` : "transparent",
                  color: active ? c.accent : "var(--cmc-neutral-5)",
                  border: `1px solid ${active ? `${c.accent}35` : "transparent"}`,
                }}
              >
                {c.icon} {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Marquee ticker */}
      {items.length === 0 ? (
        <p className="text-[10px] text-center py-2" style={{ color: "var(--cmc-neutral-5)" }}>No data</p>
      ) : (
        <div className="relative">
          {/* Edge fade gradients */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-12 z-10" style={{ background: "linear-gradient(to right, var(--cmc-bg), transparent)" }} />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 z-10" style={{ background: "linear-gradient(to left, var(--cmc-bg), transparent)" }} />

          <Marquee pauseOnHover className="[--duration:35s] [--gap:0.5rem] py-0.5" repeat={3}>
            {items.map((item) => (
              <TokenChip key={item.id} item={item} accent={cat.accent} />
            ))}
          </Marquee>
        </div>
      )}
    </div>
  );
}
