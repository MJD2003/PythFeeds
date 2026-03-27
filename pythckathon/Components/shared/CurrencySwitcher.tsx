"use client";

import { useCurrency, type Currency } from "@/lib/currency-context";
import { DollarSign } from "lucide-react";

const CURRENCIES: { key: Currency; label: string; symbol: string }[] = [
  { key: "USD", label: "USD", symbol: "$" },
  { key: "EUR", label: "EUR", symbol: "€" },
  { key: "BTC", label: "BTC", symbol: "₿" },
];

export default function CurrencySwitcher() {
  const { currency, setCurrency } = useCurrency();

  return (
    <div className="flex items-center rounded-lg p-0.5" style={{ background: "var(--cmc-neutral-2)" }}>
      {CURRENCIES.map((c) => (
        <button
          key={c.key}
          onClick={() => setCurrency(c.key)}
          className="rounded-md px-2 py-1 text-[10px] font-bold transition-all"
          style={{
            background: currency === c.key ? "var(--cmc-bg)" : "transparent",
            color: currency === c.key ? "var(--cmc-text)" : "var(--cmc-neutral-5)",
            boxShadow: currency === c.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
          }}
          title={`Switch to ${c.label}`}
        >
          {c.symbol} {c.label}
        </button>
      ))}
    </div>
  );
}
