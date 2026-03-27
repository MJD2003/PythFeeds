"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Radio, Repeat2, PieChart, MoreHorizontal, Flame, Rocket, LayoutGrid, Eye, Bell, Newspaper, GitCompare, BarChart3, Calendar, Zap, Sprout, Map } from "lucide-react";
import { useState } from "react";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/feeds", label: "Feeds", icon: Radio },
  { href: "/swap", label: "Swap", icon: Repeat2 },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
];

const MORE_LINKS = [
  { href: "/screener", label: "DEX Screener", icon: Flame },
  { href: "/new-pairs", label: "Token Discovery", icon: Rocket },
  { href: "/stocks", label: "US Equities", icon: BarChart3 },
  { href: "/heatmap", label: "Heatmap", icon: Map },
  { href: "/categories", label: "Categories", icon: LayoutGrid },
  { href: "/watchlist", label: "Watchlist", icon: Eye },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/digest", label: "AI Digest", icon: Zap },
  { href: "/yields", label: "DeFi Yields", icon: Sprout },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/compare", label: "Compare", icon: GitCompare },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <>
      {/* Spacer so content isn't hidden behind the bar */}
      <div className="h-16 xl:hidden" />

      {/* More popup */}
      {moreOpen && (
        <div className="fixed inset-0 z-998 xl:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute bottom-16 right-3 rounded-xl p-2 shadow-xl min-w-[160px]"
            style={{ background: "var(--cmc-bg)", border: "1px solid var(--cmc-border)", minWidth: 280 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-2 gap-0.5">
              {MORE_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    color: isActive(l.href) ? "var(--cmc-text)" : "var(--cmc-neutral-5)",
                    background: isActive(l.href) ? "var(--cmc-neutral-2)" : "transparent",
                  }}
                >
                  <l.icon size={13} />
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-997 xl:hidden flex items-center justify-around"
        style={{
          height: 60,
          background: "color-mix(in srgb, var(--cmc-bg) 88%, transparent)",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          borderTop: "1px solid color-mix(in srgb, var(--cmc-border) 50%, transparent)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 transition-all duration-200"
              style={{ color: active ? "var(--pf-accent)" : "var(--cmc-neutral-5)" }}
            >
              <div
                className="flex items-center justify-center rounded-xl w-10 h-7 transition-all duration-200"
                style={{ background: active ? "var(--pf-accent-muted)" : "transparent" }}
              >
                <tab.icon size={18} strokeWidth={active ? 2.5 : 1.5} />
              </div>
              <span className="text-[9px] font-semibold">{tab.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen((p) => !p)}
          className="relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 transition-all duration-200"
          style={{
            color: moreOpen
              ? "var(--pf-accent)"
              : MORE_LINKS.some((l) => isActive(l.href))
                ? "var(--pf-accent)"
                : "var(--cmc-neutral-5)",
          }}
        >
          <div
            className="flex items-center justify-center rounded-xl w-10 h-7 transition-all duration-200"
            style={{
              background: moreOpen || MORE_LINKS.some((l) => isActive(l.href)) ? "var(--pf-accent-muted)" : "transparent",
            }}
          >
            <MoreHorizontal size={18} strokeWidth={1.5} />
          </div>
          <span className="text-[9px] font-semibold">More</span>
        </button>
      </nav>
    </>
  );
}
