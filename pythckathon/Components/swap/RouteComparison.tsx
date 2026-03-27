"use client";

import { GitCompare } from "lucide-react";
import type { TokenInfo, UltraOrder } from "@/lib/jupiter";
import type { KaminoSwapQuote } from "@/lib/kamino";
import type { ExpressRelayQuote } from "@/lib/express-relay";
import type { RaydiumSwapQuote } from "@/lib/raydium-swap";
import { fmtAmount } from "@/lib/format";

interface RouteComparisonProps {
  quote: UltraOrder | null;
  kaminoQuote: KaminoSwapQuote | null;
  expressRelayQuote: ExpressRelayQuote | null;
  raydiumQuote: RaydiumSwapQuote | null;
  outputToken: TokenInfo;
  inputToken: TokenInfo;
  inputAmount: string;
  outputAmount: number;
  kaminoOutputAmount: number;
  erOutputAmount: number;
  raydiumOutputAmount: number;
  bestProvider: "jupiter" | "kamino" | "express-relay" | "raydium";
  activeOutputAmount: number;
  pythFairOutput: number;
  quoteCountdown: number;
  quoteRefreshSec: number;
  onRefresh: () => void;
  quoteLoading: boolean;
}

export default function RouteComparison({
  quote,
  kaminoQuote,
  expressRelayQuote,
  raydiumQuote,
  outputToken,
  outputAmount,
  kaminoOutputAmount,
  erOutputAmount,
  raydiumOutputAmount,
  bestProvider,
  activeOutputAmount,
  pythFairOutput,
  quoteCountdown,
  quoteRefreshSec,
  onRefresh,
  quoteLoading,
}: RouteComparisonProps) {
  if (quoteLoading || (!quote && !kaminoQuote && !expressRelayQuote && !raydiumQuote)) return null;

  return (
    <div className="mx-3 mt-2 mb-1 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.015)" }}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <GitCompare size={11} style={{ color: "var(--cmc-neutral-5)" }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Route Comparison</span>
        </div>
        {quoteCountdown > 0 && (
          <button onClick={onRefresh} className="flex items-center gap-1 text-[9px] font-medium transition-colors hover:opacity-80" style={{ color: "var(--cmc-neutral-5)" }} title="Click to refresh now">
            <svg width="14" height="14" viewBox="0 0 14 14" className="-rotate-90">
              <circle cx="7" cy="7" r="5.5" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
              <circle cx="7" cy="7" r="5.5" fill="none" stroke="#16c784" strokeWidth="1.5" strokeLinecap="round" strokeDasharray={2 * Math.PI * 5.5} strokeDashoffset={2 * Math.PI * 5.5 * (1 - quoteCountdown / quoteRefreshSec)} style={{ transition: "stroke-dashoffset 1s linear" }} />
            </svg>
            {quoteCountdown}s
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {/* Jupiter row */}
        {bestProvider === "jupiter" && outputAmount > 0 ? (
          <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: "rgba(22,199,132,0.08)", border: "1px solid rgba(22,199,132,0.25)" }}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold" style={{ color: "var(--cmc-text)" }}>Jupiter</span>
              <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "rgba(22,199,132,0.2)", color: "#16c784" }}>Best Price</span>
            </div>
            <span className="text-[11px] font-bold" style={{ color: "var(--cmc-text)" }}>{fmtAmount(outputAmount)} {outputToken.symbol}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between py-1.5 px-3" style={{ opacity: quote ? 0.7 : 0.35 }}>
            <span className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Jupiter</span>
            <span className="text-[10px] font-semibold" style={{ color: quote ? "#16c784" : "var(--cmc-neutral-5)" }}>
              {quote ? `${fmtAmount(outputAmount)} ${outputToken.symbol}` : "No route"}
            </span>
          </div>
        )}
        {/* Kamino row */}
        {bestProvider === "kamino" && kaminoOutputAmount > 0 ? (
          <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: "rgba(22,199,132,0.08)", border: "1px solid rgba(22,199,132,0.25)" }}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold" style={{ color: "var(--cmc-text)" }}>Kamino</span>
              <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "rgba(22,199,132,0.2)", color: "#16c784" }}>Best Price</span>
            </div>
            <span className="text-[11px] font-bold" style={{ color: "var(--cmc-text)" }}>{fmtAmount(kaminoOutputAmount)} {outputToken.symbol}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between py-1.5 px-3" style={{ opacity: kaminoQuote ? 0.7 : 0.35 }}>
            <span className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Kamino</span>
            <span className="text-[10px] font-semibold" style={{ color: kaminoQuote ? "#16c784" : "var(--cmc-neutral-5)" }}>
              {kaminoQuote ? `${fmtAmount(kaminoOutputAmount)} ${outputToken.symbol}` : "No route"}
            </span>
          </div>
        )}
        {/* Express Relay row */}
        {bestProvider === "express-relay" && erOutputAmount > 0 ? (
          <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: "var(--pf-up-muted)", border: "1px solid var(--pf-up)" }}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold" style={{ color: "var(--cmc-text)" }}>Express Relay</span>
              <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "var(--pf-up-muted)", color: "var(--pf-up)" }}>Best Price</span>
            </div>
            <span className="text-[11px] font-bold" style={{ color: "var(--cmc-text)" }}>{fmtAmount(erOutputAmount)} {outputToken.symbol}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between py-1.5 px-3" style={{ opacity: expressRelayQuote ? 0.7 : 0.35 }}>
            <span className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Express Relay</span>
            <span className="text-[10px] font-semibold" style={{ color: expressRelayQuote ? "var(--pf-up)" : "var(--cmc-neutral-5)" }}>
              {expressRelayQuote ? `${fmtAmount(erOutputAmount)} ${outputToken.symbol}` : "No route"}
            </span>
          </div>
        )}
        {/* Raydium row */}
        {bestProvider === "raydium" && raydiumOutputAmount > 0 ? (
          <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: "rgba(104,208,241,0.08)", border: "1px solid rgba(104,208,241,0.25)" }}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold" style={{ color: "var(--cmc-text)" }}>Raydium</span>
              <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "rgba(104,208,241,0.2)", color: "#68d0f1" }}>Best Price</span>
            </div>
            <span className="text-[11px] font-bold" style={{ color: "var(--cmc-text)" }}>{fmtAmount(raydiumOutputAmount)} {outputToken.symbol}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between py-1.5 px-3" style={{ opacity: raydiumQuote ? 0.7 : 0.35 }}>
            <span className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Raydium</span>
            <span className="text-[10px] font-semibold" style={{ color: raydiumQuote ? "#68d0f1" : "var(--cmc-neutral-5)" }}>
              {raydiumQuote ? `${fmtAmount(raydiumOutputAmount)} ${outputToken.symbol}` : "No route"}
            </span>
          </div>
        )}
        {/* Pyth oracle reference price + deviation */}
        {pythFairOutput > 0 && activeOutputAmount > 0 && (
          <div className="mt-1 pt-1.5 px-3" style={{ borderTop: "1px dashed rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Pyth Oracle Reference</span>
              <span className="text-[9px] font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>
                {fmtAmount(pythFairOutput)} {outputToken.symbol}
              </span>
            </div>
            {(() => {
              const deviation = ((activeOutputAmount - pythFairOutput) / pythFairOutput) * 100;
              const absDev = Math.abs(deviation);
              const devColor = absDev < 0.5 ? "var(--cmc-neutral-5)" : absDev < 2 ? "#f59e0b" : "#ea3943";
              return (
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[9px]" style={{ color: "var(--cmc-neutral-5)" }}>vs Oracle</span>
                  <span className="text-[9px] font-bold" style={{ color: devColor }}>
                    {deviation >= 0 ? "+" : ""}{deviation.toFixed(2)}%
                    {absDev > 2 && <span className="ml-1">⚠</span>}
                  </span>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
