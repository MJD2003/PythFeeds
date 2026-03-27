"use client";

import { X, AlertTriangle } from "lucide-react";

interface SlippageSettingsProps {
  slippage: number;
  setSlippage: (n: number) => void;
  open: boolean;
  onClose: () => void;
}

export default function SlippageSettings({ slippage, setSlippage, open, onClose }: SlippageSettingsProps) {
  if (!open) return null;
  const presets = [0.1, 0.5, 1.0, 3.0];
  return (
    <div className="absolute top-full right-0 mt-2 z-50 rounded-xl p-4 w-72 shadow-2xl" style={{ background: "var(--cmc-card, var(--cmc-bg))", border: "1px solid var(--cmc-border)" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>Slippage Tolerance</span>
        <button onClick={onClose}><X size={14} style={{ color: "var(--cmc-neutral-5)" }} /></button>
      </div>
      <div className="flex gap-1.5 mb-2">
        {presets.map((p) => (
          <button key={p} onClick={() => setSlippage(p)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors" style={{ background: slippage === p ? "var(--cmc-text)" : "var(--cmc-neutral-2)", color: slippage === p ? "var(--cmc-bg)" : "var(--cmc-text)" }}>{p}%</button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input type="number" step="0.1" min="0.01" max="50" value={slippage} onChange={(e) => setSlippage(Math.max(0.01, Math.min(50, parseFloat(e.target.value) || 0.5)))} className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }} />
        <span className="text-xs font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>%</span>
      </div>
      {slippage > 5 && <div className="flex items-center gap-1 mt-2 text-[10px]" style={{ color: "#f59e0b" }}><AlertTriangle size={10} /> High slippage — unfavorable trades possible</div>}
    </div>
  );
}
