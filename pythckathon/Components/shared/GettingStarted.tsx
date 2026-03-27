"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, ArrowLeftRight, PieChart, Radio, Zap, Sparkles } from "lucide-react";
import { useMode } from "@/lib/mode-store";

const LS_KEY = "pythfeeds_getting_started_dismissed";

const QUICK_ACTIONS = [
  { icon: ArrowLeftRight, label: "Swap", href: "/swap", color: "#16c784", desc: "Trade any Solana token" },
  { icon: PieChart, label: "Portfolio", href: "/portfolio", color: "#8b5cf6", desc: "Track your holdings" },
  { icon: Radio, label: "Pyth Feeds", href: "/feeds", color: "#6366f1", desc: "Real-time oracle prices" },
  { icon: Zap, label: "AI Digest", href: "/digest", color: "#f59e0b", desc: "AI-powered market insights" },
];

export default function GettingStarted() {
  const mode = useMode();
  const [dismissed, setDismissed] = useState(true); // default hidden to avoid flash

  useEffect(() => {
    const wasDismissed = localStorage.getItem(LS_KEY);
    if (!wasDismissed) setDismissed(false);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem(LS_KEY, "1");
  };

  // Only show in Standard mode, only for first-time visitors
  if (dismissed || mode === "degen") return null;

  return (
    <div className="relative rounded-2xl overflow-hidden mb-8" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08), rgba(22,199,132,0.06))", border: "1px solid rgba(139,92,246,0.15)" }}>
      {/* Dismiss */}
      <button onClick={dismiss} className="absolute top-3 right-3 p-1.5 rounded-lg transition-colors hover:bg-white/10 z-10" aria-label="Dismiss">
        <X size={14} style={{ color: "var(--cmc-neutral-5)" }} />
      </button>

      <div className="px-6 py-5">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-1">
          <Sparkles size={16} style={{ color: "#8b5cf6" }} />
          <h2 className="text-base font-bold" style={{ color: "var(--cmc-text)" }}>Welcome to PythFeeds</h2>
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--cmc-neutral-5)" }}>
          Real-time crypto prices, DeFi analytics, and Solana trading — all powered by Pyth Network oracles.
        </p>

        {/* Quick action cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="flex flex-col gap-2 p-3 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-md group"
                style={{ background: "color-mix(in srgb, var(--cmc-bg) 70%, transparent)", border: "1px solid var(--cmc-border)" }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${action.color}15` }}>
                    <Icon size={14} style={{ color: action.color }} />
                  </div>
                  <span className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>{action.label}</span>
                </div>
                <span className="text-[10px] leading-snug" style={{ color: "var(--cmc-neutral-5)" }}>{action.desc}</span>
              </Link>
            );
          })}
        </div>

        {/* Mode hint */}
        <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>
          <span>Tip: Switch to</span>
          <span className="font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>Degen Mode</span>
          <span>for advanced trading tools, multi-chart, and analytics.</span>
        </div>
      </div>
    </div>
  );
}
