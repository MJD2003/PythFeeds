"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  PieChart,
  LayoutDashboard,
  Grid3x3,
  ArrowLeftRight,
  Gauge,
  Calculator,
  Sprout,
  BarChart3,
  Calendar,
  Zap,
  Unlock,
  Flame,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Activity,
} from "lucide-react";
import { useIsDegen } from "@/lib/mode-store";
import { fetchPythPricesBatch } from "@/lib/pyth-prices";

const TOOLS = [
  { icon: PieChart, label: "Portfolio", href: "/portfolio", group: "trading" },
  { icon: LayoutDashboard, label: "Multi-Chart", href: "/multi-chart", group: "analytics" },
  { icon: Grid3x3, label: "Correlation", href: "/correlation", group: "analytics" },
  { icon: ArrowLeftRight, label: "Compare", href: "/compare", group: "analytics" },
  { icon: BarChart3, label: "Analytics", href: "/analytics", group: "analytics" },
  { icon: Gauge, label: "Fear & Greed", href: "/fear-greed", group: "defi" },
  { icon: Calculator, label: "Converter", href: "/converter", group: "defi" },
  { icon: Sprout, label: "DeFi Yields", href: "/yields", group: "defi" },
  { icon: Calendar, label: "Calendar", href: "/calendar", group: "defi" },
  { icon: Zap, label: "AI Digest", href: "/digest", group: "social" },
  { icon: Flame, label: "Polls", href: "/polls", group: "social" },
  { icon: Unlock, label: "Unlocks", href: "/unlocks", group: "social" },
];

const GROUP_COLORS: Record<string, string> = {
  trading: "var(--pf-accent)",
  analytics: "var(--pf-info)",
  defi: "var(--pf-up)",
  social: "var(--pf-warning)",
};

export default function DegenToolbar() {
  const isDegen = useIsDegen();
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [canScrollL, setCanScrollL] = useState(false);
  const [canScrollR, setCanScrollR] = useState(false);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [solChange, setSolChange] = useState<number | null>(null);
  const prevSolRef = useRef<number | null>(null);

  // Live SOL price
  const fetchSolPrice = useCallback(async () => {
    try {
      const prices = await fetchPythPricesBatch(["SOL"]);
      const p = prices["SOL"];
      if (p) {
        if (prevSolRef.current !== null) {
          setSolChange(((p - prevSolRef.current) / prevSolRef.current) * 100);
        }
        prevSolRef.current = p;
        setSolPrice(p);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!isDegen) return;
    fetchSolPrice();
    const iv = setInterval(fetchSolPrice, 15000);
    return () => clearInterval(iv);
  }, [isDegen, fetchSolPrice]);

  // Track page scroll to collapse toolbar when navbar becomes pill
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Track horizontal scroll state for arrow buttons
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      setCanScrollL(el.scrollLeft > 4);
      setCanScrollR(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", check); ro.disconnect(); };
  }, [isDegen]);

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });
  };

  if (!isDegen) return null;

  return (
    <div
      className="hidden xl:block transition-all duration-300 ease-out overflow-hidden"
      style={{
        maxHeight: scrolled ? 0 : 36,
        opacity: scrolled ? 0 : 1,
        borderBottom: scrolled ? "none" : "1px solid var(--cmc-border)",
        background: "var(--cmc-bg)",
      }}
    >
      <div className="relative mx-auto max-w-[1400px] w-full px-4">
        {/* Left fade + arrow */}
        {canScrollL && (
          <button
            onClick={() => scroll(-1)}
            className="absolute left-0 top-0 bottom-0 z-10 flex items-center pl-1 pr-3"
            style={{ background: "linear-gradient(90deg, var(--cmc-bg) 60%, transparent)" }}
          >
            <ChevronLeft size={12} style={{ color: "var(--cmc-neutral-5)" }} />
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide"
          style={{ height: 35 }}
        >
          {/* Live data strip */}
          <div className="flex items-center gap-2 pr-2 mr-1 shrink-0" style={{ borderRight: "1px solid var(--cmc-border)" }}>
            {solPrice !== null && (
              <div className="flex items-center gap-1 text-[10px] font-bold tabular-nums">
                <TrendingUp size={9} style={{ color: "var(--pf-accent)" }} />
                <span style={{ color: "var(--cmc-text)" }}>SOL ${solPrice.toFixed(2)}</span>
                {solChange !== null && solChange !== 0 && (
                  <span style={{ color: solChange > 0 ? "#16c784" : "#ea3943" }}>
                    {solChange > 0 ? "+" : ""}{solChange.toFixed(2)}%
                  </span>
                )}
              </div>
            )}
            <Link href="/swap" className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold transition-all hover:brightness-125" style={{ background: "rgba(22,199,132,0.15)", color: "#16c784" }}>
              <Activity size={8} /> Swap
            </Link>
          </div>

          {TOOLS.map((tool) => {
            const baseHref = tool.href.split("?")[0];
            const isActive = pathname === baseHref;
            const groupColor = GROUP_COLORS[tool.group];

            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold shrink-0 transition-all hover:bg-white/5 active:scale-95"
                style={{
                  color: isActive ? groupColor : "var(--cmc-neutral-5)",
                  background: isActive ? `color-mix(in srgb, ${groupColor} 10%, transparent)` : "transparent",
                }}
                title={tool.label}
              >
                <tool.icon size={11} />
                <span className="hidden 2xl:inline">{tool.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full" style={{ background: groupColor }} />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right fade + arrow */}
        {canScrollR && (
          <button
            onClick={() => scroll(1)}
            className="absolute right-0 top-0 bottom-0 z-10 flex items-center pr-1 pl-3"
            style={{ background: "linear-gradient(270deg, var(--cmc-bg) 60%, transparent)" }}
          >
            <ChevronRight size={12} style={{ color: "var(--cmc-neutral-5)" }} />
          </button>
        )}
      </div>
    </div>
  );
}
