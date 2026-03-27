"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CircleDot,
  Flame,
  Trophy,
  LayoutGrid,
  BarChart3,
  Gem,
  Fuel,
  Banknote,
  Repeat2,
  PieChart,
  Star,
  Bell,
  ArrowLeftRight,
  Gauge,
  Calculator,
  TrendingUp,
  Sprout,
  Clock,
  Calendar,
  Fish,
  LayoutDashboard,
  Grid3x3,
  Newspaper,
  Zap,
  Unlock,
  Rocket,
} from "lucide-react";
import type { MenuCategory } from "@/lib/types";
import { useMode } from "@/lib/mode-store";

/* ── Brand SVG icons (real logos) ── */
function DiscordIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}
function XIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
function TelegramIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}
function InstagramIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 1 0 0-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 1 1-2.882 0 1.441 1.441 0 0 1 2.882 0z" />
    </svg>
  );
}

const LUCIDE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  "circle-dot": CircleDot,
  flame: Flame,
  trophy: Trophy,
  "layout-grid": LayoutGrid,
  "bar-chart-3": BarChart3,
  gem: Gem,
  fuel: Fuel,
  banknote: Banknote,
  "repeat-2": Repeat2,
  "pie-chart": PieChart,
  star: Star,
  bell: Bell,
  "arrow-left-right": ArrowLeftRight,
  gauge: Gauge,
  calculator: Calculator,
  "trending-up": TrendingUp,
  sprout: Sprout,
  clock: Clock,
  calendar: Calendar,
  fish: Fish,
  "layout-dashboard": LayoutDashboard,
  "grid-3x3": Grid3x3,
  newspaper: Newspaper,
  zap: Zap,
  unlock: Unlock,
  rocket: Rocket,
  "brand-discord": DiscordIcon,
  "brand-x": XIcon,
  "brand-telegram": TelegramIcon,
  "brand-instagram": InstagramIcon,
};

interface SubmenuProps {
  multiSubmenu: boolean;
  list: MenuCategory[];
}

export default function Submenu({ multiSubmenu, list }: SubmenuProps) {
  const mode = useMode();
  const isDegen = mode === "degen";
  const columns = multiSubmenu ? list.length : 1;

  return (
    <div
      className="invisible absolute left-1/2 top-full z-1000 -translate-x-1/2 rounded-xl p-5 opacity-0 transition-all duration-200 ease-out group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 translate-y-1"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        whiteSpace: "nowrap",
        background: "color-mix(in srgb, var(--cmc-bg) 92%, transparent)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        border: "1px solid color-mix(in srgb, var(--cmc-border) 60%, transparent)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.2), 0 0 0 1px rgba(139,92,246,0.04)",
        maxHeight: "70vh",
        overflowY: "auto",
      }}
    >
      {/* Arrow */}
      <div className="absolute -top-5 left-1/2 -translate-x-1/2 border-10 border-transparent border-b-(--cmc-bg)" />

      {list.map((section, i) => (
        <div key={i} className="mx-2 self-start">
          {section.category && (
            <p className="mb-2 ml-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--pf-accent)", opacity: 0.7 }}>
              {section.category}
            </p>
          )}
          {section.items.map((item, j) => {
            const isExternal = item.link.startsWith("http");
            const LucideIcon = item.lucideIcon ? LUCIDE_ICONS[item.lucideIcon] : null;
            const showProBadge = item.degenOnly && !isDegen;

            const content = (
              <>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors" style={{ background: "var(--cmc-neutral-2)" }}>
                  {LucideIcon ? (
                    <LucideIcon size={15} className="text-(--cmc-neutral-5)" />
                  ) : item.icon ? (
                    <Image
                      src={`/static/icons/${item.icon}`}
                      alt=""
                      width={18}
                      height={18}
                    />
                  ) : null}
                </div>
                <span style={{ opacity: showProBadge ? 0.55 : 1 }}>{item.text}</span>
                {showProBadge && (
                  <span className="ml-auto text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }} title="Switch to Degen mode to unlock">Degen</span>
                )}
              </>
            );

            const linkClasses = "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-semibold text-(--cmc-text) transition-all duration-150 hover:bg-(--cmc-neutral-1) hover:pl-3.5";

            return isExternal ? (
              <a
                key={j}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClasses}
              >
                {content}
              </a>
            ) : (
              <Link
                key={j}
                href={item.link}
                className={linkClasses}
              >
                {content}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
