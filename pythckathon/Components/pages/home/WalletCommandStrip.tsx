"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { Wallet, PieChart, Repeat2, Flame, Sparkles, Bell, Star, ArrowRight, RefreshCw } from "lucide-react";
import { scanWalletByAddress, type WalletToken } from "@/lib/wallet-scanner";
import { fetchPythPricesBatch } from "@/lib/pyth-prices";
import { MagicCard } from "@/Components/magicui/magic-card";
import { fmtUsd } from "@/lib/format";

export default function WalletCommandStrip() {
  const { publicKey, connected } = useWallet();
  const wallet = publicKey?.toBase58() || "";
  const [totalValue, setTotalValue] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);

  const scan = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    try {
      const { solBalance, tokens } = await scanWalletByAddress(wallet);
      const symbols = [...new Set(["SOL", ...tokens.map((t: WalletToken) => t.symbol)])];
      const prices = await fetchPythPricesBatch(symbols);
      const solPrice = prices.SOL || 0;
      let total = (solBalance || 0) * solPrice;
      for (const t of tokens) {
        if (t.value && t.value > 0) total += t.value;
        else if (prices[t.symbol]) total += t.amount * prices[t.symbol];
      }
      setTotalValue(total);
      setTokenCount(tokens.length + (solBalance > 0 ? 1 : 0));
      setScanned(true);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    if (connected && wallet && !scanned) scan();
  }, [connected, wallet, scanned, scan]);

  if (!connected) return null;

  const QUICK_ACTIONS = [
    { href: "/portfolio", icon: PieChart, label: "Portfolio", color: "var(--pf-accent)" },
    { href: "/swap", icon: Repeat2, label: "Swap", color: "var(--pf-teal)" },
    { href: "/screener", icon: Flame, label: "Screener", color: "#f0b90b" },
    { href: "/new-pairs", icon: Sparkles, label: "New Pairs", color: "#67e8f9" },
    { href: "/watchlist", icon: Star, label: "Watchlist", color: "#f59e0b" },
    { href: "/alerts", icon: Bell, label: "Alerts", color: "#ea3943" },
  ];

  return (
    <MagicCard className="mx-auto max-w-[1400px] px-4 mb-4" gradientColor="rgba(153,69,255,0.04)">
      <div className="flex flex-wrap items-center gap-4 py-3 px-4">
        {/* Wallet summary */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(153,69,255,0.15)" }}>
            <Wallet size={14} style={{ color: "var(--pf-accent)" }} />
          </div>
          <div>
            <p className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>
              {wallet.slice(0, 4)}...{wallet.slice(-4)} · {tokenCount} tokens
            </p>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>
                {loading ? "..." : fmtUsd(totalValue)}
              </p>
              {!loading && (
                <button onClick={scan} className="p-0.5 rounded hover:bg-white/5" title="Refresh">
                  <RefreshCw size={9} style={{ color: "var(--cmc-neutral-5)" }} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-8" style={{ background: "var(--cmc-border)" }} />

        {/* Quick actions */}
        <div className="flex items-center gap-1 flex-wrap">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:scale-105"
              style={{ background: `${a.color}12`, color: a.color }}
            >
              <a.icon size={11} />
              {a.label}
            </Link>
          ))}
        </div>

        {/* View all link */}
        <Link href="/portfolio" className="ml-auto flex items-center gap-1 text-[10px] font-semibold transition-colors hover:opacity-80" style={{ color: "var(--pf-accent)" }}>
          View Portfolio <ArrowRight size={10} />
        </Link>
      </div>
    </MagicCard>
  );
}
