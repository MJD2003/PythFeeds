"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

const ROUTE_LABELS: Record<string, string> = {
  "": "Home",
  "token": "Token Discovery",
  "coins": "Coins",
  "stocks": "US Equities",
  "swap": "Swap",
  "portfolio": "Portfolio",
  "screener": "DEX Screener",
  "new-pairs": "Token Discovery",
  "feeds": "Pyth Feeds",
  "categories": "Categories",
  "heatmap": "Heatmap",
  "bubbles": "Bubbles",
  "gainers-losers": "Gainers & Losers",
  "news": "News",
  "fear-greed": "Fear & Greed",
  "converter": "Converter",
  "yields": "DeFi Yields",
  "analytics": "Analytics",
  "calendar": "Eco Calendar",
  "digest": "AI Digest",
  "multi-chart": "Multi-Chart",
  "correlation": "Correlation",
  "compare": "Compare",
  "polls": "Polls",
  "unlocks": "Token Unlocks",
  "alerts": "Alerts",
  "profile": "Profile",
  "ideas": "Ideas",
  "submit": "Submit Idea",
  "proposals": "Proposals",
};

// Pages deep enough to warrant breadcrumbs (2+ segments)
const DEEP_PREFIXES = ["/token/", "/coins/", "/ideas/", "/stocks"];

export default function Breadcrumbs() {
  const pathname = usePathname();

  // Only show on deep pages
  const isDeep = DEEP_PREFIXES.some((p) => pathname.startsWith(p) && pathname !== p.replace(/\/$/, ""));
  if (!isDeep) return null;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const crumbs: { label: string; href: string }[] = [{ label: "Home", href: "/" }];

  let accPath = "";
  for (let i = 0; i < segments.length; i++) {
    accPath += "/" + segments[i];
    const seg = segments[i];

    // Skip dynamic segments like chain names or addresses (show as truncated)
    if (i === segments.length - 1 && !ROUTE_LABELS[seg]) {
      // Last segment is a dynamic value (address, ID, etc.)
      const display = seg.length > 12 ? seg.slice(0, 6) + "\u2026" + seg.slice(-4) : seg;
      crumbs.push({ label: display, href: accPath });
    } else {
      const label = ROUTE_LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1);
      crumbs.push({ label, href: accPath });
    }
  }

  return (
    <nav className="flex items-center gap-1 text-[10px] font-medium mb-3 flex-wrap" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={9} style={{ color: "var(--cmc-neutral-4)" }} />}
            {isLast ? (
              <span style={{ color: "var(--cmc-text)" }}>{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="transition-colors hover:opacity-80" style={{ color: "var(--cmc-neutral-5)" }}>
                {i === 0 ? <Home size={10} /> : crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
