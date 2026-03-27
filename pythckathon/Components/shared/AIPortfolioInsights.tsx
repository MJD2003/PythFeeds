"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import PythIcon from "@/Components/shared/PythIcon";
import { fetchPortfolioInsights } from "@/lib/api/backend";

interface Holding {
  symbol: string;
  amount: number;
  price: number;
  change24h?: number;
}

function renderMd(text: string) {
  return text.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <br key={i} />;
    if (trimmed.startsWith("**") && trimmed.endsWith("**"))
      return <p key={i} className="font-semibold text-[11px] mt-2">{trimmed.replace(/\*\*/g, "")}</p>;
    if (/^\d+\.\s/.test(trimmed)) {
      const content = trimmed.replace(/^\d+\.\s*/, "");
      return (
        <div key={i} className="flex gap-2 pl-0.5 py-0.5">
          <span className="shrink-0 text-[10px] font-bold mt-px" style={{ color: "var(--cmc-neutral-5)" }}>{trimmed.match(/^\d+/)?.[0]}.</span>
          <span className="text-[11px]">{content.replace(/\*\*(.*?)\*\*/g, "$1")}</span>
        </div>
      );
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      return (
        <div key={i} className="flex gap-2 pl-0.5 py-0.5">
          <span className="mt-[5px] w-1 h-1 rounded-full shrink-0" style={{ background: "var(--pf-teal)" }} />
          <span className="text-[11px]">{trimmed.replace(/^[-•]\s*/, "").replace(/\*\*(.*?)\*\*/g, "$1")}</span>
        </div>
      );
    }
    const parts = trimmed.split(/\*\*(.*?)\*\*/g);
    return (
      <p key={i} className="text-[11px]">
        {parts.map((part, j) => (j % 2 === 1 ? <strong key={j}>{part}</strong> : part))}
      </p>
    );
  });
}

export default function AIPortfolioInsights({ holdings }: { holdings: Holding[] }) {
  const [insights, setInsights] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const generate = async () => {
    if (loading || !holdings.length) return;
    setOpen(true);
    setLoading(true);
    try {
      const result = await fetchPortfolioInsights(holdings.slice(0, 20));
      setInsights(result);
    } catch {
      setInsights("Unable to generate insights at this time. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={generate}
        className="mt-1.5 flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-[10px] font-semibold transition-colors hover:bg-white/5"
        style={{ color: "var(--pf-accent)", border: "1px dashed rgba(153,69,255,0.3)" }}
      >
        <PythIcon size={10} /> AI Portfolio Insights
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl p-3 relative" style={{ background: "rgba(153,69,255,0.05)", border: "1px solid rgba(153,69,255,0.15)" }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <PythIcon size={11} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--pf-accent)" }}>AI Insights</span>
        </div>
        <button onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-white/10">
          <X size={10} style={{ color: "var(--cmc-neutral-5)" }} />
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-3">
          <Loader2 size={12} className="animate-spin" style={{ color: "var(--pf-accent)" }} />
          <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>Analyzing your portfolio...</span>
        </div>
      ) : (
        <div style={{ color: "var(--cmc-text)" }}>{renderMd(insights)}</div>
      )}
      <p className="text-[8px] mt-2 text-right" style={{ color: "var(--cmc-neutral-4)" }}>Not financial advice</p>
    </div>
  );
}
