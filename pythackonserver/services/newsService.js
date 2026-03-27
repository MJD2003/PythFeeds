const axios = require("axios");
const RSSParser = require("rss-parser");
const { cache, CACHE_TTL } = require("../config/cache");

const rssParser = new RSSParser({ timeout: 6000 });

const FREE_RSS_FEEDS = [
  { name: "CoinDesk",      url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { name: "Decrypt",       url: "https://decrypt.co/feed" },
  { name: "The Block",     url: "https://www.theblock.co/rss.xml" },
  { name: "CryptoSlate",   url: "https://cryptoslate.com/feed/" },
  { name: "BeInCrypto",    url: "https://beincrypto.com/feed/" },
];

function timeAgo(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Fetch crypto news: CryptoPanic free token + 3 random RSS feeds in parallel
 */
async function getCryptoNews(symbols = [], limit = 20) {
  const key = `news_crypto_${symbols.sort().join(",")}_${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const results = [];

  // 1. CryptoPanic (if API key is present)
  if (process.env.CRYPTOPANIC_API_KEY) {
    try {
      let url = `https://cryptopanic.com/api/free/v1/posts/?auth_token=${process.env.CRYPTOPANIC_API_KEY}&public=true&kind=news`;
      if (symbols.length > 0) url += `&currencies=${symbols.slice(0, 3).join(",")}`;
      const { data } = await axios.get(url, { timeout: 7000 });
      if (data?.results) {
        data.results.slice(0, 12).forEach((r) => {
          results.push({
            title: r.title,
            url: r.url,
            source: r.source?.title || "CryptoPanic",
            publishedAt: r.published_at,
            timeAgo: timeAgo(r.published_at),
            content: "", // CryptoPanic doesn't provide full content in free tier
          });
        });
      }
    } catch (err) {
      console.warn("[NewsService] CryptoPanic failed:", err.message);
    }
  }

  // 2. Pick 3 random RSS feeds and fetch in parallel
  const shuffled = [...FREE_RSS_FEEDS].sort(() => Math.random() - 0.5).slice(0, 3);
  const rssResults = await Promise.allSettled(
    shuffled.map(async (feed) => {
      const parsed = await rssParser.parseURL(feed.url);
      return (parsed.items || []).slice(0, 6).map((item) => ({
        title: (item.title || "").trim(),
        url: item.link || "",
        source: feed.name,
        publishedAt: item.pubDate || item.isoDate || "",
        timeAgo: timeAgo(item.pubDate || item.isoDate || new Date().toISOString()),
        content: item.contentSnippet || item.content || item.description || "",
      })).filter((a) => a.title && a.url);
    })
  );
  for (const r of rssResults) {
    if (r.status === "fulfilled") results.push(...r.value);
  }

  // Deduplicate by title prefix, sort by date descending
  const seen = new Set();
  const deduped = results.filter((a) => {
    const k = a.title.toLowerCase().slice(0, 40);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());

  const final = deduped.slice(0, limit);
  cache.set(key, final, CACHE_TTL.NEWS);
  return final;
}

/**
 * Fetch stock news via Google News RSS
 */
async function getStockNews(ticker, limit = 10) {
  const key = `news_stock_${ticker}_${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  let articles = [];
  try {
    const feed = await rssParser.parseURL(
      `https://news.google.com/rss/search?q=${encodeURIComponent(ticker + " stock")}&hl=en-US&gl=US&ceid=US:en`
    );
    articles = (feed.items || []).slice(0, limit).map((item) => ({
      title: item.title,
      url: item.link,
      source: item.creator || item.source || "Google News",
      publishedAt: item.pubDate || item.isoDate,
      timeAgo: timeAgo(item.pubDate || item.isoDate || new Date().toISOString()),
      content: item.contentSnippet || item.content || item.description || "",
    }));
  } catch (err) {
    console.warn("[NewsService] Stock news failed:", err.message);
  }

  cache.set(key, articles, CACHE_TTL.NEWS);
  return articles;
}

module.exports = { getCryptoNews, getStockNews };
