"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import {
  RefreshCw, ExternalLink, Globe, Twitter, MessageCircle, Search, Clock,
  Droplets, BarChart3, ArrowUpDown, Copy, Check, ShieldCheck, ShieldAlert,
  Rocket, Crown, ArrowLeftRight, Flame, Zap, TrendingUp, AlertTriangle,
  LayoutGrid, List, Table2, SlidersHorizontal, X, ChevronDown,
} from "lucide-react";
import {
  fetchDexNewPairs, type DexToken, type DexPair,
  fetchJupTrending, type JupiterToken,
  fetchRaydiumLaunchLab, type LaunchLabToken,
  fetchPumpLatest, fetchPumpGraduated, fetchPumpTrending, fetchPumpAboutToGraduate, type PumpToken,
} from "@/lib/api/backend";
import { fmtUsd, fmtPrice } from "@/lib/format";
import { useMode, useIsDegen } from "@/lib/mode-store";
import { toast } from "sonner";
import QuickBuy from "@/Components/shared/QuickBuy";

type SourceTab = "dexscreener" | "jupiter" | "raydium" | "pumpfun";
type ViewMode = "grid" | "compact" | "table";
type SortOption = "newest" | "volume" | "liquidity" | "mcap" | "change";

const SOURCE_CONFIG: { key: SourceTab; label: string; icon: React.ReactNode; color: string; desc: string }[] = [
  { key: "dexscreener", label: "DexScreener", icon: <Flame size={13} />, color: "#16c784", desc: "Newly listed tokens with verified profiles" },
  { key: "jupiter", label: "Jupiter", icon: <Zap size={13} />, color: "#c7f284", desc: "Top verified tokens by daily volume" },
  { key: "raydium", label: "LaunchLab", icon: <Droplets size={13} />, color: "#68d0f1", desc: "Raydium LaunchLab — graduated memecoin launches" },
  { key: "pumpfun", label: "Pump.fun", icon: <Rocket size={13} />, color: "#f0b90b", desc: "Latest meme token launches" },
];

function timeAgo(ts: number): string {
  if (!ts) return "—";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); toast.success("Copied!"); setTimeout(() => setCopied(false), 1500); }}
      className="p-1 rounded-md transition-colors hover:bg-white/10"
      title="Copy address"
    >
      {copied ? <Check size={10} style={{ color: "var(--pf-teal)" }} /> : <Copy size={10} style={{ color: "var(--cmc-neutral-5)" }} />}
    </button>
  );
}

function SkeletonCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full animate-pulse" style={{ background: "var(--cmc-neutral-3)" }} />
              <div className="flex-1 space-y-1.5">
                <div className="w-20 h-3.5 rounded animate-pulse" style={{ background: "var(--cmc-neutral-3)" }} />
                <div className="w-32 h-2.5 rounded animate-pulse" style={{ background: "var(--cmc-neutral-3)" }} />
              </div>
            </div>
            <div className="flex justify-between">
              <div className="w-16 h-5 rounded animate-pulse" style={{ background: "var(--cmc-neutral-3)" }} />
              <div className="w-12 h-4 rounded animate-pulse" style={{ background: "var(--cmc-neutral-3)" }} />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[0, 1, 2].map(j => <div key={j} className="h-12 rounded-lg animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── DexScreener Card ──
function DexCard({ token, idx }: { token: DexToken; idx: number }) {
  const isDegen = useIsDegen();
  const pair = token.pair!;
  const change = pair.priceChange?.h24 || 0;
  const changeColor = change > 0 ? "var(--pf-up)" : change < 0 ? "var(--pf-down)" : "var(--cmc-neutral-5)";
  const txns24 = pair.txns ? (pair.txns.h24?.buys || 0) + (pair.txns.h24?.sells || 0) : 0;
  const isRisky = pair.liquidity.usd < 1000 && pair.volume.h24 > 50000;

  return (
    <div className="group rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg" style={{ border: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)", animationDelay: `${idx * 40}ms` }}>
      {token.header && <div className="h-12 bg-cover bg-center opacity-80" style={{ backgroundImage: `url(${token.header})` }} />}
      <div className="p-3.5">
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {token.icon ? (
              <img src={token.icon} alt="" className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-white/5" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}>
                {(pair.baseToken?.symbol || "?").slice(0, 2)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link href={`/token/${token.chainId}/${pair.baseToken?.address || token.tokenAddress}`} className="text-sm font-bold truncate hover:underline" style={{ color: "var(--cmc-text)" }}>{pair.baseToken?.symbol || token.tokenAddress.slice(0, 6)}</Link>
                <span className="text-[8px] px-1.5 py-0.5 rounded-full capitalize shrink-0 font-semibold" style={{ background: "rgba(22,199,132,0.1)", color: "#16c784" }}>{token.chainId}</span>
                {isRisky && <span title="Low liquidity / high volume"><AlertTriangle size={10} style={{ color: "var(--pf-warning)" }} /></span>}
              </div>
              {pair.baseToken?.name && <p className="text-[10px] truncate" style={{ color: "var(--cmc-neutral-5)" }}>{pair.baseToken.name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {pair.pairCreatedAt > 0 && (
              <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>
                <Clock size={8} /> {timeAgo(pair.pairCreatedAt)}
              </span>
            )}
            <CopyButton text={pair.baseToken?.address || token.tokenAddress} />
          </div>
        </div>

        <div className="flex items-baseline justify-between mb-2.5">
          <span className="text-lg font-bold tabular-nums font-data" style={{ color: "var(--cmc-text)" }}>{fmtPrice(pair.priceUsd)}</span>
          <span className="text-xs font-bold tabular-nums font-data" style={{ color: changeColor }}>
            {change > 0 ? "+" : ""}{change.toFixed(2)}%
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 mb-2.5">
          <div className="rounded-lg p-2 text-center" style={{ background: "var(--cmc-neutral-2)" }}>
            <p className="text-[7px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--pf-teal)" }}>Liquidity</p>
            <p className="text-[11px] font-bold tabular-nums font-data" style={{ color: "var(--cmc-text)" }}>{fmtUsd(pair.liquidity.usd)}</p>
          </div>
          <div className="rounded-lg p-2 text-center" style={{ background: "var(--cmc-neutral-2)" }}>
            <p className="text-[7px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--pf-accent)" }}>Volume</p>
            <p className="text-[11px] font-bold tabular-nums font-data" style={{ color: "var(--cmc-text)" }}>{fmtUsd(pair.volume.h24)}</p>
          </div>
          <div className="rounded-lg p-2 text-center" style={{ background: "var(--cmc-neutral-2)" }}>
            <p className="text-[7px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--pf-info)" }}>Txns</p>
            <p className="text-[11px] font-bold tabular-nums font-data" style={{ color: "var(--cmc-text)" }}>{txns24.toLocaleString()}</p>
          </div>
        </div>

        {token.description && <p className="text-[10px] leading-relaxed mb-2 line-clamp-2" style={{ color: "var(--cmc-neutral-5)" }}>{token.description}</p>}

        <div className="flex items-center gap-1.5 pt-2" style={{ borderTop: "1px solid var(--cmc-border)" }}>
          <Link href={`/swap?from=SOL&to=${pair.baseToken?.symbol || ""}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all hover:brightness-110" style={{ background: "var(--pf-accent)", color: "#fff" }}>
            <ArrowLeftRight size={9} /> Swap
          </Link>
          {isDegen && <QuickBuy tokenMint={pair.baseToken?.address || token.tokenAddress} tokenSymbol={pair.baseToken?.symbol || ""} />}
          {token.url && (
            <a href={token.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-medium transition-colors hover:bg-white/10" style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-neutral-5)" }}>
              <ExternalLink size={9} /> DexScreener
            </a>
          )}
          {token.links?.slice(0, 2).map((link, i) => (
            <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-medium transition-colors hover:bg-white/10" style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-neutral-5)" }}>
              {link.type === "twitter" ? <Twitter size={9} /> : <Globe size={9} />} {link.label || link.type || "Link"}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Jupiter Card ──
function JupCard({ token, idx }: { token: JupiterToken; idx: number }) {
  const isDegen = useIsDegen();
  return (
    <div className="group rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg" style={{ border: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)", animationDelay: `${idx * 40}ms` }}>
      <div className="p-3.5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {token.logoURI ? (
              <img src={token.logoURI} alt="" className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-white/5" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}>{token.symbol.slice(0, 2)}</div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link href={`/token/solana/${token.address}`} className="text-sm font-bold truncate hover:underline" style={{ color: "var(--cmc-text)" }}>{token.symbol}</Link>
                {token.verified && (
                  <span className="inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(22,199,132,0.12)", color: "#16c784" }}>
                    <ShieldCheck size={8} /> Verified
                  </span>
                )}
                {!token.mintAuthority && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(96,165,250,0.1)", color: "var(--pf-info)" }} title="Mint authority renounced">
                    Immutable
                  </span>
                )}
              </div>
              <p className="text-[10px] truncate" style={{ color: "var(--cmc-neutral-5)" }}>{token.name}</p>
            </div>
          </div>
          <CopyButton text={token.address} />
        </div>

        <div className="grid grid-cols-2 gap-1.5 mb-3">
          <div className="rounded-lg p-2.5" style={{ background: "var(--cmc-neutral-2)" }}>
            <p className="text-[7px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#c7f284" }}>Daily Volume</p>
            <p className="text-sm font-bold tabular-nums font-data" style={{ color: "var(--cmc-text)" }}>{fmtUsd(token.dailyVolume)}</p>
          </div>
          <div className="rounded-lg p-2.5" style={{ background: "var(--cmc-neutral-2)" }}>
            <p className="text-[7px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--cmc-neutral-5)" }}>Decimals</p>
            <p className="text-sm font-bold tabular-nums font-data" style={{ color: "var(--cmc-text)" }}>{token.decimals}</p>
          </div>
        </div>

        <div className="text-[9px] mb-3 font-mono truncate px-1" style={{ color: "var(--cmc-neutral-4)" }}>{token.address}</div>

        <div className="flex items-center gap-1.5 pt-2" style={{ borderTop: "1px solid var(--cmc-border)" }}>
          <Link href={`/swap?from=SOL&to=${token.symbol}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all hover:brightness-110" style={{ background: "#c7f284", color: "#000" }}>
            <ArrowLeftRight size={9} /> Swap
          </Link>
          {isDegen && <QuickBuy tokenMint={token.address} tokenSymbol={token.symbol} />}
          <a href={`https://solscan.io/token/${token.address}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-medium transition-colors hover:bg-white/10" style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-neutral-5)" }}>
            <ExternalLink size={9} /> Solscan
          </a>
        </div>
      </div>
    </div>
  );
}

// ── LaunchLab Card ──
function LaunchLabCard({ token, idx }: { token: LaunchLabToken; idx: number }) {
  const isDegen = useIsDegen();
  const pair = token.pair;
  const change = pair?.priceChange?.h24 || 0;
  const changeColor = change > 0 ? "var(--pf-up)" : change < 0 ? "var(--pf-down)" : "var(--cmc-neutral-5)";
  const txns24 = pair?.txns ? (pair.txns.h24?.buys || 0) + (pair.txns.h24?.sells || 0) : 0;
  const isNew = pair?.pairCreatedAt > 0 && (Date.now() - pair.pairCreatedAt) < 24 * 3600 * 1000;

  return (
    <div className="group rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg" style={{ border: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)", animationDelay: `${idx * 40}ms` }}>
      {token.header && <div className="h-12 bg-cover bg-center opacity-80" style={{ backgroundImage: `url(${token.header})` }} />}
      <div className="p-3.5">
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {token.icon ? (
              <img src={token.icon} alt="" className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-white/5" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}>
                {(pair?.baseToken?.symbol || "?").slice(0, 2)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link href={`/token/solana/${pair?.baseToken?.address || token.tokenAddress}`} className="text-sm font-bold truncate hover:underline" style={{ color: "var(--cmc-text)" }}>{pair?.baseToken?.symbol || token.tokenAddress.slice(0, 6)}</Link>
                <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold shrink-0" style={{ background: "rgba(104,208,241,0.12)", color: "#68d0f1" }}>LaunchLab</span>
                {isNew && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(104,208,241,0.2)", color: "#68d0f1" }}>NEW</span>}
              </div>
              {pair?.baseToken?.name && <p className="text-[10px] truncate" style={{ color: "var(--cmc-neutral-5)" }}>{pair.baseToken.name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {pair?.pairCreatedAt > 0 && (
              <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>
                <Clock size={8} /> {timeAgo(pair.pairCreatedAt)}
              </span>
            )}
            <CopyButton text={pair?.baseToken?.address || token.tokenAddress} />
          </div>
        </div>

        {pair && (
          <>
            <div className="flex items-baseline justify-between mb-2.5">
              <span className="text-lg font-bold tabular-nums font-data" style={{ color: "var(--cmc-text)" }}>{fmtPrice(pair.priceUsd)}</span>
              <span className="text-xs font-bold tabular-nums font-data" style={{ color: changeColor }}>
                {change > 0 ? "+" : ""}{change.toFixed(2)}%
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 mb-2.5">
              <div className="rounded-lg p-2 text-center" style={{ background: "var(--cmc-neutral-2)" }}>
                <p className="text-[7px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#68d0f1" }}>Liquidity</p>
                <p className="text-[11px] font-bold tabular-nums font-data" style={{ color: "var(--cmc-text)" }}>{fmtUsd(pair.liquidity?.usd || 0)}</p>
              </div>
              <div className="rounded-lg p-2 text-center" style={{ background: "var(--cmc-neutral-2)" }}>
                <p className="text-[7px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--pf-accent)" }}>Volume 24h</p>
                <p className="text-[11px] font-bold tabular-nums font-data" style={{ color: "var(--cmc-text)" }}>{fmtUsd(pair.volume?.h24 || 0)}</p>
              </div>
              <div className="rounded-lg p-2 text-center" style={{ background: "var(--cmc-neutral-2)" }}>
                <p className="text-[7px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--pf-info)" }}>Txns 24h</p>
                <p className="text-[11px] font-bold tabular-nums font-data" style={{ color: "var(--cmc-text)" }}>{txns24.toLocaleString()}</p>
              </div>
            </div>
          </>
        )}

        {token.description && <p className="text-[10px] leading-relaxed mb-2 line-clamp-2" style={{ color: "var(--cmc-neutral-5)" }}>{token.description}</p>}

        <div className="flex items-center gap-1.5 pt-2" style={{ borderTop: "1px solid var(--cmc-border)" }}>
          <Link href={`/swap?from=SOL&to=${pair?.baseToken?.symbol || ""}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all hover:brightness-110" style={{ background: "#68d0f1", color: "#000" }}>
            <ArrowLeftRight size={9} /> Swap
          </Link>
          {isDegen && pair?.baseToken?.address && <QuickBuy tokenMint={pair.baseToken.address} tokenSymbol={pair.baseToken.symbol || ""} />}
          {token.url && (
            <a href={token.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-medium transition-colors hover:bg-white/10" style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-neutral-5)" }}>
              <ExternalLink size={9} /> DexScreener
            </a>
          )}
          <a href={`https://raydium.io/launchpad/`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-medium transition-colors hover:bg-white/10" style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-neutral-5)" }}>
            <Droplets size={9} /> Raydium
          </a>
          {token.links?.slice(0, 1).map((link, i) => (
            <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-medium transition-colors hover:bg-white/10" style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-neutral-5)" }}>
              {link.type === "twitter" ? <Twitter size={9} /> : <Globe size={9} />} {link.label || link.type || "Link"}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Pump.fun Card ──
function PumpCard({ token, idx }: { token: PumpToken; idx: number }) {
  const isDegen = useIsDegen();
  return (
    <div className="group rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg" style={{ border: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)", animationDelay: `${idx * 40}ms` }}>
      <div className="p-3.5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {token.imageUri ? (
              <img src={token.imageUri} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0 ring-2 ring-white/5" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: "var(--cmc-neutral-2)" }}>🚀</div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link href={`/token/solana/${token.mint}`} className="text-sm font-bold truncate hover:underline" style={{ color: "var(--cmc-text)" }}>{token.symbol}</Link>
                {token.bondingCurveComplete && (
                  <span className="inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(240,185,11,0.15)", color: "#f0b90b" }}>
                    <Crown size={8} /> Graduated
                  </span>
                )}
                {token.kingOfTheHill && (
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(240,185,11,0.25)", color: "#f0b90b" }}>👑 KOTH</span>
                )}
              </div>
              <p className="text-[10px] truncate" style={{ color: "var(--cmc-neutral-5)" }}>{token.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {token.createdTimestamp > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>
                {timeAgo(token.createdTimestamp)}
              </span>
            )}
            <CopyButton text={token.mint} />
          </div>
        </div>

        {/* Bonding curve progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>Bonding Curve</span>
            <span className="text-[9px] font-bold tabular-nums" style={{ color: token.bondingCurveComplete ? "#f0b90b" : "var(--cmc-text)" }}>{token.bondingProgress}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--cmc-neutral-3)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${token.bondingProgress}%`,
                background: token.bondingCurveComplete ? "linear-gradient(90deg, #f0b90b, #ff6b35)" : "linear-gradient(90deg, #f0b90b 0%, var(--pf-accent) 100%)",
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 mb-2.5">
          <div className="rounded-lg p-2 text-center" style={{ background: "var(--cmc-neutral-2)" }}>
            <p className="text-[7px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#f0b90b" }}>Market Cap</p>
            <p className="text-[11px] font-bold tabular-nums font-data" style={{ color: "var(--cmc-text)" }}>{token.usdMarketCap > 0 ? fmtUsd(token.usdMarketCap) : `${(token.marketCapSol / 1e9).toFixed(1)} SOL`}</p>
          </div>
          <div className="rounded-lg p-2 text-center" style={{ background: "var(--cmc-neutral-2)" }}>
            <p className="text-[7px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--cmc-neutral-5)" }}>Replies</p>
            <p className="text-[11px] font-bold tabular-nums font-data" style={{ color: "var(--cmc-text)" }}>{token.replyCount}</p>
          </div>
        </div>

        {token.description && <p className="text-[10px] leading-relaxed mb-2 line-clamp-2" style={{ color: "var(--cmc-neutral-5)" }}>{token.description}</p>}

        <div className="flex items-center gap-1.5 pt-2" style={{ borderTop: "1px solid var(--cmc-border)" }}>
          {token.bondingCurveComplete || token.raydiumPool ? (
            <>
              <Link href={`/swap?from=SOL&to=${token.symbol}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all hover:brightness-110" style={{ background: "#f0b90b", color: "#000" }}>
                <ArrowLeftRight size={9} /> Swap
              </Link>
              {isDegen && token.mint && <QuickBuy tokenMint={token.mint} tokenSymbol={token.symbol} />}
            </>
          ) : (
            <a href={`https://pump.fun/coin/${token.mint}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all hover:brightness-110" style={{ background: "#f0b90b", color: "#000" }}>
              <Rocket size={9} /> Buy on Pump.fun
            </a>
          )}
          {token.twitter && (
            <a href={`https://twitter.com/${token.twitter}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-medium transition-colors hover:bg-white/10" style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-neutral-5)" }}>
              <Twitter size={9} /> Twitter
            </a>
          )}
          {token.telegram && (
            <a href={`https://t.me/${token.telegram}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-medium transition-colors hover:bg-white/10" style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-neutral-5)" }}>
              <MessageCircle size={9} /> TG
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// ── Main Page ──
// ═══════════════════════════════════════════
export default function NewPairsPage() {
  const mode = useMode();
  const isDegen = mode === "degen";
  const [activeTab, setActiveTab] = useState<SourceTab>("dexscreener");
  const [loading, setLoading] = useState(true);
  const [chainFilter, setChainFilter] = useState("solana");
  const refreshRef = useRef<NodeJS.Timeout | null>(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("discovery_view") as ViewMode) || "grid";
    return "grid";
  });

  // Data stores per source
  const [dexTokens, setDexTokens] = useState<DexToken[]>([]);
  const [jupTokens, setJupTokens] = useState<JupiterToken[]>([]);
  const [launchLabTokens, setLaunchLabTokens] = useState<LaunchLabToken[]>([]);
  const [pumpTokens, setPumpTokens] = useState<PumpToken[]>([]);
  const [pumpMode, setPumpMode] = useState<"latest" | "graduated" | "trending" | "graduating">("latest");

  // Persist view mode
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("discovery_view", viewMode); }, [viewMode]);

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - lastUpdate) / 1000)), 1000);
    return () => clearInterval(t);
  }, [lastUpdate]);

  const loadData = useCallback(async (tab: SourceTab) => {
    setLoading(true);
    try {
      switch (tab) {
        case "dexscreener": {
          const profiles = await fetchDexNewPairs();
          setDexTokens(profiles);
          break;
        }
        case "jupiter": {
          const tokens = await fetchJupTrending(80);
          setJupTokens(tokens);
          break;
        }
        case "raydium": {
          const tokens = await fetchRaydiumLaunchLab(60);
          setLaunchLabTokens(tokens);
          break;
        }
        case "pumpfun": {
          const [latest, graduated, trending, graduating] = await Promise.allSettled([
            fetchPumpLatest(60),
            fetchPumpGraduated(30),
            fetchPumpTrending(30),
            fetchPumpAboutToGraduate(30),
          ]);
          if (latest.status === "fulfilled") setPumpTokens(prev => [...latest.value]);
          if (graduated.status === "fulfilled") {
            setPumpTokens(prev => {
              const mints = new Set(prev.map(t => t.mint));
              const extra = (graduated.value || []).filter(t => !mints.has(t.mint));
              return [...prev, ...extra];
            });
          }
          if (trending.status === "fulfilled") {
            setPumpTokens(prev => {
              const mints = new Set(prev.map(t => t.mint));
              const extra = (trending.value || []).filter(t => !mints.has(t.mint));
              return [...prev, ...extra];
            });
          }
          if (graduating.status === "fulfilled") {
            setPumpTokens(prev => {
              const mints = new Set(prev.map(t => t.mint));
              const extra = (graduating.value || []).filter(t => !mints.has(t.mint));
              return [...prev, ...extra];
            });
          }
          break;
        }
      }
    } catch (err) {
      console.error(`[NewPairs] Load ${tab} error:`, err);
    } finally {
      setLoading(false);
      setLastUpdate(Date.now());
    }
  }, []);

  useEffect(() => {
    loadData(activeTab);
    const interval = activeTab === "pumpfun" ? 20000 : activeTab === "dexscreener" ? 60000 : 45000;
    refreshRef.current = setInterval(() => loadData(activeTab), interval);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [activeTab, loadData]);

  // ── Unified search + sort + filter ──
  const q = searchQuery.toLowerCase().trim();

  const filteredDex = useMemo(() => {
    let items = dexTokens.filter(t => (chainFilter === "all" || t.chainId === chainFilter) && t.pair);
    if (q) items = items.filter(t => (t.pair?.baseToken?.symbol || "").toLowerCase().includes(q) || (t.pair?.baseToken?.name || "").toLowerCase().includes(q) || t.tokenAddress.toLowerCase().includes(q));
    items.sort((a, b) => {
      const pa = a.pair!, pb = b.pair!;
      switch (sortOption) {
        case "volume": return (pb.volume?.h24 || 0) - (pa.volume?.h24 || 0);
        case "liquidity": return (pb.liquidity?.usd || 0) - (pa.liquidity?.usd || 0);
        case "mcap": return (pb.marketCap || pb.fdv || 0) - (pa.marketCap || pa.fdv || 0);
        case "change": return (pb.priceChange?.h24 || 0) - (pa.priceChange?.h24 || 0);
        default: return (pb.pairCreatedAt || 0) - (pa.pairCreatedAt || 0);
      }
    });
    return items.slice(0, 60);
  }, [dexTokens, chainFilter, q, sortOption]);

  const filteredJup = useMemo(() => {
    let items = [...jupTokens];
    if (q) items = items.filter(t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.address.toLowerCase().includes(q));
    items.sort((a, b) => {
      switch (sortOption) {
        case "volume": return (b.dailyVolume || 0) - (a.dailyVolume || 0);
        case "newest": return 0; // Keep API order
        default: return (b.dailyVolume || 0) - (a.dailyVolume || 0);
      }
    });
    return items.slice(0, 60);
  }, [jupTokens, q, sortOption]);

  const filteredLaunchLab = useMemo(() => {
    let items = [...launchLabTokens];
    if (q) items = items.filter(t => (t.pair?.baseToken?.symbol || "").toLowerCase().includes(q) || (t.pair?.baseToken?.name || "").toLowerCase().includes(q) || t.tokenAddress.toLowerCase().includes(q));
    items.sort((a, b) => {
      const pa = a.pair || {} as DexPair, pb = b.pair || {} as DexPair;
      switch (sortOption) {
        case "volume": return (pb.volume?.h24 || 0) - (pa.volume?.h24 || 0);
        case "liquidity": return (pb.liquidity?.usd || 0) - (pa.liquidity?.usd || 0);
        case "mcap": return (pb.marketCap || pb.fdv || 0) - (pa.marketCap || pa.fdv || 0);
        case "change": return (pb.priceChange?.h24 || 0) - (pa.priceChange?.h24 || 0);
        default: return (pb.pairCreatedAt || 0) - (pa.pairCreatedAt || 0);
      }
    });
    return items.slice(0, 60);
  }, [launchLabTokens, q, sortOption]);

  const filteredPump = useMemo(() => {
    let items: PumpToken[];
    switch (pumpMode) {
      case "graduated": items = pumpTokens.filter(t => t.bondingCurveComplete); break;
      case "trending": items = pumpTokens.filter(t => (t.replyCount || 0) > 0).sort((a, b) => (b.replyCount || 0) - (a.replyCount || 0)); break;
      case "graduating": items = pumpTokens.filter(t => !t.bondingCurveComplete && (t.bondingProgress || 0) >= 60); break;
      default: items = pumpTokens.filter(t => !t.bondingCurveComplete); break;
    }
    if (q) items = items.filter(t => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.mint.toLowerCase().includes(q));
    items.sort((a, b) => {
      switch (sortOption) {
        case "mcap": return (b.usdMarketCap || 0) - (a.usdMarketCap || 0);
        case "change": return (b.bondingProgress || 0) - (a.bondingProgress || 0);
        default: return (b.createdTimestamp || 0) - (a.createdTimestamp || 0);
      }
    });
    return items.slice(0, 60);
  }, [pumpTokens, pumpMode, q, sortOption]);

  const tabConfig = SOURCE_CONFIG.find(s => s.key === activeTab)!;

  const itemCount = activeTab === "dexscreener" ? filteredDex.length : activeTab === "jupiter" ? filteredJup.length : activeTab === "raydium" ? filteredLaunchLab.length : filteredPump.length;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4 relative">
      {/* Ambient gradient blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full opacity-[0.04] blur-[120px]" style={{ background: tabConfig.color, top: "-15%", left: "-10%" }} />
        <div className="absolute w-[400px] h-[400px] rounded-full opacity-[0.03] blur-[100px]" style={{ background: tabConfig.color, bottom: "-10%", right: "-5%" }} />
      </div>

      {/* Header */}
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold font-display tracking-tight" style={{ color: "var(--cmc-text)" }}>Token Discovery</h1>
            {isDegen && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(240,185,11,0.15)", color: "#f0b90b", border: "1px solid rgba(240,185,11,0.3)" }}>DEGEN</span>}
          </div>
          <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
            {tabConfig.desc} · <span className="font-semibold tabular-nums">{itemCount}</span> results
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: `${tabConfig.color}15`, color: tabConfig.color }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: tabConfig.color }} /> Live
          </div>
          <button onClick={() => loadData(activeTab)} disabled={loading} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: "var(--cmc-neutral-5)" }}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Source tabs */}
      <div className="relative z-10 flex items-center gap-1.5 mb-4 overflow-x-auto scrollbar-none pb-1">
        {SOURCE_CONFIG.map(src => (
          <button
            key={src.key}
            onClick={() => setActiveTab(src.key)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shrink-0"
            style={{
              background: activeTab === src.key ? src.color : "var(--cmc-neutral-1)",
              color: activeTab === src.key ? "#000" : "var(--cmc-neutral-5)",
              border: `1px solid ${activeTab === src.key ? src.color : "var(--cmc-border)"}`,
              transform: activeTab === src.key ? "scale(1.02)" : "scale(1)",
            }}
          >
            {src.icon} {src.label}
          </button>
        ))}
      </div>

      {/* Sub-filters */}
      <div className="relative z-10 flex flex-wrap items-center gap-3 mb-5">
        {activeTab === "dexscreener" && (
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
            {["solana", "ethereum", "base", "all"].map(c => (
              <button key={c} onClick={() => setChainFilter(c)} className="px-3 py-2 text-[11px] font-semibold capitalize transition-colors"
                style={{ background: chainFilter === c ? "var(--pf-accent)" : "var(--cmc-neutral-1)", color: chainFilter === c ? "#fff" : "var(--cmc-neutral-5)" }}>
                {c === "all" ? "All Chains" : c}
              </button>
            ))}
          </div>
        )}
        {activeTab === "pumpfun" && (
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
            {([
              { key: "latest" as const, icon: <Rocket size={10} />, label: "Latest" },
              { key: "graduated" as const, icon: <Crown size={10} />, label: "Graduated" },
              { key: "trending" as const, icon: <TrendingUp size={10} />, label: "Trending" },
              { key: "graduating" as const, icon: <Zap size={10} />, label: "About to Grad" },
            ]).map(m => (
              <button key={m.key} onClick={() => setPumpMode(m.key)} className="px-3 py-2 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                style={{ background: pumpMode === m.key ? "#f0b90b" : "var(--cmc-neutral-1)", color: pumpMode === m.key ? "#000" : "var(--cmc-neutral-5)" }}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Search + Sort + View Toggle ── */}
      <div className="relative z-10 flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--cmc-neutral-5)" }} />
          <input
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, symbol, or address..."
            className="w-full rounded-xl pl-9 pr-8 py-2.5 text-xs font-medium outline-none transition-all"
            style={{ background: "var(--cmc-neutral-1)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-white/10" style={{ color: "var(--cmc-neutral-5)" }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={sortOption} onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="appearance-none rounded-xl px-3 py-2.5 pr-8 text-xs font-semibold outline-none cursor-pointer"
            style={{ background: "var(--cmc-neutral-1)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}
          >
            <option value="newest">Newest</option>
            <option value="volume">Volume</option>
            <option value="liquidity">Liquidity</option>
            <option value="mcap">Market Cap</option>
            <option value="change">Price Change</option>
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--cmc-neutral-5)" }} />
        </div>

        {/* View mode toggle */}
        <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
          {([
            { key: "grid" as ViewMode, icon: <LayoutGrid size={13} />, title: "Grid" },
            { key: "compact" as ViewMode, icon: <List size={13} />, title: "Compact" },
            { key: "table" as ViewMode, icon: <Table2 size={13} />, title: "Table" },
          ]).map(v => (
            <button key={v.key} onClick={() => setViewMode(v.key)} title={v.title}
              className="px-2.5 py-2.5 transition-colors"
              style={{ background: viewMode === v.key ? tabConfig.color : "var(--cmc-neutral-1)", color: viewMode === v.key ? "#000" : "var(--cmc-neutral-5)" }}>
              {v.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {loading && itemCount === 0 ? (
          <SkeletonCards />
        ) : itemCount === 0 ? (
          <div className="py-20 text-center rounded-xl" style={{ border: "1px dashed var(--cmc-border)" }}>
            <Search size={28} className="mx-auto mb-3" style={{ color: "var(--cmc-neutral-5)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--cmc-text)" }}>No tokens found</p>
            <p className="text-xs mt-1" style={{ color: "var(--cmc-neutral-5)" }}>Data may still be loading — try refreshing</p>
          </div>
        ) : viewMode === "table" ? (
          /* ═══ Table View ═══ */
          <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--cmc-border)" }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "var(--cmc-neutral-1)", borderBottom: "1px solid var(--cmc-border)" }}>
                  <th className="text-left px-3 py-2.5 font-bold" style={{ color: "var(--cmc-neutral-5)" }}>#</th>
                  <th className="text-left px-3 py-2.5 font-bold" style={{ color: "var(--cmc-neutral-5)" }}>Token</th>
                  <th className="text-right px-3 py-2.5 font-bold" style={{ color: "var(--cmc-neutral-5)" }}>Price</th>
                  <th className="text-right px-3 py-2.5 font-bold" style={{ color: "var(--cmc-neutral-5)" }}>Change</th>
                  <th className="text-right px-3 py-2.5 font-bold hidden sm:table-cell" style={{ color: "var(--cmc-neutral-5)" }}>Volume</th>
                  <th className="text-right px-3 py-2.5 font-bold hidden md:table-cell" style={{ color: "var(--cmc-neutral-5)" }}>Liquidity</th>
                  <th className="text-right px-3 py-2.5 font-bold hidden lg:table-cell" style={{ color: "var(--cmc-neutral-5)" }}>Age</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {activeTab === "dexscreener" && filteredDex.map((t, i) => {
                  const p = t.pair!; const ch = p.priceChange?.h24 || 0;
                  return (
                    <tr key={`${t.tokenAddress}-${i}`} className="transition-colors hover:bg-white/3" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: "var(--cmc-neutral-5)" }}>{i + 1}</td>
                      <td className="px-3 py-2.5">
                        <Link href={`/token/${t.chainId}/${p.baseToken?.address || t.tokenAddress}`} className="flex items-center gap-2 hover:underline">
                          {t.icon && <img src={t.icon} alt="" className="w-6 h-6 rounded-full shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                          <div><span className="font-bold" style={{ color: "var(--cmc-text)" }}>{p.baseToken?.symbol || "?"}</span><span className="ml-1.5 text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{p.baseToken?.name}</span></div>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums" style={{ color: "var(--cmc-text)" }}>{fmtPrice(p.priceUsd)}</td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums" style={{ color: ch > 0 ? "var(--pf-up)" : ch < 0 ? "var(--pf-down)" : "var(--cmc-neutral-5)" }}>{ch > 0 ? "+" : ""}{ch.toFixed(1)}%</td>
                      <td className="px-3 py-2.5 text-right tabular-nums hidden sm:table-cell" style={{ color: "var(--cmc-text)" }}>{fmtUsd(p.volume?.h24 || 0)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums hidden md:table-cell" style={{ color: "var(--cmc-text)" }}>{fmtUsd(p.liquidity?.usd || 0)}</td>
                      <td className="px-3 py-2.5 text-right hidden lg:table-cell" style={{ color: "var(--cmc-neutral-5)" }}>{p.pairCreatedAt ? timeAgo(p.pairCreatedAt) : "—"}</td>
                      <td className="px-3 py-2.5"><Link href={`/swap?from=SOL&to=${p.baseToken?.symbol || ""}`} className="text-[9px] font-bold px-2 py-1 rounded-lg" style={{ background: "var(--pf-accent)", color: "#fff" }}>Swap</Link></td>
                    </tr>
                  );
                })}
                {activeTab === "jupiter" && filteredJup.map((t, i) => (
                  <tr key={t.address} className="transition-colors hover:bg-white/3" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                    <td className="px-3 py-2.5 tabular-nums" style={{ color: "var(--cmc-neutral-5)" }}>{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <Link href={`/token/solana/${t.address}`} className="flex items-center gap-2 hover:underline">
                        {t.logoURI && <img src={t.logoURI} alt="" className="w-6 h-6 rounded-full shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                        <div><span className="font-bold" style={{ color: "var(--cmc-text)" }}>{t.symbol}</span><span className="ml-1.5 text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{t.name}</span></div>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums" style={{ color: "var(--cmc-text)" }}>—</td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums" style={{ color: "var(--cmc-neutral-5)" }}>—</td>
                    <td className="px-3 py-2.5 text-right tabular-nums hidden sm:table-cell" style={{ color: "var(--cmc-text)" }}>{fmtUsd(t.dailyVolume || 0)}</td>
                    <td className="px-3 py-2.5 text-right hidden md:table-cell" style={{ color: "var(--cmc-neutral-5)" }}>—</td>
                    <td className="px-3 py-2.5 text-right hidden lg:table-cell" style={{ color: "var(--cmc-neutral-5)" }}>—</td>
                    <td className="px-3 py-2.5"><Link href={`/swap?from=SOL&to=${t.symbol}`} className="text-[9px] font-bold px-2 py-1 rounded-lg" style={{ background: "#c7f284", color: "#000" }}>Swap</Link></td>
                  </tr>
                ))}
                {activeTab === "raydium" && filteredLaunchLab.map((t, i) => {
                  const p = t.pair; const ch = p?.priceChange?.h24 || 0;
                  return (
                    <tr key={`${t.tokenAddress}-${i}`} className="transition-colors hover:bg-white/3" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                      <td className="px-3 py-2.5 tabular-nums" style={{ color: "var(--cmc-neutral-5)" }}>{i + 1}</td>
                      <td className="px-3 py-2.5">
                        <Link href={`/token/solana/${p?.baseToken?.address || t.tokenAddress}`} className="flex items-center gap-2 hover:underline">
                          {t.icon && <img src={t.icon} alt="" className="w-6 h-6 rounded-full shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                          <div><span className="font-bold" style={{ color: "var(--cmc-text)" }}>{p?.baseToken?.symbol || t.tokenAddress.slice(0, 6)}</span><span className="ml-1.5 text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{p?.baseToken?.name}</span></div>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums" style={{ color: "var(--cmc-text)" }}>{p ? fmtPrice(p.priceUsd) : "—"}</td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums" style={{ color: ch > 0 ? "var(--pf-up)" : ch < 0 ? "var(--pf-down)" : "var(--cmc-neutral-5)" }}>{ch !== 0 ? `${ch > 0 ? "+" : ""}${ch.toFixed(1)}%` : "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums hidden sm:table-cell" style={{ color: "var(--cmc-text)" }}>{fmtUsd(p?.volume?.h24 || 0)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums hidden md:table-cell" style={{ color: "var(--cmc-text)" }}>{fmtUsd(p?.liquidity?.usd || 0)}</td>
                      <td className="px-3 py-2.5 text-right hidden lg:table-cell" style={{ color: "var(--cmc-neutral-5)" }}>{p?.pairCreatedAt ? timeAgo(p.pairCreatedAt) : "—"}</td>
                      <td className="px-3 py-2.5"><Link href={`/swap?from=SOL&to=${p?.baseToken?.symbol || ""}`} className="text-[9px] font-bold px-2 py-1 rounded-lg" style={{ background: "#68d0f1", color: "#000" }}>Swap</Link></td>
                    </tr>
                  );
                })}
                {activeTab === "pumpfun" && filteredPump.map((t, i) => (
                  <tr key={t.mint} className="transition-colors hover:bg-white/3" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                    <td className="px-3 py-2.5 tabular-nums" style={{ color: "var(--cmc-neutral-5)" }}>{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <Link href={`/token/solana/${t.mint}`} className="flex items-center gap-2 hover:underline">
                        {t.imageUri && <img src={t.imageUri} alt="" className="w-6 h-6 rounded-xl shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                        <div>
                          <span className="font-bold" style={{ color: "var(--cmc-text)" }}>{t.symbol}</span>
                          {t.bondingCurveComplete && <span className="ml-1 text-[8px] font-bold" style={{ color: "#f0b90b" }}>👑</span>}
                          <span className="ml-1.5 text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{t.name}</span>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums" style={{ color: "var(--cmc-text)" }}>{t.usdMarketCap > 0 ? fmtUsd(t.usdMarketCap) : "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "#f0b90b" }}>{t.bondingProgress}%</td>
                    <td className="px-3 py-2.5 text-right hidden sm:table-cell" style={{ color: "var(--cmc-neutral-5)" }}>—</td>
                    <td className="px-3 py-2.5 text-right hidden md:table-cell" style={{ color: "var(--cmc-neutral-5)" }}>—</td>
                    <td className="px-3 py-2.5 text-right hidden lg:table-cell" style={{ color: "var(--cmc-neutral-5)" }}>{t.createdTimestamp ? timeAgo(t.createdTimestamp) : "—"}</td>
                    <td className="px-3 py-2.5">
                      {t.bondingCurveComplete || t.raydiumPool ? (
                        <Link href={`/swap?from=SOL&to=${t.symbol}`} className="text-[9px] font-bold px-2 py-1 rounded-lg" style={{ background: "#f0b90b", color: "#000" }}>Swap</Link>
                      ) : (
                        <a href={`https://pump.fun/coin/${t.mint}`} target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold px-2 py-1 rounded-lg" style={{ background: "#f0b90b", color: "#000" }}>Buy</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : viewMode === "compact" ? (
          /* ═══ Compact View ═══ */
          <div className="space-y-1.5">
            {activeTab === "dexscreener" && filteredDex.map((t, idx) => {
              const p = t.pair!; const ch = p.priceChange?.h24 || 0;
              return (
                <Link key={`${t.tokenAddress}-${idx}`} href={`/token/${t.chainId}/${p.baseToken?.address || t.tokenAddress}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/3"
                  style={{ border: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
                  {t.icon && <img src={t.icon} alt="" className="w-7 h-7 rounded-full shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>{p.baseToken?.symbol || "?"}</span>
                      <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{p.baseToken?.name}</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: "var(--cmc-text)" }}>{fmtPrice(p.priceUsd)}</span>
                  <span className="text-[10px] font-bold tabular-nums shrink-0 w-14 text-right" style={{ color: ch > 0 ? "var(--pf-up)" : ch < 0 ? "var(--pf-down)" : "var(--cmc-neutral-5)" }}>{ch > 0 ? "+" : ""}{ch.toFixed(1)}%</span>
                  <span className="text-[10px] tabular-nums shrink-0 w-16 text-right hidden sm:block" style={{ color: "var(--cmc-neutral-5)" }}>{fmtUsd(p.volume?.h24 || 0)}</span>
                  <span className="text-[10px] tabular-nums shrink-0 w-16 text-right hidden md:block" style={{ color: "var(--cmc-neutral-5)" }}>{fmtUsd(p.liquidity?.usd || 0)}</span>
                </Link>
              );
            })}
            {activeTab === "jupiter" && filteredJup.map((t, idx) => (
              <Link key={t.address} href={`/token/solana/${t.address}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/3"
                style={{ border: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
                {t.logoURI && <img src={t.logoURI} alt="" className="w-7 h-7 rounded-full shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>{t.symbol}</span>
                    {t.verified && <ShieldCheck size={10} style={{ color: "#16c784" }} />}
                    <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{t.name}</span>
                  </div>
                </div>
                <span className="text-[10px] tabular-nums shrink-0 w-20 text-right" style={{ color: "var(--cmc-text)" }}>{fmtUsd(t.dailyVolume || 0)}</span>
              </Link>
            ))}
            {activeTab === "raydium" && filteredLaunchLab.map((t, idx) => {
              const p = t.pair; const ch = p?.priceChange?.h24 || 0;
              return (
                <Link key={`${t.tokenAddress}-${idx}`} href={`/token/solana/${p?.baseToken?.address || t.tokenAddress}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/3"
                  style={{ border: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
                  {t.icon && <img src={t.icon} alt="" className="w-7 h-7 rounded-full shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>{p?.baseToken?.symbol || t.tokenAddress.slice(0, 6)}</span>
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded-full" style={{ background: "rgba(104,208,241,0.12)", color: "#68d0f1" }}>LL</span>
                      <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{p?.baseToken?.name}</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: "var(--cmc-text)" }}>{p ? fmtPrice(p.priceUsd) : "—"}</span>
                  <span className="text-[10px] font-bold tabular-nums shrink-0 w-14 text-right" style={{ color: ch > 0 ? "var(--pf-up)" : ch < 0 ? "var(--pf-down)" : "var(--cmc-neutral-5)" }}>{ch !== 0 ? `${ch > 0 ? "+" : ""}${ch.toFixed(1)}%` : "—"}</span>
                  <span className="text-[10px] tabular-nums shrink-0 w-16 text-right hidden sm:block" style={{ color: "var(--cmc-neutral-5)" }}>{fmtUsd(p?.volume?.h24 || 0)}</span>
                </Link>
              );
            })}
            {activeTab === "pumpfun" && filteredPump.map((t, idx) => (
              <Link key={t.mint} href={`/token/solana/${t.mint}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/3"
                style={{ border: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
                {t.imageUri && <img src={t.imageUri} alt="" className="w-7 h-7 rounded-xl shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>{t.symbol}</span>
                    {t.bondingCurveComplete && <Crown size={10} style={{ color: "#f0b90b" }} />}
                    <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{t.name}</span>
                  </div>
                </div>
                <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: "var(--cmc-text)" }}>{t.usdMarketCap > 0 ? fmtUsd(t.usdMarketCap) : "—"}</span>
                <div className="shrink-0 w-12">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--cmc-neutral-3)" }}>
                    <div className="h-full rounded-full" style={{ width: `${t.bondingProgress}%`, background: "#f0b90b" }} />
                  </div>
                  <span className="text-[8px] tabular-nums block text-center mt-0.5" style={{ color: "#f0b90b" }}>{t.bondingProgress}%</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* ═══ Grid View (original cards) ═══ */
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger-grid">
            {activeTab === "dexscreener" && filteredDex.map((token, idx) => <DexCard key={`${token.tokenAddress}-${idx}`} token={token} idx={idx} />)}
            {activeTab === "jupiter" && filteredJup.map((token, idx) => <JupCard key={token.address} token={token} idx={idx} />)}
            {activeTab === "raydium" && filteredLaunchLab.map((token, idx) => <LaunchLabCard key={`${token.tokenAddress}-${idx}`} token={token} idx={idx} />)}
            {activeTab === "pumpfun" && filteredPump.map((token, idx) => <PumpCard key={token.mint} token={token} idx={idx} />)}
          </div>
        )}
      </div>

      <div className="relative z-10 mt-6 text-[10px] text-center flex items-center justify-center gap-2 flex-wrap" style={{ color: "var(--cmc-neutral-5)" }}>
        <span className="font-semibold" style={{ color: tabConfig.color }}>{tabConfig.label}</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span className="tabular-nums">{elapsed}s ago</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span>Auto-refreshes</span>
        <span style={{ opacity: 0.3 }}>·</span>
        <span>{itemCount} tokens shown</span>
      </div>
    </div>
  );
}
