"use client";

import Image from "next/image";
import type { Category } from "@/lib/types";

interface CategoriesTableProps {
  categories: Category[];
}

function PctCell({ value }: { value: number }) {
  if (value === null || value === undefined) return <span className="text-[var(--cmc-neutral-5)]">—</span>;
  const up = value >= 0;
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap" style={{ color: up ? "var(--cmc-up)" : "var(--cmc-down)" }}>
      {up ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function fmtLargeNum(n: number): string {
  if (!n || n === 0) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

export default function CategoriesTable({ categories }: CategoriesTableProps) {
  return (
    <div className="mx-auto max-w-[1400px] px-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--cmc-border)]">
              <th className="sticky top-0 z-10 bg-[var(--cmc-bg)] px-2.5 py-3 text-left text-xs font-semibold text-[var(--cmc-neutral-5)]">#</th>
              <th className="sticky top-0 z-10 bg-[var(--cmc-bg)] px-2.5 py-3 text-left text-xs font-semibold text-[var(--cmc-neutral-5)] min-w-[200px]">Name</th>
              <th className="sticky top-0 z-10 bg-[var(--cmc-bg)] px-2.5 py-3 text-center text-xs font-semibold text-[var(--cmc-neutral-5)]">Top Coins</th>
              <th className="sticky top-0 z-10 bg-[var(--cmc-bg)] px-2.5 py-3 text-right text-xs font-semibold text-[var(--cmc-neutral-5)]">24h Change</th>
              <th className="sticky top-0 z-10 bg-[var(--cmc-bg)] px-2.5 py-3 text-right text-xs font-semibold text-[var(--cmc-neutral-5)]">Market Cap</th>
              <th className="sticky top-0 z-10 bg-[var(--cmc-bg)] px-2.5 py-3 text-right text-xs font-semibold text-[var(--cmc-neutral-5)]">Volume (24h)</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr
                key={cat.id}
                className="border-b border-[var(--cmc-border)] transition-colors hover:bg-[var(--cmc-neutral-1)]"
              >
                {/* # */}
                <td className="px-2.5 py-4 text-[var(--cmc-text-sub)]">{cat.index}</td>

                {/* Name */}
                <td className="px-2.5 py-4">
                  <span className="font-semibold text-[var(--cmc-text)]">
                    {cat.name}
                  </span>
                </td>

                {/* Top 3 Coins */}
                <td className="px-2.5 py-4">
                  <div className="flex justify-center -space-x-1.5">
                    {(cat.top_3_coins || []).slice(0, 3).map((url, i) => (
                      <Image
                        key={i}
                        src={url}
                        alt=""
                        width={22}
                        height={22}
                        className="rounded-full border-2 border-[var(--cmc-bg)]"
                      />
                    ))}
                  </div>
                </td>

                {/* 24h Change */}
                <td className="px-2.5 py-4 text-right text-xs font-semibold">
                  <PctCell value={cat.market_cap_change_24h} />
                </td>

                {/* Market Cap */}
                <td className="px-2.5 py-4 text-right">
                  <span className="font-medium text-[var(--cmc-text)]">
                    {fmtLargeNum(cat.market_cap)}
                  </span>
                </td>

                {/* Volume */}
                <td className="px-2.5 py-4 text-right">
                  <span className="font-medium text-[var(--cmc-text)]">
                    {fmtLargeNum(cat.volume_24h)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
