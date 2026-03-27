import HomeContent from "@/Components/pages/home/HomeContent";
import { fetchCoins, fetchTrending } from "@/lib/api/backend";
import { mockCoins } from "@/lib/data/mock-data";

export const revalidate = 30;

export default async function Home() {
  let coins;
  let trending;
  try {
    [coins, trending] = await Promise.all([
      fetchCoins(1, 100),
      fetchTrending().catch(() => null),
    ]);
  } catch {
    coins = mockCoins;
    trending = null;
  }

  // Extract trending coin IDs for the Trending tab
  const trendingIds = new Set<string>(
    (trending?.coins || [])
      .map((t: { item?: { id?: string } }) => t.item?.id)
      .filter((id): id is string => Boolean(id))
  );

  return (
    <HomeContent initialCoins={coins as Parameters<typeof HomeContent>[0]["initialCoins"]} trendingIds={trendingIds} />
  );
}
