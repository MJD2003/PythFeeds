"use client";

import { Moon, Sun, Fuel } from "lucide-react";
import { useState, useEffect } from "react";
import { mockGlobalStats } from "@/lib/data/mock-data";
import { formatLargeValue } from "@/lib/format";

export default function Infobar() {
  const [isDark, setIsDark] = useState(false);
  const [gasPrice, setGasPrice] = useState<number | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    const fetchGas = async () => {
      try {
        const res = await fetch("/api/cryptoserve/coins/gas");
        if (res.ok) {
          const data = await res.json();
          setGasPrice(data.ethereum?.average ?? data.gasPrice ?? data.standard ?? null);
        }
      } catch {}
    };
    fetchGas();
    const interval = setInterval(fetchGas, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    setIsDark((prev) => !prev);
  };

  const stats = mockGlobalStats;

  const gasColor = gasPrice !== null
    ? gasPrice < 20 ? "var(--cmc-up)" : gasPrice < 50 ? "#f6b87e" : "var(--cmc-down)"
    : "var(--cmc-neutral-5)";

  return (
    <div className="border-b border-[var(--cmc-border)] bg-[var(--cmc-neutral-1)] text-xs">
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 overflow-x-auto px-4 py-2">
        {/* Global Stats */}
        <div className="flex items-center gap-4 whitespace-nowrap">
          <span className="text-[var(--cmc-text-sub)]">
            Cryptos:{" "}
            <span className="font-semibold text-[var(--pf-accent)]">
              {formatLargeValue(stats.active_cryptocurrencies)}
            </span>
          </span>
          <span className="text-[var(--cmc-text-sub)]">
            Exchanges:{" "}
            <span className="font-semibold text-[var(--pf-accent)]">
              {stats.markets}
            </span>
          </span>
          <span className="text-[var(--cmc-text-sub)]">
            Market Cap:{" "}
            <span className="font-semibold text-[var(--cmc-text)]">
              ${formatLargeValue(stats.total_market_cap)}
            </span>
            <span
              className={`ml-1 ${
                stats.market_cap_change_24h >= 0
                  ? "text-[var(--cmc-up)]"
                  : "text-[var(--cmc-down)]"
              }`}
            >
              {stats.market_cap_change_24h >= 0 ? "▲" : "▼"}{" "}
              {Math.abs(stats.market_cap_change_24h).toFixed(2)}%
            </span>
          </span>
          <span className="text-[var(--cmc-text-sub)]">
            24h Vol:{" "}
            <span className="font-semibold text-[var(--cmc-text)]">
              ${formatLargeValue(stats.total_volume)}
            </span>
          </span>
          <span className="text-[var(--cmc-text-sub)]">
            Dominance:{" "}
            <span className="font-semibold text-[var(--cmc-text)]">
              BTC: {stats.btc_dominance}% ETH: {stats.eth_dominance}%
            </span>
          </span>
          {gasPrice !== null && (
            <span className="flex items-center gap-1 text-[var(--cmc-text-sub)]">
              <Fuel size={11} style={{ color: gasColor }} />
              Gas:{" "}
              <span className="font-semibold" style={{ color: gasColor }}>
                {gasPrice} Gwei
              </span>
            </span>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="ml-auto shrink-0 text-[var(--cmc-neutral-5)] hover:text-[var(--cmc-text)]"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </div>
  );
}
