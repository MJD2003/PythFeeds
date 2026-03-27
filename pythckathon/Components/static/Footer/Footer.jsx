"use client";

import Image from "next/image";
import { footerItems } from "@/lib/data/footer-items";
import GasTracker from "@/Components/shared/GasTracker";
import { useIsDarkMode } from "@/lib/theme-client";

export default function Footer() {
  const sections = Object.entries(footerItems);
  const isDark = useIsDarkMode();

  return (
    <footer className="relative" style={{ borderTop: "1px solid var(--cmc-border)" }}>
      {/* Subtle gradient wash at top */}
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--pf-accent), var(--pf-up), transparent)" }} />
      <div className="mx-auto max-w-[1400px] px-4 pt-10 pb-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
          {/* Logo + description */}
          <div>
            <Image src={isDark ? "/dark-mode-pythfeeds.png" : "/light-mode-pythfeeds.png"} alt="PythFeeds" width={180} height={50} className="object-contain" style={{ height: 44 }} />
            <p className="mt-3 max-w-xs text-xs leading-relaxed" style={{ color: "var(--cmc-neutral-5)" }}>
              Real-time prices for crypto, stocks, metals, commodities &amp; forex — powered by Pyth Network oracle data.
            </p>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {sections.map(([category, links]) => (
              <div key={category}>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--pf-accent)" }}>
                  {category}
                </p>
                <ul className="space-y-2">
                  {links.map((item, i) => (
                    <li key={i}>
                      <a
                        href={item.url || "#"}
                        className="text-xs transition-colors duration-200"
                        style={{ color: "var(--cmc-neutral-5)" }}
                        onMouseEnter={(e) => e.currentTarget.style.color = "var(--cmc-text)"}
                        onMouseLeave={(e) => e.currentTarget.style.color = "var(--cmc-neutral-5)"}
                      >
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Copyright + Gas Tracker */}
        <div className="gradient-divider mt-8 mb-4" />
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>
            {new Date().getFullYear()} PythFeeds. All rights reserved. Data powered by <span style={{ color: "var(--pf-accent)", fontWeight: 600 }}>Pyth Network</span>.
          </p>
          <GasTracker />
        </div>
      </div>
    </footer>
  );
}