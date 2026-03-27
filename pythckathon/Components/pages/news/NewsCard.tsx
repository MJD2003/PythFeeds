"use client";

import { useState } from "react";
import { Clock, ExternalLink, Bot, Loader2, X as XIcon } from "lucide-react";
import { fetchNewsSummary } from "@/lib/api/backend";

interface NewsCardProps {
  article: any;
  sentiment: "bullish" | "bearish" | "neutral";
  sStyle: { bg: string; color: string; label: string };
  timeAgo: string;
  thumb: string | null;
}

export default function NewsCard({ article, sentiment, sStyle, timeAgo, thumb }: NewsCardProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const title = article.title || "Untitled";
  const source = article.source?.title || article.source || "Unknown";
  const url = article.url || article.link || "#";
  const content = article.content || article.body || article.description || "";

  const handleSummarize = (e: React.MouseEvent) => {
    e.preventDefault(); // prevent link click
    e.stopPropagation();
    setModalOpen(true);
    if (!summary && !loading) {
      setLoading(true);
      fetchNewsSummary(title, content)
        .then(s => setSummary(s))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  };

  return (
    <>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex flex-col rounded-xl overflow-hidden transition-all hover:-translate-y-px"
        style={{ border: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}
      >
        {/* Thumbnail */}
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="w-full h-32 object-cover" style={{ borderBottom: "1px solid var(--cmc-border)" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        )}
        <div className="flex-1 p-4 flex flex-col">
          {/* Meta row */}
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <span className="text-[9px] font-bold uppercase rounded px-1.5 py-0.5"
              style={{ background: "rgba(153,69,255,0.12)", color: "var(--pf-accent)" }}>
              {article.category}
            </span>
            <span className="text-[9px] font-semibold rounded px-1.5 py-0.5"
              style={{ background: sStyle.bg, color: sStyle.color }}>
              {sStyle.label}
            </span>
            <span className="text-[10px] font-medium ml-auto" style={{ color: "var(--cmc-neutral-5)" }}>{source}</span>
          </div>
          {/* Title */}
          <h3 className="text-sm font-semibold line-clamp-3 group-hover:opacity-80 transition-opacity" style={{ color: "var(--cmc-text)" }}>{title}</h3>
          
          <div className="flex-1" />

          {/* Footer */}
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={handleSummarize}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80"
              style={{ background: "rgba(153,69,255,0.12)", color: "var(--pf-accent)" }}
            >
              <Bot size={12} /> Summarize
            </button>

            <div className="flex items-center gap-2.5">
              {timeAgo && (
                <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>
                  <Clock size={9} /> {timeAgo}
                </span>
              )}
              <ExternalLink size={12} style={{ color: "var(--cmc-neutral-5)" }} />
            </div>
          </div>
        </div>
      </a>

      {/* AI Summary Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-[500px] rounded-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[80vh]" style={{ background: "var(--cmc-bg)", border: "1px solid var(--cmc-border)" }} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
              <div className="flex items-center gap-2">
                <Bot size={18} style={{ color: "var(--pf-accent)" }} />
                <h3 className="font-bold text-sm" style={{ color: "var(--cmc-text)" }}>AI Summary</h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded-full hover:bg-black/5">
                <XIcon size={16} style={{ color: "var(--cmc-neutral-5)" }} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <h4 className="text-sm font-semibold mb-4 leading-snug" style={{ color: "var(--cmc-text)" }}>{title}</h4>
              
              {loading ? (
                <div className="flex flex-col items-center justify-center py-6 gap-3">
                  <Loader2 size={24} className="animate-spin" style={{ color: "var(--pf-accent)" }} />
                  <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>Generating summary with Gemini...</p>
                </div>
              ) : error ? (
                <div className="p-4 rounded-xl flex items-center justify-center text-sm font-medium" style={{ background: "rgba(234,57,67,0.1)", color: "#ea3943" }}>
                  {error}
                </div>
              ) : (
                <div className="text-sm leading-relaxed space-y-2" style={{ color: "var(--cmc-neutral-6)" }}>
                  {summary?.split('\n').map((line, i) => (
                    <p key={i} className="flex gap-2">
                      {line.trim().startsWith('-') || line.trim().startsWith('•') ? (
                        <>
                          <span className="text-[var(--pf-accent)] mt-0.5">•</span>
                          <span>{line.replace(/^[-•]\s*/, '')}</span>
                        </>
                      ) : (
                        <span>{line}</span>
                      )}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t text-[10px] flex items-center justify-between" style={{ borderColor: "var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
              <span style={{ color: "var(--cmc-neutral-5)" }}>Powered by Google Gemini</span>
              <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-semibold hover:underline" style={{ color: "var(--pf-accent)" }}>
                Read full article <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
