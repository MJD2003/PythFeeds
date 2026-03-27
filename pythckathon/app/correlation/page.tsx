"use client";

import { useState, useEffect, useMemo } from "react";
import { fetchCoins, fetchCorrelationInsights } from "@/lib/api/backend";
import { Loader2, RefreshCw, Info, Settings2, X, Check } from "lucide-react";
import PythIcon from "@/Components/shared/PythIcon";

const ALL_AVAILABLE = [
  "BTC","ETH","SOL","BNB","XRP","ADA","DOGE","LINK","AVAX","DOT",
  "LTC","MATIC","ATOM","UNI","FTM","NEAR","ALGO","VET","ICP","HBAR",
  "APT","ARB","OP","SUI","TIA","JUP","RENDER","WIF","BONK","PYTH",
];
const DEFAULT_SELECTION = ["BTC","ETH","SOL","BNB","XRP","ADA","DOGE","PYTH","AVAX","DOT"];
const TIMEFRAME_OPTIONS = [
  { label: "7D", value: 48 },
  { label: "30D", value: 120 },
  { label: "90D", value: 168 },
];

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ax = a.slice(-n), bx = b.slice(-n);
  const ma = ax.reduce((s, x) => s + x, 0) / n;
  const mb = bx.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const dA = ax[i] - ma, dB = bx[i] - mb;
    num += dA * dB;
    da += dA * dA;
    db += dB * dB;
  }
  const denom = Math.sqrt(da * db);
  return denom === 0 ? 0 : num / denom;
}

function corrColor(r: number): string {
  const abs = Math.abs(r);
  if (abs < 0.15) return "#6b7280";
  if (r > 0) return abs > 0.7 ? "#059669" : abs > 0.4 ? "#10b981" : "#34d399";
  return abs > 0.7 ? "#dc2626" : abs > 0.4 ? "#ef4444" : "#f87171";
}

function corrBg(r: number, hovered: boolean): string {
  const abs = Math.abs(r);
  if (abs < 0.05) return "transparent";
  const alpha = (abs * (hovered ? 0.4 : 0.25) + 0.05).toFixed(2);
  return r >= 0 ? `rgba(5,150,105,${alpha})` : `rgba(220,38,38,${alpha})`;
}

function corrLabel(r: number): string {
  if (r >= 0.8) return "Strong +";
  if (r >= 0.5) return "Moderate +";
  if (r >= 0.2) return "Weak +";
  if (r > -0.2) return "None";
  if (r > -0.5) return "Weak −";
  if (r > -0.8) return "Moderate −";
  return "Strong −";
}

export default function CorrelationPage() {
  const [matrix, setMatrix] = useState<{ symbol: string; correlations: Record<string, number> }[]>([]);
  const [coins, setCoins] = useState<{ symbol: string; name: string; image: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<{ r: number; c: number } | null>(null);
  const [selected, setSelected] = useState<string[]>(DEFAULT_SELECTION);
  const [showPicker, setShowPicker] = useState(false);
  const [allCoins, setAllCoins] = useState<{ symbol: string; name: string; image: string }[]>([]);
  const [aiInsights, setAiInsights] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [timeframe, setTimeframe] = useState(48);
  const [strengthFilter, setStrengthFilter] = useState(false);

  const toggleSymbol = (sym: string) => {
    setSelected(prev =>
      prev.includes(sym)
        ? prev.length > 2 ? prev.filter(s => s !== sym) : prev
        : prev.length < 12 ? [...prev, sym] : prev
    );
  };

  const compute = async (syms = selected) => {
    setLoading(true);
    try {
      const data = await fetchCoins(1, 250);
      const allMeta = data.map((c: { symbol: string; name: string; image?: string }) => ({ symbol: c.symbol.toUpperCase(), name: c.name, image: c.image || "" }));
      setAllCoins(allMeta);
      const relevant = data.filter((c: { symbol: string }) => syms.includes(c.symbol.toUpperCase()));
      const coinMeta = relevant.map((c: { symbol: string; name: string; image?: string }) => ({
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        image: c.image || "",
      }));
      setCoins(coinMeta);

      const sparklines: Record<string, number[]> = {};
      for (const c of relevant) {
        const sp = (c as any).sparkline_in_7d?.price;
        if (sp && sp.length > 0) sparklines[c.symbol.toUpperCase()] = sp.slice(-timeframe);
      }

      const symbols = Object.keys(sparklines);
      const result = symbols.map(sym => {
        const corrs: Record<string, number> = {};
        for (const other of symbols) {
          corrs[other] = sym === other ? 1 : pearson(sparklines[sym], sparklines[other]);
        }
        return { symbol: sym, correlations: corrs };
      });
      setMatrix(result);
    } catch {}
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { compute(); }, [timeframe]);

  const symbols = matrix.map(r => r.symbol);

  const summary = useMemo(() => {
    if (matrix.length < 2) return null;
    const syms = matrix.map(r => r.symbol);
    let bestPos = { a: "", b: "", r: -Infinity };
    let bestNeg = { a: "", b: "", r: Infinity };
    let bestZero = { a: "", b: "", r: Infinity, absR: Infinity };
    for (let i = 0; i < matrix.length; i++) {
      for (let j = i + 1; j < syms.length; j++) {
        const v = matrix[i].correlations[syms[j]] ?? 0;
        if (v > bestPos.r) bestPos = { a: matrix[i].symbol, b: syms[j], r: v };
        if (v < bestNeg.r) bestNeg = { a: matrix[i].symbol, b: syms[j], r: v };
        if (Math.abs(v) < bestZero.absR) bestZero = { a: matrix[i].symbol, b: syms[j], r: v, absR: Math.abs(v) };
      }
    }
    return { bestPos, bestNeg, bestZero };
  }, [matrix]);

  return (
    <div className="min-h-screen" style={{ background: "var(--cmc-bg)" }}>
      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-3xl font-bold font-display tracking-tight mb-1" style={{ color: "var(--cmc-text)" }}>Correlation Matrix</h1>
            <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
              Pearson correlation · {TIMEFRAME_OPTIONS.find(t => t.value === timeframe)?.label || "7D"} window · {selected.length} assets
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPicker(p => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: showPicker ? "rgba(153,69,255,0.12)" : "var(--cmc-neutral-2)", color: showPicker ? "var(--pf-accent)" : "var(--cmc-text)", border: `1px solid ${showPicker ? "var(--pf-accent)" : "var(--cmc-border)"}` }}
            >
              <Settings2 size={12} /> Assets
            </button>
            <button
              onClick={() => compute()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Timeframe & Strength filter */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-medium mr-1" style={{ color: "var(--cmc-neutral-5)" }}>Timeframe:</span>
            {TIMEFRAME_OPTIONS.map(tf => (
              <button key={tf.label} onClick={() => setTimeframe(tf.value)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                style={{
                  background: timeframe === tf.value ? "var(--pf-accent)" : "transparent",
                  color: timeframe === tf.value ? "#fff" : "var(--cmc-neutral-5)",
                  border: `1px solid ${timeframe === tf.value ? "var(--pf-accent)" : "var(--cmc-border)"}`,
                }}
              >{tf.label}</button>
            ))}
          </div>
          <div className="w-px h-5" style={{ background: "var(--cmc-border)" }} />
          <button
            onClick={() => setStrengthFilter(f => !f)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-all"
            style={{
              background: strengthFilter ? "rgba(153,69,255,0.12)" : "transparent",
              color: strengthFilter ? "var(--pf-accent)" : "var(--cmc-neutral-5)",
              border: `1px solid ${strengthFilter ? "var(--pf-accent)" : "var(--cmc-border)"}`,
            }}
          >
            {strengthFilter ? <Check size={11} /> : null}
            Strong only (|r| &gt; 0.7)
          </button>
        </div>

        {/* Asset picker panel */}
        {showPicker && (
          <div className="mb-4 p-4 rounded-2xl" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>Select assets (2–12)</p>
              <button onClick={() => { setShowPicker(false); compute(); }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold"
                style={{ background: "var(--pf-accent)", color: "#fff" }}>
                <Check size={11} /> Apply
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_AVAILABLE.map(sym => {
                const isOn = selected.includes(sym);
                return (
                  <button key={sym} onClick={() => toggleSymbol(sym)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                    style={{ background: isOn ? "rgba(153,69,255,0.15)" : "var(--cmc-neutral-2)", color: isOn ? "var(--pf-accent)" : "var(--cmc-neutral-5)", border: `1px solid ${isOn ? "var(--pf-accent)" : "transparent"}` }}
                  >{sym}</button>
                );
              })}
            </div>
            <p className="text-[10px] mt-2" style={{ color: "var(--cmc-neutral-5)" }}>Only assets with sparkline data available will appear in the matrix.</p>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="text-[11px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Correlation:</span>
          {[
            { label: "Strong +", color: "#059669" },
            { label: "Moderate +", color: "#10b981" },
            { label: "None", color: "#6b7280" },
            { label: "Moderate −", color: "#ef4444" },
            { label: "Strong −", color: "#dc2626" },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
              <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{l.label}</span>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--cmc-neutral-5)" }} />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid var(--cmc-border)" }}>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="w-24 p-3" style={{ background: "var(--cmc-neutral-1)", borderBottom: "1px solid var(--cmc-border)", borderRight: "1px solid var(--cmc-border)" }}>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Asset</span>
                  </th>
                  {symbols.map(sym => {
                    const coin = coins.find(c => c.symbol === sym);
                    return (
                      <th key={sym} className="p-2 text-center min-w-[60px]"
                        style={{ background: "var(--cmc-neutral-1)", borderBottom: "1px solid var(--cmc-border)", borderRight: "1px solid var(--cmc-border)" }}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          {coin?.image && (
                            <img src={coin.image} alt="" className="w-5 h-5 rounded-full" onError={e => (e.currentTarget.style.display = "none")} />
                          )}
                          <span className="font-bold text-[10px]" style={{ color: "var(--cmc-text)" }}>{sym}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, ri) => {
                  const coin = coins.find(c => c.symbol === row.symbol);
                  return (
                    <tr key={row.symbol}>
                      <td className="p-3 font-semibold whitespace-nowrap"
                        style={{ background: "var(--cmc-neutral-1)", borderBottom: "1px solid var(--cmc-border)", borderRight: "1px solid var(--cmc-border)", color: "var(--cmc-text)" }}
                      >
                        <div className="flex items-center gap-1.5">
                          {coin?.image && (
                            <img src={coin.image} alt="" className="w-4 h-4 rounded-full" onError={e => (e.currentTarget.style.display = "none")} />
                          )}
                          {row.symbol}
                        </div>
                      </td>
                      {symbols.map((sym, ci) => {
                        const r = row.correlations[sym] ?? 0;
                        const isHov = hovered?.r === ri && hovered?.c === ci;
                        const isDiag = ri === ci;
                        return (
                          <td
                            key={sym}
                            onMouseEnter={() => setHovered({ r: ri, c: ci })}
                            onMouseLeave={() => setHovered(null)}
                            className="text-center p-2 cursor-default transition-all"
                            title={`${row.symbol} vs ${sym}: ${r.toFixed(3)} (${corrLabel(r)})`}
                            style={{
                              background: isDiag ? "rgba(153,69,255,0.15)" : corrBg(r, isHov),
                              borderBottom: "1px solid var(--cmc-border)",
                              borderRight: "1px solid var(--cmc-border)",
                              outline: isHov ? `2px solid ${corrColor(r)}` : undefined,
                              outlineOffset: "-2px",
                              opacity: strengthFilter && !isDiag && Math.abs(r) <= 0.7 ? 0.25 : 1,
                            }}
                          >
                            <span className="font-mono font-bold text-[11px]" style={{ color: isDiag ? "var(--pf-accent)" : corrColor(r) }}>
                              {isDiag ? "1.00" : r.toFixed(2)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tooltip for hovered cell */}
        {hovered && matrix[hovered.r] && (
          <div className="mt-3 flex items-start gap-1.5 text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>
            <Info size={12} className="mt-0.5 shrink-0" />
            <span>
              <strong style={{ color: "var(--cmc-text)" }}>
                {matrix[hovered.r].symbol} × {symbols[hovered.c]}:
              </strong>{" "}
              r = {(matrix[hovered.r].correlations[symbols[hovered.c]] ?? 0).toFixed(4)} —{" "}
              {corrLabel(matrix[hovered.r].correlations[symbols[hovered.c]] ?? 0)} correlation over the last 7 days.
            </span>
          </div>
        )}

        {/* Correlation Summary */}
        {!loading && summary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4">
            <div className="rounded-xl px-4 py-3" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#059669" }}>Strongest Positive</p>
              <p className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>{summary.bestPos.a} × {summary.bestPos.b}</p>
              <p className="text-xs font-mono font-bold" style={{ color: "#059669" }}>{summary.bestPos.r.toFixed(4)}</p>
            </div>
            <div className="rounded-xl px-4 py-3" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#dc2626" }}>Strongest Negative</p>
              <p className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>{summary.bestNeg.a} × {summary.bestNeg.b}</p>
              <p className="text-xs font-mono font-bold" style={{ color: "#dc2626" }}>{summary.bestNeg.r.toFixed(4)}</p>
            </div>
            <div className="rounded-xl px-4 py-3" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--cmc-neutral-5)" }}>Most Uncorrelated</p>
              <p className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>{summary.bestZero.a} × {summary.bestZero.b}</p>
              <p className="text-xs font-mono font-bold" style={{ color: "var(--cmc-neutral-5)" }}>{summary.bestZero.r.toFixed(4)}</p>
            </div>
          </div>
        )}

        {/* AI Correlation Insights */}
        {!loading && matrix.length > 0 && (
          <div className="mt-4">
            {!aiOpen ? (
              <button
                onClick={async () => {
                  setAiOpen(true);
                  setAiLoading(true);
                  try {
                    const pairs: { a: string; b: string; correlation: number }[] = [];
                    for (let i = 0; i < matrix.length && pairs.length < 10; i++) {
                      for (let j = i + 1; j < symbols.length && pairs.length < 10; j++) {
                        const r = matrix[i].correlations[symbols[j]] ?? 0;
                        if (Math.abs(r) > 0.4) pairs.push({ a: matrix[i].symbol, b: symbols[j], correlation: r });
                      }
                    }
                    if (!pairs.length) {
                      for (let i = 0; i < Math.min(5, matrix.length); i++) {
                        for (let j = i + 1; j < Math.min(5, symbols.length); j++) {
                          pairs.push({ a: matrix[i].symbol, b: symbols[j], correlation: matrix[i].correlations[symbols[j]] ?? 0 });
                        }
                      }
                    }
                    const result = await fetchCorrelationInsights(pairs);
                    setAiInsights(result);
                  } catch {
                    setAiInsights("Unable to generate insights right now.");
                  } finally {
                    setAiLoading(false);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.01]"
                style={{ color: "var(--pf-accent)", border: "1px dashed rgba(153,69,255,0.3)", background: "rgba(153,69,255,0.04)" }}
              >
                <PythIcon size={13} /> AI Correlation Insights
              </button>
            ) : (
              <div className="rounded-xl p-4" style={{ background: "rgba(153,69,255,0.04)", border: "1px solid rgba(153,69,255,0.15)" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <PythIcon size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--pf-accent)" }}>AI Correlation Insights</span>
                  </div>
                  <button onClick={() => setAiOpen(false)} className="p-0.5 rounded hover:bg-white/10">
                    <X size={12} style={{ color: "var(--cmc-neutral-5)" }} />
                  </button>
                </div>
                {aiLoading ? (
                  <div className="flex items-center gap-2 py-3">
                    <Loader2 size={14} className="animate-spin" style={{ color: "var(--pf-accent)" }} />
                    <span className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>Analyzing correlations...</span>
                  </div>
                ) : (
                  <div className="text-xs leading-relaxed" style={{ color: "var(--cmc-text)" }}>
                    {aiInsights.split("\n").map((line, i) => {
                      const t = line.trim();
                      if (!t) return <br key={i} />;
                      if (t.startsWith("**") && t.endsWith("**")) return <p key={i} className="font-semibold mt-2">{t.replace(/\*\*/g, "")}</p>;
                      if (t.startsWith("- ") || t.startsWith("• ")) return (
                        <div key={i} className="flex gap-2 pl-0.5 py-0.5">
                          <span className="mt-[5px] w-1 h-1 rounded-full shrink-0" style={{ background: "var(--pf-accent)" }} />
                          <span>{t.replace(/^[-•]\s*/, "").replace(/\*\*(.*?)\*\*/g, "$1")}</span>
                        </div>
                      );
                      const parts = t.split(/\*\*(.*?)\*\*/g);
                      return <p key={i}>{parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}</p>;
                    })}
                  </div>
                )}
                <p className="text-[8px] mt-2 text-right" style={{ color: "var(--cmc-neutral-4)" }}>Not financial advice</p>
              </div>
            )}
          </div>
        )}

        <p className="mt-6 text-[10px]" style={{ color: "var(--cmc-neutral-4)" }}>
          Based on hourly Pyth/CoinGecko sparkline data. Correlation ranges from −1 (inverse) to +1 (identical). Data refreshes on page load.
        </p>
      </div>
    </div>
  );
}
