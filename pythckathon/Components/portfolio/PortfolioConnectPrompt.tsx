"use client";

import { Wallet, PieChart, TrendingUp, BarChart3 } from "lucide-react";

interface PortfolioConnectPromptProps {
  onConnect: () => void;
}

export default function PortfolioConnectPrompt({ onConnect }: PortfolioConnectPromptProps) {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-12 text-center">
      <div className="mx-auto max-w-lg">
        {/* Animated wallet icon with layered rings */}
        <div className="relative mx-auto mb-8 w-28 h-28">
          <div className="absolute inset-0 rounded-full animate-[spin_12s_linear_infinite] opacity-30" style={{ background: "conic-gradient(from 0deg, var(--pf-accent), var(--pf-up), var(--pf-accent))" }} />
          <div className="absolute inset-[3px] rounded-full" style={{ background: "var(--cmc-bg)" }} />
          <div className="absolute inset-2 rounded-full animate-pulse" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(0,229,155,0.08))" }} />
          <div className="absolute inset-2 rounded-full flex items-center justify-center" style={{ background: "var(--cmc-bg)" }}>
            <Wallet size={36} style={{ color: "var(--pf-accent)" }} />
          </div>
        </div>
        <h1 className="text-3xl font-bold font-display mb-3 tracking-tight" style={{ color: "var(--cmc-text)" }}>
          Portfolio Tracker
        </h1>
        <p className="text-sm mb-8 max-w-md mx-auto leading-relaxed" style={{ color: "var(--cmc-text-sub)" }}>
          Connect your Solana wallet to track your crypto &amp; stock holdings with live P&amp;L powered by Pyth Network oracle data.
        </p>
        <button
          onClick={onConnect}
          className="group inline-flex items-center gap-2.5 rounded-full px-8 py-3 text-sm font-bold text-white transition-all duration-300 hover:scale-[1.03] hover:shadow-lg"
          style={{
            background: "linear-gradient(135deg, var(--pf-accent), var(--pf-up))",
            boxShadow: "0 4px 24px rgba(139,92,246,0.25), 0 0 0 1px rgba(139,92,246,0.1)",
          }}
        >
          <Wallet size={16} className="transition-transform group-hover:scale-110" />
          Connect Wallet
        </button>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: PieChart, label: "Auto-detect tokens", desc: "On-chain scanning" },
            { icon: TrendingUp, label: "Live P&L tracking", desc: "Pyth oracle prices" },
            { icon: BarChart3, label: "Portfolio analytics", desc: "Charts & insights" },
          ].map((f) => (
            <div
              key={f.label}
              className="rounded-xl px-4 py-4 transition-all duration-200 hover:scale-[1.02]"
              style={{
                background: "var(--cmc-neutral-1)",
                border: "1px solid var(--cmc-border)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <div className="mx-auto mb-2 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--pf-accent-muted)" }}>
                <f.icon size={15} style={{ color: "var(--pf-accent)" }} />
              </div>
              <p className="text-[11px] font-semibold mb-0.5" style={{ color: "var(--cmc-text)" }}>{f.label}</p>
              <p className="text-[9px]" style={{ color: "var(--cmc-neutral-5)" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
