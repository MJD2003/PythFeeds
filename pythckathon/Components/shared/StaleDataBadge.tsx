"use client";

import { Clock } from "lucide-react";

export default function StaleDataBadge({ stale }: { stale?: boolean }) {
  if (!stale) return null;

  return (
    <div
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold"
      style={{
        background: "rgba(245,158,11,0.1)",
        color: "#f59e0b",
        border: "1px solid rgba(245,158,11,0.2)",
      }}
    >
      <Clock size={9} />
      Data may be delayed
    </div>
  );
}
