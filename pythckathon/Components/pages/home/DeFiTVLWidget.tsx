"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ExternalLink, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { fetchProtocols, type DefiProtocol } from "@/lib/api/backend";
import { fmtB } from "@/lib/format";

interface Protocol {
  name: string;
  tvl: number;
  change_1d: number;
  logo: string;
  category: string;
  url: string;
}

interface ChainTVL {
  name: string;
  tvl: number;
}

export default function DeFiTVLWidget() {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [totalTVL, setTotalTVL] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await fetchProtocols(50);
        if (Array.isArray(data) && data.length > 0) {
          const sorted = data
            .filter((p: DefiProtocol) => p.tvl > 0 && p.category !== "Chain")
            .slice(0, 8)
            .map((p: DefiProtocol) => ({
              name: p.name,
              tvl: p.tvl,
              change_1d: p.change1d ?? 0,
              logo: p.logo || "",
              category: p.category || "DeFi",
              url: p.url || `https://defillama.com/protocol/${p.id}`,
            }));
          setProtocols(sorted);
          setTotalTVL(data.reduce((s: number, p: DefiProtocol) => s + (p.tvl || 0), 0));
        }
      } catch {}
      setLoading(false);
    };

    fetchData();
    const iv = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>DeFi TVL</span>
          {totalTVL !== null && !loading && (
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(153,69,255,0.1)", color: "var(--pf-accent)" }}>
              {fmtB(totalTVL)} total
            </span>
          )}
        </div>
        <a href="https://defillama.com" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] font-medium hover:underline"
          style={{ color: "var(--cmc-neutral-5)" }}>
          DefiLlama <ExternalLink size={9} />
        </a>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-8" style={{ background: "var(--cmc-neutral-1)" }}>
          <Loader2 size={18} className="animate-spin" style={{ color: "var(--cmc-neutral-5)" }} />
        </div>
      ) : (
        <div className="divide-y" style={{ background: "var(--cmc-neutral-1)", borderColor: "var(--cmc-border)" }}>
          {protocols.map((p, i) => (
            <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between px-4 py-2.5 hover:brightness-110 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] w-4 shrink-0 font-bold text-right" style={{ color: "var(--cmc-neutral-4)" }}>{i + 1}</span>
                {p.logo ? (
                  <img src={p.logo} alt="" className="w-5 h-5 rounded-full shrink-0"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="w-5 h-5 rounded-full shrink-0" style={{ background: "var(--cmc-neutral-3)" }} />
                )}
                <div>
                  <p className="text-xs font-semibold leading-none" style={{ color: "var(--cmc-text)" }}>{p.name}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: "var(--cmc-neutral-5)" }}>{p.category}</p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-2">
                <p className="text-xs font-bold font-mono" style={{ color: "var(--cmc-text)" }}>{fmtB(p.tvl)}</p>
                {p.change_1d !== 0 && (
                  <div className="flex items-center justify-end gap-0.5">
                    {p.change_1d > 0
                      ? <TrendingUp size={8} style={{ color: "#16c784" }} />
                      : <TrendingDown size={8} style={{ color: "#ea3943" }} />}
                    <span className="text-[9px] font-semibold"
                      style={{ color: p.change_1d > 0 ? "#16c784" : "#ea3943" }}>
                      {p.change_1d > 0 ? "+" : ""}{p.change_1d.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2" style={{ borderTop: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
        <p className="text-[9px]" style={{ color: "var(--cmc-neutral-4)" }}>
          Data from DeFi Llama · Refreshes every 5 min
        </p>
      </div>
    </div>
  );
}
