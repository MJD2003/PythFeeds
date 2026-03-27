import StockDetail from "@/Components/pages/stock/StockDetail";
import { fetchStockDetail, fetchStocks } from "@/lib/api/backend";
import type { StockPrice } from "@/lib/api/backend";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 30;

interface StockPageProps {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: StockPageProps): Promise<Metadata> {
  const { ticker } = await params;
  const t = ticker.toUpperCase();
  try {
    const data = await fetchStockDetail(t);
    if (!data) return { title: `${t} — PythFeeds` };
    const priceStr = data.price ? `$${data.price.toLocaleString()}` : "";
    const name = (data as any).name || t;
    return {
      title: `${name} (${t}) Stock Price ${priceStr} — PythFeeds`,
      description: `Live ${name} stock price powered by Pyth Network oracle. Real-time data, charts and market info.`,
    };
  } catch {
    return { title: `${t} Stock — PythFeeds` };
  }
}

export default async function StockPage({ params }: StockPageProps) {
  const { ticker } = await params;
  const t = ticker.toUpperCase();

  let data: StockPrice | null = null;
  let allStocks: StockPrice[] = [];
  try {
    [data, allStocks] = await Promise.all([
      fetchStockDetail(t),
      fetchStocks().catch(() => []),
    ]);
  } catch {
    notFound();
  }

  if (!data || !data.ticker) notFound();

  const stock = {
    ticker: data.ticker,
    name: data.name || t,
    price: data.price,
    change1d: data.change1d || 0,
    previousClose: data.previousClose || data.price,
    marketOpen: data.marketOpen ?? false,
    marketCap: data.marketCap || 0,
    volume: data.volume || 0,
    pe: data.pe || 0,
    eps: data.eps || 0,
    dividend: data.dividend || 0,
    beta: data.beta || 0,
    high52w: data.high52w || 0,
    low52w: data.low52w || 0,
    sector: data.sector || "",
    exchange: data.exchange || "NASDAQ",
    description: data.description || "",
    logo: data.logo || "",
    priceSource: data.source || "reference",
    source: data.source || "reference",
  };

  // Get related stocks (same sector, excluding current)
  const related = allStocks
    .filter((s) => s.ticker !== t)
    .slice(0, 5)
    .map((s) => ({
      ticker: s.ticker,
      name: s.name,
      price: s.price,
      change: s.change1d || 0,
      logo: s.logo || "",
    }));

  return <StockDetail stock={stock} relatedStocks={related} />;
}
