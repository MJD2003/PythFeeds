"use client";

import { useState, useEffect } from "react";
import { X, Star, PieChart, Bell, ArrowLeftRight, Newspaper, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useMenu } from "@/Components/providers/MenuProvider";
import { menuItems } from "@/lib/data/menu-items";

const QUICK_LINKS = [
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/compare", label: "Compare", icon: ArrowLeftRight },
  { href: "/news", label: "News", icon: Newspaper },
];

export default function MobileMenu() {
  const { isMenuOpen, closeMenu } = useMenu();
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    if (isMenuOpen) {
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isMenuOpen]);

  if (!visible) return null;

  const data = Object.entries(menuItems);

  const handleClose = () => {
    setAnimating(false);
    setTimeout(() => closeMenu(), 300);
  };

  return (
    <div className="fixed inset-0 z-[999] xl:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", opacity: animating ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className="absolute right-0 top-0 h-full w-[300px] overflow-y-auto p-6 shadow-2xl transition-transform duration-300 ease-out"
        style={{
          background: "var(--cmc-bg)",
          transform: animating ? "translateX(0)" : "translateX(100%)",
          borderLeft: "1px solid var(--cmc-border)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--cmc-neutral-5)" }}>Menu</span>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--cmc-neutral-2)]"
            style={{ color: "var(--cmc-text)" }}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick links */}
        <div className="mb-5 pb-5" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleClose}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-center transition-colors hover:bg-[var(--cmc-neutral-2)]"
              >
                <item.icon size={18} style={{ color: "var(--pf-accent)" }} />
                <span className="text-[10px] font-semibold" style={{ color: "var(--cmc-text)" }}>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Sections with accordion */}
        {data.map(([key, section]) => (
          <div key={key} className="mb-1">
            <button
              onClick={() => setExpandedSection(expandedSection === key ? null : key)}
              className="w-full flex items-center justify-between py-3 px-1 text-left transition-colors"
            >
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: expandedSection === key ? "var(--pf-accent)" : "var(--cmc-neutral-5)" }}>
                {key}
              </span>
              <ChevronDown
                size={14}
                className="transition-transform duration-200"
                style={{
                  color: "var(--cmc-neutral-5)",
                  transform: expandedSection === key ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>
            <div
              className="overflow-hidden transition-all duration-300 ease-out"
              style={{
                maxHeight: expandedSection === key ? "600px" : "0px",
                opacity: expandedSection === key ? 1 : 0,
              }}
            >
              <div className="pl-2 pb-3">
                {section.list.map((cat, i) => (
                  <div key={i}>
                    {cat.category && (
                      <p className="mt-2.5 mb-1 text-[10px] font-semibold uppercase" style={{ color: "var(--cmc-neutral-4)" }}>
                        {cat.category}
                      </p>
                    )}
                    {cat.items.map((item, j) => (
                      <Link
                        key={j}
                        href={item.link}
                        onClick={handleClose}
                        className="block py-2 pl-2 text-sm font-medium rounded-lg transition-colors hover:bg-[var(--cmc-neutral-2)]"
                        style={{ color: "var(--cmc-text)" }}
                      >
                        {item.text}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
