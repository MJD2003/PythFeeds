"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { fetchSearch, fetchCoins } from "@/lib/api/backend";
import type { SearchResult, CoinMarketItem } from "@/lib/api/backend";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const [query, setQuery] = useState(q);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [coins, setCoins] = useState<CoinMarketItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (q) setQuery(q); }, [q]);

  useEffect(() => {
    if (query.length < 2) { setResults(null); return; }
    setLoading(true);
    Promise.all([
      fetchSearch(query).catch(() => null),
      fetchCoins(1, 100).catch(() => []),
    ]).then(([searchData, coinData]) => {
      setResults(searchData);
      if (Array.isArray(coinData)) setCoins(coinData as CoinMarketItem[]);
      setLoading(false);
    });
  }, [query]);

  const searchCoins = results?.coins || [];
  const searchExchanges = results?.exchanges || [];
  // Match search results against full coin data for prices
  const coinMap = new Map(coins.map((c) => [c.id, c]));

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      {/* Search input */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--cmc-neutral-5)" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search coins, stocks, exchanges..."
          className="w-full rounded-xl border py-3 pl-11 pr-4 text-sm outline-none transition-colors focus:border-[var(--pf-accent)]"
          style={{ background: "var(--cmc-neutral-1)", color: "var(--cmc-text)", borderColor: "var(--cmc-border)" }}
          autoFocus
        />
      </div>

      {loading && (
        <div className="py-16 text-center">
          <Loader2 size={28} className="mx-auto animate-spin mb-2" style={{ color: "var(--cmc-neutral-5)" }} />
          <p className="text-sm" style={{ color: "var(--cmc-neutral-5)" }}>Searching...</p>
        </div>
      )}

      {!loading && query.length >= 2 && searchCoins.length === 0 && searchExchanges.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-lg font-bold mb-1" style={{ color: "var(--cmc-text)" }}>No results found</p>
          <p className="text-sm" style={{ color: "var(--cmc-neutral-5)" }}>Try searching for something else</p>
        </div>
      )}

      {/* Crypto results */}
      {searchCoins.length > 0 && (
        <div className="mb-8">
          <h2 className="text-base font-bold mb-3" style={{ color: "var(--cmc-text)" }}>Cryptocurrencies ({searchCoins.length})</h2>
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--cmc-border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                  {["#", "Coin", "Price", "24h %", "Market Cap"].map((h, i) => (
                    <th key={h} className={`px-3 py-2.5 text-xs font-semibold ${i <= 1 ? "text-left" : "text-right"}`} style={{ color: "var(--cmc-neutral-5)", background: "var(--cmc-bg)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {searchCoins.map((coin) => {
                  const full = coinMap.get(coin.id);
                  return (
                    <tr key={coin.id} style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--cmc-neutral-5)" }}>{coin.market_cap_rank || "—"}</td>
                      <td className="px-3 py-2.5">
                        <Link href={`/coins/${coin.id}`} className="flex items-center gap-2 hover:opacity-80">
                          <Image src={coin.thumb} alt={coin.name} width={24} height={24} className="rounded-full" />
                          <span className="font-medium" style={{ color: "var(--cmc-text)" }}>{coin.name}</span>
                          <span className="text-xs uppercase" style={{ color: "var(--cmc-neutral-5)" }}>{coin.symbol}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium" style={{ color: "var(--cmc-text)" }}>
                        {full ? `$${full.current_price.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {full ? (
                          <span className="inline-flex items-center gap-0.5" style={{ color: (full.price_change_percentage_24h_in_currency ?? 0) >= 0 ? "#16c784" : "#ea3943" }}>
                            {(full.price_change_percentage_24h_in_currency ?? 0) >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {Math.abs(full.price_change_percentage_24h_in_currency ?? 0).toFixed(2)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs" style={{ color: "var(--cmc-text)" }}>
                        {full && full.market_cap > 0 ? `$${(full.market_cap / 1e9).toFixed(2)}B` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Exchange results */}
      {searchExchanges.length > 0 && (
        <div className="mb-8">
          <h2 className="text-base font-bold mb-3" style={{ color: "var(--cmc-text)" }}>Exchanges ({searchExchanges.length})</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {searchExchanges.map((ex) => (
              <Link key={ex.id} href="/exchanges" className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:opacity-80" style={{ borderColor: "var(--cmc-border)" }}>
                <Image src={ex.thumb} alt={ex.name} width={32} height={32} className="rounded-full" />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--cmc-text)" }}>{ex.name}</p>
                  <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>Exchange</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {query.length < 2 && (
        <div className="py-16 text-center">
          <Search size={40} className="mx-auto mb-3" style={{ color: "var(--cmc-neutral-4)" }} />
          <p className="text-sm" style={{ color: "var(--cmc-neutral-5)" }}>Type at least 2 characters to search</p>
        </div>
      )}
    </div>
  );
}
