"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import DataTable, { type TableColumn } from "@/Components/shared/DataTable";
import type { Exchange } from "@/lib/types";
import { formatLargeValue } from "@/lib/format";

interface ExchangesTableProps {
  exchanges: Exchange[];
}

export default function ExchangesTable({ exchanges }: ExchangesTableProps) {
  const columns = useMemo<TableColumn<Exchange>[]>(
    () => [
      {
        header: "#",
        accessorKey: "trust_score_rank",
        size: 50,
        textAlign: "start" as const,
      },
      {
        header: "Exchange",
        accessorKey: "name",
        cell: ({ row }) => (
          <Link
            href={`/exchanges/${row.original.id}`}
            className="flex items-center gap-2"
          >
            <Image
              src={row.original.image}
              alt={row.original.name}
              width={24}
              height={24}
              className="rounded-full"
            />
            <span className="font-semibold text-[var(--cmc-text)] hover:text-[var(--pf-accent)]">
              {row.original.name}
            </span>
          </Link>
        ),
        size: 200,
        textAlign: "start" as const,
      },
      {
        header: "Trust Score",
        accessorKey: "trust_score",
        size: 100,
        cell: ({ getValue }) => {
          const score = getValue() as number;
          return (
            <div className="flex items-center gap-1.5">
              <div
                className="h-2.5 w-10 rounded-full"
                style={{
                  background: `linear-gradient(90deg, var(--cmc-up) ${score * 10}%, var(--cmc-neutral-2) ${score * 10}%)`,
                }}
              />
              <span className="text-xs">{score}/10</span>
            </div>
          );
        },
      },
      {
        header: "24h Volume (BTC)",
        accessorKey: "trade_volume_24h_btc",
        size: 160,
        cell: ({ getValue }) => (
          <span>{formatLargeValue(getValue() as number)} BTC</span>
        ),
      },
      {
        header: "24h Vol Normalized",
        accessorKey: "trade_volume_24h_btc_normalized",
        size: 160,
        cell: ({ getValue }) => (
          <span>{formatLargeValue(getValue() as number)} BTC</span>
        ),
      },
      {
        header: "Year",
        accessorKey: "year_established",
        size: 80,
        cell: ({ getValue }) => <span>{getValue() as number || "—"}</span>,
      },
      {
        header: "Country",
        accessorKey: "country",
        size: 150,
        cell: ({ getValue }) => <span>{(getValue() as string) || "—"}</span>,
      },
    ],
    []
  );

  return <DataTable columns={columns} data={exchanges} />;
}
