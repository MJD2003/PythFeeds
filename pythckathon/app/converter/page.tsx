"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import { ArrowDownUp, Search, X, Loader2, Calculator, Zap, RefreshCw } from "lucide-react";
import { fetchCoins, type CoinMarketItem } from "@/lib/api/backend";
import { fetchPythPrice } from "@/lib/pyth-prices";

interface Asset {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number; // USD price
}

const FIAT: Asset[] = [
  { id: "usd", symbol: "USD", name: "US Dollar", image: "", price: 1 },
  { id: "eur", symbol: "EUR", name: "Euro", image: "", price: 1.09 },
  { id: "gbp", symbol: "GBP", name: "British Pound", image: "", price: 1.27 },
  { id: "jpy", symbol: "JPY", name: "Japanese Yen", image: "", price: 0.0067 },
];

const POPULAR_PAIRS: { from: string; to: string }[] = [
  { from: "bitcoin", to: "usd" },
  { from: "ethereum", to: "usd" },
  { from: "solana", to: "usd" },
  { from: "bitcoin", to: "ethereum" },
];

function fmtResult(n: number): string {
  if (n === 0) return "0";
  if (n >= 1e9) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  if (n >= 0.0001) return n.toFixed(6);
  return n.toPrecision(4);
}

function AssetPicker({ assets, value, onChange, label, open, setOpen, search, setSearch }: {
  assets: Asset[];
  value: Asset;
  onChange: (a: Asset) => void;
  label: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  search: string;
  setSearch: (v: string) => void;
}) {
  const filtered = useMemo(() => {
    if (!search) return assets.slice(0, 50);
    const q = search.toLowerCase();
    return assets.filter((a) => a.name.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q)).slice(0, 50);
  }, [assets, search]);

  return (
    <div className="relative">
      <button onClick={() => { setOpen(!open); setSearch(""); }}
        className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors"
        style={{ background: "var(--cmc-neutral-2)", border: "1px solid var(--cmc-border)" }}>
        {value.image ? (
          <Image src={value.image} alt={value.symbol} width={20} height={20} className="rounded-full" />
        ) : (
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
            style={{ background: "var(--cmc-neutral-3)", color: "var(--cmc-text)" }}>
            {value.symbol.charAt(0)}
          </div>
        )}
        <span className="text-sm font-semibold" style={{ color: "var(--cmc-text)" }}>{value.symbol}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 z-50 w-64 rounded-xl shadow-xl overflow-hidden"
            style={{ background: "var(--cmc-bg)", border: "1px solid var(--cmc-border)" }}>
            <div className="p-2">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: "var(--cmc-neutral-2)" }}>
                <Search size={12} style={{ color: "var(--cmc-neutral-5)" }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
                  className="flex-1 bg-transparent text-xs outline-none" style={{ color: "var(--cmc-text)" }}
                  autoFocus />
                {search && <button onClick={() => setSearch("")}><X size={10} style={{ color: "var(--cmc-neutral-5)" }} /></button>}
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filtered.map((a) => (
                <button key={a.id} onClick={() => { onChange(a); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:brightness-110"
                  style={{ background: a.id === value.id ? "var(--cmc-neutral-1)" : "transparent" }}>
                  {a.image ? (
                    <Image src={a.image} alt={a.symbol} width={18} height={18} className="rounded-full" />
                  ) : (
                    <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] font-bold"
                      style={{ background: "var(--cmc-neutral-3)", color: "var(--cmc-text)" }}>
                      {a.symbol.charAt(0)}
                    </div>
                  )}
                  <span className="text-xs font-semibold" style={{ color: "var(--cmc-text)" }}>{a.name}</span>
                  <span className="text-[10px] ml-auto" style={{ color: "var(--cmc-neutral-5)" }}>{a.symbol}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ConverterPage() {
  const [coins, setCoins] = useState<CoinMarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("1");
  const [fromAsset, setFromAsset] = useState<Asset | null>(null);
  const [toAsset, setToAsset] = useState<Asset | null>(null);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [fromSearch, setFromSearch] = useState("");
  const [toSearch, setToSearch] = useState("");
  const [pythUpdated, setPythUpdated] = useState<Date | null>(null);
  const [liveFrom, setLiveFrom] = useState<number | null>(null);
  const [liveTo, setLiveTo] = useState<number | null>(null);
  const fromRef = useRef(fromAsset);
  const toRef = useRef(toAsset);
  useEffect(() => { fromRef.current = fromAsset; }, [fromAsset]);
  useEffect(() => { toRef.current = toAsset; }, [toAsset]);

  useEffect(() => {
    fetchCoins(1, 100)
      .then((data) => {
        setCoins(data);
        // Default: BTC → USD
        const btc = data.find((c) => c.id === "bitcoin");
        if (btc) setFromAsset({ id: btc.id, symbol: btc.symbol.toUpperCase(), name: btc.name, image: btc.image, price: btc.current_price });
        setToAsset(FIAT[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const refreshPyth = useCallback(async () => {
    const f = fromRef.current;
    const t = toRef.current;
    let updated = false;
    if (f && f.id !== "usd" && f.id !== "eur" && f.id !== "gbp" && f.id !== "jpy") {
      try {
        const p = await fetchPythPrice(f.symbol);
        if (p && p.price > 0) { setLiveFrom(p.price); updated = true; }
      } catch {}
    } else {
      setLiveFrom(null);
    }
    if (t && t.id !== "usd" && t.id !== "eur" && t.id !== "gbp" && t.id !== "jpy") {
      try {
        const p = await fetchPythPrice(t.symbol);
        if (p && p.price > 0) { setLiveTo(p.price); updated = true; }
      } catch {}
    } else {
      setLiveTo(null);
    }
    if (updated) setPythUpdated(new Date());
  }, []);

  useEffect(() => {
    if (fromAsset || toAsset) {
      setLiveFrom(null); setLiveTo(null);
      refreshPyth();
    }
  }, [fromAsset?.id, toAsset?.id, refreshPyth]);

  useEffect(() => {
    const iv = setInterval(refreshPyth, 10_000);
    return () => clearInterval(iv);
  }, [refreshPyth]);

  const allAssets: Asset[] = useMemo(() => {
    const crypto = coins.map((c) => ({
      id: c.id,
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      image: c.image,
      price: c.current_price,
    }));
    return [...crypto, ...FIAT];
  }, [coins]);

  const swap = useCallback(() => {
    setFromAsset(toAsset);
    setToAsset(fromAsset);
  }, [fromAsset, toAsset]);

  const selectPair = useCallback((pair: { from: string; to: string }) => {
    const f = allAssets.find((a) => a.id === pair.from);
    const t = allAssets.find((a) => a.id === pair.to);
    if (f) setFromAsset(f);
    if (t) setToAsset(t);
  }, [allAssets]);

  const numAmount = parseFloat(amount) || 0;
  const effectiveFrom = liveFrom ?? fromAsset?.price ?? 0;
  const effectiveTo = liveTo ?? toAsset?.price ?? 0;
  const result = fromAsset && toAsset && effectiveTo > 0
    ? (numAmount * effectiveFrom) / effectiveTo
    : 0;
  const rate = fromAsset && toAsset && effectiveTo > 0
    ? effectiveFrom / effectiveTo
    : 0;
  const isLive = liveFrom !== null || liveTo !== null;

  if (loading) {
    return (
      <div className="mx-auto max-w-[600px] px-4 py-24 flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--cmc-neutral-4)" }} />
        <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>Loading prices…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight" style={{ color: "var(--cmc-text)" }}>Converter</h1>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: "rgba(22,199,132,0.12)", color: "#16c784" }}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#16c784" }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#16c784" }} />
              </span>
              Pyth Live
            </div>
          )}
          <button onClick={refreshPyth} className="p-1.5 rounded-lg hover:opacity-70 transition-opacity" style={{ color: "var(--cmc-neutral-5)" }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Converter Card */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>

        {/* From */}
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--cmc-neutral-5)" }}>From</label>
          <div className="flex items-center gap-3">
            {fromAsset && (
              <AssetPicker assets={allAssets} value={fromAsset} onChange={setFromAsset} label="From"
                open={fromOpen} setOpen={setFromOpen} search={fromSearch} setSearch={setFromSearch} />
            )}
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
              className="flex-1 text-right text-2xl font-bold bg-transparent outline-none tabular-nums"
              style={{ color: "var(--cmc-text)" }} min="0" step="any" />
          </div>
        </div>

        {/* Swap button */}
        <div className="flex justify-center">
          <button onClick={swap}
            className="p-2 rounded-full transition-colors hover:brightness-110"
            style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}>
            <ArrowDownUp size={16} />
          </button>
        </div>

        {/* To */}
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--cmc-neutral-5)" }}>To</label>
          <div className="flex items-center gap-3">
            {toAsset && (
              <AssetPicker assets={allAssets} value={toAsset} onChange={setToAsset} label="To"
                open={toOpen} setOpen={setToOpen} search={toSearch} setSearch={setToSearch} />
            )}
            <div className="flex-1 text-right text-2xl font-bold tabular-nums" style={{ color: "var(--cmc-text)" }}>
              {fmtResult(result)}
            </div>
          </div>
        </div>

        {/* Rate */}
        {fromAsset && toAsset && rate > 0 && (
          <div className="pt-3 space-y-1.5" style={{ borderTop: "1px solid var(--cmc-border)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Zap size={10} style={{ color: "var(--cmc-neutral-5)" }} />
                <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>Rate</span>
              </div>
              <span className="text-[11px] font-semibold tabular-nums" style={{ color: "var(--cmc-text)" }}>
                1 {fromAsset.symbol} = {fmtResult(rate)} {toAsset.symbol}
              </span>
            </div>
            {pythUpdated && (
              <p className="text-[10px] text-right" style={{ color: "var(--cmc-neutral-5)" }}>
                Pyth updated {pythUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Popular Pairs */}
      <div className="mt-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--cmc-neutral-5)" }}>Popular Pairs</p>
        <div className="flex flex-wrap gap-2">
          {POPULAR_PAIRS.map((pair) => {
            const f = allAssets.find((a) => a.id === pair.from);
            const t = allAssets.find((a) => a.id === pair.to);
            if (!f || !t) return null;
            return (
              <button key={`${pair.from}-${pair.to}`} onClick={() => selectPair(pair)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors hover:brightness-110"
                style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)", color: "var(--cmc-text)" }}>
                {f.image && <Image src={f.image} alt={f.symbol} width={14} height={14} className="rounded-full" />}
                {f.symbol} → {t.symbol}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
