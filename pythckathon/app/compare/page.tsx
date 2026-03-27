"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import { Plus, X, ArrowLeftRight, Search, TrendingUp, BarChart3, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Separator } from "@/Components/ui/separator";
import { fetchStocks, fetchPythPrices, fetchCoins, type StockPrice, type CoinMarketItem } from "@/lib/api/backend";
import { fetchPythPricesBatch } from "@/lib/pyth-prices";
import { fmtCurrency as fmtUsd, fmtB as fmtLarge } from "@/lib/format";

interface CompareAsset {
  symbol: string;
  name: string;
  type: "stock" | "crypto";
  price: number;
  marketCap: number;
  pe: number;
  eps: number;
  beta: number;
  dividend: number;
  volume: number;
  logo?: string;
  change24h?: number;
  change7d?: number;
  rank?: number;
  circulatingSupply?: number;
}

const PRESETS: { label: string; symbols: { symbol: string; type: "stock" | "crypto" }[] }[] = [
  { label: "Top Crypto", symbols: [{ symbol: "BTC", type: "crypto" }, { symbol: "ETH", type: "crypto" }, { symbol: "SOL", type: "crypto" }, { symbol: "BNB", type: "crypto" }] },
  { label: "L1 Chains", symbols: [{ symbol: "ETH", type: "crypto" }, { symbol: "SOL", type: "crypto" }, { symbol: "ADA", type: "crypto" }, { symbol: "AVAX", type: "crypto" }] },
  { label: "Memecoins", symbols: [{ symbol: "DOGE", type: "crypto" }, { symbol: "SHIB", type: "crypto" }, { symbol: "BONK", type: "crypto" }, { symbol: "PEPE", type: "crypto" }] },
  { label: "Big Tech", symbols: [{ symbol: "AAPL", type: "stock" }, { symbol: "MSFT", type: "stock" }, { symbol: "GOOGL", type: "stock" }, { symbol: "NVDA", type: "stock" }] },
];

const ASSET_COLORS = ["#3B82F6", "#F59E0B", "#10B981", "#EF4444"];

export default function ComparePage() {
  const [stocks, setStocks] = useState<StockPrice[]>([]);
  const [coinData, setCoinData] = useState<CoinMarketItem[]>([]);
  const [selected, setSelected] = useState<CompareAsset[]>([]);
  const [addType, setAddType] = useState<"stock" | "crypto">("stock");
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  useEffect(() => {
    fetchStocks().then(setStocks).catch(() => {});
    fetchCoins(1, 50).then(setCoinData).catch(() => {});
  }, []);

  // Pyth real-time price polling for selected crypto assets
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const cryptoKey = selected.filter(a => a.type === "crypto").map(a => a.symbol).join(",");
  useEffect(() => {
    const cryptoSymbols = cryptoKey.split(",").filter(Boolean);
    if (cryptoSymbols.length === 0) return;
    const refresh = async () => {
      try {
        const prices = await fetchPythPricesBatch(cryptoSymbols);
        setLivePrices(prev => ({ ...prev, ...prices }));
        setSelected(prev => prev.map(a => {
          if (a.type === "crypto" && prices[a.symbol] && prices[a.symbol] > 0) {
            return { ...a, price: prices[a.symbol] };
          }
          return a;
        }));
      } catch {}
    };
    refresh();
    const iv = setInterval(refresh, 10_000);
    return () => clearInterval(iv);
  }, [cryptoKey]);

  const addAsset = (symbol: string, type: "stock" | "crypto") => {
    if (selected.length >= 4) return;
    if (selected.some((s) => s.symbol === symbol)) return;

    if (type === "stock") {
      const s = stocks.find((st) => st.ticker === symbol);
      if (!s) return;
      setSelected((prev) => [...prev, {
        symbol: s.ticker, name: s.name, type: "stock", price: s.price,
        marketCap: s.marketCap, pe: s.pe, eps: s.eps, beta: s.beta,
        dividend: s.dividend, volume: s.volume, logo: s.logo,
      }]);
    } else {
      const coin = coinData.find((c) => c.symbol.toUpperCase() === symbol);
      if (!coin) return;
      setSelected((prev) => [...prev, {
        symbol: coin.symbol.toUpperCase(), name: coin.name, type: "crypto",
        price: coin.current_price,
        marketCap: coin.market_cap || 0,
        pe: 0, eps: 0, beta: 0, dividend: 0,
        volume: coin.total_volume || 0,
        logo: coin.image,
        change24h: coin.price_change_percentage_24h || 0,
        change7d: coin.price_change_percentage_7d_in_currency || 0,
        rank: coin.market_cap_rank || 0,
        circulatingSupply: coin.circulating_supply || 0,
      }]);
    }
    setShowPicker(false);
  };

  const removeAsset = (symbol: string) => {
    setSelected((prev) => prev.filter((s) => s.symbol !== symbol));
  };

  const metrics: { label: string; render: (a: CompareAsset) => React.ReactNode; numericValue?: (a: CompareAsset) => number | null; higherIsBetter?: boolean; tooltip?: string }[] = [
    { label: "Price", render: (a) => fmtUsd(a.price), numericValue: (a) => a.price, higherIsBetter: true },
    { label: "24h Change", tooltip: "Daily performance", render: (a) => a.change24h !== undefined && a.change24h !== 0 ? <span style={{ color: a.change24h >= 0 ? "#16c784" : "#ea3943" }}>{a.change24h >= 0 ? "+" : ""}{a.change24h.toFixed(2)}%</span> : "—", numericValue: (a) => a.change24h ?? null, higherIsBetter: true },
    { label: "7d Change", tooltip: "Weekly performance", render: (a) => a.change7d !== undefined && a.change7d !== 0 ? <span style={{ color: a.change7d >= 0 ? "#16c784" : "#ea3943" }}>{a.change7d >= 0 ? "+" : ""}{a.change7d.toFixed(2)}%</span> : "—", numericValue: (a) => a.change7d ?? null, higherIsBetter: true },
    { label: "Market Cap", render: (a) => a.marketCap > 0 ? fmtLarge(a.marketCap) : "—", numericValue: (a) => a.marketCap, higherIsBetter: true },
    { label: "Rank", tooltip: "Lower is better", render: (a) => a.rank && a.rank > 0 ? `#${a.rank}` : "—", numericValue: (a) => a.rank ?? null, higherIsBetter: false },
    { label: "Volume", tooltip: "24h trading volume", render: (a) => a.volume > 0 ? fmtLarge(a.volume) : "—", numericValue: (a) => a.volume, higherIsBetter: true },
    { label: "Vol/MCap", tooltip: "Liquidity ratio", render: (a) => a.volume > 0 && a.marketCap > 0 ? `${(a.volume / a.marketCap * 100).toFixed(2)}%` : "—", numericValue: (a) => a.volume > 0 && a.marketCap > 0 ? a.volume / a.marketCap : null, higherIsBetter: true },
    { label: "Circ. Supply", render: (a) => a.circulatingSupply && a.circulatingSupply > 0 ? `${(a.circulatingSupply / 1e6).toFixed(1)}M` : "—" },
    { label: "P/E Ratio", tooltip: "Price to earnings", render: (a) => a.pe > 0 ? a.pe.toFixed(1) : "—", numericValue: (a) => a.pe > 0 ? a.pe : null, higherIsBetter: false },
    { label: "EPS", tooltip: "Earnings per share", render: (a) => a.eps !== 0 ? `$${a.eps.toFixed(2)}` : "—", numericValue: (a) => a.eps !== 0 ? a.eps : null, higherIsBetter: true },
    { label: "Beta", tooltip: "Volatility measure", render: (a) => a.beta > 0 ? a.beta.toFixed(2) : "—" },
    { label: "Dividend", render: (a) => a.dividend > 0 ? `${a.dividend.toFixed(2)}%` : "N/A", numericValue: (a) => a.dividend > 0 ? a.dividend : null, higherIsBetter: true },
    { label: "Type", render: (a) => a.type === "stock" ? "Equity" : "Crypto" },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--cmc-text)" }}>Compare</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--cmc-text-sub)" }}>
            Compare up to 4 stocks or cryptos side by side
          </p>
        </div>
        {selected.length < 4 && (
          <Button size="sm" onClick={() => setShowPicker(!showPicker)} className="gap-1.5" style={{ background: "var(--pf-accent)", color: "#fff" }}>
            <Plus size={13} /> Add Asset
          </Button>
        )}
      </div>

      {/* Quick Presets */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        <Zap size={12} style={{ color: "var(--pf-accent)" }} />
        <span className="text-[10px] font-semibold uppercase shrink-0" style={{ color: "var(--cmc-neutral-5)" }}>Quick:</span>
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => { setSelected([]); setTimeout(() => p.symbols.forEach(s => addAsset(s.symbol, s.type)), 100); }}
            className="shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-all hover:opacity-80"
            style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Asset Picker */}
      {showPicker && (
        <Card className="border-(--cmc-border) bg-transparent mb-5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => { setAddType("stock"); setPickerSearch(""); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: addType === "stock" ? "var(--cmc-text)" : "var(--cmc-neutral-2)", color: addType === "stock" ? "var(--cmc-bg)" : "var(--cmc-text)" }}
              >Stocks</button>
              <button onClick={() => { setAddType("crypto"); setPickerSearch(""); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: addType === "crypto" ? "var(--pf-accent)" : "var(--cmc-neutral-2)", color: addType === "crypto" ? "#fff" : "var(--cmc-text)" }}
              >Crypto</button>
              <div className="relative ml-auto">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--cmc-neutral-5)" }} />
                <input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="Search..." className="rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none w-40" style={{ background: "var(--cmc-neutral-1)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {addType === "stock" ? stocks.filter(s => !pickerSearch || s.ticker.toLowerCase().includes(pickerSearch.toLowerCase()) || s.name?.toLowerCase().includes(pickerSearch.toLowerCase())).map((s) => (
                <button key={s.ticker} onClick={() => addAsset(s.ticker, "stock")}
                  disabled={selected.some((sel) => sel.symbol === s.ticker)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:opacity-80 disabled:opacity-30"
                  style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}
                >
                  {s.logo && <img src={s.logo} alt={s.ticker} className="w-4 h-4 rounded" />}
                  {s.ticker}
                </button>
              )) : coinData.filter(c => !pickerSearch || c.symbol.toLowerCase().includes(pickerSearch.toLowerCase()) || c.name?.toLowerCase().includes(pickerSearch.toLowerCase())).slice(0, 30).map((c) => (
                <button key={c.symbol} onClick={() => addAsset(c.symbol.toUpperCase(), "crypto")}
                  disabled={selected.some((sel) => sel.symbol === c.symbol.toUpperCase())}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:opacity-80 disabled:opacity-30"
                  style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}
                >
                  {c.image && <img src={c.image} alt={c.symbol} className="w-4 h-4 rounded-full" />}
                  {c.symbol.toUpperCase()}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison Table */}
      {selected.length === 0 ? (
        <div className="py-16 text-center rounded-2xl" style={{ border: "2px dashed var(--cmc-border)" }}>
          <ArrowLeftRight size={36} className="mx-auto mb-3" style={{ color: "var(--cmc-neutral-4)" }} />
          <p className="text-sm font-bold mb-1" style={{ color: "var(--cmc-text)" }}>Compare assets side by side</p>
          <p className="text-xs mb-4" style={{ color: "var(--cmc-neutral-5)" }}>Select up to 4 stocks or cryptocurrencies to compare metrics, prices, and performance.</p>
          <Button size="sm" onClick={() => setShowPicker(true)} className="gap-1.5" style={{ background: "var(--pf-accent)", color: "#fff" }}>
            <Plus size={13} /> Get Started
          </Button>
        </div>
      ) : (
        <>
          {/* Asset header cards */}
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: `repeat(${selected.length}, 1fr)` }}>
            {selected.map((a, i) => (
              <div key={a.symbol} className="rounded-xl p-3 relative overflow-hidden" style={{ border: `2px solid ${ASSET_COLORS[i]}25`, background: "var(--cmc-neutral-1)" }}>
                <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: ASSET_COLORS[i] }} />
                <div className="flex items-center gap-2 mb-2">
                  {a.logo && <img src={a.logo} alt={a.symbol} className="w-8 h-8 rounded-full" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>{a.symbol}</span>
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: a.type === "crypto" ? "rgba(153,69,255,0.1)" : "rgba(20,241,149,0.1)", color: a.type === "crypto" ? "var(--pf-accent)" : "var(--pf-teal)" }}>{a.type === "crypto" ? "Crypto" : "Stock"}</span>
                    </div>
                    <p className="text-[10px] truncate" style={{ color: "var(--cmc-neutral-5)" }}>{a.name}</p>
                  </div>
                  <button onClick={() => removeAsset(a.symbol)} className="p-1 rounded-full hover:bg-red-500/10 shrink-0"><X size={12} style={{ color: "#ea3943" }} /></button>
                </div>
                <p className="text-lg font-bold tabular-nums" style={{ color: "var(--cmc-text)" }}>{fmtUsd(a.price)}</p>
                {a.change24h !== undefined && a.change24h !== 0 && (
                  <p className="text-[11px] font-semibold mt-0.5" style={{ color: a.change24h >= 0 ? "#16c784" : "#ea3943" }}>
                    {a.change24h >= 0 ? "+" : ""}{a.change24h.toFixed(2)}% (24h)
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Comparison Table */}
          <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--cmc-border)" }}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase w-32" style={{ color: "var(--cmc-neutral-5)", background: "var(--cmc-neutral-1)" }}>Metric</th>
                  {selected.map((a, i) => (
                    <th key={a.symbol} className="px-4 py-2.5 text-center text-xs font-bold" style={{ background: "var(--cmc-neutral-1)", color: ASSET_COLORS[i] }}>
                      {a.symbol}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => {
                  // Determine best value for highlighting
                  const numericValues = selected.map(a => m.numericValue ? m.numericValue(a) : null);
                  const validNums = numericValues.filter((v): v is number => v !== null && v !== 0);
                  const bestIdx = m.higherIsBetter !== undefined && validNums.length >= 2
                    ? numericValues.indexOf(m.higherIsBetter ? Math.max(...validNums) : Math.min(...validNums))
                    : -1;
                  return (
                    <tr key={m.label} className="transition-colors" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                      <td className="px-4 py-2.5 text-[11px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>
                        {m.label}
                        {m.tooltip && <span className="block text-[9px] font-normal" style={{ color: "var(--cmc-neutral-4)" }}>{m.tooltip}</span>}
                      </td>
                      {selected.map((a, i) => (
                        <td key={a.symbol} className="px-4 py-2.5 text-center text-sm font-medium" style={{ color: bestIdx === i ? "#16c784" : "var(--cmc-text)", fontWeight: bestIdx === i ? 700 : 500 }}>
                          {m.render(a)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Visual comparison bars */}
          {selected.length >= 2 && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {/* Market Cap bar */}
              {selected.some(a => a.marketCap > 0) && (
                <div className="rounded-xl p-4" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
                  <div className="flex items-center gap-1.5 mb-3">
                    <BarChart3 size={12} style={{ color: "var(--pf-accent)" }} />
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Market Cap</p>
                  </div>
                  <div className="space-y-2">
                    {selected.filter(a => a.marketCap > 0).map((a, i) => {
                      const maxMc = Math.max(...selected.map(s => s.marketCap));
                      const pct = maxMc > 0 ? (a.marketCap / maxMc) * 100 : 0;
                      return (
                        <div key={a.symbol} className="flex items-center gap-2">
                          <span className="text-[10px] font-bold w-10 shrink-0" style={{ color: ASSET_COLORS[selected.indexOf(a)] }}>{a.symbol}</span>
                          <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: "var(--cmc-neutral-2)" }}>
                            <div className="h-full rounded-full flex items-center px-2 transition-all duration-500" style={{ width: `${Math.max(pct, 6)}%`, background: ASSET_COLORS[selected.indexOf(a)] }}>
                              <span className="text-[8px] font-bold text-white truncate">{fmtLarge(a.marketCap)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Volume bar */}
              {selected.some(a => a.volume > 0) && (
                <div className="rounded-xl p-4" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
                  <div className="flex items-center gap-1.5 mb-3">
                    <TrendingUp size={12} style={{ color: "var(--pf-teal)" }} />
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>24h Volume</p>
                  </div>
                  <div className="space-y-2">
                    {selected.filter(a => a.volume > 0).map((a) => {
                      const maxVol = Math.max(...selected.map(s => s.volume));
                      const pct = maxVol > 0 ? (a.volume / maxVol) * 100 : 0;
                      return (
                        <div key={a.symbol} className="flex items-center gap-2">
                          <span className="text-[10px] font-bold w-10 shrink-0" style={{ color: ASSET_COLORS[selected.indexOf(a)] }}>{a.symbol}</span>
                          <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: "var(--cmc-neutral-2)" }}>
                            <div className="h-full rounded-full flex items-center px-2 transition-all duration-500" style={{ width: `${Math.max(pct, 6)}%`, background: ASSET_COLORS[selected.indexOf(a)] }}>
                              <span className="text-[8px] font-bold text-white truncate">{fmtLarge(a.volume)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="mt-3 flex items-center justify-center gap-1.5 text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
        {Object.keys(livePrices).length > 0 && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#16c784" }} />}
        Prices powered by <span className="font-bold">Pyth Network</span> oracle data
      </div>
    </div>
  );
}
