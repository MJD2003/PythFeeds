"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { Card, CardContent } from "@/Components/ui/card";

const TABS = ["Spot", "Derivatives", "DEX", "Lending"] as const;

interface ExchangesHeaderProps {
  exchanges?: { trust_score: number; trade_volume_24h_btc: number; name: string }[];
}

export default function ExchangesHeader({ exchanges = [] }: ExchangesHeaderProps) {
  const [activeTab, setActiveTab] = useState<string>("Spot");
  const totalVol = exchanges.reduce((s, e) => s + (e.trade_volume_24h_btc || 0), 0);
  const avgTrust = exchanges.length > 0 ? (exchanges.reduce((s, e) => s + (e.trust_score || 0), 0) / exchanges.length) : 0;
  const topExchange = exchanges.length > 0 ? exchanges[0].name : "—";

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto" style={{ borderColor: "var(--cmc-border)" }}>
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}
              className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-semibold data-[state=active]:border-[var(--pf-accent)] data-[state=active]:text-[var(--pf-accent)] data-[state=active]:shadow-none"
              style={{ color: "var(--cmc-neutral-5)" }}
            >{tab}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <h1 className="mt-4 text-2xl font-bold" style={{ color: "var(--cmc-text)" }}>
        Top Cryptocurrency Spot Exchanges
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--cmc-text-sub)" }}>
        CryptoServe ranks and scores exchanges based on traffic, liquidity, trading volumes, and confidence in the legitimacy of trading volumes reported.
      </p>

      {/* Summary stats */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card className="border-[var(--cmc-border)] bg-transparent">
          <CardContent className="p-3">
            <p className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Total Exchanges</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: "var(--cmc-text)" }}>{exchanges.length || "—"}</p>
          </CardContent>
        </Card>
        <Card className="border-[var(--cmc-border)] bg-transparent">
          <CardContent className="p-3">
            <p className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>24h Total Volume</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: "var(--cmc-text)" }}>{totalVol > 0 ? `${(totalVol).toLocaleString(undefined, { maximumFractionDigits: 0 })} BTC` : "—"}</p>
          </CardContent>
        </Card>
        <Card className="border-[var(--cmc-border)] bg-transparent">
          <CardContent className="p-3">
            <p className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Top by Volume</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: "var(--pf-accent)" }}>{topExchange}</p>
          </CardContent>
        </Card>
        <Card className="border-[var(--cmc-border)] bg-transparent">
          <CardContent className="p-3">
            <p className="text-[10px] font-medium" style={{ color: "var(--cmc-neutral-5)" }}>Avg Trust Score</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: "#16c784" }}>{avgTrust > 0 ? `${avgTrust.toFixed(1)}/10` : "—"}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
