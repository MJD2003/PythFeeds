"use client";

import { useState, useEffect, useMemo } from "react";
import { ExternalLink, Search, ArrowUpDown, ArrowUp, ArrowDown, Sprout, TrendingUp, Layers } from "lucide-react";
import { fetchYields as fetchYieldsAPI, type YieldPoolBackend } from "@/lib/api/backend";

interface YieldPool {
  id: string;
  protocol: string;
  protoKey: string;
  pool: string;
  apy: number;
  tvl: number;
  category: string;
  url: string;
}

const PROTOCOLS: Record<string, { name: string; color: string; logo: string }> = {
  marinade: { name: "Marinade", color: "#4EC9B0", logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey/logo.png" },
  jito: { name: "Jito", color: "#6366F1", logo: "https://storage.googleapis.com/token-metadata/JitoSOL-256.png" },
  kamino: { name: "Kamino", color: "#22D1EE", logo: "https://imgs.search.brave.com/8L7goLZDd9RaIVcrjM7QaVTjnHg--bBUX4yTnzLzMFU/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9pbWFn/ZS1jZG4ucGx1YW5n/LmNvbS9pY29ucy9s/aWdodC9jcnlwdG9j/dXJyZW5jeS9hc3Nl/dC1pY29ucy9rbW5v/X3YxLnN2Zw" },
  raydium: { name: "Raydium", color: "#C741D7", logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png" },
  drift: { name: "Drift", color: "#E8A838", logo: "https://assets.coingecko.com/coins/images/36662/small/drift.png" },
  meteora: { name: "Meteora", color: "#FFD700", logo: "https://app.meteora.ag/icons/logo.svg" },
};

function ProtoIcon({ protoKey, size = 24 }: { protoKey: string; size?: number }) {
  const [err, setErr] = useState(false);
  const p = PROTOCOLS[protoKey];
  if (!p) return <div className="rounded-full shrink-0" style={{ width: size, height: size, background: "#444" }} />;
  if (err) return (
    <div className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, background: p.color, fontSize: size * 0.38 }}>
      {p.name.slice(0, 2)}
    </div>
  );
  return <img src={p.logo} alt={p.name} width={size} height={size} className="rounded-full shrink-0" onError={() => setErr(true)} />;
}

type SortKey = "apy" | "tvl" | "protocol" | "pool";
type SortDir = "asc" | "desc";

async function fetchYieldsData(): Promise<YieldPool[]> {
  try {
    const data = await fetchYieldsAPI(200, "Solana");
    const keys = Object.keys(PROTOCOLS);

    return data
      .filter((p: YieldPoolBackend) => keys.some(k => p.project?.toLowerCase().includes(k)))
      .map((p: YieldPoolBackend): YieldPool => {
        const protoKey = keys.find(k => p.project?.toLowerCase().includes(k)) || "raydium";
        return {
          id: p.pool,
          protocol: PROTOCOLS[protoKey]?.name || protoKey,
          protoKey,
          pool: p.symbol || "Unknown",
          apy: p.apy || 0,
          tvl: p.tvl || 0,
          category: p.exposure === "single" ? "Staking" : "LP",
          url: p.url || `https://app.${protoKey}.finance`,
        };
      })
      .filter((p: YieldPool) => p.apy > 0 && p.tvl > 10000)
      .sort((a: YieldPool, b: YieldPool) => b.tvl - a.tvl)
      .slice(0, 100);
  } catch {
    return [];
  }
}

function fmtPct(n: number) {
  if (n >= 100) return n.toFixed(0) + "%";
  if (n >= 10) return n.toFixed(1) + "%";
  return n.toFixed(2) + "%";
}

function fmtTvl(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default function YieldsPage() {
  const [pools, setPools] = useState<YieldPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [protoFilter, setProtoFilter] = useState<string>("All");
  const [catFilter, setCatFilter] = useState<string>("All");
  const [sortKey, setSortKey] = useState<SortKey>("tvl");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    fetchYieldsData().then(setPools).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let arr = [...pools];
    if (protoFilter !== "All") arr = arr.filter(p => p.protocol === protoFilter);
    if (catFilter !== "All") arr = arr.filter(p => p.category === catFilter);
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(p => p.pool.toLowerCase().includes(q) || p.protocol.toLowerCase().includes(q));
    }
    arr.sort((a, b) => {
      let va: number | string, vb: number | string;
      switch (sortKey) {
        case "apy": va = a.apy; vb = b.apy; break;
        case "tvl": va = a.tvl; vb = b.tvl; break;
        case "protocol": va = a.protocol; vb = b.protocol; break;
        case "pool": va = a.pool; vb = b.pool; break;
        default: va = a.tvl; vb = b.tvl;
      }
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return arr;
  }, [pools, protoFilter, catFilter, search, sortKey, sortDir]);

  const protocols = useMemo(() => ["All", ...new Set(pools.map(p => p.protocol))], [pools]);
  const categories = useMemo(() => ["All", ...new Set(pools.map(p => p.category))], [pools]);

  const avgApy = pools.length ? pools.reduce((s, p) => s + p.apy, 0) / pools.length : 0;
  const totalTvl = pools.reduce((s, p) => s + p.tvl, 0);
  const topApy = pools.length ? Math.max(...pools.map(p => p.apy)) : 0;

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-40" />;
    return sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />;
  }

  return (
    <div className="mx-auto max-w-[1200px] px-3 sm:px-4 py-5 sm:py-8">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-3xl font-bold font-display tracking-tight" style={{ color: "var(--cmc-text)" }}>DeFi Yields</h1>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(22,199,132,0.1)", color: "var(--pf-up)" }}>Solana</span>
        </div>
        <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
          Live APY rates from top Solana DeFi protocols · DefiLlama
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-5 sm:mb-6">
        {[
          { label: "Total Pools", value: pools.length.toString(), color: "var(--cmc-text)", icon: <Layers size={14} /> },
          { label: "Total TVL", value: fmtTvl(totalTvl), color: "var(--pf-accent)", icon: <span className="text-[11px]">$</span> },
          { label: "Avg APY", value: fmtPct(avgApy), color: "#16c784", icon: <TrendingUp size={14} /> },
          { label: "Top APY", value: fmtPct(topApy), color: "#00d67e", icon: <span className="text-[11px]">🔥</span> },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 sm:p-4" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span style={{ color: s.color, opacity: 0.6 }}>{s.icon}</span>
              <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>{s.label}</p>
            </div>
            <p className="text-base sm:text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-5">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--cmc-neutral-5)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pools or protocols..."
            className="w-full rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none"
            style={{ background: "var(--cmc-neutral-1)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }} />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
          <div className="flex gap-1.5 shrink-0">
            {protocols.map(p => (
              <button key={p} onClick={() => setProtoFilter(p)}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap"
                style={{
                  background: protoFilter === p ? "var(--cmc-text)" : "var(--cmc-neutral-1)",
                  color: protoFilter === p ? "var(--cmc-bg)" : "var(--cmc-neutral-5)",
                  border: `1px solid ${protoFilter === p ? "var(--cmc-text)" : "var(--cmc-border)"}`,
                }}>{p}</button>
            ))}
          </div>
          <div className="w-px shrink-0" style={{ background: "var(--cmc-border)" }} />
          <div className="flex gap-1.5 shrink-0">
            {categories.map(c => (
              <button key={c} onClick={() => setCatFilter(c)}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap"
                style={{
                  background: catFilter === c ? "#16c784" : "var(--cmc-neutral-1)",
                  color: catFilter === c ? "#fff" : "var(--cmc-neutral-5)",
                  border: `1px solid ${catFilter === c ? "#16c784" : "var(--cmc-border)"}`,
                }}>{c}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 rounded-full animate-spin" style={{ borderColor: "var(--cmc-border)", borderTopColor: "#16c784" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm" style={{ color: "var(--cmc-neutral-5)" }}>No pools found.</p>
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="sm:hidden space-y-2">
            {filtered.map((pool, i) => (
              <div key={pool.id} className="rounded-xl p-3.5"
                style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <ProtoIcon protoKey={pool.protoKey} size={28} />
                    <div>
                      <p className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>{pool.protocol}</p>
                      <p className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>{pool.pool}</p>
                    </div>
                  </div>
                  <a href={pool.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: "var(--cmc-neutral-2)" }}>
                    <ExternalLink size={11} style={{ color: "var(--cmc-neutral-5)" }} />
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-[9px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-5)" }}>APY</p>
                    <p className="text-sm font-bold tabular-nums" style={{ color: pool.apy >= 10 ? "#16c784" : "var(--cmc-text)" }}>{fmtPct(pool.apy)}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-[9px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-5)" }}>TVL</p>
                    <p className="text-sm font-bold tabular-nums" style={{ color: "var(--cmc-text)" }}>{fmtTvl(pool.tvl)}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: pool.category === "Staking" ? "rgba(99,102,241,0.1)" : "rgba(199,65,215,0.1)", color: pool.category === "Staking" ? "#6366F1" : "#C741D7" }}>
                    {pool.category}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl" style={{ border: "1px solid var(--cmc-border)" }}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ background: "var(--cmc-neutral-1)" }}>
                  {[
                    { key: "protocol" as SortKey, label: "Protocol", align: "text-left" },
                    { key: "pool" as SortKey, label: "Pool", align: "text-left" },
                    { key: "apy" as SortKey, label: "APY", align: "text-right" },
                    { key: "tvl" as SortKey, label: "TVL", align: "text-right" },
                  ].map(h => (
                    <th key={h.key} onClick={() => handleSort(h.key)}
                      className={`group cursor-pointer select-none px-4 py-3 text-xs font-semibold ${h.align}`}
                      style={{ color: "var(--cmc-neutral-5)" }}>
                      <span className="inline-flex items-center gap-1">{h.label} <SortIcon col={h.key} /></span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-xs font-semibold text-right" style={{ color: "var(--cmc-neutral-5)" }}>Type</th>
                  <th className="px-3 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((pool) => (
                  <tr key={pool.id} className="transition-colors" style={{ borderTop: "1px solid var(--cmc-border)" }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <ProtoIcon protoKey={pool.protoKey} size={26} />
                        <span className="font-semibold text-xs" style={{ color: "var(--cmc-text)" }}>{pool.protocol}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-xs" style={{ color: "var(--cmc-text)" }}>{pool.pool}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-sm tabular-nums" style={{ color: pool.apy >= 10 ? "#16c784" : pool.apy >= 5 ? "#22ab6f" : "var(--cmc-text)" }}>
                        {fmtPct(pool.apy)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-medium tabular-nums" style={{ color: "var(--cmc-text)" }}>{fmtTvl(pool.tvl)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                        style={{ background: pool.category === "Staking" ? "rgba(99,102,241,0.1)" : "rgba(199,65,215,0.1)", color: pool.category === "Staking" ? "#6366F1" : "#C741D7" }}>
                        {pool.category}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <a href={pool.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:opacity-70" style={{ background: "var(--cmc-neutral-2)" }}>
                        <ExternalLink size={11} style={{ color: "var(--cmc-neutral-5)" }} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
