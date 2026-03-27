"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, ExternalLink, TrendingUp, Sprout, Landmark, Gift, ChevronDown, Lock, ArrowUpRight, ArrowDownRight, Shield, Droplets, RefreshCw, AlertTriangle } from "lucide-react";
import { fetchKaminoUserPositions, type KaminoUserPosition, type KaminoEnrichedVault, type KaminoObligation, type KaminoLendPosition, type KaminoLiquidityPosition } from "@/lib/kamino";
import { fmtCurrency as fmtUsd } from "@/lib/format";

const KAMINO_LOGO = "https://assets.coingecko.com/coins/images/35727/small/Kamino.png";

const TOKEN_ICONS: Record<string, string> = {
  "So11111111111111111111111111111111111111112": "https://assets.coingecko.com/coins/images/4128/small/solana.png",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3": "https://assets.coingecko.com/coins/images/31924/small/pyth.png",
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn": "https://assets.coingecko.com/coins/images/28946/small/JitoSOL.png",
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So": "https://assets.coingecko.com/coins/images/26629/small/mSOL.png",
  "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1": "https://assets.coingecko.com/coins/images/26636/small/blazesolana.png",
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": "https://assets.coingecko.com/coins/images/33205/small/bonk.png",
  "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL": "https://assets.coingecko.com/coins/images/33228/small/jto.png",
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5": "https://assets.coingecko.com/coins/images/36440/small/mew.png",
  "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof": "https://assets.coingecko.com/coins/images/11636/small/render.png",
  "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux": "https://assets.coingecko.com/coins/images/4284/small/Helium_HNT.png",
  "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v": "https://assets.coingecko.com/coins/images/36083/small/jupSOL.png",
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": "https://assets.coingecko.com/coins/images/34188/small/jup.png",
  "KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS": KAMINO_LOGO,
  "LSTxxxnJzKDFSLr4dUkPcmCf5VyryEqzPLz5j4bpxFp": "https://assets.coingecko.com/coins/images/34003/small/LST.png",
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm": "https://assets.coingecko.com/coins/images/33613/small/wif.png",
  "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ": "https://assets.coingecko.com/coins/images/35177/small/w.png",
};

function getTokenIcon(mint: string): string | null {
  return TOKEN_ICONS[mint] || null;
}

function TokenIcon({ mint, symbol, size = 20 }: { mint: string; symbol: string; size?: number }) {
  const url = getTokenIcon(mint);
  if (url) {
    return (
      <div
        className="rounded-full shrink-0 overflow-hidden flex items-center justify-center"
        style={{ width: size, height: size, background: "var(--cmc-neutral-2)" }}
      >
        <img
          src={url}
          alt={symbol}
          className="rounded-full"
          style={{ width: size, height: size }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      </div>
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-bold"
      style={{ width: size, height: size, fontSize: size * 0.38, background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}
    >
      {symbol.slice(0, 2).toUpperCase()}
    </div>
  );
}

function TokenPairIcon({ mintA, mintB, symbolA, symbolB, size = 20 }: { mintA: string; mintB: string; symbolA: string; symbolB: string; size?: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size * 1.5, height: size }}>
      <div className="absolute left-0 top-0 z-1" style={{ border: "1.5px solid var(--cmc-neutral-1)", borderRadius: "50%" }}>
        <TokenIcon mint={mintA} symbol={symbolA} size={size} />
      </div>
      <div className="absolute top-0 z-0" style={{ left: size * 0.55, border: "1.5px solid var(--cmc-neutral-1)", borderRadius: "50%" }}>
        <TokenIcon mint={mintB} symbol={symbolB} size={size} />
      </div>
    </div>
  );
}

function KaminoLogo({ size = 20 }: { size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className="rounded-full shrink-0">
        <rect width="32" height="32" rx="16" fill="#1FCFB1" />
        <path d="M9 8h3.5v6.2L19.3 8H23l-7.5 7L23 24h-3.8l-6.7-7.8V24H9V8z" fill="#0D1117" />
      </svg>
    );
  }
  return (
    <img
      src={KAMINO_LOGO}
      alt="Kamino"
      className="rounded-full shrink-0"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}


function fmtAmount(n: number): string {
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (n >= 0.0001) return n.toFixed(6);
  return n.toExponential(3);
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(2) + "%";
}

// ── Collapsible section ──
function Section({
  title,
  icon,
  value,
  color,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  value?: string;
  color: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 transition-colors hover:bg-white/5"
        style={{ background: "rgba(255,255,255,0.02)" }}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[11px] font-bold" style={{ color }}>{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {value && <span className="text-[11px] font-bold" style={{ color: "var(--cmc-text)" }}>{value}</span>}
          <ChevronDown
            size={12}
            className="transition-transform"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", color: "var(--cmc-neutral-5)" }}
          />
        </div>
      </button>
      {open && (
        <div style={{ borderTop: "1px solid var(--cmc-border)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Vault row ──
function VaultRow({ vault }: { vault: KaminoEnrichedVault }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 transition-colors hover:bg-white/5">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <TokenIcon mint={vault.tokenMint} symbol={vault.tokenSymbol} size={22} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <a
              href={`https://app.kamino.finance/lending/earn/${vault.vaultAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold truncate hover:underline"
              style={{ color: "var(--cmc-text)" }}
            >
              {vault.vaultName}
            </a>
            <ExternalLink size={8} style={{ color: "var(--cmc-neutral-5)", flexShrink: 0 }} />
            {vault.stakedShares > 0 && (
              <span className="text-[7px] font-bold uppercase px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}>
                <Lock size={6} /> Staked
              </span>
            )}
          </div>
          <div className="text-[9px]" style={{ color: "var(--cmc-neutral-5)" }}>
            {fmtAmount(vault.tokenBalance)} {vault.tokenSymbol || "tokens"}
            {vault.apy > 0 && <span className="ml-1.5" style={{ color: "var(--cmc-neutral-5)" }}>{(vault.apy * 100).toFixed(2)}% APY</span>}
          </div>
        </div>
      </div>
      <div className="text-right shrink-0 ml-3">
        <div className="text-[11px] font-bold" style={{ color: "var(--cmc-text)" }}>
          {vault.usdValue > 0.01 ? fmtUsd(vault.usdValue) : vault.usdValue > 0 ? "<$0.01" : "$0.00"}
        </div>
        {vault.apyFarmRewards > 0 && (
          <span className="text-[8px]" style={{ color: "var(--cmc-neutral-5)" }}>
            +{(vault.apyFarmRewards * 100).toFixed(2)}% farm
          </span>
        )}
        {vault.pnlUsd !== 0 && (
          <span className="text-[8px] font-semibold block" style={{ color: vault.pnlUsd >= 0 ? "#16c784" : "#ea3943" }}>
            {vault.pnlUsd >= 0 ? "+" : ""}{fmtUsd(vault.pnlUsd)} PnL
          </span>
        )}
        <div className="flex items-center gap-1 mt-0.5 justify-end">
          <a href={`https://app.kamino.finance/lending/earn/${vault.vaultAddress}`} target="_blank" rel="noopener noreferrer" className="text-[7px] font-bold px-1.5 py-0.5 rounded transition-colors hover:brightness-110" style={{ background: "rgba(22,199,132,0.1)", color: "#16c784" }}>Deposit</a>
          <a href={`https://app.kamino.finance/lending/earn/${vault.vaultAddress}`} target="_blank" rel="noopener noreferrer" className="text-[7px] font-bold px-1.5 py-0.5 rounded transition-colors hover:brightness-110" style={{ background: "rgba(255,255,255,0.04)", color: "var(--cmc-neutral-5)" }}>Withdraw</a>
        </div>
      </div>
    </div>
  );
}

// ── Lend token position row ──
function LendPositionRow({ pos }: { pos: KaminoLendPosition }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 transition-colors hover:bg-white/5">
      <div className="flex items-center gap-2.5">
        <TokenIcon mint={pos.tokenMint || ""} symbol={pos.tokenSymbol} size={22} />
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold" style={{ color: "var(--cmc-text)" }}>{pos.tokenSymbol}</span>
          </div>
          <span className="text-[9px]" style={{ color: "var(--cmc-neutral-5)" }}>
            {fmtAmount(pos.amount)} {pos.tokenSymbol}
          </span>
        </div>
      </div>
      <div className="text-right">
        <span className="text-[11px] font-bold" style={{ color: "var(--cmc-text)" }}>
          {pos.valueUsd > 0.01 ? fmtUsd(pos.valueUsd) : pos.valueUsd > 0 ? "<$0.01" : "$0.00"}
        </span>
      </div>
    </div>
  );
}

// ── Obligation card ──
function ObligationCard({ obligation }: { obligation: KaminoObligation }) {
  const s = obligation.stats;
  const healthPct = s.liquidationLtv > 0 ? Math.min(100, (s.loanToValue / s.liquidationLtv) * 100) : 0;
  const healthColor = healthPct < 50 ? "#16c784" : healthPct < 80 ? "#f59e0b" : "#ea3943";

  return (
    <div className="space-y-1">
      {/* Supplied */}
      {obligation.deposits.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
            <ArrowUpRight size={10} style={{ color: "#1FCFB1" }} />
            <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: "#1FCFB1" }}>Supplied</span>
            <span className="text-[8px] font-semibold ml-auto" style={{ color: "var(--cmc-neutral-5)" }}>{fmtUsd(s.totalDeposit)}</span>
          </div>
          {obligation.deposits.map((pos, i) => (
            <LendPositionRow key={i} pos={pos} />
          ))}
        </div>
      )}
      {/* Borrowed */}
      {obligation.borrows.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 px-3 pt-2 pb-1" style={{ borderTop: "1px solid var(--cmc-border)" }}>
            <ArrowDownRight size={10} style={{ color: "#ea3943" }} />
            <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: "#ea3943" }}>Borrowed</span>
            <span className="text-[8px] font-semibold ml-auto" style={{ color: "var(--cmc-neutral-5)" }}>{fmtUsd(s.totalBorrow)}</span>
          </div>
          {obligation.borrows.map((pos, i) => (
            <LendPositionRow key={i} pos={pos} />
          ))}
        </div>
      )}
      {/* Stats bar */}
      <div className="mx-3 mt-1 mb-2 rounded-lg p-2.5 space-y-1.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--cmc-border)" }}>
        <div className="flex items-center justify-between">
          <span className="text-[9px]" style={{ color: "var(--cmc-neutral-5)" }}>Net Account Value</span>
          <span className="text-[10px] font-bold" style={{ color: "var(--cmc-text)" }}>{fmtUsd(s.netAccountValue)}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[8px]" style={{ color: "var(--cmc-neutral-5)" }}>LTV {fmtPct(s.loanToValue)}</span>
              <span className="text-[8px]" style={{ color: "var(--cmc-neutral-5)" }}>Liq. {fmtPct(s.liquidationLtv)}</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--cmc-neutral-2)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, healthPct)}%`, background: healthColor }} />
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[8px]" style={{ color: "var(--cmc-neutral-5)" }}>Leverage</span>
            <div className="text-[10px] font-bold" style={{ color: "var(--cmc-text)" }}>{s.leverage.toFixed(2)}x</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── LP Position row ──
function LiquidityRow({ pos }: { pos: KaminoLiquidityPosition }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 transition-colors hover:bg-white/5">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <TokenPairIcon mintA={pos.tokenAMint} mintB={pos.tokenBMint} symbolA={pos.tokenA} symbolB={pos.tokenB} size={20} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <a
              href={`https://app.kamino.finance/liquidity/${pos.strategyAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold truncate hover:underline"
              style={{ color: "var(--cmc-text)" }}
            >
              {pos.tokenA}/{pos.tokenB}
            </a>
            <ExternalLink size={8} style={{ color: "var(--cmc-neutral-5)", flexShrink: 0 }} />
          </div>
          <div className="text-[9px]" style={{ color: "var(--cmc-neutral-5)" }}>
            {fmtAmount(pos.sharesHeld)} shares
            {pos.apy > 0 && <span className="ml-1.5">{(pos.apy * 100).toFixed(2)}% APY</span>}
          </div>
        </div>
      </div>
      <div className="text-right shrink-0 ml-3">
        <div className="text-[11px] font-bold" style={{ color: "var(--cmc-text)" }}>
          {pos.usdValue > 0.01 ? fmtUsd(pos.usdValue) : pos.usdValue > 0 ? "<$0.01" : "$0.00"}
        </div>
        {pos.tvl > 0 && (
          <span className="text-[8px]" style={{ color: "var(--cmc-neutral-5)" }}>
            TVL {fmtUsd(pos.tvl)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function KaminoPositions({ wallet, walletTokens, onTotalChange }: { wallet: string; walletTokens?: { mint: string; amount: number }[]; onTotalChange?: (total: number) => void }) {
  const [positions, setPositions] = useState<KaminoUserPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  // Stable key so useEffect doesn't re-fire on every render from .map() creating new arrays
  const tokensKey = useMemo(
    () => walletTokens ? walletTokens.map(t => `${t.mint}:${t.amount}`).join(",") : "",
    [walletTokens]
  );

  const loadPositions = useCallback(() => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    fetchKaminoUserPositions(wallet, walletTokens)
      .then((data) => { setPositions(data); })
      .catch((err) => { setError(err?.message || "Failed to load Kamino positions"); })
      .finally(() => { setLoading(false); });
  }, [wallet, walletTokens]);

  useEffect(() => {
    loadPositions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, tokensKey]);

  const hasEarn = positions && positions.earnVaults.length > 0;
  const hasLend = positions && positions.obligations.length > 0;
  const hasLiquidity = positions && positions.liquidityPositions.length > 0;
  const hasFarm = positions?.hasFarming;
  const hasRewards = positions?.seasonRewards && positions.seasonRewards.totalPoints > 0;
  const hasAny = hasEarn || hasLend || hasLiquidity || hasFarm || hasRewards;

  // Total across earn + lend net value + liquidity + farming
  const earnUsd = positions?.earnTotalUsd || 0;
  const lendNet = positions?.lendNetValue || 0;
  const liqUsd = positions?.liquidityTotalUsd || 0;
  const farmUsd = positions?.farmingTotalUsd || 0;
  const totalUsd = earnUsd + (lendNet > 0 ? lendNet : 0) + liqUsd + farmUsd;

  // Notify parent of total value changes
  useEffect(() => {
    if (onTotalChange) onTotalChange(totalUsd);
  }, [totalUsd, onTotalChange]);

  return (
    <div className="mt-6 mb-4">
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
        {/* ── Main Header ── */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/5"
          style={{ background: "var(--cmc-neutral-1)" }}
        >
          <div className="flex items-center gap-2.5">
            <KaminoLogo size={22} />
            <span className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>Kamino</span>
            {loading && <Loader2 size={12} className="animate-spin" style={{ color: "var(--cmc-neutral-5)" }} />}
          </div>
          <div className="flex items-center gap-3">
            {totalUsd > 0 && (
              <span className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>{fmtUsd(totalUsd)}</span>
            )}
            <ChevronDown
              size={14}
              className="transition-transform"
              style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", color: "var(--cmc-neutral-5)" }}
            />
          </div>
        </button>

        {/* ── Content ── */}
        {expanded && (
          <div className="p-3 space-y-2" style={{ borderTop: "1px solid var(--cmc-border)" }}>
            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-6 gap-2">
                <Loader2 size={14} className="animate-spin" style={{ color: "var(--cmc-neutral-5)" }} />
                <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>Loading Kamino positions…</span>
              </div>
            )}

            {/* Error state */}
            {!loading && error && (
              <div className="text-center py-6">
                <AlertTriangle size={24} className="mx-auto mb-2" style={{ color: "#f59e0b" }} />
                <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--cmc-text)" }}>Failed to load positions</p>
                <p className="text-[9px] mb-3" style={{ color: "var(--cmc-neutral-5)" }}>{error}</p>
                <button
                  onClick={loadPositions}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:brightness-110"
                  style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}
                >
                  <RefreshCw size={10} /> Retry
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && !hasAny && (
              <div className="text-center py-6">
                <div className="flex justify-center"><KaminoLogo size={36} /></div>
                <p className="text-[12px] font-semibold mb-1 mt-3" style={{ color: "var(--cmc-text)" }}>No Kamino positions found</p>
                <p className="text-[10px] mb-3" style={{ color: "var(--cmc-neutral-5)" }}>
                  Deposit into Kamino Earn vaults, Lend markets, or Liquidity pools to see your positions here
                </p>
                <a
                  href="https://app.kamino.finance/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:brightness-110"
                  style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}
                >
                  Explore Kamino <ExternalLink size={9} />
                </a>
              </div>
            )}

            {/* ═══ Earn Section ═══ */}
            {!loading && hasEarn && positions && (
              <Section
                title="Earn"
                icon={<TrendingUp size={12} style={{ color: "var(--cmc-text)" }} />}
                value={positions.earnTotalUsd > 0 ? fmtUsd(positions.earnTotalUsd) : undefined}
                color="var(--cmc-text)"
              >
                {(positions.earnWeightedApy > 0 || positions.earnInterestUsd > 0) && (
                  <div className="flex items-center gap-3 px-3 py-2" style={{ background: "rgba(255,255,255,0.02)" }}>
                    {positions.earnWeightedApy > 0 && (
                      <span className="text-[9px] font-semibold" style={{ color: "var(--cmc-text)" }}>
                        Avg APY: {(positions.earnWeightedApy * 100).toFixed(2)}%
                      </span>
                    )}
                    {positions.earnInterestUsd > 0 && (
                      <span className="text-[9px]" style={{ color: "var(--cmc-neutral-5)" }}>
                        Interest earned: {fmtUsd(positions.earnInterestUsd)}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                  <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Vault</span>
                  <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Value</span>
                </div>
                {positions.earnVaults.map((vault) => (
                  <VaultRow key={vault.vaultAddress} vault={vault} />
                ))}
              </Section>
            )}

            {/* ═══ Lending Section — Actual Positions ═══ */}
            {!loading && hasLend && positions && (
              <Section
                title="Lending"
                icon={<Landmark size={12} style={{ color: "var(--cmc-text)" }} />}
                value={positions.lendNetValue > 0 ? fmtUsd(positions.lendNetValue) : undefined}
                color="var(--cmc-text)"
                defaultOpen={true}
              >
                {positions.obligations.map((ob, i) => (
                  <ObligationCard key={ob.obligationAddress || i} obligation={ob} />
                ))}
                <div className="px-3 pb-2">
                  <a
                    href="https://app.kamino.finance/lending"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg transition-all hover:brightness-110 w-full"
                    style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}
                  >
                    Manage on Kamino <ExternalLink size={9} />
                  </a>
                </div>
              </Section>
            )}

            {/* ═══ Liquidity Section ═══ */}
            {!loading && hasLiquidity && positions && (
              <Section
                title="Liquidity"
                icon={<Droplets size={12} style={{ color: "var(--cmc-text)" }} />}
                value={positions.liquidityTotalUsd > 0 ? fmtUsd(positions.liquidityTotalUsd) : undefined}
                color="var(--cmc-text)"
                defaultOpen={true}
              >
                <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                  <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Pool</span>
                  <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Value</span>
                </div>
                {positions.liquidityPositions.map((pos) => (
                  <LiquidityRow key={pos.strategyAddress} pos={pos} />
                ))}
                <div className="px-3 pb-2">
                  <a
                    href="https://app.kamino.finance/liquidity"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 text-[10px] font-bold py-1.5 rounded-lg transition-all hover:brightness-110 w-full"
                    style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}
                  >
                    Manage on Kamino <ExternalLink size={9} />
                  </a>
                </div>
              </Section>
            )}

            {/* ═══ Farming Section ═══ */}
            {!loading && hasFarm && positions && (
              <Section
                title="Farming"
                icon={<Sprout size={12} style={{ color: "var(--cmc-text)" }} />}
                color="var(--cmc-text)"
                defaultOpen={true}
              >
                <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                  <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Rewards</span>
                  <div className="flex items-center gap-6">
                    <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Balance</span>
                    <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Value</span>
                  </div>
                </div>
                {positions.farmingTxs.slice(0, 10).map((tx, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 transition-colors hover:bg-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "var(--cmc-neutral-2)" }}>
                        <Sprout size={10} style={{ color: "var(--cmc-text)" }} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`https://solscan.io/tx/${tx.signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold hover:underline"
                          style={{ color: "var(--cmc-text)" }}
                        >
                          {tx.rewardSymbol || tx.instruction.replace(/([A-Z])/g, " $1").trim()}
                        </a>
                        <ExternalLink size={7} style={{ color: "var(--cmc-neutral-5)" }} />
                        {tx.instruction.toLowerCase().includes("claim") && (
                          <span className="text-[7px] font-bold uppercase px-1.5 py-0.5 rounded-full" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}>
                            Claimable
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-[10px] font-semibold" style={{ color: "var(--cmc-text)" }}>
                        {fmtAmount(parseFloat(tx.rewardAmount || "0"))} {tx.rewardSymbol}
                      </span>
                      <span className="text-[10px] font-semibold min-w-[50px] text-right" style={{ color: "var(--cmc-text)" }}>
                        {(tx.rewardUsdValue || 0) > 0.01 ? fmtUsd(tx.rewardUsdValue || 0) : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </Section>
            )}

            {/* ═══ Season Rewards ═══ */}
            {!loading && hasRewards && positions?.seasonRewards && (
              <Section
                title="Season Rewards"
                icon={<Gift size={12} style={{ color: "var(--cmc-text)" }} />}
                color="var(--cmc-text)"
                defaultOpen={false}
              >
                <div className="px-3 py-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>Total Points</span>
                    <span className="text-[11px] font-bold" style={{ color: "var(--cmc-text)" }}>
                      {positions.seasonRewards.totalPoints.toLocaleString()}
                    </span>
                  </div>
                  {positions.seasonRewards.kvaultPoints > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>Earn Points</span>
                      <span className="text-[10px] font-semibold" style={{ color: "var(--cmc-text)" }}>
                        {positions.seasonRewards.kvaultPoints.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {positions.seasonRewards.klendPoints > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>Lend Points</span>
                      <span className="text-[10px] font-semibold" style={{ color: "var(--cmc-text)" }}>
                        {positions.seasonRewards.klendPoints.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Footer link */}
            {!loading && hasAny && (
              <div className="text-center pt-1">
                <a
                  href="https://app.kamino.finance/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-semibold transition-colors hover:underline"
                  style={{ color: "var(--cmc-neutral-5)" }}
                >
                  Open Kamino Finance <ExternalLink size={9} />
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
