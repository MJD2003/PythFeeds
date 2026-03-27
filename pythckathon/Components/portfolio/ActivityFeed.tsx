"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Filter, Download, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import {
  fetchTransactionHistory,
  resolveTokenMeta,
  type EnhancedTransaction,
} from "@/lib/helius-api";

// App logo/icon/color map
const APP_META: Record<string, { color: string; label: string; icon?: string }> = {
  JUPITER: { color: "#6366f1", label: "Jupiter", icon: "https://static.jup.ag/jup/icon.png" },
  RAYDIUM: { color: "#6366f1", label: "Raydium", icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png" },
  ORCA: { color: "#6366f1", label: "Orca", icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png" },
  MARINADE: { color: "#94a3b8", label: "Marinade", icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey/logo.png" },
  TENSOR: { color: "#94a3b8", label: "Tensor" },
  MAGIC_EDEN: { color: "#94a3b8", label: "MagicEden", icon: "https://bafkreihlve3lokwjivscp2apj4geraghah6cnag7qs36ub6m7pw7nkz2ly.ipfs.nftstorage.link" },
  PHANTOM: { color: "#94a3b8", label: "Phantom" },
  PYTH: { color: "#6366f1", label: "Pyth", icon: "https://pyth.network/token.svg" },
  SYSTEM_PROGRAM: { color: "var(--cmc-neutral-5)", label: "Solana", icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" },
  UNKNOWN: { color: "var(--cmc-neutral-5)", label: "Unknown" },
};

const TYPE_TAGS: Record<string, { label: string; color: string }> = {
  TRANSFER: { label: "Transfer", color: "var(--cmc-neutral-5)" },
  SWAP: { label: "Swap", color: "#C7F284" },
  COMPRESSED_NFT_MINT: { label: "NFT Mint", color: "#AB9FF2" },
  NFT_SALE: { label: "NFT Sale", color: "#EE4899" },
  NFT_LISTING: { label: "Listing", color: "#f59e0b" },
  STAKE: { label: "Stake", color: "#16c784" },
  UNSTAKE: { label: "Unstake", color: "#ea3943" },
  TOKEN_MINT: { label: "Mint", color: "#06b6d4" },
  BURN: { label: "Burn", color: "#ea3943" },
};

function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtAmount(n: number): string {
  if (Math.abs(n) < 0.000001) return "0";
  if (Math.abs(n) >= 1)
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toFixed(9).replace(/0+$/, "");
}

function truncateMint(mint: string): string {
  return mint.slice(0, 4) + "..." + mint.slice(-4);
}

function resolveSymbol(mint: string): { symbol: string; icon?: string } {
  return resolveTokenMeta(mint);
}

interface ActivityFeedProps {
  walletAddress: string;
}

export default function ActivityFeed({ walletAddress }: ActivityFeedProps) {
  const [transactions, setTransactions] = useState<EnhancedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideFailed, setHideFailed] = useState(false);
  const [hideSpam, setHideSpam] = useState(true);
  const [showPnL, setShowPnL] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [txLimit, setTxLimit] = useState(50);

  useEffect(() => {
    if (!walletAddress) return;
    setLoading(true);
    fetchTransactionHistory(walletAddress, txLimit).then((txs) => {
      setTransactions(txs);
      setLoading(false);
    });
  }, [walletAddress, txLimit]);

  // Summary stats
  const swapCount = transactions.filter(tx => tx.type === "SWAP").length;
  const transferCount = transactions.filter(tx => tx.type === "TRANSFER").length;
  const stakeCount = transactions.filter(tx => tx.type === "STAKE" || tx.type === "UNSTAKE").length;
  const otherCount = transactions.length - swapCount - transferCount - stakeCount;

  // Type filter options
  const typeOptions = [
    { key: "ALL", label: "All", count: transactions.length },
    { key: "SWAP", label: "Swaps", count: swapCount },
    { key: "TRANSFER", label: "Transfers", count: transferCount },
    { key: "STAKE", label: "Staking", count: stakeCount },
    ...(otherCount > 0 ? [{ key: "OTHER", label: "Other", count: otherCount }] : []),
  ];

  // Group transactions by date with filters applied
  const grouped: Record<string, EnhancedTransaction[]> = {};
  for (const tx of transactions) {
    // Type filter
    if (typeFilter !== "ALL") {
      if (typeFilter === "STAKE") {
        if (tx.type !== "STAKE" && tx.type !== "UNSTAKE") continue;
      } else if (typeFilter === "OTHER") {
        if (["SWAP", "TRANSFER", "STAKE", "UNSTAKE"].includes(tx.type)) continue;
      } else if (tx.type !== typeFilter) continue;
    }

    const dateKey = fmtDate(tx.timestamp);
    if (!grouped[dateKey]) grouped[dateKey] = [];

    // Filter spam (very small transfers with no meaningful action)
    if (hideSpam) {
      const totalValue =
        tx.tokenTransfers.reduce((s, t) => s + Math.abs(t.tokenAmount), 0) +
        tx.nativeTransfers.reduce((s, t) => s + Math.abs(t.amount) / 1e9, 0);
      if (totalValue < 0.0000001 && tx.type === "TRANSFER") continue;
    }

    grouped[dateKey].push(tx);
  }

  const visibleTxCount = Object.values(grouped).reduce((s, g) => s + g.length, 0);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg animate-pulse" style={{ background: "var(--cmc-neutral-1)" }}>
            <div className="w-8 h-8 rounded-full" style={{ background: "var(--cmc-neutral-2)" }} />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 rounded" style={{ background: "var(--cmc-neutral-2)", width: `${60 + i * 15}px` }} />
              <div className="h-2 rounded" style={{ background: "var(--cmc-neutral-2)", width: `${80 + i * 10}px`, opacity: 0.5 }} />
            </div>
            <div className="h-3 w-16 rounded" style={{ background: "var(--cmc-neutral-2)" }} />
          </div>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div
        className="py-16 text-center rounded-xl"
        style={{ border: "1px solid var(--cmc-border)" }}
      >
        <p className="text-sm" style={{ color: "var(--cmc-text)" }}>
          No transactions found
        </p>
        <p
          className="text-xs mt-1"
          style={{ color: "var(--cmc-neutral-5)" }}
        >
          Transaction history will appear here once you make transfers.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Unified toolbar: filters + stats + toggles */}
      <div
        className="flex items-center justify-between px-4 py-2.5 mb-3 rounded-xl flex-wrap gap-2"
        style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          {typeOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setTypeFilter(opt.key)}
              className="px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all"
              style={{
                background: typeFilter === opt.key ? "var(--cmc-text)" : "transparent",
                color: typeFilter === opt.key ? "var(--cmc-bg)" : "var(--cmc-neutral-5)",
                border: typeFilter === opt.key ? "none" : "1px solid var(--cmc-border)",
              }}
            >
              {opt.label} ({opt.count})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] tabular-nums" style={{ color: "var(--cmc-neutral-4)" }}>
            {transactions.length} total
          </span>
          <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
            <span style={{ color: "var(--cmc-neutral-5)" }}>Spam</span>
            <input
              type="checkbox"
              checked={!hideSpam}
              onChange={(e) => setHideSpam(!e.target.checked)}
              className="w-3 h-3 accent-[#6366f1]"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
            <span style={{ color: "var(--cmc-neutral-5)" }}>P&L</span>
            <input
              type="checkbox"
              checked={showPnL}
              onChange={(e) => setShowPnL(e.target.checked)}
              className="w-3 h-3 accent-[#6366f1]"
            />
          </label>
        </div>
      </div>

      {/* Transaction groups by date */}
      {Object.entries(grouped).map(([date, txs]) => (
        <div
          key={date}
          className="rounded-xl mb-3 overflow-hidden"
          style={{ border: "1px solid var(--cmc-border)" }}
        >
          {/* Date header */}
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{
              background: "var(--cmc-neutral-1)",
              borderBottom: "1px solid var(--cmc-border)",
            }}
          >
            <p
              className="text-xs font-semibold"
              style={{ color: "var(--cmc-text)" }}
            >
              {date}
            </p>
            <p className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>
              {txs.length} activit{txs.length === 1 ? "y" : "ies"}
            </p>
          </div>

          {/* Column headers */}
          <div
            className="grid px-4 py-2 text-[10px] font-semibold sticky top-0 z-10"
            style={{
              gridTemplateColumns: showPnL ? "70px 1fr 1fr 1fr 80px 60px 40px" : "70px 1fr 1fr 1fr 80px 40px",
              color: "var(--cmc-neutral-5)",
              background: "var(--cmc-neutral-1)",
              borderBottom: "1px solid var(--cmc-border)",
            }}
          >
            <span>Time</span>
            <span>App</span>
            <span>Received</span>
            <span>Sent</span>
            <span>Tags</span>
            {showPnL && <span className="text-right">P&L</span>}
            <span className="text-right">Link</span>
          </div>

          {/* Transaction rows */}
          {txs.map((tx) => {
            const app =
              APP_META[tx.source] || APP_META.UNKNOWN;
            const tag =
              TYPE_TAGS[tx.type] || {
                label: tx.type,
                color: "var(--cmc-neutral-5)",
              };

            const SOL_ICON = "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";

            // Compute received/sent with icons
            const received: { amount: string; symbol: string; icon?: string }[] = [];
            const sent: { amount: string; symbol: string; icon?: string }[] = [];

            for (const tt of tx.tokenTransfers) {
              const { symbol: sym, icon: ico } = resolveSymbol(tt.mint);
              if (tt.toUserAccount === walletAddress && tt.tokenAmount > 0) {
                received.push({
                  amount: `+${fmtAmount(tt.tokenAmount)}`,
                  symbol: sym,
                  icon: ico,
                });
              }
              if (
                tt.fromUserAccount === walletAddress &&
                tt.tokenAmount > 0
              ) {
                sent.push({
                  amount: `-${fmtAmount(tt.tokenAmount)}`,
                  symbol: sym,
                  icon: ico,
                });
              }
            }

            for (const nt of tx.nativeTransfers) {
              const solAmount = nt.amount / 1e9;
              if (
                nt.toUserAccount === walletAddress &&
                Math.abs(solAmount) > 0.000001
              ) {
                received.push({
                  amount: `+${fmtAmount(solAmount)}`,
                  symbol: "SOL",
                  icon: SOL_ICON,
                });
              }
              if (
                nt.fromUserAccount === walletAddress &&
                Math.abs(solAmount) > 0.000001
              ) {
                sent.push({
                  amount: `-${fmtAmount(Math.abs(solAmount))}`,
                  symbol: "SOL",
                  icon: SOL_ICON,
                });
              }
            }

            return (
              <div
                key={tx.signature}
                className="grid px-4 py-2.5 text-xs transition-colors hover:bg-white/1.5"
                style={{
                  gridTemplateColumns: showPnL ? "70px 1fr 1fr 1fr 80px 60px 40px" : "70px 1fr 1fr 1fr 80px 40px",
                  borderBottom: "1px solid var(--cmc-border)",
                }}
              >
                {/* Time */}
                <span style={{ color: "var(--cmc-neutral-5)" }}>
                  {fmtTime(tx.timestamp)}
                </span>

                {/* App */}
                <div className="flex items-center gap-1.5">
                  {app.icon ? (
                    <img src={app.icon} alt={app.label} className="h-5 w-5 rounded-full shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div
                      className="h-5 w-5 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0"
                      style={{ background: "var(--cmc-neutral-2)", color: app.color }}
                    >
                      {app.label.slice(0, 1)}
                    </div>
                  )}
                  <div>
                    <p
                      className="text-xs font-semibold leading-tight"
                      style={{ color: "var(--cmc-text)" }}
                    >
                      {app.label}
                    </p>
                    <p
                      className="text-[9px] leading-tight"
                      style={{ color: "var(--cmc-neutral-5)" }}
                    >
                      {tx.type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                  </div>
                </div>

                {/* Received */}
                <div className="flex flex-col gap-0.5">
                  {received.map((r, i) => (
                    <div key={i} className="flex items-center gap-1">
                      {r.icon && <img src={r.icon} alt={r.symbol} className="h-3.5 w-3.5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                      <span style={{ color: "#16c784" }}>
                        {r.amount} {r.symbol}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Sent */}
                <div className="flex flex-col gap-0.5">
                  {sent.map((s, i) => (
                    <div key={i} className="flex items-center gap-1">
                      {s.icon && <img src={s.icon} alt={s.symbol} className="h-3.5 w-3.5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                      <span style={{ color: "#ea3943" }}>
                        {s.amount} {s.symbol}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Tags */}
                <div>
                  <span
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      background: tag.color + "18",
                      color: tag.color,
                    }}
                  >
                    {tag.label}
                  </span>
                </div>

                {/* P&L estimate for swaps */}
                {showPnL && (
                  <div className="text-right text-[10px] font-semibold">
                    {tx.type === "SWAP" && received.length > 0 && sent.length > 0 ? (
                      <span className="flex items-center justify-end gap-0.5" style={{ color: "#16c784" }}>
                        <TrendingUp size={9} />
                        Swap
                      </span>
                    ) : tx.type === "TRANSFER" && sent.length > 0 ? (
                      <span style={{ color: "#ea3943" }}>Out</span>
                    ) : tx.type === "TRANSFER" && received.length > 0 ? (
                      <span style={{ color: "#16c784" }}>In</span>
                    ) : (
                      <span style={{ color: "var(--cmc-neutral-5)" }}>—</span>
                    )}
                  </div>
                )}

                {/* Link */}
                <div className="text-right">
                  <a
                    href={`https://solscan.io/tx/${tx.signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex p-1 rounded hover:bg-white/5 transition-colors"
                  >
                    <ExternalLink
                      size={12}
                      style={{ color: "var(--cmc-neutral-5)" }}
                    />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Load more / showing count */}
      <div className="flex items-center justify-center gap-3 mt-3 mb-1">
        <span className="text-[10px]" style={{ color: "var(--cmc-neutral-4)" }}>
          Showing {visibleTxCount} of {transactions.length} transactions
        </span>
        {transactions.length >= txLimit && (
          <button
            onClick={() => setTxLimit((prev) => prev + 50)}
            className="px-3 py-1 rounded-full text-[10px] font-semibold transition-colors hover:bg-white/5"
            style={{ color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}
          >
            Load More
          </button>
        )}
      </div>
    </div>
  );
}
