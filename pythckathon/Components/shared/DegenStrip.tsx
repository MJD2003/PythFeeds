"use client";

import { useMode } from "@/lib/mode-store";

export default function DegenStrip() {
  const mode = useMode();
  if (mode !== "degen") return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-9999 h-[4px]">
      <div
        className="h-full w-full relative"
        style={{
          background: "linear-gradient(90deg, var(--pf-beam-from), var(--pf-beam-to), var(--pf-beam-from))",
          backgroundSize: "200% 100%",
          animation: "rainbow 2s linear infinite, degen-strip-glow 1.5s ease-in-out infinite",
        }}
      />
      {/* Glow reflection beneath the strip */}
      <div
        className="absolute top-full left-0 right-0 h-8 pointer-events-none"
        style={{
          background: "linear-gradient(180deg, color-mix(in srgb, var(--pf-beam-from) 12%, transparent), transparent)",
        }}
      />
    </div>
  );
}
