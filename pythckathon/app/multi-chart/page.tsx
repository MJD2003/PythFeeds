"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus } from "lucide-react";
import { fetchPythPrice } from "@/lib/pyth-prices";

function TvChart({ symbol, interval, isDark }: { symbol: string; interval: string; isDark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      width: "100%", height: "100%",
      symbol,
      interval,
      timezone: "Etc/UTC",
      theme: isDark ? "dark" : "light",
      style: "1",
      locale: "en",
      allow_symbol_change: false,
      hide_side_toolbar: true,
      hide_top_toolbar: false,
      support_host: "https://www.tradingview.com",
    });
    ref.current.appendChild(script);
    return () => { if (ref.current) ref.current.innerHTML = ""; };
  }, [symbol, interval, isDark]);
  return (
    <div ref={ref} className="tradingview-widget-container w-full h-full">
      <div className="tradingview-widget-container__widget w-full h-full" />
    </div>
  );
}

type PairCategory = "crypto" | "pyth" | "meme" | "stock" | "forex" | "metal" | "index";

const PRESET_PAIRS: { label: string; symbol: string; pyth: string; category: PairCategory }[] = [
  // ── Major Crypto ──
  { label: "BTC", symbol: "BINANCE:BTCUSDT", pyth: "BTC", category: "crypto" },
  { label: "ETH", symbol: "BINANCE:ETHUSDT", pyth: "ETH", category: "crypto" },
  { label: "SOL", symbol: "BINANCE:SOLUSDT", pyth: "SOL", category: "crypto" },
  { label: "BNB", symbol: "BINANCE:BNBUSDT", pyth: "BNB", category: "crypto" },
  { label: "XRP", symbol: "BINANCE:XRPUSDT", pyth: "XRP", category: "crypto" },
  { label: "ADA", symbol: "BINANCE:ADAUSDT", pyth: "ADA", category: "crypto" },
  { label: "AVAX", symbol: "BINANCE:AVAXUSDT", pyth: "AVAX", category: "crypto" },
  { label: "LINK", symbol: "BINANCE:LINKUSDT", pyth: "LINK", category: "crypto" },
  { label: "DOT", symbol: "BINANCE:DOTUSDT", pyth: "DOT", category: "crypto" },
  { label: "UNI", symbol: "BINANCE:UNIUSDT", pyth: "UNI", category: "crypto" },
  { label: "ATOM", symbol: "BINANCE:ATOMUSDT", pyth: "ATOM", category: "crypto" },
  { label: "LTC", symbol: "BINANCE:LTCUSDT", pyth: "LTC", category: "crypto" },
  { label: "OP", symbol: "BINANCE:OPUSDT", pyth: "OP", category: "crypto" },
  { label: "ARB", symbol: "BINANCE:ARBUSDT", pyth: "ARB", category: "crypto" },
  { label: "INJ", symbol: "BINANCE:INJUSDT", pyth: "INJ", category: "crypto" },
  { label: "SUI", symbol: "BINANCE:SUIUSDT", pyth: "SUI", category: "crypto" },
  { label: "APT", symbol: "BINANCE:APTUSDT", pyth: "APT", category: "crypto" },
  { label: "TIA", symbol: "BINANCE:TIAUSDT", pyth: "TIA", category: "crypto" },
  // ── Pyth Ecosystem ──
  { label: "PYTH", symbol: "BINANCE:PYTHUSDT", pyth: "PYTH", category: "pyth" },
  { label: "JUP", symbol: "BINANCE:JUPUSDT", pyth: "JUP", category: "pyth" },
  { label: "JTO", symbol: "BINANCE:JTOUSDT", pyth: "JTO", category: "pyth" },
  { label: "RAY", symbol: "BINANCE:RAYUSDT", pyth: "RAY", category: "pyth" },
  { label: "RENDER", symbol: "BINANCE:RENDERUSDT", pyth: "RENDER", category: "pyth" },
  { label: "HNT", symbol: "BINANCE:HNTUSDT", pyth: "HNT", category: "pyth" },
  // ── Memecoins ──
  { label: "DOGE", symbol: "BINANCE:DOGEUSDT", pyth: "DOGE", category: "meme" },
  { label: "BONK", symbol: "BINANCE:BONKUSDT", pyth: "BONK", category: "meme" },
  { label: "WIF", symbol: "BINANCE:WIFUSDT", pyth: "WIF", category: "meme" },
  { label: "PEPE", symbol: "BINANCE:PEPEUSDT", pyth: "PEPE", category: "meme" },
  { label: "SHIB", symbol: "BINANCE:SHIBUSDT", pyth: "SHIB", category: "meme" },
  // ── US Stocks ──
  { label: "AAPL", symbol: "NASDAQ:AAPL", pyth: "AAPL", category: "stock" },
  { label: "TSLA", symbol: "NASDAQ:TSLA", pyth: "TSLA", category: "stock" },
  { label: "NVDA", symbol: "NASDAQ:NVDA", pyth: "NVDA", category: "stock" },
  { label: "MSFT", symbol: "NASDAQ:MSFT", pyth: "MSFT", category: "stock" },
  { label: "GOOGL", symbol: "NASDAQ:GOOGL", pyth: "GOOGL", category: "stock" },
  { label: "AMZN", symbol: "NASDAQ:AMZN", pyth: "AMZN", category: "stock" },
  { label: "META", symbol: "NASDAQ:META", pyth: "META", category: "stock" },
  { label: "AMD", symbol: "NASDAQ:AMD", pyth: "AMD", category: "stock" },
  { label: "COIN", symbol: "NASDAQ:COIN", pyth: "COIN", category: "stock" },
  // ── Forex ──
  { label: "EUR/USD", symbol: "FX:EURUSD", pyth: "EUR", category: "forex" },
  { label: "GBP/USD", symbol: "FX:GBPUSD", pyth: "GBP", category: "forex" },
  { label: "USD/JPY", symbol: "FX:USDJPY", pyth: "JPY", category: "forex" },
  // ── Metals ──
  { label: "Gold", symbol: "TVC:GOLD", pyth: "XAU", category: "metal" },
  { label: "Silver", symbol: "TVC:SILVER", pyth: "XAG", category: "metal" },
  // ── Indices ──
  { label: "S&P 500", symbol: "SP:SPX", pyth: "SPY", category: "index" },
  { label: "Nasdaq", symbol: "NASDAQ:NDX", pyth: "QQQ", category: "index" },
  { label: "SPY ETF", symbol: "AMEX:SPY", pyth: "SPY", category: "index" },
];

const CATEGORY_LABELS: Record<PairCategory, string> = {
  crypto: "Crypto", pyth: "Pyth Eco", meme: "Memes",
  stock: "Stocks", forex: "Forex", metal: "Metals", index: "Indices",
};
const CATEGORY_COLORS: Record<PairCategory, string> = {
  crypto: "var(--pf-accent)", pyth: "var(--pf-accent)", meme: "#ea3943",
  stock: "#16c784", forex: "#f59e0b", metal: "#d97706", index: "#6366f1",
};

const INTERVALS = ["1", "5", "15", "60", "240", "D"] as const;
type Interval = typeof INTERVALS[number];

interface ChartSlot {
  id: number;
  pair: typeof PRESET_PAIRS[number];
  interval: Interval;
  pythPrice: number | null;
  pythConf: number | null;
}

function ChartTile({ slot, isDark, onRemove, onChangePair }: {
  slot: ChartSlot;
  isDark: boolean;
  onRemove: () => void;
  onChangePair: (pair: typeof PRESET_PAIRS[number]) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerCat, setPickerCat] = useState<PairCategory | "all">("all");
  const cats = (Object.keys(CATEGORY_LABELS) as PairCategory[]);
  const filtered = pickerCat === "all" ? PRESET_PAIRS : PRESET_PAIRS.filter(p => p.category === pickerCat);
  const catColor = CATEGORY_COLORS[slot.pair.category];

  return (
    <div className="relative flex flex-col rounded-xl overflow-hidden"
      style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}
    >
      {/* Tile header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPicker(!showPicker)}
            className="flex items-center gap-1.5 text-xs font-bold transition-colors hover:opacity-80"
            style={{ color: "var(--cmc-text)" }}
          >
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: `${catColor}18`, color: catColor }}>
              {CATEGORY_LABELS[slot.pair.category]}
            </span>
            {slot.pair.label}
            <span className="text-[9px] font-medium px-1 py-0.5 rounded" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>▾</span>
          </button>
          {slot.pythPrice !== null && (
            <span className="text-[10px] font-mono font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>
              ${slot.pythPrice >= 1 ? slot.pythPrice.toLocaleString(undefined, { maximumFractionDigits: 2 }) : slot.pythPrice.toFixed(6)}
              {slot.pythConf !== null && slot.pythConf > 0 && (
                <span className="ml-1 text-[9px]" style={{ color: "rgba(153,69,255,0.8)" }}>
                  ±{((slot.pythConf / slot.pythPrice) * 100).toFixed(3)}%
                </span>
              )}
            </span>
          )}
          {slot.pythPrice !== null && (
            <span className="text-[8px] font-bold px-1 py-0.5 rounded-full" style={{ background: "rgba(22,199,132,0.1)", color: "#16c784" }}>PYTH</span>
          )}
        </div>
        <button onClick={onRemove} className="rounded p-0.5 hover:opacity-70 transition-opacity" style={{ color: "var(--cmc-neutral-5)" }}>
          <X size={13} />
        </button>
      </div>

      {/* Pair picker dropdown */}
      {showPicker && (
        <div className="absolute top-10 left-0 z-50 rounded-xl shadow-2xl w-64 overflow-hidden"
          style={{ background: "var(--cmc-bg)", border: "1px solid var(--cmc-border)" }}
        >
          {/* Category filter */}
          <div className="flex flex-wrap gap-1 p-2 border-b" style={{ borderColor: "var(--cmc-border)" }}>
            <button onClick={() => setPickerCat("all")}
              className="px-2 py-0.5 rounded text-[9px] font-bold transition-all"
              style={{ background: pickerCat === "all" ? "rgba(153,69,255,0.12)" : "transparent", color: pickerCat === "all" ? "var(--pf-accent)" : "var(--cmc-neutral-5)" }}
            >All</button>
            {cats.map(c => (
              <button key={c} onClick={() => setPickerCat(c)}
                className="px-2 py-0.5 rounded text-[9px] font-bold transition-all"
                style={{ background: pickerCat === c ? `${CATEGORY_COLORS[c]}20` : "transparent", color: pickerCat === c ? CATEGORY_COLORS[c] : "var(--cmc-neutral-5)" }}
              >{CATEGORY_LABELS[c]}</button>
            ))}
          </div>
          {/* Pair list */}
          <div className="max-h-48 overflow-y-auto p-1.5 grid grid-cols-3 gap-1">
            {filtered.map(p => (
              <button key={`${p.category}-${p.label}`}
                onClick={() => { onChangePair(p); setShowPicker(false); setPickerCat("all"); }}
                className="text-left px-2 py-1.5 rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity"
                style={{
                  color: p.label === slot.pair.label ? CATEGORY_COLORS[p.category] : "var(--cmc-text)",
                  background: p.label === slot.pair.label ? `${CATEGORY_COLORS[p.category]}15` : "transparent",
                }}
              >{p.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <TvChart symbol={slot.pair.symbol} interval={slot.interval} isDark={isDark} />
      </div>
    </div>
  );
}

export default function MultiChartPage() {
  const [isDark, setIsDark] = useState(true);
  const [globalInterval, setGlobalInterval] = useState<Interval>("60");
  const [slots, setSlots] = useState<ChartSlot[]>([
    { id: 1, pair: PRESET_PAIRS[0], interval: "60", pythPrice: null, pythConf: null },
    { id: 2, pair: PRESET_PAIRS[1], interval: "60", pythPrice: null, pythConf: null },
    { id: 3, pair: PRESET_PAIRS[2], interval: "60", pythPrice: null, pythConf: null },
    { id: 4, pair: PRESET_PAIRS[3], interval: "60", pythPrice: null, pythConf: null },
  ]);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // Fetch Pyth prices for all slots
  useEffect(() => {
    const fetchAll = async () => {
      const updated = await Promise.all(
        slots.map(async slot => {
          try {
            const p = await fetchPythPrice(slot.pair.pyth);
            if (p && p.price > 0) {
              return { ...slot, pythPrice: p.price, pythConf: p.confidence ?? null };
            }
          } catch {}
          return slot;
        })
      );
      setSlots(updated);
    };
    fetchAll();
    const iv = setInterval(fetchAll, 10_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots.map(s => s.pair.pyth).join(",")]);

  const addSlot = () => {
    if (slots.length >= 4) return;
    const used = slots.map(s => s.pair.label);
    const next = PRESET_PAIRS.find(p => !used.includes(p.label)) || PRESET_PAIRS[4];
    setSlots(prev => [...prev, { id: Date.now(), pair: next, interval: globalInterval, pythPrice: null, pythConf: null }]);
  };

  const removeSlot = (id: number) => setSlots(prev => prev.filter(s => s.id !== id));

  const changePair = (id: number, pair: typeof PRESET_PAIRS[number]) => {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, pair, pythPrice: null, pythConf: null } : s));
  };

  const syncInterval = (iv: Interval) => {
    setGlobalInterval(iv);
    setSlots(prev => prev.map(s => ({ ...s, interval: iv })));
  };

  const gridClass = slots.length === 1 ? "grid-cols-1" :
    slots.length === 2 ? "grid-cols-2" :
    slots.length === 3 ? "grid-cols-2 grid-rows-2" : "grid-cols-2 grid-rows-2";

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 56px)", background: "var(--cmc-bg)" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
        <h1 className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>Multi-Chart View</h1>
        <div className="flex items-center gap-2">
          {/* Interval sync */}
          <div className="flex items-center rounded-lg p-0.5" style={{ background: "var(--cmc-neutral-2)" }}>
            {INTERVALS.map(iv => (
              <button key={iv} onClick={() => syncInterval(iv)}
                className="px-2 py-1 rounded-md text-[10px] font-bold transition-all"
                style={{
                  background: globalInterval === iv ? "var(--cmc-bg)" : "transparent",
                  color: globalInterval === iv ? "var(--cmc-text)" : "var(--cmc-neutral-5)",
                }}
              >
                {iv === "D" ? "1D" : iv === "240" ? "4H" : iv === "60" ? "1H" : `${iv}m`}
              </button>
            ))}
          </div>
          {slots.length < 4 && (
            <button onClick={addSlot}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
              style={{ background: "rgba(153,69,255,0.12)", color: "var(--pf-accent)", border: "1px solid rgba(153,69,255,0.25)" }}
            >
              <Plus size={12} /> Add Chart
            </button>
          )}
        </div>
      </div>

      {/* Charts grid */}
      <div className={`flex-1 grid ${gridClass} gap-2 p-2 min-h-0`}>
        {slots.map(slot => (
          <ChartTile
            key={slot.id}
            slot={{ ...slot, interval: globalInterval }}
            isDark={isDark}
            onRemove={() => removeSlot(slot.id)}
            onChangePair={pair => changePair(slot.id, pair)}
          />
        ))}
      </div>
    </div>
  );
}
