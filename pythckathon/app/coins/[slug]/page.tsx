import CoinDetail from "@/Components/pages/coin/CoinDetail";
import { fetchCoinDetail, fetchTrending } from "@/lib/api/backend";
import type { CoinDetailResponse } from "@/lib/api/backend";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 30;

interface CoinPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CoinPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const raw = await fetchCoinDetail(slug);
    if (!raw) return { title: "Coin Not Found — PythFeeds" };
    const price = raw.market_data?.current_price?.usd;
    const priceStr = price ? `$${price.toLocaleString()}` : "";
    return {
      title: `${raw.name} (${raw.symbol?.toUpperCase()}) Price ${priceStr} — PythFeeds`,
      description: `Live ${raw.name} price, market cap, volume, chart and stats. Powered by Pyth Network oracle data.`,
    };
  } catch {
    return { title: `${slug} — PythFeeds` };
  }
}

function mapDetailToInfo(raw: CoinDetailResponse) {
  const md = raw.market_data;
  return {
    id: raw.id,
    name: raw.name,
    symbol: raw.symbol,
    image: raw.image || { small: "" },
    market_cap_rank: (raw as any).market_cap_rank || 0,
    links: {
      homepage: raw.links?.homepage || [],
      repos_url: { github: (raw.links as any)?.repos_url?.github || [] },
      blockchain_site: raw.links?.blockchain_site || [],
      official_forum_url: (raw.links as any)?.official_forum_url || [],
      subreddit_url: (raw.links as any)?.subreddit_url || "",
    },
    market_data: {
      current_price: { usd: md?.current_price?.usd || 0, btc: 0, eth: 0 },
      price_change_percentage_24h_in_currency: { btc: 0, eth: 0 },
      price_change_percentage_24h: md?.price_change_percentage_24h || 0,
      price_change_percentage_7d: md?.price_change_percentage_7d || 0,
      price_change_percentage_30d: md?.price_change_percentage_30d || 0,
      low_24h: { usd: md?.low_24h?.usd || 0 },
      high_24h: { usd: md?.high_24h?.usd || 0 },
      market_cap: { usd: md?.market_cap?.usd || 0 },
      fully_diluted_valuation: { usd: md?.fully_diluted_valuation?.usd || 0 },
      total_volume: { usd: md?.total_volume?.usd || 0 },
      circulating_supply: md?.circulating_supply || 0,
      total_supply: md?.total_supply || null,
      max_supply: md?.max_supply || null,
      ath: { usd: md?.ath?.usd || 0 },
      atl: { usd: md?.atl?.usd || 0 },
      sparkline_7d: md?.sparkline_7d || { price: [] },
    },
    description: raw.description?.en || "",
    genesis_date: raw.genesis_date || null,
    price_source: raw.price_source || "coingecko",
    pyth_price: raw.pyth_price,
    pyth_confidence: raw.pyth_confidence,
    // Pass raw links for better link resolution
    _raw_links: raw.links,
  };
}

export default async function CoinPage({ params }: CoinPageProps) {
  const { slug } = await params;

  let raw: CoinDetailResponse | null = null;
  try {
    raw = await fetchCoinDetail(slug);
  } catch {
    // backend unavailable
  }

  if (!raw) {
    notFound();
  }

  const info = mapDetailToInfo(raw);

  // Fetch trending coins for the related section
  let trending: { coins: { item: { id: string; name: string; symbol: string; thumb: string; market_cap_rank: number } }[] } | null = null;
  try {
    trending = await fetchTrending();
  } catch { /* ignore */ }

  return <CoinDetail info={info as any} trendingCoins={trending?.coins?.slice(0, 5) || []} />;
}
