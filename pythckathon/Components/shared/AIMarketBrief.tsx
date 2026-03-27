"use client";

import { useEffect, useState } from "react";
import { Bot, RefreshCw } from "lucide-react";
import PythIcon from "@/Components/shared/PythIcon";

export default function AIMarketBrief() {
  const [brief, setBrief] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchBrief = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/cryptoserve/ai/market-brief", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBrief(data.brief);
      setLastUpdated(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrief();
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden mb-5" style={{ border: "1px solid var(--cmc-border)" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          background: "linear-gradient(135deg, rgba(153,69,255,0.07) 0%, rgba(153,69,255,0.07) 100%)",
          borderBottom: "1px solid var(--cmc-border)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, var(--pf-accent), var(--pf-teal))" }}
          >
            <Bot size={14} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>AI Market Brief</p>
              <PythIcon size={11} />
            </div>
            <p className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>
              Google Gemini · refreshes every 30 min
              {lastUpdated && ` · ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
            </p>
          </div>
        </div>
        <button
          onClick={fetchBrief}
          disabled={loading}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 disabled:opacity-50"
          style={{ background: "rgba(153,69,255,0.12)", color: "var(--pf-accent)" }}
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          {loading ? "Analyzing..." : "Refresh"}
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3.5" style={{ background: "var(--cmc-neutral-1)" }}>
        {loading && (
          <div className="space-y-2.5">
            {["85%", "75%", "90%"].map((w, i) => (
              <div key={i} className="h-3.5 rounded-full animate-pulse" style={{ width: w, background: "var(--cmc-neutral-2)" }} />
            ))}
          </div>
        )}
        {error && !loading && (
          <div className="flex items-center gap-2">
            <p className="text-sm" style={{ color: "var(--cmc-neutral-5)" }}>AI brief unavailable.</p>
            <button onClick={fetchBrief} className="text-xs underline" style={{ color: "var(--pf-accent)" }}>Retry</button>
          </div>
        )}
        {brief && !loading && (
          <div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--cmc-text)" }}>{brief}</p>
            <p className="text-[9px] mt-2" style={{ color: "var(--cmc-neutral-4)" }}>
              ⚠ AI-generated summary for informational purposes only. Not financial advice.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
