"use client";

import {
  Trash2,
  CheckCircle,
  Zap,
  Bell as BellIcon,
  BarChart3,
  Star,
} from "lucide-react";
import { COIN_SLUGS } from "./portfolio-types";

// ── Skeleton shimmer cards for loading state ──
export function PortfolioSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-xl p-4" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
              <div className="h-2 w-16 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)", opacity: 0.5 }} />
            </div>
            <div className="h-4 w-16 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
          </div>
          {[1, 2, 3].map(j => (
            <div key={j} className="flex items-center gap-3 py-2" style={{ borderTop: j > 1 ? "1px solid var(--cmc-border)" : undefined }}>
              <div className="w-6 h-6 rounded-full animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
              <div className="flex-1">
                <div className="h-3 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)", width: `${50 + Math.random() * 60}px` }} />
              </div>
              <div className="h-3 w-14 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Mini sparkline from 24h change ──
export function MiniSparkline({ change, width = 48, height = 16 }: { change: number; width?: number; height?: number }) {
  const color = change >= 0 ? "#16c784" : "#ea3943";
  // Generate a simple 7-point trend line seeded from the change value
  const seed = Math.abs(change * 100) + 1;
  const pts: number[] = [];
  for (let i = 0; i < 7; i++) {
    const noise = Math.sin(seed * (i + 1) * 0.7) * 0.3;
    const trend = change >= 0 ? (i / 6) * 0.6 + 0.2 : (1 - i / 6) * 0.6 + 0.2;
    pts.push(Math.max(0.05, Math.min(0.95, trend + noise)));
  }
  const points = pts.map((v, i) => `${(i / 6) * width},${(1 - v) * height}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Token row component ──
export function TokenRow({
  logo,
  symbol,
  name,
  balance,
  price,
  value,
  badge,
  change24h,
  apy,
  verified,
  onRemove,
  coinId,
  onSwap,
  onAlert,
  starred,
  onStar,
  pnl,
}: {
  logo?: string;
  symbol: string;
  name: string;
  balance: string;
  price: string;
  value: string;
  badge?: { label: string; color: string };
  change24h?: number;
  apy?: string;
  verified?: boolean;
  onRemove?: () => void;
  coinId?: string;
  onSwap?: () => void;
  onAlert?: () => void;
  starred?: boolean;
  onStar?: () => void;
  pnl?: { amount: number; pct: number };
}) {
  const coinSlug = coinId || COIN_SLUGS[symbol];
  return (
    <tr
      className="transition-colors hover:bg-white/2 group"
      style={{ borderBottom: "1px solid var(--cmc-border)" }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          {logo ? (
            <div className="h-7 w-7 rounded-full shrink-0 overflow-hidden flex items-center justify-center" style={{ background: "var(--cmc-neutral-2)" }}>
              <img
                src={logo}
                alt={symbol}
                className="h-7 w-7 rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          ) : (
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
              style={{
                background: "var(--cmc-neutral-2)",
                color: "var(--cmc-text)",
              }}
            >
              {symbol.slice(0, 2)}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            {coinSlug ? (
              <a
                href={`/coins/${coinSlug}`}
                className="text-sm font-semibold hover:underline"
                style={{ color: "var(--cmc-text)" }}
              >
                {name}
              </a>
            ) : (
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--cmc-text)" }}
              >
                {name}
              </span>
            )}
            {verified && (
              <CheckCircle
                size={12}
                style={{ color: "var(--pf-up)" }}
              />
            )}
            {badge && (
              <span
                className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                style={{
                  background: badge.color + "18",
                  color: badge.color,
                }}
              >
                {badge.label}
              </span>
            )}
          </div>
          {onRemove && (
            <button
              onClick={onRemove}
              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1"
            >
              <Trash2 size={12} style={{ color: "#ea3943" }} />
            </button>
          )}
        </div>
      </td>
      <td
        className="px-4 py-3 text-right text-sm"
        style={{ color: "var(--cmc-text)" }}
      >
        {balance}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {change24h !== undefined && <MiniSparkline change={change24h} />}
          <div>
            <p className="text-sm" style={{ color: "var(--cmc-text)" }}>
              {price}
            </p>
            {change24h !== undefined && (
              <p
                className="text-[10px] font-medium"
                style={{ color: change24h >= 0 ? "#16c784" : "#ea3943" }}
              >
                {change24h >= 0 ? "+" : ""}
                {change24h.toFixed(2)}%
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {apy && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: "rgba(20,241,149,0.1)", color: "var(--pf-up)" }}
            >
              {apy}
            </span>
          )}
          <div className="text-right">
            <span
              className="text-sm font-bold"
              style={{ color: "var(--cmc-text)" }}
            >
              {value}
            </span>
            {pnl && pnl.amount !== 0 && (
              <p className="text-[9px] font-semibold tabular-nums" style={{ color: pnl.amount >= 0 ? "#16c784" : "#ea3943" }}>
                {pnl.amount >= 0 ? "+" : ""}{pnl.amount < 1000 && pnl.amount > -1000 ? `$${Math.abs(pnl.amount).toFixed(2)}` : `$${Math.abs(pnl.amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} ({pnl.pct >= 0 ? "+" : ""}{pnl.pct.toFixed(1)}%)
              </p>
            )}
          </div>
        </div>
      </td>
      {/* Inline actions column */}
      <td className="px-2 py-3">
        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onSwap && (
            <button onClick={onSwap} title="Swap" className="p-1.5 rounded-lg transition-colors hover:bg-(--pf-accent)/10">
              <Zap size={12} style={{ color: "var(--pf-accent)" }} />
            </button>
          )}
          {onAlert && (
            <button onClick={onAlert} title="Set Alert" className="p-1.5 rounded-lg transition-colors hover:bg-[#f0b90b]/10">
              <BellIcon size={12} style={{ color: "#f0b90b" }} />
            </button>
          )}
          {coinSlug && (
            <a href={`/coins/${coinSlug}`} title="View Chart" className="p-1.5 rounded-lg transition-colors hover:bg-(--pf-up)/10">
              <BarChart3 size={12} style={{ color: "var(--pf-up)" }} />
            </a>
          )}
          {onStar && (
            <button onClick={onStar} title={starred ? "Remove from Watchlist" : "Add to Watchlist"} className="p-1.5 rounded-lg transition-colors hover:bg-[#f0b90b]/10">
              <Star size={12} style={{ color: starred ? "#f0b90b" : "var(--cmc-neutral-5)" }} fill={starred ? "#f0b90b" : "none"} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Table header ──
export function TableHead({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr style={{ borderBottom: "1px solid var(--cmc-border)" }}>
        {columns.map((h, i) => (
          <th
            key={h}
            className={`px-4 py-2.5 text-[11px] font-semibold ${i === 0 ? "text-left" : "text-right"}`}
            style={{ color: "var(--cmc-neutral-5)" }}
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}
