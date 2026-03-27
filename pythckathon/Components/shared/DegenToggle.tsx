"use client";

import { useMode, toggleMode } from "@/lib/mode-store";
import { toast } from "sonner";
import { useCallback } from "react";
import { Flame, Crosshair } from "lucide-react";

export default function DegenToggle() {
  const mode = useMode();
  const isDegen = mode === "degen";

  const handleToggle = useCallback(() => {
    const nextIsDegen = mode === "standard";
    toggleMode();

    // Screen flash overlay
    const flash = document.createElement("div");
    flash.className = `mode-flash ${nextIsDegen ? "mode-flash-degen" : "mode-flash-standard"}`;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 600);

    if (nextIsDegen) {
      toast("Degen Mode", { description: "Advanced tools & analytics unlocked", icon: "⚡" });
    } else {
      toast("Standard Mode", { description: "Clean view active", icon: "✦" });
    }
  }, [mode]);

  return (
    <button
      onClick={handleToggle}
      className="group relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-300 overflow-hidden"
      style={{
        background: isDegen ? "var(--pf-accent-muted)" : "var(--cmc-neutral-2)",
        color: isDegen ? "var(--pf-accent)" : "var(--cmc-neutral-5)",
        border: isDegen ? "1px solid color-mix(in srgb, var(--pf-accent) 30%, transparent)" : "1px solid var(--cmc-border)",
        boxShadow: isDegen
          ? "0 0 12px var(--pf-accent-muted)"
          : "none",
      }}
      title={isDegen ? "Switch to Standard mode (M)" : "Switch to Degen mode (M)"}
    >
      {isDegen ? (
        <>
          <Flame size={12} />
          <span className="tracking-wider text-[10px]">DEGEN</span>
        </>
      ) : (
        <>
          <Crosshair size={12} />
          <span className="text-[10px]">Standard</span>
        </>
      )}
      <kbd className="hidden xl:inline ml-0.5 text-[8px] opacity-40 font-mono">M</kbd>
    </button>
  );
}
