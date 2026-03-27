"use client";

import { useState, useEffect } from "react";
import { fetchFearGreed } from "@/lib/api/backend";

function getColor(value: number): string {
  if (value <= 25) return "#ea3943";
  if (value <= 45) return "#f5a623";
  if (value <= 55) return "#f5d100";
  if (value <= 75) return "#93c648";
  return "#16c784";
}

function getLabel(classification: string): string {
  return classification || "Neutral";
}

export default function FearGreedGauge() {
  const [data, setData] = useState<{ value: number; classification: string } | null>(null);

  useEffect(() => {
    fetchFearGreed()
      .then(setData)
      .catch(() => setData({ value: 50, classification: "Neutral" }));
  }, []);

  if (!data) return null;

  const color = getColor(data.value);
  const rotation = (data.value / 100) * 180 - 90; // -90 to 90 degrees

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Gauge arc */}
      <div className="relative w-[120px] h-[65px] overflow-hidden">
        {/* Background arc */}
        <div
          className="absolute inset-0 rounded-t-full"
          style={{
            background: `conic-gradient(from 180deg at 50% 100%, #ea3943 0deg, #f5a623 45deg, #f5d100 90deg, #93c648 135deg, #16c784 180deg, transparent 180deg)`,
            opacity: 0.2,
          }}
        />
        {/* Filled arc */}
        <div
          className="absolute inset-0 rounded-t-full"
          style={{
            background: `conic-gradient(from 180deg at 50% 100%, #ea3943 0deg, #f5a623 45deg, #f5d100 90deg, #93c648 135deg, #16c784 180deg, transparent 180deg)`,
            clipPath: `polygon(50% 100%, 0% 0%, ${data.value}% 0%, 50% 100%)`,
          }}
        />
        {/* Needle */}
        <div className="absolute bottom-0 left-1/2 origin-bottom" style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}>
          <div className="w-[2px] h-[52px] rounded-full" style={{ background: color }} />
        </div>
        {/* Center dot */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 rounded-full border-2" style={{ background: "var(--cmc-bg)", borderColor: color }} />
      </div>
      {/* Value */}
      <div className="text-center -mt-1">
        <span className="text-xl font-bold" style={{ color }}>{data.value}</span>
        <span className="text-[10px] font-medium block" style={{ color }}>{getLabel(data.classification)}</span>
      </div>
    </div>
  );
}
