"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

export default function AIMarketMood() {
  const [mood, setMood] = useState<string | null>(null);
  const [fearGreed, setFearGreed] = useState<{ value: number; label: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/cryptoserve/ai/mood");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setMood(data.mood);
        setFearGreed(data.fearGreed);
      } catch {
        setMood(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !mood) return null;

  const fgVal = fearGreed?.value ?? 50;
  const fgColor = fgVal >= 60 ? "var(--pf-up)" : fgVal <= 40 ? "var(--pf-down)" : "var(--pf-warning)";
  const fgEmoji = fgVal >= 75 ? "▲" : fgVal >= 55 ? "●" : fgVal >= 40 ? "◆" : "▼";

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[12px] transition-all"
      style={{
        border: "1px solid var(--cmc-border)",
        color: "var(--cmc-text)",
      }}
    >
      <div className="flex items-center gap-2 shrink-0">
        <Activity size={13} style={{ color: fgColor }} />
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--cmc-neutral-5)" }}>
          AI Pulse
        </span>
      </div>
      <div className="w-px h-3.5 shrink-0" style={{ background: "var(--cmc-border)" }} />
      <span className="text-[11px] font-medium line-clamp-1 flex-1">{fgEmoji} {mood}</span>
      {fearGreed && (
        <span
          className="shrink-0 text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-md"
          style={{ background: `${fgColor}15`, color: fgColor }}
        >
          {fearGreed.value}
        </span>
      )}
    </div>
  );
}
