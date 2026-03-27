"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Loader2, Calendar, ChevronDown, ChevronUp, AlertTriangle, Clock, Landmark, Bitcoin, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { fetchEconomicCalendar, fetchAIChat, type CalendarEvent } from "@/lib/api/backend";
import PythIcon from "@/Components/shared/PythIcon";
import { MagicCard } from "@/Components/magicui/magic-card";
import { BorderBeam } from "@/Components/magicui/border-beam";

const IMPACT_CONFIG: Record<string, { color: string; label: string; bg: string }> = {
  high: { color: "#ea3943", label: "High", bg: "rgba(234,57,67,0.08)" },
  medium: { color: "#ef8c22", label: "Medium", bg: "rgba(239,140,34,0.08)" },
  low: { color: "#16c784", label: "Low", bg: "rgba(22,199,132,0.08)" },
};

type CategoryFilter = "all" | "macro" | "crypto";

function useCountdowns(events: CalendarEvent[]) {
  const [now, setNow] = useState(Date.now());
  const upcoming = useMemo(
    () => events.filter(e => e.timestamp > Date.now() && e.timestamp - Date.now() < 86400000),
    [events]
  );
  const hasUpcoming = upcoming.length > 0;

  useEffect(() => {
    if (!hasUpcoming) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasUpcoming]);

  const getCountdown = useCallback(
    (timestamp: number): string | null => {
      const diff = timestamp - now;
      if (diff <= 0 || diff >= 86400000) return null;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    },
    [now]
  );

  return getCountdown;
}

function parseNumeric(val: string | null | undefined): number | null {
  if (!val) return null;
  const cleaned = val.replace(/[%KMB,]/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function DataChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 8px", borderRadius: 6,
      background: "var(--cmc-neutral-1, rgba(128,128,128,0.06))",
    }}>
      <span style={{ fontSize: 9, fontWeight: 600, color: "var(--cmc-neutral-5)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: color || "var(--cmc-text)" }}>{value}</span>
    </div>
  );
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<CategoryFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [aiPreviews, setAiPreviews] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const getCountdown = useCountdowns(events);

  useEffect(() => {
    fetchEconomicCalendar().then(setEvents).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = events;
    if (filter !== "all") list = list.filter(e => e.impact === filter);
    if (catFilter !== "all") list = list.filter(e => e.category === catFilter);
    return list;
  }, [events, filter, catFilter]);

  const highCount = events.filter(e => e.impact === "high").length;
  const upcomingCount = events.filter(e => e.daysUntil <= 7 && e.daysUntil >= 0).length;
  const cryptoCount = events.filter(e => e.category === "crypto").length;
  const macroCount = events.filter(e => e.category === "macro").length;

  const getAIPreview = async (event: CalendarEvent) => {
    if (aiPreviews[event.id]) return;
    setAiLoading(p => ({ ...p, [event.id]: true }));
    try {
      const reply = await fetchAIChat(
        `In 2-3 sentences, explain how the upcoming "${event.name}" (${event.description}) typically affects crypto and stock markets. Be concise and factual.`,
        []
      );
      setAiPreviews(p => ({ ...p, [event.id]: reply }));
    } catch {
      setAiPreviews(p => ({ ...p, [event.id]: "Unable to generate AI preview at this time." }));
    } finally {
      setAiLoading(p => ({ ...p, [event.id]: false }));
    }
  };

  const toggleExpand = (event: CalendarEvent) => {
    if (expandedId === event.id) {
      setExpandedId(null);
    } else {
      setExpandedId(event.id);
      getAIPreview(event);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-display tracking-tight mb-1" style={{ color: "var(--cmc-text)" }}>Economic Calendar</h1>
        <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>Macro events that impact crypto &amp; traditional markets</p>
      </div>

      {/* Summary stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-5">
          {[
            { label: "Total Events", value: events.length.toString(), icon: Calendar, color: "var(--cmc-text)" },
            { label: "High Impact", value: highCount.toString(), icon: AlertTriangle, color: "#ea3943" },
            { label: "This Week", value: upcomingCount.toString(), icon: Clock, color: "#16c784" },
            { label: "Macro", value: macroCount.toString(), icon: Landmark, color: "var(--pf-info)" },
            { label: "Crypto", value: cryptoCount.toString(), icon: Bitcoin, color: "var(--pf-accent)" },
          ].map(s => (
            <div key={s.label} className="rounded-xl px-4 py-3 relative overflow-hidden" style={{ background: "var(--cmc-neutral-1)", borderTop: `2px solid ${s.color}`, borderLeft: "1px solid var(--cmc-border)", borderRight: "1px solid var(--cmc-border)", borderBottom: "1px solid var(--cmc-border)" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <s.icon size={11} style={{ color: "var(--cmc-neutral-5)" }} />
                <span className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>{s.label}</span>
              </div>
              <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
              <BorderBeam size={80} duration={8} colorFrom="var(--pf-accent)" colorTo="var(--pf-teal)" />
            </div>
          ))}
        </div>
      )}

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex items-center gap-1 mr-2">
          {([
            { key: "all" as CategoryFilter, label: "All", icon: <Calendar size={10} /> },
            { key: "macro" as CategoryFilter, label: "Macro", icon: <Landmark size={10} /> },
            { key: "crypto" as CategoryFilter, label: "Crypto", icon: <Bitcoin size={10} /> },
          ]).map(c => (
            <button key={c.key} onClick={() => setCatFilter(c.key)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
              style={{
                background: catFilter === c.key ? "var(--pf-accent)" : "transparent",
                color: catFilter === c.key ? "#fff" : "var(--cmc-neutral-5)",
                border: `1px solid ${catFilter === c.key ? "var(--pf-accent)" : "var(--cmc-border)"}`,
              }}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-(--cmc-border)" />

        {[
          { key: "all", label: "All Impact" },
          { key: "high", label: "High" },
          { key: "medium", label: "Medium" },
          { key: "low", label: "Low" },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all"
            style={{
              background: filter === f.key ? "var(--cmc-text)" : "transparent",
              color: filter === f.key ? "var(--cmc-bg)" : "var(--cmc-neutral-5)",
              border: filter === f.key ? "none" : "1px solid var(--cmc-border)",
            }}
          >{f.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl px-4 py-3 relative overflow-hidden animate-pulse" style={{ background: "var(--cmc-bg)", border: "1px solid var(--cmc-border)" }}>
                <div className="space-y-2">
                  <div className="h-2.5 w-16 rounded-full" style={{ background: "var(--cmc-neutral-2)" }} />
                  <div className="h-5 w-10 rounded-full" style={{ background: "var(--cmc-neutral-2)" }} />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <MagicCard key={i} className="rounded-xl overflow-hidden" gradientColor="rgba(153,69,255,0.02)" gradientFrom="var(--pf-accent)08" gradientTo="transparent">
                <BorderBeam size={60} duration={5 + i} colorFrom={["#ea3943", "#ef8c22", "#16c784", "var(--pf-accent)"][i]} colorTo="var(--pf-accent)" borderWidth={1} />
                <div className="p-4 flex items-center gap-4 animate-pulse">
                  <div className="shrink-0 w-12 h-12 rounded-lg" style={{ background: "var(--cmc-neutral-2)" }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 rounded-full w-3/5" style={{ background: "var(--cmc-neutral-2)" }} />
                    <div className="h-3 rounded-full w-2/5" style={{ background: "var(--cmc-neutral-2)", opacity: 0.6 }} />
                  </div>
                  <div className="h-5 w-14 rounded-full" style={{ background: "var(--cmc-neutral-2)", opacity: 0.4 }} />
                </div>
              </MagicCard>
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ border: "1px solid var(--cmc-border)" }}>
          <Calendar size={28} style={{ color: "var(--cmc-neutral-4)" }} className="mx-auto mb-2" />
          <p className="text-sm" style={{ color: "var(--cmc-neutral-5)" }}>No events match this filter</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(event => {
            const impact = IMPACT_CONFIG[event.impact] || IMPACT_CONFIG.low;
            const isExpanded = expandedId === event.id;
            const isUrgent = event.daysUntil <= 3 && event.daysUntil >= 0;
            const countdown = getCountdown(event.timestamp);

            const hasData = event.actual || event.forecast || event.previous;
            const actualNum = parseNumeric(event.actual);
            const forecastNum = parseNumeric(event.forecast);
            let beatColor: string | undefined;
            if (actualNum !== null && forecastNum !== null) {
              beatColor = actualNum > forecastNum ? "#16c784" : actualNum < forecastNum ? "#ea3943" : "var(--cmc-neutral-5)";
            }

            return (
              <div
                key={event.id}
                className="rounded-xl overflow-hidden transition-all relative hover:scale-[1.005] duration-200"
                style={{ background: "var(--cmc-bg)", border: isUrgent ? `1px solid ${impact.color}33` : "1px solid var(--cmc-border)" }}
              >
                {isUrgent && <BorderBeam size={60} duration={5} colorFrom={impact.color} colorTo="var(--pf-accent)" borderWidth={1.5} />}
                <button
                  onClick={() => toggleExpand(event)}
                  className="w-full flex items-center gap-4 p-4 pb-3 text-left transition-all hover:opacity-90"
                >
                  {/* Date badge */}
                  <div className="shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center" style={{ background: impact.bg }}>
                    <p className="text-[10px] font-bold uppercase" style={{ color: impact.color }}>{new Date(event.date).toLocaleDateString("en-US", { month: "short" })}</p>
                    <p className="text-base font-bold leading-none" style={{ color: "var(--cmc-text)" }}>{new Date(event.date).getDate()}</p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-sm truncate" style={{ color: "var(--cmc-text)" }}>{event.name}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0" style={{ background: impact.bg, color: impact.color }}>{impact.label}</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold shrink-0" style={{
                        background: event.category === "crypto" ? "rgba(153,69,255,0.1)" : "rgba(96,165,250,0.1)",
                        color: event.category === "crypto" ? "var(--pf-accent)" : "var(--pf-info)",
                      }}>{event.category === "crypto" ? "Crypto" : "Macro"}</span>
                    </div>
                    <p className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>{event.body} · {event.recurring}</p>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color: isUrgent ? "#ea3943" : "var(--cmc-neutral-5)" }}>
                        {event.daysUntil <= 0 ? "Today" : event.daysUntil === 1 ? "Tomorrow" : `${event.daysUntil}d`}
                      </span>
                      {isExpanded ? <ChevronUp size={14} style={{ color: "var(--cmc-neutral-5)" }} /> : <ChevronDown size={14} style={{ color: "var(--cmc-neutral-5)" }} />}
                    </div>
                    {countdown && (
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md" style={{
                        background: "rgba(234,57,67,0.08)",
                        color: "#ea3943",
                      }}>{countdown}</span>
                    )}
                  </div>
                </button>

                {/* Actual / Forecast / Previous chips */}
                {hasData && (
                  <div className="flex items-center gap-2 px-4 pb-3 flex-wrap" style={{ marginLeft: 64 }}>
                    {event.actual && (
                      <DataChip label="Act" value={event.actual} color={beatColor} />
                    )}
                    {event.forecast && (
                      <DataChip label="Fcst" value={event.forecast} />
                    )}
                    {event.previous && (
                      <DataChip label="Prev" value={event.previous} />
                    )}
                    {beatColor && (
                      beatColor === "#16c784" ? <TrendingUp size={13} style={{ color: beatColor }} /> :
                      beatColor === "#ea3943" ? <TrendingDown size={13} style={{ color: beatColor }} /> :
                      <Minus size={13} style={{ color: beatColor }} />
                    )}
                  </div>
                )}

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0" style={{ borderTop: "1px solid var(--cmc-border)" }}>
                    <p className="text-xs mt-3 mb-3 leading-relaxed" style={{ color: "var(--cmc-neutral-5)" }}>{event.description}</p>

                    {/* AI Preview */}
                    <div className="rounded-lg p-3" style={{ background: "rgba(153,69,255,0.04)", border: "1px solid rgba(153,69,255,0.1)" }}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <PythIcon size={11} />
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--pf-accent)" }}>AI Impact Preview</span>
                      </div>
                      {aiLoading[event.id] ? (
                        <div className="flex items-center gap-2">
                          <Loader2 size={12} className="animate-spin" style={{ color: "var(--pf-accent)" }} />
                          <span className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>Analyzing impact...</span>
                        </div>
                      ) : (
                        <p className="text-xs leading-relaxed" style={{ color: "var(--cmc-text)" }}>{aiPreviews[event.id] || "Loading analysis..."}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
