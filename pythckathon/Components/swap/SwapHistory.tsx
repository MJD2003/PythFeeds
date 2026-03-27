"use client";

import { Clock, Trash2, X, ExternalLink } from "lucide-react";
import type { SwapRecord } from "@/lib/swap-history";
import { findTokenByMint } from "@/lib/jupiter";

interface SwapHistoryProps {
  open: boolean;
  onClose: () => void;
  history: SwapRecord[];
  onClear: () => void;
}

// Re-export findTokenByMint from jupiter for token logo lookup
function TokenPairIcons({ rec }: { rec: SwapRecord }) {
  const fromToken = findTokenByMint(rec.inputMint);
  const toToken = findTokenByMint(rec.outputMint);
  return (
    <div className="relative shrink-0" style={{ width: 36, height: 28 }}>
      <div className="absolute left-0 top-0 z-1" style={{ border: "1.5px solid var(--cmc-card, var(--cmc-bg))", borderRadius: "50%" }}>
        {fromToken?.logo ? (
          <img src={fromToken.logo} alt={rec.inputSymbol} className="w-6 h-6 rounded-full" style={{ background: "var(--cmc-neutral-2)" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}>{rec.inputSymbol.slice(0, 2)}</div>
        )}
      </div>
      <div className="absolute top-0.5 z-0" style={{ left: 14, border: "1.5px solid var(--cmc-card, var(--cmc-bg))", borderRadius: "50%" }}>
        {toToken?.logo ? (
          <img src={toToken.logo} alt={rec.outputSymbol} className="w-6 h-6 rounded-full" style={{ background: "var(--cmc-neutral-2)" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}>{rec.outputSymbol.slice(0, 2)}</div>
        )}
      </div>
    </div>
  );
}

export default function SwapHistoryModal({ open, onClose, history, onClear }: SwapHistoryProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[420px] mx-4 rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--cmc-card, var(--cmc-bg))", border: "1px solid var(--cmc-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
          <div className="flex items-center gap-2">
            <Clock size={14} style={{ color: "var(--cmc-text)" }} />
            <span className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>Swap History</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>{history.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onClear} className="p-1.5 rounded-lg transition-colors hover:bg-white/10" title="Clear all">
              <Trash2 size={13} style={{ color: "var(--cmc-neutral-5)" }} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-white/10">
              <X size={14} style={{ color: "var(--cmc-neutral-5)" }} />
            </button>
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {history.length === 0 ? (
            <div className="py-10 text-center">
              <span className="text-sm" style={{ color: "var(--cmc-neutral-5)" }}>No swaps yet</span>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--cmc-border)" }}>
              {history.map((rec) => (
                <a
                  key={rec.id}
                  href={`https://solscan.io/tx/${rec.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/5 group"
                >
                  <div className="flex items-center gap-3">
                    <TokenPairIcons rec={rec} />
                    <div>
                      <span className="text-[11px] font-bold" style={{ color: "var(--cmc-text)" }}>
                        {rec.inputSymbol} → {rec.outputSymbol}
                      </span>
                      <div className="text-[9px]" style={{ color: "var(--cmc-neutral-5)" }}>
                        {parseFloat(rec.inputAmount).toFixed(4)} → {parseFloat(rec.outputAmount).toFixed(4)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>
                      {new Date(rec.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <ExternalLink size={9} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--cmc-text)" }} />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
