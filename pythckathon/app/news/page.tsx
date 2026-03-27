import { fetchCryptoNews, fetchStockNews } from "@/lib/api/backend";
import Link from "next/link";
import { Newspaper } from "lucide-react";
import AIMarketBrief from "@/Components/shared/AIMarketBrief";
import NewsCard from "@/Components/pages/news/NewsCard";

export const revalidate = 300;

export const metadata = {
  title: "News | PythFeeds",
  description: "Latest crypto and stock market news powered by Pyth Network",
};

const BULLISH_WORDS = ["rally", "surge", "soar", "pump", "breakout", "all-time high", "bullish", "gains", "recover", "moon", "rocket", "outperform", "upgrade", "adoption", "approval"];
const BEARISH_WORDS = ["crash", "dump", "plunge", "drop", "sell-off", "bearish", "losses", "decline", "liquidat", "hack", "exploit", "ban", "fraud", "scam", "downgrade", "fear", "collapse"];

function classifySentiment(title: string): "bullish" | "bearish" | "neutral" {
  const t = title.toLowerCase();
  let bull = 0;
  let bear = 0;
  for (const w of BULLISH_WORDS) if (t.includes(w)) bull++;
  for (const w of BEARISH_WORDS) if (t.includes(w)) bear++;
  if (bull > bear) return "bullish";
  if (bear > bull) return "bearish";
  return "neutral";
}

const SENTIMENT_STYLE = {
  bullish: { bg: "rgba(22,199,132,0.1)", color: "#16c784", label: "Bullish" },
  bearish: { bg: "rgba(234,57,67,0.1)", color: "#ea3943", label: "Bearish" },
  neutral: { bg: "rgba(133,140,162,0.08)", color: "var(--cmc-neutral-5)", label: "Neutral" },
};

export default async function NewsPage() {
  let cryptoNews: any[] = [];
  let stockNews: any[] = [];
  try {
    [cryptoNews, stockNews] = await Promise.all([
      fetchCryptoNews([], 20).catch(() => []),
      fetchStockNews("AAPL", 10).catch(() => []),
    ]);
  } catch {}

  const allNews = [
    ...cryptoNews.map((n: any) => ({ ...n, category: "crypto" })),
    ...stockNews.map((n: any) => ({ ...n, category: "stocks" })),
  ].sort((a, b) => new Date(b.publishedAt || b.published_at || b.date || 0).getTime() - new Date(a.publishedAt || a.published_at || a.date || 0).getTime());

  const bullishCount = allNews.filter((a: any) => classifySentiment(a.title || "") === "bullish").length;
  const bearishCount = allNews.filter((a: any) => classifySentiment(a.title || "") === "bearish").length;
  const cryptoCount = allNews.filter((a: any) => a.category === "crypto").length;
  const stocksCount = allNews.filter((a: any) => a.category === "stocks").length;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      {/* Header — clean, no icon box */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-display tracking-tight mb-1" style={{ color: "var(--cmc-text)" }}>Market News</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>{allNews.length} articles · refreshed every 5 min</p>
          {allNews.length > 0 && (
            <div className="flex items-center gap-2">
              {[
                { label: "Bullish", val: bullishCount, color: "var(--pf-up)" },
                { label: "Bearish", val: bearishCount, color: "var(--pf-down)" },
              ].map((s) => (
                <span key={s.label} className="flex items-center gap-1 text-[10px] font-bold" style={{ color: s.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />{s.val} {s.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Market Brief */}
      <AIMarketBrief />

      {allNews.length === 0 ? (
        <div className="py-16 text-center rounded-2xl" style={{ border: "1px dashed var(--cmc-border)" }}>
          <Newspaper size={32} className="mx-auto mb-3" style={{ color: "var(--cmc-neutral-4)" }} />
          <p className="text-sm" style={{ color: "var(--cmc-neutral-5)" }}>No news available at the moment.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {allNews.map((article: any, idx: number) => {
            const title = article.title || "Untitled";
            const source = article.source?.title || article.source || "Unknown";
            const url = article.url || article.link || "#";
            const date = article.published_at || article.date;
            const timeAgo = date ? getTimeAgo(new Date(date)) : "";
            const sentiment = classifySentiment(title);
            const sStyle = SENTIMENT_STYLE[sentiment];
            const thumb = article.metadata?.image || article.image || null;

            return (
              <NewsCard
                key={`${url}-${idx}`}
                article={article}
                sentiment={sentiment}
                sStyle={sStyle}
                timeAgo={timeAgo}
                thumb={thumb}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
