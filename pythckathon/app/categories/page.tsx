import CategoriesTable from "@/Components/pages/categories/CategoriesTable";
import { mockCategories } from "@/lib/data/mock-data";
import CategoriesHeader from "@/Components/pages/categories/CategoriesHeader";

export const metadata = {
  title: "Cryptocurrency Categories | PythFeeds",
  description: "Browse all cryptocurrency categories by market cap, volume and 24h performance",
};

export const revalidate = 120;

async function fetchCategories() {
  try {
    const base = process.env.BACKEND_URL || "http://localhost:4000";
    const res = await fetch(`${base}/api/coins/categories`, {
      next: { revalidate: 120 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Categories API ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    // CoinGecko returns: id, name, market_cap, market_cap_change_24h, top_3_coins (array of image urls), volume_24h, content
    return data.map((cat: any, idx: number) => {
      const top3Images: string[] = Array.isArray(cat.top_3_coins)
        ? cat.top_3_coins.filter((u: any) => typeof u === "string")
        : [];
      return {
        id: cat.id || `cat-${idx}`,
        name: cat.name || "Unknown",
        market_cap: cat.market_cap || 0,
        market_cap_change_24h: cat.market_cap_change_24h ?? 0,
        volume_24h: cat.volume_24h || 0,
        volume_btc: 0,
        dominance: 0,
        index: idx + 1,
        top_3_coins: top3Images,
        topGainer: {
          name: "",
          symbol: "",
          image: top3Images[0] || "",
          change: cat.market_cap_change_24h ?? 0,
          top3Images,
        },
        gainers: 0,
        losers: 0,
        content: cat.content || "",
      };
    });
  } catch (err) {
    console.error("[Categories] fetch failed:", err);
    return null;
  }
}

export default async function CategoriesPage() {
  const categories = await fetchCategories();
  const data = categories || mockCategories;

  const topGainerCat = [...data].sort((a, b) => b.market_cap_change_24h - a.market_cap_change_24h)[0];
  const topLoserCat = [...data].sort((a, b) => a.market_cap_change_24h - b.market_cap_change_24h)[0];

  return (
    <>
      <CategoriesHeader
        totalCategories={data.length}
        topGainer={topGainerCat ? { name: topGainerCat.name, change: topGainerCat.market_cap_change_24h } : null}
        topLoser={topLoserCat ? { name: topLoserCat.name, change: topLoserCat.market_cap_change_24h } : null}
        isLive={!!categories}
      />
      <div className="mt-4">
        <CategoriesTable categories={data} />
      </div>
    </>
  );
}
