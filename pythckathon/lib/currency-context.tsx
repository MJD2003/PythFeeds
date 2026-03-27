"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type Currency = "USD" | "EUR" | "BTC";

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  convert: (usdValue: number) => number;
  symbol: string;
  format: (usdValue: number) => string;
}

const RATES: Record<Currency, { rate: number; symbol: string; decimals: number }> = {
  USD: { rate: 1, symbol: "$", decimals: 2 },
  EUR: { rate: 0.92, symbol: "€", decimals: 2 },
  BTC: { rate: 0.0000156, symbol: "₿", decimals: 6 },
};

const STORAGE_KEY = "pythfeeds_currency";

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "USD",
  setCurrency: () => {},
  convert: (v) => v,
  symbol: "$",
  format: (v) => `$${v.toFixed(2)}`,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    if (typeof window === "undefined") return "USD";
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Currency;
      if (saved && RATES[saved]) return saved;
    } catch {}
    return "USD";
  });

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    try { localStorage.setItem(STORAGE_KEY, c); } catch {}
  };

  const convert = (usdValue: number) => usdValue * RATES[currency].rate;

  const symbol = RATES[currency].symbol;

  const format = (usdValue: number) => {
    const converted = convert(usdValue);
    const info = RATES[currency];
    if (currency === "BTC") {
      return `${info.symbol}${converted.toFixed(info.decimals)}`;
    }
    if (converted >= 1e12) return `${info.symbol}${(converted / 1e12).toFixed(2)}T`;
    if (converted >= 1e9) return `${info.symbol}${(converted / 1e9).toFixed(2)}B`;
    if (converted >= 1e6) return `${info.symbol}${(converted / 1e6).toFixed(2)}M`;
    if (converted >= 1000) return `${info.symbol}${converted.toLocaleString("en-US", { maximumFractionDigits: info.decimals })}`;
    if (converted >= 1) return `${info.symbol}${converted.toFixed(info.decimals)}`;
    if (converted >= 0.01) return `${info.symbol}${converted.toFixed(4)}`;
    return `${info.symbol}${converted.toPrecision(4)}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, convert, symbol, format }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
