import Pagination from "@/Components/shared/Pagination";
import ExchangesTable from "@/Components/pages/exchanges/ExchangesTable";
import { fetchExchanges } from "@/lib/api/backend";
import { mockExchanges } from "@/lib/data/mock-data";
import ExchangesHeader from "@/Components/pages/exchanges/ExchangesHeader";

export const revalidate = 300;

export default async function ExchangesPage() {
  let exchanges;
  try {
    const raw = await fetchExchanges(1, 100);
    exchanges = raw.map((ex, i) => ({
      index: i + 1,
      id: ex.id,
      name: ex.name,
      image: ex.image || "",
      trust_score: ex.trust_score ?? 0,
      trust_score_rank: ex.trust_score_rank ?? i + 1,
      trade_volume_24h_btc: ex.trade_volume_24h_btc ?? 0,
      trade_volume_24h_btc_normalized: ex.trade_volume_24h_btc_normalized ?? 0,
      year_established: ex.year_established ?? 0,
      country: ex.country ?? "",
    }));
  } catch {
    exchanges = mockExchanges;
  }

  return (
    <>
      <ExchangesHeader exchanges={exchanges} />
      <ExchangesTable exchanges={exchanges} />
      <Pagination totalItems={exchanges.length} itemsPerPage={100} uri="/exchanges" />
    </>
  );
}
