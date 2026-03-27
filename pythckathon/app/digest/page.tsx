"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, Calendar, TrendingUp, BarChart3, Globe, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { fetchDigest } from "@/lib/api/backend";
import PythIcon from "@/Components/shared/PythIcon";
import { MagicCard } from "@/Components/magicui/magic-card";
import { BorderBeam } from "@/Components/magicui/border-beam";

function renderMd(text: string) {
  return text.split('\n').map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <br key={i} />;
    if (trimmed.startsWith('## ')) return <h2 key={i} className="text-base font-bold mt-6 mb-2 pb-1" style={{ color: "var(--cmc-text)", borderBottom: "1px solid var(--cmc-border)" }}>{trimmed.slice(3)}</h2>;
    if (trimmed.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold mt-4 mb-1" style={{ color: "var(--cmc-text)" }}>{trimmed.slice(4)}</h3>;
    if (trimmed.startsWith('**') && trimmed.endsWith('**')) return <p key={i} className="font-semibold mt-3 text-sm" style={{ color: "var(--cmc-text)" }}>{trimmed.replace(/\*\*/g, '')}</p>;
    if (/^\d+\.\s/.test(trimmed)) {
      const content = trimmed.replace(/^\d+\.\s*/, '');
      return (
        <div key={i} className="flex gap-3 py-1.5">
          <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: "var(--pf-accent-muted)", color: "var(--pf-accent)" }}>{trimmed.match(/^\d+/)?.[0]}</span>
          <span className="text-sm leading-relaxed" style={{ color: "var(--cmc-text)" }}>{content.replace(/\*\*(.*?)\*\*/g, '$1')}</span>
        </div>
      );
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
      return (
        <div key={i} className="flex gap-2 pl-1 py-0.5">
          <span className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--pf-up)" }} />
          <span className="text-sm" style={{ color: "var(--cmc-text)" }}>{trimmed.replace(/^[-•*]\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1')}</span>
        </div>
      );
    }
    const parts = trimmed.split(/\*\*(.*?)\*\*/g);
    return <p key={i} className="text-sm leading-relaxed" style={{ color: "var(--cmc-text)" }}>{parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}</p>;
  });
}

function getDateStr(d: Date) { return d.toISOString().split("T")[0]; }
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return getDateStr(d);
}

export default function DigestPage() {
  const today = getDateStr(new Date());
  const [digest, setDigest] = useState("");
  const [date, setDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notAvailable, setNotAvailable] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const load = useCallback((targetDate?: string) => {
    const d = targetDate || today;
    setDate(d);
    setLoading(true);
    setError("");
    setNotAvailable(false);
    fetch(`/api/cryptoserve/ai/digest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: d }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.available === false || !data.digest) {
          setNotAvailable(true);
          setDigest("");
        } else {
          setDigest(data.digest);
          setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        }
        if (data.availableDates) setAvailableDates(data.availableDates);
      })
      .catch(e => setError(e.message || "Failed to load digest"))
      .finally(() => setLoading(false));
  }, [today]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 5 minutes to pick up new auto-generated digests
  useEffect(() => {
    const iv = setInterval(() => load(), 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [load]);

  const goToPrevDay = () => load(addDays(date, -1));
  const goToNextDay = () => { if (date < today) load(addDays(date, 1)); };
  const goToToday = () => load(today);
  const isToday = date === today;

  return (
    <div className="min-h-screen px-4 py-8 max-w-4xl mx-auto">
      {/* Hero header — clean typography */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display tracking-tight mb-1" style={{ color: "var(--cmc-text)" }}>Daily Market Digest</h1>
            <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
              Auto-generated every 2 hours · Pyth Network
              {lastUpdated && <span className="ml-2" style={{ color: "var(--cmc-neutral-4)" }}>· Updated {lastUpdated}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => load()} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80" style={{ color: "var(--cmc-neutral-5)", border: "1px solid var(--cmc-border)" }}>
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={goToPrevDay}
            disabled={loading}
            className="p-1 rounded-lg transition-all hover:opacity-80"
            style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-neutral-5)" }}
          >
            <ChevronLeft size={14} />
          </button>
          <div className="flex items-center gap-1.5">
            <Calendar size={12} style={{ color: "var(--cmc-neutral-5)" }} />
            <span className="text-[11px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>
              {new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>
          <button
            onClick={goToNextDay}
            disabled={loading || isToday}
            className="p-1 rounded-lg transition-all hover:opacity-80 disabled:opacity-30"
            style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-neutral-5)" }}
          >
            <ChevronRight size={14} />
          </button>
          {!isToday && (
            <button
              onClick={goToToday}
              className="text-[10px] font-semibold px-2 py-1 rounded-lg transition-all hover:opacity-80"
              style={{ background: "rgba(153,69,255,0.1)", color: "var(--pf-accent)" }}
            >
              Today
            </button>
          )}
          {availableDates.length > 1 && (
            <span className="text-[9px] ml-1" style={{ color: "var(--cmc-neutral-4)" }}>
              {availableDates.length} days available
            </span>
          )}
        </div>
      </div>

      {/* Quick stat cards */}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {[
            { icon: TrendingUp, label: "Market Trend", value: "Live", color: "var(--pf-up)" },
            { icon: BarChart3, label: "Data Sources", value: "Multi-Sources", color: "var(--pf-accent)" },
            { icon: Globe, label: "Coverage", value: "Global", color: "var(--pf-teal)" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl px-4 py-3 transition-all hover:brightness-105" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <stat.icon size={11} style={{ color: stat.color }} />
                <span className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>{stat.label}</span>
              </div>
              <p className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {/* Skeleton stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl px-4 py-3 space-y-2" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
                <div className="h-2.5 w-16 rounded-full animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
                <div className="h-4 w-12 rounded-full animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
              </div>
            ))}
          </div>
          {/* Skeleton main content */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
            <div className="p-6">
              <div className="flex flex-col items-center justify-center py-8 gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(153,69,255,0.1)" }}>
                    <PythIcon size={24} />
                  </div>
                  <Loader2 size={48} className="animate-spin absolute -top-[18px] -left-[18px]" style={{ color: "rgba(153,69,255,0.3)" }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: "var(--cmc-text)" }}>Generating today&apos;s digest...</p>
                  <p className="text-[11px] mt-1" style={{ color: "var(--cmc-neutral-5)" }}>Analyzing market data across exchanges</p>
                </div>
              </div>
              <div className="space-y-3 mt-2">
                {["100%", "92%", "80%", "95%", "70%", "88%", "65%"].map((w, i) => (
                  <div key={i} className="h-3 rounded-full animate-pulse" style={{ width: w, background: "var(--cmc-neutral-2)", opacity: 1 - i * 0.08 }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl p-8 text-center" style={{ background: "rgba(234,57,67,0.03)", border: "1px solid rgba(234,57,67,0.15)" }}>
          <p className="text-sm font-medium" style={{ color: "#ea3943" }}>{error}</p>
          <button onClick={() => load()} className="mt-4 px-5 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90" style={{ background: "var(--pf-accent)" }}>
            Try Again
          </button>
        </div>
      ) : notAvailable ? (
        <div className="rounded-xl p-8 text-center" style={{ background: "rgba(153,69,255,0.03)", border: "1px solid var(--cmc-border)" }}>
          <Calendar size={32} className="mx-auto mb-3" style={{ color: "var(--cmc-neutral-4)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--cmc-text)" }}>No digest available for this date</p>
          <p className="text-[11px] mt-1 mb-4" style={{ color: "var(--cmc-neutral-5)" }}>Digests are generated daily. Try today or a date with data.</p>
          <button onClick={goToToday} className="px-5 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90" style={{ background: "var(--pf-accent)" }}>
            Go to Today
          </button>
        </div>
      ) : (
        <MagicCard className="rounded-2xl overflow-hidden" gradientColor="rgba(153,69,255,0.03)" gradientFrom="var(--pf-accent)11" gradientTo="var(--pf-teal)11">
          <BorderBeam size={100} duration={10} colorFrom="var(--pf-accent)" colorTo="var(--pf-teal)" borderWidth={1.5} />
          <div className="p-6">
            {/* Reading time */}
            <div className="flex items-center gap-3 mb-5 pb-4" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
              <div className="flex items-center gap-1.5">
                <Clock size={11} style={{ color: "var(--cmc-neutral-5)" }} />
                <span className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>
                  {Math.max(1, Math.ceil(digest.split(/\s+/).length / 200))} min read
                </span>
              </div>
              <span className="text-[10px]" style={{ color: "var(--cmc-neutral-4)" }}>
                {digest.split(/\s+/).length} words
              </span>
            </div>
            <div className="space-y-1">
              {renderMd(digest)}
            </div>
            <div className="mt-6 pt-4 flex items-center justify-between" style={{ borderTop: "1px solid var(--cmc-border)" }}>
              <div className="flex items-center gap-1.5">
                <PythIcon size={10} />
                <span className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-4)" }}>Powered by Pyth Network</span>
              </div>
              <p className="text-[10px]" style={{ color: "var(--cmc-neutral-4)" }}>
                Not financial advice
              </p>
            </div>
          </div>
        </MagicCard>
      )}
    </div>
  );
}
