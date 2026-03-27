"use client";

import { useEffect, useRef, memo, useState } from "react";

interface StockTradingViewProps {
  symbol: string;
  interval?: string;
}

const INTERVAL_MAP: Record<string, string> = {
  "1D": "D",
  "5D": "W",
  "1M": "M",
  "6M": "6M",
  "YTD": "12M",
  "1Y": "12M",
  "5Y": "60M",
};

const SYMBOL_MAP: Record<string, string> = {
  AAPL: "NASDAQ:AAPL",
  MSFT: "NASDAQ:MSFT",
  GOOGL: "NASDAQ:GOOGL",
  AMZN: "NASDAQ:AMZN",
  META: "NASDAQ:META",
  NVDA: "NASDAQ:NVDA",
  TSLA: "NASDAQ:TSLA",
  JPM: "NYSE:JPM",
  V: "NYSE:V",
  JNJ: "NYSE:JNJ",
  WMT: "NYSE:WMT",
  PG: "NYSE:PG",
  UNH: "NYSE:UNH",
  HD: "NYSE:HD",
  DIS: "NYSE:DIS",
  NFLX: "NASDAQ:NFLX",
  PYPL: "NASDAQ:PYPL",
  INTC: "NASDAQ:INTC",
  AMD: "NASDAQ:AMD",
  CRM: "NYSE:CRM",
};

function getTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function StockTradingViewInner({ symbol, interval = "1M" }: StockTradingViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState(getTheme);

  // Watch for theme changes on <html> class
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(getTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = "";

    const ticker = symbol.toUpperCase();
    const tvSymbol = SYMBOL_MAP[ticker] || `NASDAQ:${ticker}`;

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      width: "100%",
      height: 500,
      symbol: tvSymbol,
      interval: INTERVAL_MAP[interval] || "D",
      timezone: "Etc/UTC",
      theme,
      style: "1",
      locale: "en",
      backgroundColor: theme === "dark" ? "rgba(13,13,15,1)" : "rgba(255,255,255,1)",
      gridColor: theme === "dark" ? "rgba(42,42,52,0.3)" : "rgba(233,233,240,0.5)",
      allow_symbol_change: true,
      calendar: false,
      hide_side_toolbar: false,
      details: true,
      hotlist: false,
      support_host: "https://www.tradingview.com",
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [symbol, interval, theme]);

  return (
    <div className="tradingview-widget-container w-full overflow-hidden rounded-lg" style={{ height: 620, minHeight: 620 }} ref={containerRef}>
      <div className="tradingview-widget-container__widget" style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

const StockTradingView = memo(StockTradingViewInner);
export default StockTradingView;
