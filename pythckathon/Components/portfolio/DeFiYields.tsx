"use client";

import { useState, useEffect } from "react";
import { TrendingUp, ExternalLink, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { fetchYields as fetchYieldsAPI, type YieldPoolBackend } from "@/lib/api/backend";
import { fmtB } from "@/lib/format";

interface YieldOpportunity {
  protocol: string;
  protocolLogo: string;
  pool: string;
  apy: number;
  tvl: number;
  token: string;
  tokenLogo: string;
  type: "staking" | "lending" | "lp" | "vault";
  risk: "low" | "medium" | "high";
  url: string;
}

const YIELD_DATA: YieldOpportunity[] = [
  {
    protocol: "Marinade",
    protocolLogo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey/logo.png",
    pool: "mSOL Staking",
    apy: 7.2,
    tvl: 1_420_000_000,
    token: "SOL",
    tokenLogo: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
    type: "staking",
    risk: "low",
    url: "https://marinade.finance/app/stake/",
  },
  {
    protocol: "Jito",
    protocolLogo: "https://assets.coingecko.com/coins/images/33228/small/jto.png",
    pool: "JitoSOL Staking",
    apy: 7.8,
    tvl: 2_100_000_000,
    token: "SOL",
    tokenLogo: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
    type: "staking",
    risk: "low",
    url: "https://www.jito.network/staking/",
  },
  {
    protocol: "Jupiter",
    protocolLogo: "https://assets.coingecko.com/coins/images/34188/small/jup.png",
    pool: "JupSOL Staking",
    apy: 8.1,
    tvl: 890_000_000,
    token: "SOL",
    tokenLogo: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
    type: "staking",
    risk: "low",
    url: "https://jup.ag/stake",
  },
  {
    protocol: "Kamino",
    protocolLogo: "https://assets.coingecko.com/coins/images/35425/small/kmno.png",
    pool: "SOL Lending",
    apy: 4.5,
    tvl: 620_000_000,
    token: "SOL",
    tokenLogo: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
    type: "lending",
    risk: "low",
    url: "https://app.kamino.finance/",
  },
  {
    protocol: "Kamino",
    protocolLogo: "https://assets.coingecko.com/coins/images/35425/small/kmno.png",
    pool: "USDC Lending",
    apy: 9.3,
    tvl: 410_000_000,
    token: "USDC",
    tokenLogo: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
    type: "lending",
    risk: "low",
    url: "https://app.kamino.finance/",
  },
  {
    protocol: "Raydium",
    protocolLogo: "https://assets.coingecko.com/coins/images/13928/small/PSigc4ie_400x400.jpg",
    pool: "SOL-USDC LP",
    apy: 24.5,
    tvl: 180_000_000,
    token: "SOL",
    tokenLogo: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
    type: "lp",
    risk: "medium",
    url: "https://raydium.io/liquidity/",
  },
  {
    protocol: "Drift",
    protocolLogo: "https://assets.coingecko.com/coins/images/36044/small/drift.png",
    pool: "USDC Vault",
    apy: 12.8,
    tvl: 95_000_000,
    token: "USDC",
    tokenLogo: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
    type: "vault",
    risk: "medium",
    url: "https://app.drift.trade/earn",
  },
  {
    protocol: "marginfi",
    protocolLogo: "https://assets.coingecko.com/coins/images/36820/small/marginfi.jpg",
    pool: "SOL Lending",
    apy: 5.1,
    tvl: 340_000_000,
    token: "SOL",
    tokenLogo: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
    type: "lending",
    risk: "low",
    url: "https://app.marginfi.com/",
  },
  {
    protocol: "Sanctum",
    protocolLogo: "https://assets.coingecko.com/coins/images/36997/small/sanctum.jpg",
    pool: "INF Staking",
    apy: 8.5,
    tvl: 520_000_000,
    token: "SOL",
    tokenLogo: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
    type: "staking",
    risk: "low",
    url: "https://www.sanctum.so/",
  },
];


const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  staking: { label: "Stake", color: "#16c784" },
  lending: { label: "Lend", color: "#14b8a6" },
  lp: { label: "LP", color: "#f59e0b" },
  vault: { label: "Vault", color: "#a855f7" },
};

const RISK_COLORS: Record<string, string> = {
  low: "#16c784",
  medium: "#f59e0b",
  high: "#ea3943",
};

// Map DeFiLlama project names to our display format
const PROTOCOL_META: Record<string, { logo: string; url: string }> = {
  "marinade-finance": { logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey/logo.png", url: "https://marinade.finance/app/stake/" },
  "jito": { logo: "https://assets.coingecko.com/coins/images/33228/small/jto.png", url: "https://www.jito.network/staking/" },
  "jupiter-perps": { logo: "https://assets.coingecko.com/coins/images/34188/small/jup.png", url: "https://jup.ag/stake" },
  "kamino": { logo: "https://assets.coingecko.com/coins/images/35425/small/kmno.png", url: "https://app.kamino.finance/" },
  "kamino-lending": { logo: "https://assets.coingecko.com/coins/images/35425/small/kmno.png", url: "https://app.kamino.finance/" },
  "raydium": { logo: "https://assets.coingecko.com/coins/images/13928/small/PSigc4ie_400x400.jpg", url: "https://raydium.io/liquidity/" },
  "drift-protocol": { logo: "https://assets.coingecko.com/coins/images/36044/small/drift.png", url: "https://app.drift.trade/earn" },
  "marginfi": { logo: "https://assets.coingecko.com/coins/images/36820/small/marginfi.jpg", url: "https://app.marginfi.com/" },
  "sanctum-infinity": { logo: "https://assets.coingecko.com/coins/images/36997/small/sanctum.jpg", url: "https://www.sanctum.so/" },
  "meteora": { logo: "https://assets.coingecko.com/coins/images/31756/small/meteora.png", url: "https://app.meteora.ag/" },
  "solend": { logo: "https://assets.coingecko.com/coins/images/21672/small/solend.png", url: "https://solend.fi/" },
  "orca": { logo: "https://assets.coingecko.com/coins/images/17547/small/Orca_Logo.png", url: "https://www.orca.so/" },
};

const TOKEN_LOGOS: Record<string, string> = {
  SOL: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
  USDC: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
  USDT: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  ETH: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  JitoSOL: "https://assets.coingecko.com/coins/images/28946/small/JitoSOL.png",
  mSOL: "https://assets.coingecko.com/coins/images/26629/small/mSOL.png",
};

const ALLOWED_PROJECTS = Object.keys(PROTOCOL_META);

function classifyPool(pool: string, project: string): "staking" | "lending" | "lp" | "vault" {
  const lower = (pool + " " + project).toLowerCase();
  if (lower.includes("stake") || lower.includes("staking") || lower.includes("liquid staking")) return "staking";
  if (lower.includes("lend") || lower.includes("borrow") || lower.includes("supply")) return "lending";
  if (lower.includes("lp") || lower.includes("amm") || lower.includes("clmm") || lower.includes("liquidity")) return "lp";
  return "vault";
}

function estimateRisk(apy: number, tvl: number): "low" | "medium" | "high" {
  if (apy > 50 || tvl < 5_000_000) return "high";
  if (apy > 20 || tvl < 50_000_000) return "medium";
  return "low";
}

export default function DeFiYields() {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"apy" | "tvl">("apy");
  const [liveYields, setLiveYields] = useState<YieldOpportunity[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchYieldsAPI(200, "Solana")
      .then((pools: YieldPoolBackend[]) => {
        if (cancelled) return;
        const solanaPools = pools
          .filter(p => ALLOWED_PROJECTS.includes(p.project) && p.tvl > 1_000_000 && p.apy > 0.1 && p.apy < 200)
          .sort((a, b) => b.tvl - a.tvl)
          .slice(0, 30);

        const mapped: YieldOpportunity[] = solanaPools.map(p => {
          const meta = PROTOCOL_META[p.project] || { logo: "", url: "" };
          const mainSymbol = (p.symbol || "").split("-")[0].trim();
          const type = classifyPool(p.pool || p.symbol || "", p.project);
          return {
            protocol: p.projectName || p.project,
            protocolLogo: meta.logo,
            pool: p.symbol || p.pool || "",
            apy: p.apy,
            tvl: p.tvl,
            token: mainSymbol,
            tokenLogo: TOKEN_LOGOS[mainSymbol] || TOKEN_LOGOS.SOL,
            type,
            risk: estimateRisk(p.apy, p.tvl),
            url: meta.url || p.url,
          };
        });
        setLiveYields(mapped);
      })
      .catch(() => { if (!cancelled) setLiveYields(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const yieldData = liveYields || YIELD_DATA;

  const filtered = yieldData
    .filter((y) => filter === "all" || y.type === filter)
    .sort((a, b) => sortBy === "apy" ? b.apy - a.apy : b.tvl - a.tvl);

  const displayed = expanded ? filtered : filtered.slice(0, 4);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
        <div className="flex items-center gap-2">
          <TrendingUp size={14} style={{ color: "var(--cmc-text)" }} />
          <p className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>DeFi Yield Opportunities</p>
          {loading && <Loader2 size={10} className="animate-spin" style={{ color: "var(--cmc-neutral-5)" }} />}
          {liveYields && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(22,199,132,0.1)", color: "#16c784" }}>LIVE</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {[
            { key: "all", label: "All" },
            { key: "staking", label: "Stake" },
            { key: "lending", label: "Lend" },
            { key: "lp", label: "LP" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="rounded-full px-2 py-0.5 text-[9px] font-semibold transition-all"
              style={{
                background: filter === f.key ? "var(--cmc-neutral-2)" : "transparent",
                color: filter === f.key ? "var(--cmc-text)" : "var(--cmc-neutral-5)",
                border: filter === f.key ? "1px solid var(--cmc-border)" : "1px solid transparent",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sort row */}
      <div className="flex items-center gap-3 px-4 py-1.5 text-[9px]" style={{ borderBottom: "1px solid var(--cmc-border)", color: "var(--cmc-neutral-5)" }}>
        <span className="flex-1">Protocol / Pool</span>
        <button onClick={() => setSortBy("apy")} className="flex items-center gap-0.5 font-semibold" style={{ color: sortBy === "apy" ? "var(--cmc-text)" : undefined }}>
          APY {sortBy === "apy" && <ChevronDown size={8} />}
        </button>
        <button onClick={() => setSortBy("tvl")} className="flex items-center gap-0.5 font-semibold w-16 text-right" style={{ color: sortBy === "tvl" ? "var(--cmc-text)" : undefined }}>
          TVL {sortBy === "tvl" && <ChevronDown size={8} />}
        </button>
        <span className="w-10 text-right">Risk</span>
        <span className="w-5" />
      </div>

      {/* Rows */}
      <div>
        {displayed.map((y, i) => {
          const typeInfo = TYPE_LABELS[y.type] || { label: y.type, color: "#888" };
          return (
            <a
              key={`${y.protocol}-${y.pool}-${i}`}
              href={y.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/2"
              style={{ borderBottom: i < displayed.length - 1 ? "1px solid var(--cmc-border)" : undefined }}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="relative shrink-0">
                  <div className="h-7 w-7 rounded-full overflow-hidden flex items-center justify-center" style={{ background: "var(--cmc-neutral-2)" }}>
                    <img src={y.protocolLogo} alt={y.protocol} className="h-7 w-7 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full overflow-hidden flex items-center justify-center border border-(--cmc-bg)" style={{ background: "var(--cmc-neutral-2)" }}>
                    <img src={y.tokenLogo} alt={y.token} className="h-3.5 w-3.5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold truncate" style={{ color: "var(--cmc-text)" }}>{y.protocol}</span>
                    <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: `${typeInfo.color}18`, color: typeInfo.color }}>
                      {typeInfo.label}
                    </span>
                  </div>
                  <span className="text-[10px] truncate block" style={{ color: "var(--cmc-neutral-5)" }}>{y.pool}</span>
                </div>
              </div>

              <span className="text-[11px] font-bold shrink-0" style={{ color: "#16c784" }}>
                {y.apy.toFixed(1)}%
              </span>

              <span className="text-[10px] font-medium w-16 text-right shrink-0" style={{ color: "var(--cmc-text)" }}>
                {fmtB(y.tvl)}
              </span>

              <span className="text-[9px] font-bold w-10 text-right shrink-0" style={{ color: RISK_COLORS[y.risk] }}>
                {y.risk.charAt(0).toUpperCase() + y.risk.slice(1)}
              </span>

              <ExternalLink size={10} className="shrink-0" style={{ color: "var(--cmc-neutral-5)" }} />
            </a>
          );
        })}
      </div>

      {/* Expand toggle */}
      {filtered.length > 4 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-center gap-1 w-full py-2 text-[10px] font-semibold transition-colors hover:bg-white/2"
          style={{ color: "var(--cmc-text)", borderTop: "1px solid var(--cmc-border)" }}
        >
          {expanded ? <><ChevronUp size={10} /> Show Less</> : <><ChevronDown size={10} /> Show All {filtered.length} Opportunities</>}
        </button>
      )}
    </div>
  );
}
