import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Globe, Shield, Calendar, MapPin, BarChart3 } from "lucide-react";

export const revalidate = 300;

async function fetchExchangeDetail(id: string) {
  const base = process.env.BACKEND_URL || "http://localhost:4000";
  try {
    const res = await fetch(`${base}/api/coins/exchanges/${id}`, { next: { revalidate: 300 } });
    if (res.ok) return res.json();
  } catch {}
  // Fallback: fetch from CoinGecko directly
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/exchanges/${id}`, { next: { revalidate: 300 } });
    if (res.ok) return res.json();
  } catch {}
  return null;
}

function fmtBtc(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K BTC`;
  return `${n.toFixed(1)} BTC`;
}

export default async function ExchangeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchExchangeDetail(id);

  if (!data) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-12 text-center">
        <p className="text-sm" style={{ color: "var(--cmc-neutral-5)" }}>Exchange not found.</p>
        <Link href="/exchanges" className="text-xs mt-3 inline-block" style={{ color: "var(--pf-accent)" }}>← Back to Exchanges</Link>
      </div>
    );
  }

  const trustColor = (data.trust_score ?? 0) >= 8 ? "#16c784" : (data.trust_score ?? 0) >= 5 ? "#f59e0b" : "#ea3943";

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6">
      {/* Back link */}
      <Link href="/exchanges" className="inline-flex items-center gap-1 text-xs font-medium mb-5 transition-colors hover:opacity-80" style={{ color: "var(--cmc-neutral-5)" }}>
        <ArrowLeft size={12} /> Back to Exchanges
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        {data.image && (
          <Image src={data.image} alt={data.name} width={48} height={48} className="rounded-xl" />
        )}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--cmc-text)" }}>{data.name}</h1>
          {data.url && (
            <a href={data.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] mt-0.5 transition-colors hover:opacity-80" style={{ color: "var(--pf-accent)" }}>
              <Globe size={10} /> {new URL(data.url).hostname}
            </a>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        {/* Trust Score */}
        <div className="rounded-xl p-4" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Shield size={12} style={{ color: trustColor }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Trust Score</span>
          </div>
          <p className="text-xl font-bold" style={{ color: trustColor }}>{data.trust_score ?? "N/A"}<span className="text-xs font-normal" style={{ color: "var(--cmc-neutral-5)" }}>/10</span></p>
        </div>

        {/* Trust Rank */}
        <div className="rounded-xl p-4" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <BarChart3 size={12} style={{ color: "var(--pf-accent)" }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Rank</span>
          </div>
          <p className="text-xl font-bold" style={{ color: "var(--cmc-text)" }}>#{data.trust_score_rank ?? "—"}</p>
        </div>

        {/* 24h Volume */}
        <div className="rounded-xl p-4" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <BarChart3 size={12} style={{ color: "#f7931a" }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>24h Volume</span>
          </div>
          <p className="text-xl font-bold tabular-nums" style={{ color: "var(--cmc-text)" }}>
            {data.trade_volume_24h_btc ? fmtBtc(data.trade_volume_24h_btc) : "—"}
          </p>
        </div>

        {/* Country */}
        <div className="rounded-xl p-4" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <MapPin size={12} style={{ color: "var(--pf-accent)" }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Country</span>
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--cmc-text)" }}>{data.country || "Unknown"}</p>
        </div>
      </div>

      {/* Additional info */}
      <div className="rounded-xl p-4" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--cmc-neutral-5)" }}>Details</p>
        <div className="space-y-2">
          {data.year_established && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
                <Calendar size={11} /> Year Established
              </span>
              <span className="text-xs font-semibold" style={{ color: "var(--cmc-text)" }}>{data.year_established}</span>
            </div>
          )}
          {data.has_trading_incentive !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>Trading Incentive</span>
              <span className="text-xs font-semibold" style={{ color: data.has_trading_incentive ? "#16c784" : "var(--cmc-neutral-5)" }}>
                {data.has_trading_incentive ? "Yes" : "No"}
              </span>
            </div>
          )}
          {data.centralized !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>Type</span>
              <span className="text-xs font-semibold" style={{ color: "var(--cmc-text)" }}>
                {data.centralized ? "Centralized" : "Decentralized"}
              </span>
            </div>
          )}
          {data.trade_volume_24h_btc_normalized && (
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>Normalized Volume (24h)</span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--cmc-text)" }}>
                {fmtBtc(data.trade_volume_24h_btc_normalized)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {data.description && (
        <div className="mt-4 rounded-xl p-4" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--cmc-neutral-5)" }}>About</p>
          <p className="text-xs leading-relaxed line-clamp-6" style={{ color: "var(--cmc-text)" }}>{data.description}</p>
        </div>
      )}
    </div>
  );
}
