"use client";

import { Card, CardContent } from "@/Components/ui/card";
import { LayoutGrid, TrendingUp, TrendingDown, Wifi } from "lucide-react";

interface CategoriesHeaderProps {
  totalCategories?: number;
  topGainer?: { name: string; change: number } | null;
  topLoser?: { name: string; change: number } | null;
  isLive?: boolean;
}

export default function CategoriesHeader({
  totalCategories = 0,
  topGainer = null,
  topLoser = null,
  isLive = false,
}: CategoriesHeaderProps) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-6">
      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(153,69,255,0.1)" }}>
              <LayoutGrid size={16} style={{ color: "var(--pf-accent)" }} />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--cmc-text)" }}>
              Cryptocurrency Categories
            </h1>
          </div>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: "var(--cmc-neutral-5)" }}>
            Crypto categories ranked by 24h market cap change. Each index tracks price performance of coins in that sector.
          </p>
        </div>
        {isLive && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold shrink-0" style={{ background: "rgba(22,199,132,0.1)", color: "#16c784" }}>
            <Wifi size={11} />
            Live Data
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Card className="border-0 bg-transparent" style={{ border: "1px solid var(--cmc-border)" }}>
          <CardContent className="p-3">
            <p className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Total Categories</p>
            <p className="text-lg font-bold mt-0.5" style={{ color: "var(--cmc-text)" }}>
              {totalCategories > 0 ? totalCategories : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-transparent" style={{ border: "1px solid var(--cmc-border)" }}>
          <CardContent className="p-3">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp size={10} style={{ color: "#16c784" }} />
              <p className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Top Gainer</p>
            </div>
            {topGainer ? (
              <>
                <p className="text-sm font-bold leading-tight" style={{ color: "var(--cmc-text)" }}>{topGainer.name}</p>
                <p className="text-xs font-semibold" style={{ color: "#16c784" }}>+{topGainer.change.toFixed(2)}%</p>
              </>
            ) : (
              <p className="text-sm font-bold" style={{ color: "var(--cmc-neutral-4)" }}>—</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-0 bg-transparent" style={{ border: "1px solid var(--cmc-border)" }}>
          <CardContent className="p-3">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingDown size={10} style={{ color: "#ea3943" }} />
              <p className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Top Loser</p>
            </div>
            {topLoser ? (
              <>
                <p className="text-sm font-bold leading-tight" style={{ color: "var(--cmc-text)" }}>{topLoser.name}</p>
                <p className="text-xs font-semibold" style={{ color: "#ea3943" }}>{topLoser.change.toFixed(2)}%</p>
              </>
            ) : (
              <p className="text-sm font-bold" style={{ color: "var(--cmc-neutral-4)" }}>—</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
