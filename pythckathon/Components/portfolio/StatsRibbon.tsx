"use client";

import { fmtUsd } from "@/Components/portfolio/portfolio-types";
import type { PortfolioMetrics } from "@/lib/portfolio-analytics";

interface StatsRibbonProps {
  realPnl: { pnl24h: number; pnlPct24h: number; pnlTotal: number; pnlPctTotal: number };
  tokenCount: number;
  portfolioMetrics: PortfolioMetrics | null;
}

export default function StatsRibbon({ realPnl, tokenCount, portfolioMetrics }: StatsRibbonProps) {
  const items = [
    { label: "Total PnL", value: `${realPnl.pnlTotal >= 0 ? "+" : ""}${fmtUsd(Math.abs(realPnl.pnlTotal))}`, color: realPnl.pnlTotal >= 0 ? "var(--pf-up)" : "var(--pf-down)" },
    { label: "24h Change", value: `${realPnl.pnl24h >= 0 ? "+" : ""}${fmtUsd(Math.abs(realPnl.pnl24h))}`, color: realPnl.pnl24h >= 0 ? "var(--pf-up)" : "var(--pf-down)" },
    { label: "Tokens", value: String(tokenCount), color: "var(--cmc-text)" },
    ...(portfolioMetrics ? [
      { label: "Sharpe", value: portfolioMetrics.sharpeRatio.toFixed(2), color: portfolioMetrics.sharpeRatio >= 1 ? "var(--pf-up)" : "var(--pf-warning)" },
      { label: "Vol", value: `${portfolioMetrics.volatility.toFixed(1)}%`, color: "var(--pf-info)" },
    ] : []),
  ];

  return (
    <div className="flex items-stretch gap-px rounded-xl overflow-hidden mb-6" style={{ background: "var(--cmc-border)" }}>
      {items.map((m) => (
        <div key={m.label} className="flex-1 px-3.5 py-3 text-center" style={{ background: "var(--cmc-neutral-1)" }}>
          <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--cmc-neutral-5)" }}>{m.label}</p>
          <p className="text-sm font-bold tabular-nums font-data" style={{ color: m.color }}>{m.value}</p>
        </div>
      ))}
    </div>
  );
}
