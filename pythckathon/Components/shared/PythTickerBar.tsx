"use client";

import { useState, useEffect, useRef } from "react";
import { fetchPythPricesBatch } from "@/lib/pyth-prices";
import { isSoundEnabled, setSoundEnabled } from "@/lib/price-sound";

const TICKER_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "LINK", "AVAX", "DOT"];

function fmtPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

interface TickerItem {
  symbol: string;
  price: number;
  flash: "up" | "down" | null;
}

export default function PythTickerBar() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const prevRef = useRef<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refresh = async () => {
      try {
        const prices = await fetchPythPricesBatch(TICKER_SYMBOLS);
        const prev = prevRef.current;
        const newItems: TickerItem[] = TICKER_SYMBOLS.map((sym) => {
          const p = prices[sym] || 0;
          let flash: "up" | "down" | null = null;
          if (prev[sym] && p !== prev[sym]) {
            flash = p > prev[sym] ? "up" : "down";
          }
          return { symbol: sym, price: p, flash };
        }).filter((i) => i.price > 0);
        prevRef.current = { ...prev, ...prices };
        setItems(newItems);
        // Clear flashes after 700ms
        setTimeout(() => {
          setItems((prev) => prev.map((i) => ({ ...i, flash: null })));
        }, 700);
      } catch {}
    };
    refresh();
    const iv = setInterval(refresh, 10_000);
    return () => clearInterval(iv);
  }, []);

  // Auto-scroll animation
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let pos = 0;
    let raf: number;
    const step = () => {
      pos += 0.4;
      if (pos >= el.scrollWidth / 2) pos = 0;
      el.scrollLeft = pos;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [items.length]);

  const [soundOn, setSoundOn] = useState(true);
  useEffect(() => { setSoundOn(isSoundEnabled()); }, []);
  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  if (items.length === 0) return null;

  // Duplicate items for seamless loop
  const doubled = [...items, ...items];

  return (
    <div
      className="fixed top-0 left-0 right-0 w-full overflow-hidden select-none"
      style={{
        height: 24,
        background: "var(--cmc-bg)",
        borderBottom: "1px solid var(--cmc-border)",
        zIndex: 1000,
      }}
    >
      <div
        ref={scrollRef}
        className="flex items-center gap-6 whitespace-nowrap overflow-hidden"
        style={{ height: 24, paddingLeft: 12, paddingRight: 50 }}
      >
        {doubled.map((item, i) => (
          <span
            key={`${item.symbol}-${i}`}
            className="inline-flex items-center gap-1.5 text-[10px] font-medium shrink-0 transition-colors duration-500"
            style={{
              color: item.flash === "up"
                ? "var(--pf-up)"
                : item.flash === "down"
                  ? "var(--pf-down)"
                  : "var(--cmc-neutral-5)",
            }}
          >
            <span className="font-bold" style={{ color: item.flash ? undefined : "var(--cmc-text)" }}>
              {item.symbol}
            </span>
            {fmtPrice(item.price)}
            {item.flash && (
              <span
                className="w-1 h-1 rounded-full"
                style={{ background: item.flash === "up" ? "var(--pf-up)" : "var(--pf-down)" }}
              />
            )}
          </span>
        ))}
      </div>
      {/* Sound toggle */}
      <button
        onClick={toggleSound}
        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors hover-surface"
        style={{ color: "var(--cmc-neutral-5)" }}
        title={soundOn ? "Mute price alerts" : "Enable price alerts"}
      >
        {soundOn ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
        )}
      </button>
    </div>
  );
}
