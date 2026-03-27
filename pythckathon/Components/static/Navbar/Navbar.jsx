"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Menu, Search, Sun, Moon, Star, PieChart, Bell, ArrowLeftRight, Grid3X3, Flame, X, Repeat2, Radio } from "lucide-react";
import { useIsDarkMode, setLightDarkMode } from "@/lib/theme-client";
import { menuItems } from "@/lib/data/menu-items";
import { useMenu } from "@/Components/providers/MenuProvider";
import Submenu from "./Submenu";
import GlobalSearch from "@/Components/shared/GlobalSearch";
import WalletButton from "@/Components/shared/WalletButton";
import TrendingSidebar from "@/Components/shared/TrendingSidebar";
import NotificationCenter from "@/Components/shared/NotificationCenter";
import CurrencySwitcher from "@/Components/shared/CurrencySwitcher";
import DegenToggle from "@/Components/shared/DegenToggle";
import { useMode, toggleMode } from "@/lib/mode-store";

export default function Navbar() {
  const { toggleMenu } = useMenu();
  const mode = useMode();
  const isDegen = mode === "degen";
  const isDark = useIsDarkMode();
  const data = Object.entries(menuItems);
  const innerRef = useRef(null);
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [trendingOpen, setTrendingOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check if a menu section contains the current route
  const isSectionActive = (section) => {
    return section.list.some((cat) =>
      cat.items.some((item) => {
        if (item.link.startsWith("http")) return false;
        const link = item.link.split("?")[0];
        if (link === "/") return pathname === "/";
        return pathname === link || pathname.startsWith(link + "/");
      })
    );
  };

  const toggleTheme = useCallback(() => {
    setLightDarkMode(isDark ? "light" : "dark");
  }, [isDark]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Global keyboard shortcuts: K = search, D = dark mode toggle, M = mode toggle
  useEffect(() => {
    const handler = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        document.querySelector("[data-global-search-input]")?.focus();
      }
      if (e.key === "d" || e.key === "D") {
        toggleTheme();
      }
      if (e.key === "m" || e.key === "M") {
        toggleMode();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleTheme]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const navFontSize = scrolled ? 11.5 : 13;
  const navHeight = scrolled ? 40 : 52;
  const iconSize = scrolled ? 12 : 14;
  const btnSize = scrolled ? "h-7 w-7" : "h-8 w-8";

  return (
    <>
      <div style={{ height: 76 }} />

      {/* Outer nav */}
      <nav
        className="fixed left-0 right-0 w-full z-999 flex justify-center transition-[padding,top] duration-300 ease-out"
        style={{ top: 24, paddingTop: scrolled ? 8 : 0, paddingLeft: scrolled ? 0 : undefined, paddingRight: scrolled ? 0 : undefined }}
      >
        {/* Inner container — CSS transitions replace GSAP */}
        <div
          ref={innerRef}
          className="relative flex items-center overflow-visible transition-all duration-400 ease-out"
          style={{
            maxWidth: scrolled ? "90%" : "100%",
            width: "100%",
            borderRadius: scrolled ? 9999 : 0,
            padding: scrolled ? "0 16px" : "0 24px",
            height: scrolled ? 40 : 52,
            background: scrolled
              ? "color-mix(in srgb, var(--cmc-bg) 82%, transparent)"
              : "var(--cmc-bg)",
            backdropFilter: scrolled ? "blur(24px) saturate(1.6)" : "none",
            WebkitBackdropFilter: scrolled ? "blur(24px) saturate(1.6)" : "none",
            border: scrolled
              ? "1px solid color-mix(in srgb, var(--cmc-border) 40%, transparent)"
              : "none",
            borderBottom: scrolled ? undefined : "1px solid var(--cmc-border)",
            boxShadow: scrolled
              ? "0 4px 32px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.08)"
              : "none",
          }}
        >
          {/* Logo */}
          <Link href="/" className="shrink-0 mr-2">
            <Image
              src={isDark ? "/dark-mode-pythfeeds.png" : "/light-mode-pythfeeds.png"}
              alt="PythFeeds"
              width={150}
              height={42}
              className="transition-all duration-300 object-contain"
              style={{ width: scrolled ? 92 : 120, height: scrolled ? 26 : 34 }}
              priority
            />
          </Link>

          {/* Desktop Menu — centered */}
          <ul className="hidden xl:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2" style={{ fontSize: navFontSize }}>
            {data.map(([key, section]) => {
              const active = isSectionActive(section);
              return (
                <li key={key} className="group relative">
                  <span
                    className="flex cursor-pointer items-center font-semibold capitalize transition-all duration-200 px-3 rounded-lg hover:opacity-80"
                    style={{
                      minHeight: navHeight,
                      color: active ? "var(--cmc-text)" : "var(--cmc-neutral-5)",
                    }}
                  >
                    {key}
                    {active && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-[2px] w-4 rounded-full" style={{ background: "var(--cmc-text)" }} />
                    )}
                  </span>
                  <Submenu multiSubmenu={section.multiSubmenu} list={section.list} />
                </li>
              );
            })}
            <li>
              <Link
                href="/feeds"
                className="flex items-center gap-1.5 font-semibold transition-all duration-200 px-3 rounded-lg hover:opacity-80 relative"
                style={{
                  minHeight: navHeight,
                  color: pathname === "/feeds" ? "var(--cmc-text)" : "var(--cmc-neutral-5)",
                }}
              >
                <Radio size={iconSize} style={{ color: pathname === "/feeds" ? "var(--pf-accent)" : undefined }} />
                Feeds
                {pathname === "/feeds" && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-[2px] w-4 rounded-full" style={{ background: "var(--pf-accent)" }} />
                )}
              </Link>
            </li>
            <li>
              <Link
                href="/swap"
                className="flex items-center gap-1.5 font-semibold transition-all duration-200 px-3 rounded-lg hover:opacity-80 relative"
                style={{
                  minHeight: navHeight,
                  color: pathname === "/swap" ? "var(--cmc-text)" : "var(--cmc-neutral-5)",
                }}
              >
                <Repeat2 size={iconSize} />
                Swap
                {pathname === "/swap" && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-[2px] w-4 rounded-full" style={{ background: "var(--cmc-text)" }} />
                )}
              </Link>
            </li>
          </ul>

          {/* Right side — compact row */}
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {/* Search */}
            <div className="hidden xl:block">
              <GlobalSearch />
            </div>

            {/* Trending */}
            <button
              onClick={() => setTrendingOpen(true)}
              className={`hidden xl:flex ${btnSize} items-center justify-center rounded-full transition-colors hover-surface`}
              style={{ color: "var(--pf-star)" }}
              title="Trending"
            >
              <Flame size={scrolled ? 13 : 15} />
            </button>

            {/* Degen mode toggle */}
            <div className="hidden xl:block">
              <DegenToggle />
            </div>

            {/* Theme toggle — always visible */}
            <button
              onClick={toggleTheme}
              className={`hidden sm:flex ${btnSize} items-center justify-center rounded-full transition-colors hover-surface`}
              style={{ color: "var(--cmc-neutral-5)" }}
              aria-label="Toggle theme (D)"
            >
              {isDark ? <Sun size={scrolled ? 13 : 15} /> : <Moon size={scrolled ? 13 : 15} />}
            </button>

            {/* Notifications */}
            <NotificationCenter />

            {/* Wallet */}
            <WalletButton />

            {/* Mobile: search + theme + menu */}
            <button
              className="sm:hidden flex h-8 w-8 items-center justify-center rounded-full"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              style={{ color: "var(--cmc-neutral-5)" }}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              className="xl:hidden flex h-8 w-8 items-center justify-center"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Menu"
            >
              <Menu size={18} style={{ color: "var(--cmc-text)" }} />
            </button>
          </div>
        </div>
      </nav>

      {/* ═══ Mobile slide-over menu ═══ */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-1000">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Panel */}
          <div
            className="absolute top-0 right-0 h-full w-72 overflow-y-auto"
            style={{ background: "var(--cmc-bg)", borderLeft: "1px solid var(--cmc-border)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
              <span className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>Menu</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-lg hover-surface">
                <X size={18} style={{ color: "var(--cmc-text)" }} />
              </button>
            </div>

            {/* Search */}
            <div className="p-3">
              <GlobalSearch />
            </div>

            {/* Quick links */}
            <div className="px-2 py-1">
              <Link
                href="/feeds"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover-surface"
                style={{ color: pathname === "/feeds" ? "var(--pf-accent)" : "var(--cmc-text)" }}
              >
                <Radio size={15} style={{ color: "var(--pf-accent)" }} />
                Pyth Feeds
              </Link>
              <Link
                href="/swap"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover-surface"
                style={{ color: "var(--cmc-text)" }}
              >
                <Repeat2 size={15} style={{ color: "var(--cmc-neutral-5)" }} />
                Swap
              </Link>
              <button
                onClick={() => { setTrendingOpen(true); setMobileMenuOpen(false); }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover-surface w-full"
                style={{ color: "var(--cmc-text)" }}
              >
                <Flame size={15} style={{ color: "var(--pf-star)" }} />
                Trending
              </button>
            </div>

            {/* Divider */}
            <div className="mx-3 my-2" style={{ borderTop: "1px solid var(--cmc-border)" }} />

            {/* Settings row */}
            <div className="px-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>Theme</span>
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                  style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}
                >
                  {isDark ? <><Sun size={12} /> Light</> : <><Moon size={12} /> Dark</>}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>Currency</span>
                <CurrencySwitcher />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>Mode</span>
                <DegenToggle />
              </div>
            </div>

            {/* Menu sections */}
            <div className="mx-3 my-3" style={{ borderTop: "1px solid var(--cmc-border)" }} />
            <div className="px-2 pb-6">
              {data.map(([key, section]) => (
                <div key={key} className="mb-2">
                  <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>{key}</p>
                  {section.list.map((cat, ci) =>
                    cat.items.map((item, ii) => {
                      const isExt = item.link.startsWith("http");
                      const Comp = isExt ? "a" : Link;
                      const extra = isExt ? { href: item.link, target: "_blank", rel: "noopener noreferrer" } : { href: item.link, onClick: () => setMobileMenuOpen(false) };
                      const showPro = item.degenOnly && !isDegen;
                      return (
                        <Comp
                          key={`${ci}-${ii}`}
                          {...extra}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover-surface"
                          style={{ color: "var(--cmc-text)", opacity: showPro ? 0.55 : 1 }}
                        >
                          {item.text}
                          {showPro && (
                            <span className="ml-auto text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>Degen</span>
                          )}
                        </Comp>
                      );
                    })
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trending sidebar */}
      <TrendingSidebar open={trendingOpen} onClose={() => setTrendingOpen(false)} />
    </>
  );
}