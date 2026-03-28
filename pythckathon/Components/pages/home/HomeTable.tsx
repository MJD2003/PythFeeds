"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Sparklines, SparklinesLine } from "react-sparklines";
import { Star, TrendingUp, TrendingDown, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import type { CoinData } from "@/lib/types";
import { formatPrice, formatLargeValue, startsWithHttp } from "@/lib/format";
import { useCurrency } from "@/lib/currency-context";
import type { HomeFilters } from "./HomeContent";
import { fetchMarketMovers, fetchNewListings, type CoinMarketItem } from "@/lib/api/backend";

/** CoinGecko sometimes returns `price_change_percentage_24h` without `_in_currency`. */
function normalizeTabCoin(c: CoinMarketItem | CoinData): CoinData {
  const r = c as CoinData & {
    price_change_percentage_24h?: number;
    price_change_percentage_7d?: number;
    price_change_percentage_1h?: number;
  };
  return {
    ...r,
    price_change_percentage_1h_in_currency:
      r.price_change_percentage_1h_in_currency ?? r.price_change_percentage_1h ?? 0,
    price_change_percentage_24h_in_currency:
      r.price_change_percentage_24h_in_currency ?? r.price_change_percentage_24h ?? 0,
    price_change_percentage_7d_in_currency:
      r.price_change_percentage_7d_in_currency ?? r.price_change_percentage_7d ?? 0,
    sparkline_in_7d: r.sparkline_in_7d ?? { price: [] },
  };
}

interface HomeTableProps {
  coins: CoinData[];
  trendingIds?: Set<string>;
  filters?: HomeFilters;
  loading?: boolean;
  pythPrices?: Record<string, { price: number; prev: number }>;
}

type SortKey = "rank" | "name" | "price" | "1h" | "24h" | "7d" | "mcap" | "vol" | "supply";
type SortDir = "asc" | "desc";
type TabFilter = "top" | "trending" | "gainers" | "losers" | "new";

const BATCH = 30;
const TABS: { key: TabFilter; label: string }[] = [
  { key: "top", label: "Top" },
  { key: "trending", label: "Trending" },
  { key: "gainers", label: "Gainers" },
  { key: "losers", label: "Losers" },
  { key: "new", label: "New" },
];

function PctCell({ value }: { value: number }) {
  if (value === null || value === undefined) return <span style={{ color: "var(--cmc-neutral-5)" }}>—</span>;
  const up = value >= 0;
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap" style={{ color: up ? "var(--cmc-up)" : "var(--cmc-down)" }}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

function getSortValue(coin: CoinData, key: SortKey): number | string {
  switch (key) {
    case "rank": return coin.market_cap_rank;
    case "name": return coin.name.toLowerCase();
    case "price": return coin.current_price;
    case "1h": return coin.price_change_percentage_1h_in_currency ?? 0;
    case "24h": return coin.price_change_percentage_24h_in_currency ?? 0;
    case "7d": return coin.price_change_percentage_7d_in_currency ?? 0;
    case "mcap": return coin.market_cap;
    case "vol": return coin.total_volume;
    case "supply": return coin.circulating_supply;
    default: return 0;
  }
}

export default function HomeTable({ coins, trendingIds = new Set(), filters, loading: parentLoading, pythPrices }: HomeTableProps) {
  const [starred, setStarred] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(localStorage.getItem("pf_watchlist") || "[]")); } catch { return new Set(); }
  });
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [visibleCount, setVisibleCount] = useState(BATCH);
  const [activeTab, setActiveTab] = useState<TabFilter>("top");
  const [remoteTabCoins, setRemoteTabCoins] = useState<CoinData[] | null>(null);
  const [remoteTabLoading, setRemoteTabLoading] = useState(false);

  // Live prices from Pyth (passed from parent)
  const livePrices = pythPrices || {};

  // Gainers / Losers / New — fetch real lists from API (not just resorting the top-100 row)
  useEffect(() => {
    if (activeTab === "top" || activeTab === "trending") {
      setRemoteTabCoins(null);
      setRemoteTabLoading(false);
      return;
    }
    let cancelled = false;
    setRemoteTabLoading(true);
    (async () => {
      try {
        let raw: CoinMarketItem[];
        if (activeTab === "gainers") raw = await fetchMarketMovers("gainers", 50);
        else if (activeTab === "losers") raw = await fetchMarketMovers("losers", 50);
        else raw = await fetchNewListings(60);
        if (!cancelled) setRemoteTabCoins(raw.map(normalizeTabCoin));
      } catch {
        if (!cancelled) setRemoteTabCoins(null);
      } finally {
        if (!cancelled) setRemoteTabLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  // Persist watchlist
  useEffect(() => {
    localStorage.setItem("pf_watchlist", JSON.stringify([...starred]));
  }, [starred]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "1") setActiveTab("top");
      else if (e.key === "2") setActiveTab("trending");
      else if (e.key === "3") setActiveTab("gainers");
      else if (e.key === "4") setActiveTab("losers");
      else if (e.key === "5") setActiveTab("new");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Apply parent sort override
  useEffect(() => {
    if (!filters?.sort) return;
    const [key, dir] = filters.sort.split("_") as [string, string];
    const keyMap: Record<string, SortKey> = { mcap: "mcap", vol: "vol", price: "price" };
    if (keyMap[key]) {
      setSortKey(keyMap[key]);
      setSortDir(dir === "asc" ? "asc" : "desc");
    }
  }, [filters?.sort]);

  const pct24 = (c: CoinData) =>
    c.price_change_percentage_24h_in_currency ??
    (c as CoinData & { price_change_percentage_24h?: number }).price_change_percentage_24h ??
    0;

  // Filter coins based on active tab + parent filters (mcap, volume)
  const tabFiltered = useMemo(() => {
    let result: CoinData[];
    switch (activeTab) {
      case "trending":
        result = trendingIds.size > 0 ? coins.filter(c => trendingIds.has(c.id)) : coins.slice(0, 20);
        break;
      case "gainers":
        result = remoteTabCoins?.length
          ? remoteTabCoins
          : [...coins].sort((a, b) => pct24(b) - pct24(a)).slice(0, 50);
        break;
      case "losers":
        result = remoteTabCoins?.length
          ? remoteTabCoins
          : [...coins].sort((a, b) => pct24(a) - pct24(b)).slice(0, 50);
        break;
      case "new":
        result = remoteTabCoins?.length
          ? remoteTabCoins
          : [...coins]
              .sort((a, b) => (a.market_cap || 0) - (b.market_cap || 0))
              .slice(0, 50);
        break;
      default:
        result = coins;
    }
    // Apply mcap/volume filters from toolbar
    if (filters) {
      if (filters.minMcap > 0) result = result.filter(c => c.market_cap >= filters.minMcap);
      if (filters.maxMcap > 0) result = result.filter(c => c.market_cap <= filters.maxMcap);
      if (filters.minVol > 0) result = result.filter(c => c.total_volume >= filters.minVol);
    }
    return result;
  }, [coins, activeTab, trendingIds, filters, remoteTabCoins]);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const toggleStar = (id: string) => {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Get live price for a coin (SSE overlay)
  const getLivePrice = (coin: CoinData): { price: number; flash: "up" | "down" | null } => {
    const sym = coin.symbol.toUpperCase();
    const live = livePrices[sym];
    if (!live) return { price: coin.current_price, flash: null };
    const flash = live.price > live.prev ? "up" : live.price < live.prev ? "down" : null;
    return { price: live.price, flash };
  };

  const { format: fmtCurrency, symbol: currSym } = useCurrency();

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir(key === "rank" || key === "name" ? "asc" : "desc");
      return key;
    });
  }, []);

  const sorted = useMemo(() => {
    const arr = [...tabFiltered];
    arr.sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return arr;
  }, [tabFiltered, sortKey, sortDir]);

  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          setLoadingMore(true);
          setTimeout(() => {
            setVisibleCount((c) => Math.min(c + BATCH, sorted.length));
            setLoadingMore(false);
          }, 300);
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, sorted.length]);

  // Reset visible count on sort/tab change
  useEffect(() => {
    setVisibleCount(BATCH);
  }, [sortKey, sortDir, activeTab]);

  const needsRemoteTab =
    activeTab === "gainers" || activeTab === "losers" || activeTab === "new";
  const tableLoading = Boolean(parentLoading || (needsRemoteTab && remoteTabLoading));

  const headers: { key: SortKey | "star" | "7days"; label: string; width: string; align: string; sortable: boolean; hideClass?: string }[] = [
    { key: "star", label: "", width: "w-[28px]", align: "text-center", sortable: false },
    { key: "rank", label: "#", width: "w-[40px]", align: "text-left", sortable: true },
    { key: "name", label: "Name", width: "min-w-[140px] sm:min-w-[180px]", align: "text-left", sortable: true },
    { key: "price", label: "Price", width: "w-[90px] sm:w-[110px]", align: "text-right", sortable: true },
    { key: "1h", label: "1h %", width: "w-[72px]", align: "text-right", sortable: true, hideClass: "hidden md:table-cell" },
    { key: "24h", label: "24h %", width: "w-[72px]", align: "text-right", sortable: true },
    { key: "7d", label: "7d %", width: "w-[72px]", align: "text-right", sortable: true, hideClass: "hidden lg:table-cell" },
    { key: "mcap", label: "Market Cap", width: "w-[150px]", align: "text-right", sortable: true, hideClass: "hidden sm:table-cell" },
    { key: "vol", label: "Volume(24h)", width: "w-[150px]", align: "text-right", sortable: true, hideClass: "hidden lg:table-cell" },
    { key: "supply", label: "Circulating Supply", width: "w-[160px]", align: "text-right", sortable: true, hideClass: "hidden xl:table-cell" },
    { key: "7days", label: "Last 7 Days", width: "w-[148px]", align: "text-right", sortable: false, hideClass: "hidden xl:table-cell" },
  ];

  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col) return <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-50" />;
    return sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />;
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4">
      {/* Tab filters */}
      <div className="flex items-center gap-1 mb-4 pb-0.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-3.5 py-1.5 text-[13px] font-medium rounded-lg transition-all press-scale"
            style={{
              color: activeTab === tab.key ? "var(--cmc-text)" : "var(--cmc-neutral-5)",
              background: activeTab === tab.key ? "var(--cmc-neutral-2)" : "transparent",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--cmc-border)" }}>
              {headers.map((h) => (
                <th
                  key={h.key}
                  className={`group sticky top-0 z-10 px-2 sm:px-2.5 py-3 text-xs font-semibold ${h.align} ${h.width} ${h.sortable ? "cursor-pointer select-none hover:opacity-80" : ""} ${h.hideClass || ""}`}
                  style={{ background: "var(--cmc-bg)", color: "var(--cmc-neutral-5)" }}
                  onClick={() => h.sortable && handleSort(h.key as SortKey)}
                >
                  <span className="inline-flex items-center gap-1">
                    {h.label}
                    {h.sortable && <SortIcon col={h.key} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableLoading ? (
              // Skeleton loader rows
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={`skel-${i}`} style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                  <td className="px-2.5 py-4"><div className="h-3 w-3 rounded-full animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} /></td>
                  <td className="px-2.5 py-4"><div className="h-3 w-6 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} /></td>
                  <td className="px-2.5 py-4"><div className="flex items-center gap-2"><div className="h-6 w-6 rounded-full animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} /><div className="h-3 w-24 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} /></div></td>
                  <td className="px-2.5 py-4 text-right"><div className="ml-auto h-3 w-16 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} /></td>
                  <td className="px-2.5 py-4 text-right"><div className="ml-auto h-3 w-10 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} /></td>
                  <td className="px-2.5 py-4 text-right"><div className="ml-auto h-3 w-10 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} /></td>
                  <td className="px-2.5 py-4 text-right"><div className="ml-auto h-3 w-10 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} /></td>
                  <td className="px-2.5 py-4 text-right"><div className="ml-auto h-3 w-20 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} /></td>
                  <td className="px-2.5 py-4 text-right"><div className="ml-auto h-3 w-20 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} /></td>
                  <td className="px-2.5 py-4 text-right"><div className="ml-auto h-3 w-20 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} /></td>
                  <td className="px-2.5 py-4 text-right"><div className="ml-auto h-8 w-[135px] rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} /></td>
                </tr>
              ))
            ) : visible.map((coin) => {
              const isStarred = starred.has(coin.id);
              const change7d = coin.price_change_percentage_7d_in_currency;
              const sparkColor = change7d >= 0 ? "var(--cmc-up)" : "var(--cmc-down)";
              const { price: livePrice, flash } = getLivePrice(coin);

              return (
                <tr
                  key={coin.id}
                  className="group transition-colors cursor-pointer hover:bg-(--cmc-neutral-1)"
                  style={{ borderBottom: "1px solid var(--cmc-border)" }}
                  onClick={(e) => {
                    // Don't navigate if clicking star button
                    if ((e.target as HTMLElement).closest("button")) return;
                    window.location.href = `/coins/${coin.id}`;
                  }}
                >
                  <td className="px-2 sm:px-2.5 py-3.5 text-center">
                    <button
                      type="button"
                      title={isStarred ? "Remove from watchlist" : "Add to watchlist"}
                      aria-label={isStarred ? "Remove from watchlist" : "Add to watchlist"}
                      onClick={() => toggleStar(coin.id)}
                      style={{ color: isStarred ? "var(--cmc-star)" : "var(--cmc-neutral-3)" }}
                    >
                      <Star size={14} fill={isStarred ? "currentColor" : "none"} />
                    </button>
                  </td>

                  <td className="px-2 sm:px-2.5 py-3.5 text-left" style={{ color: "var(--cmc-text-sub)" }}>
                    {coin.market_cap_rank}
                  </td>

                  <td className="px-2 sm:px-2.5 py-3.5 text-left">
                    <Link href={`/coins/${coin.id}`} className="flex items-center gap-2">
                      {startsWithHttp(coin.image) ? (
                        <Image src={coin.image} alt={coin.name} width={24} height={24} className="h-6 w-6 rounded-full" />
                      ) : (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] text-white" style={{ background: "var(--cmc-neutral-4)" }}>?</div>
                      )}
                      <span className="font-semibold truncate max-w-[100px] sm:max-w-none" style={{ color: "var(--cmc-text)" }}>{coin.name}</span>
                      <span className="text-xs font-normal uppercase hidden sm:inline" style={{ color: "var(--cmc-neutral-5)" }}>{coin.symbol}</span>
                    </Link>
                  </td>

                  <td
                    className={`px-2 sm:px-2.5 py-3.5 text-right font-medium font-data tabular-nums transition-colors duration-500 ${flash === "up" ? "price-flash-up" : flash === "down" ? "price-flash-down" : ""}`}
                    style={{ color: "var(--cmc-text)" }}
                  >
                    {fmtCurrency(livePrice)}
                  </td>

                  <td className="hidden md:table-cell px-2.5 py-3.5 text-right text-xs">
                    <PctCell value={coin.price_change_percentage_1h_in_currency} />
                  </td>

                  <td className="px-2 sm:px-2.5 py-3.5 text-right text-xs">
                    <PctCell value={coin.price_change_percentage_24h_in_currency} />
                  </td>

                  <td className="hidden lg:table-cell px-2.5 py-3.5 text-right text-xs">
                    <PctCell value={coin.price_change_percentage_7d_in_currency} />
                  </td>

                  <td className="hidden sm:table-cell px-2.5 py-3.5 text-right">
                    <span className="font-medium" style={{ color: "var(--cmc-text)" }}>
                      {currSym}{formatLargeValue(coin.market_cap)}
                    </span>
                  </td>

                  <td className="hidden lg:table-cell px-2.5 py-3.5 text-right">
                    <div className="font-medium" style={{ color: "var(--cmc-text)" }}>
                      {currSym}{formatLargeValue(coin.total_volume)}
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>
                      {(coin.total_volume / coin.current_price).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} {coin.symbol.toUpperCase()}
                    </div>
                  </td>

                  <td className="hidden xl:table-cell px-2.5 py-3.5 text-right">
                    <span style={{ color: "var(--cmc-text)" }}>
                      {formatLargeValue(coin.circulating_supply)}{" "}
                      <span className="uppercase">{coin.symbol}</span>
                    </span>
                  </td>

                  <td className="hidden xl:table-cell px-2.5 py-3.5 text-right">
                    <div className="ml-auto w-[135px]">
                      <Sparklines data={coin.sparkline_in_7d.price} width={135} height={40} margin={2}>
                        <SparklinesLine color={sparkColor} style={{ fill: "none", strokeWidth: "1.5px" }} />
                      </Sparklines>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />
      {loadingMore && (
        <div className="flex items-center justify-center py-4">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--cmc-neutral-5)" }} />
        </div>
      )}
      {!hasMore && visible.length > 0 && (
        <p className="py-4 text-center text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
          Showing all {visible.length} coins
        </p>
      )}
      {/* Pyth attribution */}
      {Object.keys(livePrices).length > 0 && (
        <div className="flex items-center justify-center gap-1.5 py-2 text-[9px]" style={{ color: "var(--cmc-neutral-5)" }}>
          <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#16c784" }} />
          Prices powered by <span className="font-bold">Pyth Network</span> — updated every 10s
        </div>
      )}
    </div>
  );
}
