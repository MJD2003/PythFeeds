"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Keyboard } from "lucide-react";

const SHORTCUTS = [
  { keys: ["Ctrl", "K"], description: "Open search" },
  { keys: ["Ctrl", "/"], description: "Open AI chat" },
  { keys: ["D"], description: "Toggle dark / light mode" },
  { keys: ["?"], description: "Show keyboard shortcuts" },
  { keys: ["Esc"], description: "Close modals & overlays" },
  { keys: ["G", "H"], description: "Go to Home" },
  { keys: ["G", "P"], description: "Go to Portfolio" },
  { keys: ["G", "W"], description: "Go to Watchlist" },
  { keys: ["G", "S"], description: "Go to Swap" },
  { keys: ["G", "A"], description: "Go to Alerts" },
  { keys: ["G", "N"], description: "Go to News" },
  { keys: ["J"], description: "Next row (tables)" },
  { keys: ["K"], description: "Previous row (tables)" },
];

const NAV_MAP: Record<string, string> = {
  h: "/", p: "/portfolio", w: "/watchlist", s: "/swap",
  a: "/alerts", n: "/news", c: "/converter", f: "/fear-greed",
};

export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const gPending = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K → search (works even from input fields)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/search");
        return;
      }

      // Ctrl+/ → open AI chatbot (works even from input fields)
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        const fab = document.querySelector('[aria-label="Open AI Chat"]') as HTMLButtonElement;
        if (fab) fab.click();
        return;
      }

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // G+key navigation
      if (gPending.current) {
        gPending.current = false;
        if (gTimer.current) clearTimeout(gTimer.current);
        const dest = NAV_MAP[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          router.push(dest);
          return;
        }
      }

      if (e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        gPending.current = true;
        if (gTimer.current) clearTimeout(gTimer.current);
        gTimer.current = setTimeout(() => { gPending.current = false; }, 600);
        return;
      }

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((p) => !p);
      }
      if (e.key === "Escape") setOpen(false);

      // J/K row navigation for tables
      if (e.key === "j" || e.key === "k") {
        const rows = document.querySelectorAll("table tbody tr");
        if (rows.length === 0) return;
        const focused = document.querySelector("table tbody tr[data-focused='true']");
        let idx = focused ? Array.from(rows).indexOf(focused) : -1;
        if (e.key === "j") idx = Math.min(idx + 1, rows.length - 1);
        if (e.key === "k") idx = Math.max(idx - 1, 0);
        rows.forEach((r) => {
          (r as HTMLElement).removeAttribute("data-focused");
          (r as HTMLElement).style.outline = "";
        });
        const target = rows[idx] as HTMLElement;
        if (target) {
          target.setAttribute("data-focused", "true");
          target.style.outline = "2px solid rgba(153,69,255,0.4)";
          target.style.outlineOffset = "-2px";
          target.scrollIntoView({ block: "nearest" });
          // Enter to navigate
          const link = target.querySelector("a");
          if (link) {
            const enterHandler = (ev: KeyboardEvent) => {
              if (ev.key === "Enter") { link.click(); window.removeEventListener("keydown", enterHandler); }
            };
            window.addEventListener("keydown", enterHandler);
            setTimeout(() => window.removeEventListener("keydown", enterHandler), 5000);
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Modal */}
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl p-5 shadow-2xl"
        style={{ background: "var(--cmc-bg)", border: "1px solid var(--cmc-border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Keyboard size={16} style={{ color: "var(--cmc-text)" }} />
            <h2 className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded-lg transition-colors hover:bg-white/10"
          >
            <X size={16} style={{ color: "var(--cmc-neutral-5)" }} />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="space-y-2">
          {SHORTCUTS.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-1.5"
              style={{ borderBottom: i < SHORTCUTS.length - 1 ? "1px solid var(--cmc-border)" : "none" }}
            >
              <span className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
                {s.description}
              </span>
              <div className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md text-[10px] font-bold"
                    style={{
                      background: "var(--cmc-neutral-2)",
                      color: "var(--cmc-text)",
                      border: "1px solid var(--cmc-border)",
                    }}
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-[10px]" style={{ color: "var(--cmc-neutral-4)" }}>
          Press <kbd className="px-1 py-0.5 rounded text-[9px] font-bold" style={{ background: "var(--cmc-neutral-2)", border: "1px solid var(--cmc-border)" }}>?</kbd> to toggle this overlay
        </p>
      </div>
    </div>
  );
}
