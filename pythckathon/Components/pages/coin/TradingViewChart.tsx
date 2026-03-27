"use client";

import { useEffect, useRef, memo } from "react";

interface TradingViewChartProps {
  symbol: string;
  interval?: string;
  compareSymbol?: string;
}

const INTERVAL_MAP: Record<string, string> = {
  "1D": "15",   // 15-min bars for 1-day view
  "7D": "60",   // 1-hour bars for 7-day view
  "1M": "240",  // 4-hour bars for 1-month view
  "3M": "D",    // daily bars for 3-month view
  "1Y": "W",    // weekly bars for 1-year view
  "ALL": "M",   // monthly bars for all-time view
};

function TradingViewChartInner({ symbol, interval = "D", compareSymbol }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = "";

    const tvSymbol = symbol.toUpperCase();
    // Map common crypto symbols to TradingView format
    const symbolMap: Record<string, string> = {
      BTC: "BINANCE:BTCUSDT",
      ETH: "BINANCE:ETHUSDT",
      SOL: "BINANCE:SOLUSDT",
      BNB: "BINANCE:BNBUSDT",
      XRP: "BINANCE:XRPUSDT",
      ADA: "BINANCE:ADAUSDT",
      DOGE: "BINANCE:DOGEUSDT",
      DOT: "BINANCE:DOTUSDT",
      AVAX: "BINANCE:AVAXUSDT",
      LINK: "BINANCE:LINKUSDT",
      USDT: "BINANCE:USDTUSD",
      USDC: "BINANCE:USDCUSDT",
    };

    const tvPair = symbolMap[tvSymbol] || `BINANCE:${tvSymbol}USDT`;

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    // Build compare symbol if provided
    const compareTV = compareSymbol
      ? symbolMap[compareSymbol.toUpperCase()] || `BINANCE:${compareSymbol.toUpperCase()}USDT`
      : undefined;

    const widgetConfig: Record<string, unknown> = {
      width: "100%",
      height: 500,
      symbol: tvPair,
      interval: INTERVAL_MAP[interval] || interval,
      timezone: "Etc/UTC",
      theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
      style: "1",
      locale: "en",
      allow_symbol_change: true,
      calendar: false,
      hide_side_toolbar: false,
      details: true,
      hotlist: false,
      support_host: "https://www.tradingview.com",
    };
    if (compareTV) {
      widgetConfig.studies = [`Compare@tv-basicstudies|0|${compareTV}||#9945FF195|true|0|0`];
    }

    script.innerHTML = JSON.stringify(widgetConfig);

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [symbol, interval, compareSymbol]);

  return (
    <div className="tradingview-widget-container w-full" style={{ height: 620, minHeight: 620 }} ref={containerRef}>
      <div className="tradingview-widget-container__widget" style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

const TradingViewChart = memo(TradingViewChartInner);
export default TradingViewChart;
