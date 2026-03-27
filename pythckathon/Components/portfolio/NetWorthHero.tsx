"use client";

import { Lock, ArrowUpRight, RefreshCw, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { fmtUsd } from "@/Components/portfolio/portfolio-types";
import type { WalletToken } from "@/lib/wallet-scanner";
import type { NativeStake } from "@/lib/wallet-scanner";

interface NetWorthHeroProps {
  totalValue: number;
  solEquiv: string;
  hasSolPrice: boolean;
  balanceHidden: boolean;
  setBalanceHidden: (fn: (prev: boolean) => boolean) => void;
  realPnl: { pnl24h: number; pnlPct24h: number; pnlTotal: number; pnlPctTotal: number };
  wallet: string;
  refreshPrices: () => void;
  // Export data
  solBalance: number | null;
  livePrices: Record<string, number>;
  fungible: WalletToken[];
  nativeStakes: NativeStake[];
  kaminoTotal: number;
}

export default function NetWorthHero({
  totalValue,
  solEquiv,
  hasSolPrice,
  balanceHidden,
  setBalanceHidden,
  realPnl,
  wallet,
  refreshPrices,
  solBalance,
  livePrices,
  fungible,
  nativeStakes,
  kaminoTotal,
}: NetWorthHeroProps) {
  const handleExportCSV = () => {
    const rows: string[][] = [["Asset", "Symbol", "Balance", "Price (USD)", "Value (USD)"]];
    if (solBalance) rows.push(["Solana", "SOL", String(solBalance), String(livePrices.SOL || 0), String((solBalance || 0) * (livePrices.SOL || 0))]);
    fungible.forEach(t => rows.push([t.name || t.symbol, t.symbol, String(t.amount), String(t.price || 0), String(t.value || 0)]));
    nativeStakes.forEach(s => rows.push(["Native Stake", "SOL", String(s.activeStake), String(livePrices.SOL || 0), String(s.activeStake * (livePrices.SOL || 0))]));
    if (kaminoTotal > 0) rows.push(["Kamino DeFi", "—", "—", "—", String(kaminoTotal)]);
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `portfolio_${wallet.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Portfolio exported as CSV");
  };

  const handleShare = async () => {
    const card = document.getElementById("portfolio-share-card");
    if (!card) { toast.error("Share card not found"); return; }
    const wrapper = card.parentElement;
    if (wrapper) { wrapper.style.width = "auto"; wrapper.style.height = "auto"; wrapper.style.overflow = "visible"; wrapper.style.position = "fixed"; wrapper.style.left = "-9999px"; wrapper.style.top = "0"; wrapper.style.zIndex = "99999"; }
    card.style.width = "480px";
    await new Promise(r => setTimeout(r, 100));
    try {
      const canvas = await html2canvas(card, { backgroundColor: "#0b0b12", scale: 2, useCORS: true, logging: false, width: 480, windowWidth: 480 });
      const link = document.createElement("a"); link.download = `portfolio_${wallet.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.png`; link.href = canvas.toDataURL("image/png"); link.click();
      toast.success("Share card saved!");
    } catch (err) { console.error("html2canvas error:", err); toast.error("Failed to generate image"); }
    if (wrapper) { wrapper.style.width = "0"; wrapper.style.height = "0"; wrapper.style.overflow = "hidden"; wrapper.style.position = "absolute"; wrapper.style.left = "0"; wrapper.style.top = "0"; wrapper.style.zIndex = ""; }
  };

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Net Worth</p>
        <button onClick={() => setBalanceHidden((h) => !h)} className="p-1 rounded hover:bg-white/5 transition-colors" title="Toggle visibility">
          {balanceHidden ? <Lock size={11} style={{ color: "var(--cmc-neutral-5)" }} /> : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--cmc-neutral-5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>}
        </button>
      </div>

      <div className="flex items-baseline gap-3 mb-2">
        <p className="text-5xl font-bold font-display tracking-tight" style={{ color: "var(--cmc-text)" }}>
          {balanceHidden ? "••••••" : fmtUsd(totalValue)}
        </p>
        {!balanceHidden && hasSolPrice && totalValue > 0 && (
          <p className="text-sm font-medium font-data" style={{ color: "var(--cmc-neutral-5)" }}>{solEquiv} SOL</p>
        )}
      </div>

      {!balanceHidden && totalValue > 0 && (
        <div className="flex items-center gap-2.5 mb-6">
          <span className="text-sm font-bold font-data" style={{ color: realPnl.pnl24h >= 0 ? "var(--pf-up)" : "var(--pf-down)" }}>
            {realPnl.pnl24h >= 0 ? "+" : ""}{fmtUsd(Math.abs(realPnl.pnl24h))}
          </span>
          <span className="text-xs font-semibold font-data px-2 py-0.5 rounded-md" style={{ background: realPnl.pnlPct24h >= 0 ? "var(--pf-up-muted)" : "var(--pf-down-muted)", color: realPnl.pnlPct24h >= 0 ? "var(--pf-up)" : "var(--pf-down)" }}>
            {realPnl.pnlPct24h >= 0 ? "+" : ""}{realPnl.pnlPct24h.toFixed(2)}%
          </span>
          <span className="text-[10px]" style={{ color: "var(--cmc-neutral-4)" }}>24h</span>
        </div>
      )}

      {/* Quick Actions Strip */}
      {!balanceHidden && (
        <div className="flex items-center gap-2 flex-wrap">
          <a href="/swap" className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:brightness-110" style={{ background: "var(--pf-accent-muted)", color: "var(--pf-accent)", border: "1px solid color-mix(in srgb, var(--pf-accent) 20%, transparent)" }}>
            <ArrowUpRight size={12} style={{ transform: "rotate(45deg)" }} /> Swap
          </a>
          <button onClick={() => { if (wallet) refreshPrices(); }} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:bg-white/5" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-6)", border: "1px solid var(--cmc-border)" }}>
            <RefreshCw size={12} /> Refresh
          </button>
          {totalValue > 0 && (
            <>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:bg-white/5"
                style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-6)", border: "1px solid var(--cmc-border)" }}
              >
                <Download size={12} /> Export
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:bg-white/5"
                style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-6)", border: "1px solid var(--cmc-border)" }}
              >
                <Share2 size={12} /> Share
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
