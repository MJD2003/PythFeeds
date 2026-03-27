"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, ExternalLink, TrendingUp, TrendingDown, Layers, ArrowUpDown, Search, BarChart3, Link2, Download } from "lucide-react";
import { fetchProtocols, fetchChainsTVL, fetchStablecoins, fetchBridges, type DefiProtocol, type ChainTVL, type StablecoinData, type BridgeData } from "@/lib/api/backend";
import { exportCSV } from "@/lib/csv-export";
import { fmtB } from "@/lib/format";

function PctBadge({ value }: { value: number }) {
  const color = value >= 0 ? "#16c784" : "#ea3943";
  return (
    <span className="text-xs font-medium" style={{ color }}>
      {value >= 0 ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function ProtoLogo({ src, name }: { src: string; name: string }) {
  const [err, setErr] = useState(false);
  if (err || !src) return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg, var(--pf-accent), var(--pf-teal))" }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
  return <img src={src} alt={name} className="w-8 h-8 rounded-full shrink-0 object-cover" onError={() => setErr(true)} />;
}

type Tab = "protocols" | "chains" | "stablecoins" | "bridges";

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>("protocols");
  const [protocols, setProtocols] = useState<DefiProtocol[]>([]);
  const [chains, setChains] = useState<ChainTVL[]>([]);
  const [stables, setStables] = useState<StablecoinData[]>([]);
  const [bridges, setBridges] = useState<BridgeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>("tvl");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setLoading(true);
    const fetchers: Record<Tab, () => Promise<void>> = {
      protocols: async () => { const d = await fetchProtocols(100); setProtocols(d); },
      chains: async () => { const d = await fetchChainsTVL(); setChains(d); },
      stablecoins: async () => { const d = await fetchStablecoins(); setStables(d); },
      bridges: async () => { const d = await fetchBridges(); setBridges(d); },
    };
    fetchers[tab]().catch(() => {}).finally(() => setLoading(false));
  }, [tab]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const totalTVL = useMemo(() => chains.reduce((s, c) => s + c.tvl, 0), [chains]);

  const filteredProtocols = useMemo(() => {
    const list = protocols.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.category?.toLowerCase().includes(search.toLowerCase()));
    list.sort((a: any, b: any) => sortDir === "desc" ? (b[sortKey] || 0) - (a[sortKey] || 0) : (a[sortKey] || 0) - (b[sortKey] || 0));
    return list;
  }, [protocols, search, sortKey, sortDir]);

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: "protocols", label: "Protocols", icon: Layers },
    { key: "chains", label: "Chains TVL", icon: BarChart3 },
    { key: "stablecoins", label: "Stablecoins", icon: TrendingUp },
    { key: "bridges", label: "Bridges", icon: Link2 },
  ];

  return (
    <div className="min-h-screen px-4 py-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-display tracking-tight mb-1" style={{ color: "var(--cmc-text)" }}>On-Chain Analytics</h1>
        <div className="flex items-center gap-3">
          <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>DeFi protocols, chain TVL, stablecoins &amp; bridge data · DefiLlama</p>
          <button
            onClick={() => {
              if (tab === "protocols" && filteredProtocols.length) exportCSV(filteredProtocols.map(p => ({ Name: p.name, Category: p.category, Chain: p.chain, TVL: p.tvl, "24h%": p.change1d, "7d%": p.change7d })), "defi-protocols");
              if (tab === "chains" && chains.length) exportCSV(chains.map(c => ({ Chain: c.name, Symbol: c.tokenSymbol, TVL: c.tvl })), "chains-tvl");
              if (tab === "stablecoins" && stables.length) exportCSV(stables.map(s => ({ Name: s.name, Symbol: s.symbol, MarketCap: s.mcap, PegType: s.pegType })), "stablecoins");
              if (tab === "bridges" && bridges.length) exportCSV(bridges.map(b => ({ Name: b.name, Volume24h: b.volume24h, Chains: b.chains?.length })), "bridges");
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-opacity hover:opacity-80"
            style={{ color: "var(--cmc-neutral-5)", border: "1px solid var(--cmc-border)" }}
          >
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch(""); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all shrink-0"
            style={{
              background: tab === t.key ? "var(--cmc-text)" : "var(--cmc-neutral-1)",
              color: tab === t.key ? "var(--cmc-bg)" : "var(--cmc-text)",
              border: tab === t.key ? "none" : "1px solid var(--cmc-border)",
            }}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Search (protocols only) */}
      {tab === "protocols" && (
        <div className="relative mb-4 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--cmc-neutral-5)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search protocols..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-transparent outline-none"
            style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-text)" }}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin" size={24} style={{ color: "var(--cmc-neutral-5)" }} />
        </div>
      ) : (
        <>
          {/* Protocols Table */}
          {tab === "protocols" && (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--cmc-neutral-1)" }}>
                      <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--cmc-neutral-5)" }}>#</th>
                      <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Protocol</th>
                      <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Category</th>
                      <th className="text-right px-4 py-3 font-medium cursor-pointer select-none" style={{ color: "var(--cmc-neutral-5)" }} onClick={() => toggleSort("tvl")}>
                        TVL <ArrowUpDown size={10} className="inline ml-0.5" />
                      </th>
                      <th className="text-right px-4 py-3 font-medium cursor-pointer select-none" style={{ color: "var(--cmc-neutral-5)" }} onClick={() => toggleSort("change1d")}>
                        24h <ArrowUpDown size={10} className="inline ml-0.5" />
                      </th>
                      <th className="text-right px-4 py-3 font-medium cursor-pointer select-none" style={{ color: "var(--cmc-neutral-5)" }} onClick={() => toggleSort("change7d")}>
                        7d <ArrowUpDown size={10} className="inline ml-0.5" />
                      </th>
                      <th className="text-right px-4 py-3 font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Chains</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProtocols.map((p, i) => (
                      <tr key={p.id} className="transition-colors" style={{ borderTop: "1px solid var(--cmc-border)", background: i % 2 === 0 ? "transparent" : "var(--cmc-neutral-1)" }} onMouseEnter={e => e.currentTarget.style.background = 'var(--cmc-neutral-2)'} onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--cmc-neutral-1)'}>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--cmc-neutral-5)" }}>{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <ProtoLogo src={p.logo} name={p.name} />
                            <div>
                              <p className="font-medium" style={{ color: "var(--cmc-text)" }}>{p.name}</p>
                              <p className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{p.chain}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--cmc-neutral-1)", color: "var(--cmc-neutral-5)" }}>{p.category || "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium" style={{ color: "var(--cmc-text)" }}>{fmtB(p.tvl)}</td>
                        <td className="px-4 py-3 text-right"><PctBadge value={p.change1d} /></td>
                        <td className="px-4 py-3 text-right"><PctBadge value={p.change7d} /></td>
                        <td className="px-4 py-3 text-right text-xs" style={{ color: "var(--cmc-neutral-5)" }}>{p.chains?.length || 1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Chains TVL */}
          {tab === "chains" && (
            <div>
              <p className="text-sm font-medium mb-4" style={{ color: "var(--cmc-neutral-5)" }}>Total DeFi TVL: <span style={{ color: "var(--cmc-text)" }}>{fmtB(totalTVL)}</span></p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {chains.map((c, i) => {
                  const pct = totalTVL > 0 ? (c.tvl / totalTVL * 100) : 0;
                  return (
                    <div key={c.name} className="rounded-xl p-4 transition-all hover:scale-[1.01]" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold w-6 text-center" style={{ color: "var(--cmc-neutral-5)" }}>#{i + 1}</span>
                          <span className="font-medium" style={{ color: "var(--cmc-text)" }}>{c.name}</span>
                          {c.tokenSymbol && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>{c.tokenSymbol}</span>}
                        </div>
                        <span className="font-bold text-sm" style={{ color: "var(--cmc-text)" }}>{fmtB(c.tvl)}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--cmc-neutral-2)" }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: "linear-gradient(90deg, var(--pf-accent), var(--pf-teal))" }} />
                      </div>
                      <p className="text-[10px] mt-1 text-right" style={{ color: "var(--cmc-neutral-5)" }}>{pct.toFixed(1)}% of total</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stablecoins */}
          {tab === "stablecoins" && (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--cmc-neutral-1)" }}>
                    <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--cmc-neutral-5)" }}>#</th>
                    <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Stablecoin</th>
                    <th className="text-right px-4 py-3 font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Market Cap</th>
                    <th className="text-right px-4 py-3 font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Peg Type</th>
                    <th className="text-right px-4 py-3 font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Dominance</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const totalMcap = stables.reduce((s, st) => s + st.mcap, 0);
                    return stables.map((s, i) => (
                      <tr key={s.id} className="transition-colors" style={{ borderTop: "1px solid var(--cmc-border)", background: i % 2 === 0 ? "transparent" : "var(--cmc-neutral-1)" }} onMouseEnter={e => e.currentTarget.style.background = 'var(--cmc-neutral-2)'} onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--cmc-neutral-1)'}>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--cmc-neutral-5)" }}>{i + 1}</td>
                        <td className="px-4 py-3 font-medium" style={{ color: "var(--cmc-text)" }}>
                          {s.name} <span className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>({s.symbol})</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium" style={{ color: "var(--cmc-text)" }}>{fmtB(s.mcap)}</td>
                        <td className="px-4 py-3 text-right text-xs" style={{ color: "var(--cmc-neutral-5)" }}>{s.pegType?.replace("peggedto", "Pegged to ") || "USD"}</td>
                        <td className="px-4 py-3 text-right text-xs font-medium" style={{ color: "var(--pf-accent)" }}>{(s.mcap / totalMcap * 100).toFixed(1)}%</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}

          {/* Bridges */}
          {tab === "bridges" && (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--cmc-neutral-1)" }}>
                    <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--cmc-neutral-5)" }}>#</th>
                    <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Bridge</th>
                    <th className="text-right px-4 py-3 font-medium" style={{ color: "var(--cmc-neutral-5)" }}>24h Volume</th>
                    <th className="text-right px-4 py-3 font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Chains</th>
                  </tr>
                </thead>
                <tbody>
                  {bridges.map((b, i) => (
                    <tr key={b.id} className="transition-colors" style={{ borderTop: "1px solid var(--cmc-border)", background: i % 2 === 0 ? "transparent" : "var(--cmc-neutral-1)" }} onMouseEnter={e => e.currentTarget.style.background = 'var(--cmc-neutral-2)'} onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--cmc-neutral-1)'}>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--cmc-neutral-5)" }}>{i + 1}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--cmc-text)" }}>{b.name}</td>
                      <td className="px-4 py-3 text-right font-medium" style={{ color: "var(--cmc-text)" }}>{fmtB(b.volume24h)}</td>
                      <td className="px-4 py-3 text-right text-xs" style={{ color: "var(--cmc-neutral-5)" }}>{b.chains?.length || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
