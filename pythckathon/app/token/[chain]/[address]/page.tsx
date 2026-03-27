"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftRight, ExternalLink, Copy, Check, Globe, Twitter, MessageCircle,
  Droplets, BarChart3, Clock, Shield, ShieldCheck, ShieldAlert, TrendingUp,
  TrendingDown, ArrowLeft, Loader2, Rocket, Crown, RefreshCw, Users, Zap,
} from "lucide-react";
import {
  fetchDexTokenPools, fetchDexTokenPairs, type DexPair,
  fetchJupToken, type JupiterToken,
  fetchRaydiumPoolsByMint, type RaydiumPool,
  fetchPumpToken, type PumpToken,
} from "@/lib/api/backend";
import { fmtUsd, fmtPrice, fmtB, fmtAmount, truncAddr } from "@/lib/format";
import { toast } from "sonner";
import InlineSwap from "@/Components/swap/InlineSwap";
import Breadcrumbs from "@/Components/shared/Breadcrumbs";

function timeAgo(ts: number): string {
  if (!ts) return "—";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); toast.success("Copied!"); setTimeout(() => setCopied(false), 1500); }}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors hover:bg-white/10"
      style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-neutral-5)" }}
    >
      {copied ? <Check size={10} style={{ color: "var(--pf-teal)" }} /> : <Copy size={10} />}
      {label || "Copy CA"}
    </button>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
      <p className="text-[8px] font-bold uppercase tracking-wider mb-1" style={{ color: color || "var(--cmc-neutral-5)" }}>{label}</p>
      <p className="text-sm font-bold tabular-nums font-data" style={{ color: "var(--cmc-text)" }}>{value}</p>
    </div>
  );
}

function PoolRow({ pair }: { pair: DexPair }) {
  const change = pair.priceChange?.h24 || 0;
  const changeColor = change > 0 ? "var(--pf-up)" : change < 0 ? "var(--pf-down)" : "var(--cmc-neutral-5)";
  return (
    <div className="flex items-center justify-between py-3 px-4 transition-colors hover:bg-white/2" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded capitalize" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>
            {pair.dexId || "DEX"}
          </span>
        </div>
        <div className="min-w-0">
          <span className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>
            {pair.baseToken?.symbol}/{pair.quoteToken?.symbol}
          </span>
          {pair.pairCreatedAt > 0 && (
            <span className="ml-2 text-[9px]" style={{ color: "var(--cmc-neutral-5)" }}>{timeAgo(pair.pairCreatedAt)}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <div className="text-[11px] font-bold tabular-nums" style={{ color: "var(--cmc-text)" }}>{fmtPrice(pair.priceUsd)}</div>
          <div className="text-[9px] font-semibold tabular-nums" style={{ color: changeColor }}>
            {change > 0 ? "+" : ""}{change.toFixed(2)}%
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-[10px] font-semibold tabular-nums" style={{ color: "var(--cmc-text)" }}>{fmtUsd(pair.liquidity?.usd || 0)}</div>
          <div className="text-[8px] uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Liquidity</div>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-[10px] font-semibold tabular-nums" style={{ color: "var(--cmc-text)" }}>{fmtUsd(pair.volume?.h24 || 0)}</div>
          <div className="text-[8px] uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Vol 24h</div>
        </div>
        {pair.url && (
          <a href={pair.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/5">
            <ExternalLink size={11} style={{ color: "var(--cmc-neutral-5)" }} />
          </a>
        )}
      </div>
    </div>
  );
}

function RaydiumPoolRow({ pool }: { pool: RaydiumPool }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 transition-colors hover:bg-white/2" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: "rgba(104,208,241,0.1)", color: "#68d0f1" }}>Raydium</span>
        <span className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>{pool.mintA.symbol}/{pool.mintB.symbol}</span>
        <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>{pool.type}</span>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <div className="text-[10px] font-semibold tabular-nums" style={{ color: "var(--cmc-text)" }}>{fmtUsd(pool.tvl)}</div>
          <div className="text-[8px] uppercase" style={{ color: "var(--cmc-neutral-5)" }}>TVL</div>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-[10px] font-semibold tabular-nums" style={{ color: "var(--cmc-text)" }}>{fmtUsd(pool.volume24h)}</div>
          <div className="text-[8px] uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Vol 24h</div>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-[10px] font-semibold tabular-nums" style={{ color: pool.apr24h > 0 ? "var(--pf-up)" : "var(--cmc-text)" }}>
            {pool.apr24h > 0 ? `${pool.apr24h.toFixed(1)}%` : "—"}
          </div>
          <div className="text-[8px] uppercase" style={{ color: "var(--cmc-neutral-5)" }}>APR</div>
        </div>
      </div>
    </div>
  );
}

export default function TokenDetailPage() {
  const params = useParams();
  const chain = (params?.chain as string) || "solana";
  const address = (params?.address as string) || "";

  const [loading, setLoading] = useState(true);
  const [dexPairs, setDexPairs] = useState<DexPair[]>([]);
  const [jupToken, setJupToken] = useState<JupiterToken | null>(null);
  const [rayPools, setRayPools] = useState<RaydiumPool[]>([]);
  const [pumpToken, setPumpToken] = useState<PumpToken | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dex, jup, ray, pump] = await Promise.allSettled([
        fetchDexTokenPairs(chain, address),
        chain === "solana" ? fetchJupToken(address) : Promise.resolve(null),
        chain === "solana" ? fetchRaydiumPoolsByMint(address) : Promise.resolve([]),
        chain === "solana" ? fetchPumpToken(address) : Promise.resolve(null),
      ]);
      if (dex.status === "fulfilled") setDexPairs(dex.value || []);
      if (jup.status === "fulfilled") setJupToken(jup.value);
      if (ray.status === "fulfilled") setRayPools(ray.value || []);
      if (pump.status === "fulfilled") setPumpToken(pump.value);
    } catch (err) {
      console.error("[TokenDetail] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [chain, address]);

  useEffect(() => { loadData(); }, [loadData]);

  // Derive best data from all sources
  const primaryPair = dexPairs[0] || null;
  const symbol = jupToken?.symbol || primaryPair?.baseToken?.symbol || pumpToken?.symbol || address.slice(0, 6);
  const name = jupToken?.name || primaryPair?.baseToken?.name || pumpToken?.name || "";
  const logo = jupToken?.logoURI || pumpToken?.imageUri || "";
  const price = Number(primaryPair?.priceUsd) || 0;
  const change24h = primaryPair?.priceChange?.h24 || 0;
  const changeColor = change24h > 0 ? "var(--pf-up)" : change24h < 0 ? "var(--pf-down)" : "var(--cmc-neutral-5)";

  const totalLiquidity = dexPairs.reduce((sum, p) => sum + (p.liquidity?.usd || 0), 0);
  const totalVolume = dexPairs.reduce((sum, p) => sum + (p.volume?.h24 || 0), 0);
  const totalTxns = dexPairs.reduce((sum, p) => sum + ((p.txns?.h24?.buys || 0) + (p.txns?.h24?.sells || 0)), 0);
  const fdv = primaryPair?.fdv || 0;
  const marketCap = primaryPair?.marketCap || pumpToken?.usdMarketCap || 0;

  if (loading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--pf-accent)" }} />
          <span className="ml-3 text-sm" style={{ color: "var(--cmc-neutral-5)" }}>Loading token data…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4">
      <Breadcrumbs />
      {/* Back link */}
      <Link href="/new-pairs" className="inline-flex items-center gap-1.5 text-xs font-medium mb-4 transition-colors hover:opacity-80" style={{ color: "var(--cmc-neutral-5)" }}>
        <ArrowLeft size={13} /> Back to Token Discovery
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          {logo ? (
            <img src={logo} alt="" className="w-14 h-14 rounded-2xl ring-2 ring-white/10" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}>{symbol.slice(0, 2)}</div>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold font-display tracking-tight" style={{ color: "var(--cmc-text)" }}>{symbol}</h1>
              {jupToken?.verified && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(22,199,132,0.12)", color: "#16c784" }}>
                  <ShieldCheck size={9} /> Verified
                </span>
              )}
              {pumpToken?.bondingCurveComplete && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(240,185,11,0.15)", color: "#f0b90b" }}>
                  <Crown size={9} /> Graduated
                </span>
              )}
              <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>{chain}</span>
            </div>
            {name && <p className="text-sm" style={{ color: "var(--cmc-neutral-5)" }}>{name}</p>}
            <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--cmc-neutral-4)" }}>{truncAddr(address)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/swap?from=SOL&to=${symbol}`}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: "linear-gradient(135deg, #16c784, var(--pf-accent))", color: "#000" }}
          >
            <ArrowLeftRight size={14} /> Swap {symbol}
          </Link>
          <CopyBtn text={address} />
          {primaryPair?.url && (
            <a href={primaryPair.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors hover:bg-white/10" style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-neutral-5)" }}>
              <ExternalLink size={12} /> DexScreener
            </a>
          )}
          <a href={`https://solscan.io/token/${address}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors hover:bg-white/10" style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-neutral-5)" }}>
            <ExternalLink size={12} /> Solscan
          </a>
        </div>
      </div>

      {/* Price + Stats row */}
      <div className="flex flex-wrap items-end gap-6 mb-6">
        {price > 0 && (
          <div>
            <span className="text-3xl font-bold tabular-nums font-data" style={{ color: "var(--cmc-text)" }}>{fmtPrice(price)}</span>
            <span className="ml-2 text-sm font-bold tabular-nums" style={{ color: changeColor }}>
              {change24h > 0 ? "+" : ""}{change24h.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        <StatCard label="Market Cap" value={marketCap > 0 ? fmtUsd(marketCap) : "—"} color="var(--pf-accent)" />
        <StatCard label="FDV" value={fdv > 0 ? fmtUsd(fdv) : "—"} />
        <StatCard label="Total Liquidity" value={fmtUsd(totalLiquidity)} color="var(--pf-teal)" />
        <StatCard label="Volume 24h" value={fmtUsd(totalVolume)} color="var(--pf-info)" />
        <StatCard label="Transactions 24h" value={totalTxns.toLocaleString()} />
        <StatCard label="Pools" value={String(dexPairs.length + rayPools.length)} />
      </div>

      {/* Inline Swap Widget (Solana tokens only) */}
      {chain === "solana" && (
        <div className="mb-6">
          <InlineSwap
            tokenSymbol={symbol}
            tokenMint={address}
            tokenLogo={logo}
            tokenDecimals={jupToken?.decimals || 9}
          />
        </div>
      )}

      {/* Pump.fun bonding curve */}
      {pumpToken && !pumpToken.bondingCurveComplete && (
        <div className="rounded-xl p-4 mb-6" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Rocket size={14} style={{ color: "#f0b90b" }} />
              <span className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>Pump.fun Bonding Curve</span>
            </div>
            <span className="text-xs font-bold tabular-nums" style={{ color: "#f0b90b" }}>{pumpToken.bondingProgress}%</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden mb-2" style={{ background: "var(--cmc-neutral-3)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pumpToken.bondingProgress}%`, background: "linear-gradient(90deg, #f0b90b, #ff6b35)" }} />
          </div>
          <div className="flex items-center gap-4 text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>
            <span>Creator: {truncAddr(pumpToken.creator)}</span>
            {pumpToken.replyCount > 0 && <span>{pumpToken.replyCount} replies</span>}
            {pumpToken.createdTimestamp > 0 && <span>Created {timeAgo(pumpToken.createdTimestamp)}</span>}
          </div>
        </div>
      )}

      {/* Token info card */}
      {(jupToken || pumpToken?.description) && (
        <div className="rounded-xl p-4 mb-6" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--cmc-neutral-5)" }}>Token Info</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            {jupToken && (
              <>
                <div>
                  <p className="text-[9px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Decimals</p>
                  <p className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>{jupToken.decimals}</p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Mint Authority</p>
                  <p className="text-xs font-bold" style={{ color: jupToken.mintAuthority ? "var(--pf-warning)" : "var(--pf-up)" }}>
                    {jupToken.mintAuthority ? "Active" : "Renounced"}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Freeze Authority</p>
                  <p className="text-xs font-bold" style={{ color: jupToken.freezeAuthority ? "var(--pf-warning)" : "var(--pf-up)" }}>
                    {jupToken.freezeAuthority ? "Active" : "None"}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-5)" }}>Daily Volume</p>
                  <p className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>{fmtUsd(jupToken.dailyVolume)}</p>
                </div>
              </>
            )}
          </div>
          {pumpToken?.description && (
            <p className="text-xs leading-relaxed" style={{ color: "var(--cmc-neutral-5)" }}>{pumpToken.description}</p>
          )}
          {/* Social links */}
          {pumpToken && (pumpToken.website || pumpToken.twitter || pumpToken.telegram) && (
            <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--cmc-border)" }}>
              {pumpToken.website && (
                <a href={pumpToken.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors hover:bg-white/10" style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-neutral-5)" }}>
                  <Globe size={10} /> Website
                </a>
              )}
              {pumpToken.twitter && (
                <a href={`https://twitter.com/${pumpToken.twitter}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors hover:bg-white/10" style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-neutral-5)" }}>
                  <Twitter size={10} /> Twitter
                </a>
              )}
              {pumpToken.telegram && (
                <a href={`https://t.me/${pumpToken.telegram}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors hover:bg-white/10" style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-neutral-5)" }}>
                  <MessageCircle size={10} /> Telegram
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* TradingView Chart */}
      {primaryPair && (
        <div className="rounded-xl overflow-hidden mb-6" style={{ border: "1px solid var(--cmc-border)" }}>
          <iframe
            src={`https://dexscreener.com/${chain}/${address}?embed=1&theme=dark&trades=0&info=0`}
            className="w-full border-0"
            style={{ height: 420 }}
            title="Chart"
            loading="lazy"
          />
        </div>
      )}

      {/* Pools table */}
      {(dexPairs.length > 0 || rayPools.length > 0) && (
        <div className="rounded-xl overflow-hidden mb-6" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
            <div className="flex items-center gap-2">
              <Droplets size={13} style={{ color: "var(--pf-teal)" }} />
              <span className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>Pools</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>{dexPairs.length + rayPools.length}</span>
            </div>
            <button onClick={loadData} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: "var(--cmc-neutral-5)" }}>
              <RefreshCw size={12} />
            </button>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {dexPairs.map((pair, i) => <PoolRow key={`dex-${i}`} pair={pair} />)}
            {rayPools.map((pool, i) => <RaydiumPoolRow key={`ray-${i}`} pool={pool} />)}
          </div>
        </div>
      )}

      {/* No data */}
      {dexPairs.length === 0 && rayPools.length === 0 && !jupToken && !pumpToken && (
        <div className="py-16 text-center rounded-xl" style={{ border: "1px dashed var(--cmc-border)" }}>
          <ShieldAlert size={32} className="mx-auto mb-3" style={{ color: "var(--cmc-neutral-5)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--cmc-text)" }}>No data found for this token</p>
          <p className="text-xs mt-1" style={{ color: "var(--cmc-neutral-5)" }}>The token may not be listed on supported DEXs yet</p>
        </div>
      )}

      <div className="mt-6 text-[10px] text-center flex items-center justify-center gap-2 flex-wrap" style={{ color: "var(--cmc-neutral-5)" }}>
        <span>Data from</span>
        <span className="font-semibold">DexScreener</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span className="font-semibold">Jupiter</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span className="font-semibold">Raydium</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span className="font-semibold">Pump.fun</span>
      </div>
    </div>
  );
}
