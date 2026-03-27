"use client";

import { useState, useEffect } from "react";
import { Fuel } from "lucide-react";

interface GasData {
  ethereum: { low: number; average: number; high: number };
  solana: { low: number; medium: number; high: number };
}

/** Compact version for footer */
export default function GasTracker() {
  const [gas, setGas] = useState<GasData | null>(null);

  useEffect(() => {
    const fetchGas = () => {
      fetch("/api/cryptoserve/coins/gas")
        .then((r) => r.json())
        .then(setGas)
        .catch(() => {});
    };
    fetchGas();
    const interval = setInterval(fetchGas, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!gas || (!gas.solana && !gas.ethereum)) return null;

  const solMedium = gas.solana?.medium ?? 0;
  const ethAvg = gas.ethereum?.average ?? 0;

  if (solMedium === 0 && ethAvg === 0) return null;

  return (
    <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>
      <Fuel size={11} className="shrink-0" />
      {solMedium > 0 && (
        <span className="flex items-center gap-1">
          <img src="https://assets.coingecko.com/coins/images/4128/small/solana.png" alt="SOL" className="h-3 w-3 rounded-full" />
          <span style={{ color: "var(--cmc-text)" }}>{solMedium.toLocaleString()}</span>
          <span>μLamports</span>
        </span>
      )}
      {ethAvg > 0 && (
        <span className="flex items-center gap-1">
          <img src="https://assets.coingecko.com/coins/images/279/small/ethereum.png" alt="ETH" className="h-3 w-3 rounded-full" />
          <span style={{ color: "var(--cmc-text)" }}>{ethAvg}</span>
          <span>Gwei</span>
        </span>
      )}
    </div>
  );
}

/** Prominent banner version — shown above the fold */
export function GasTrackerBanner() {
  const [gas, setGas] = useState<GasData | null>(null);

  useEffect(() => {
    const fetchGas = () => {
      fetch("/api/cryptoserve/coins/gas")
        .then((r) => r.json())
        .then(setGas)
        .catch(() => {});
    };
    fetchGas();
    const interval = setInterval(fetchGas, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!gas || (!gas.solana && !gas.ethereum)) return null;

  const solLow = gas.solana?.low ?? 0;
  const solMedium = gas.solana?.medium ?? 0;
  const solHigh = gas.solana?.high ?? 0;
  const ethLow = gas.ethereum?.low ?? 0;
  const ethAvg = gas.ethereum?.average ?? 0;
  const ethHigh = gas.ethereum?.high ?? 0;

  if (solMedium === 0 && ethAvg === 0) return null;

  // Gas level indicator
  const solLevel = solMedium < 5000 ? "Low" : solMedium < 50000 ? "Normal" : "High";
  const solColor = solLevel === "Low" ? "#22c55e" : solLevel === "Normal" ? "#f59e0b" : "#ef4444";
  const ethLevel = ethAvg < 15 ? "Low" : ethAvg < 40 ? "Normal" : "High";
  const ethColor = ethLevel === "Low" ? "#22c55e" : ethLevel === "Normal" ? "#f59e0b" : "#ef4444";

  return (
    <div
      className="flex items-center justify-center gap-6 py-1.5 px-4 text-[11px]"
      style={{
        background: "var(--cmc-neutral-1)",
        borderBottom: "1px solid var(--cmc-border)",
      }}
    >
      <div className="flex items-center gap-1.5">
        <Fuel size={12} style={{ color: "var(--cmc-neutral-5)" }} />
        <span className="font-semibold" style={{ color: "var(--cmc-text)" }}>Gas Tracker</span>
      </div>

      {solMedium > 0 && (
        <div className="flex items-center gap-2">
          <img src="https://assets.coingecko.com/coins/images/4128/small/solana.png" alt="SOL" className="h-3.5 w-3.5 rounded-full" />
          <span className="font-medium" style={{ color: "var(--cmc-text)" }}>Solana</span>
          <div className="flex items-center gap-1">
            <span style={{ color: "var(--cmc-neutral-5)" }}>Low</span>
            <span className="font-semibold" style={{ color: "var(--cmc-text)" }}>{solLow.toLocaleString()}</span>
            <span className="mx-0.5" style={{ color: "var(--cmc-neutral-5)" }}>|</span>
            <span style={{ color: "var(--cmc-neutral-5)" }}>Med</span>
            <span className="font-bold" style={{ color: solColor }}>{solMedium.toLocaleString()}</span>
            <span className="mx-0.5" style={{ color: "var(--cmc-neutral-5)" }}>|</span>
            <span style={{ color: "var(--cmc-neutral-5)" }}>High</span>
            <span className="font-semibold" style={{ color: "var(--cmc-text)" }}>{solHigh.toLocaleString()}</span>
          </div>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${solColor}18`, color: solColor }}>
            {solLevel}
          </span>
        </div>
      )}

      {ethAvg > 0 && (
        <div className="flex items-center gap-2">
          <img src="https://assets.coingecko.com/coins/images/279/small/ethereum.png" alt="ETH" className="h-3.5 w-3.5 rounded-full" />
          <span className="font-medium" style={{ color: "var(--cmc-text)" }}>Ethereum</span>
          <div className="flex items-center gap-1">
            <span style={{ color: "var(--cmc-neutral-5)" }}>Low</span>
            <span className="font-semibold" style={{ color: "var(--cmc-text)" }}>{ethLow}</span>
            <span className="mx-0.5" style={{ color: "var(--cmc-neutral-5)" }}>|</span>
            <span style={{ color: "var(--cmc-neutral-5)" }}>Avg</span>
            <span className="font-bold" style={{ color: ethColor }}>{ethAvg}</span>
            <span className="mx-0.5" style={{ color: "var(--cmc-neutral-5)" }}>|</span>
            <span style={{ color: "var(--cmc-neutral-5)" }}>High</span>
            <span className="font-semibold" style={{ color: "var(--cmc-text)" }}>{ethHigh}</span>
          </div>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${ethColor}18`, color: ethColor }}>
            {ethLevel} Gwei
          </span>
        </div>
      )}
    </div>
  );
}
