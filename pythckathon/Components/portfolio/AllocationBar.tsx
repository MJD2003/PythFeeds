"use client";

import { fmtUsd } from "@/Components/portfolio/portfolio-types";

interface AllocationSegment {
  label: string;
  value: number;
  color: string;
}

interface AllocationBarProps {
  segments: AllocationSegment[];
  totalValue: number;
}

export default function AllocationBar({ segments, totalValue }: AllocationBarProps) {
  if (segments.length === 0 || totalValue <= 0) return null;

  return (
    <div className="mb-6">
      <div className="flex rounded-full overflow-hidden h-2 mb-2" style={{ background: "var(--cmc-neutral-2)" }}>
        {segments.map(s => (
          <div key={s.label} style={{ width: `${(s.value / totalValue) * 100}%`, background: s.color }} title={`${s.label}: ${fmtUsd(s.value)} (${((s.value / totalValue) * 100).toFixed(1)}%)`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{s.label}</span>
            <span className="text-[10px] font-bold font-data" style={{ color: "var(--cmc-text)" }}>{((s.value / totalValue) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
