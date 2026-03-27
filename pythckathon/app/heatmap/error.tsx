"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function HeatmapError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Heatmap Error]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <AlertTriangle size={48} className="mx-auto mb-4" style={{ color: "#ea3943" }} />
      <h2 className="text-xl font-bold mb-2" style={{ color: "var(--cmc-text)" }}>Heatmap Error</h2>
      <p className="text-sm mb-6" style={{ color: "var(--cmc-neutral-5)" }}>
        {error.message || "Could not render the heatmap. Please try again."}
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110"
        style={{ background: "var(--pf-accent)", color: "#fff" }}
      >
        <RefreshCw size={14} /> Retry
      </button>
    </div>
  );
}
