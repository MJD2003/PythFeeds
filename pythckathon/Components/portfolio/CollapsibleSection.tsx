"use client";

import { useState } from "react";
import { ChevronUp, ExternalLink } from "lucide-react";

interface CollapsibleSectionProps {
  icon?: React.ReactNode;
  title: string;
  value: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  level?: "platform" | "subsection";
  link?: string;
  badge?: React.ReactNode;
}

export default function CollapsibleSection({
  icon,
  title,
  value,
  defaultOpen = true,
  children,
  level = "platform",
  link,
  badge,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const isPlatform = level === "platform";

  return (
    <div
      className={isPlatform ? "rounded-xl overflow-hidden mb-3" : ""}
      style={isPlatform ? { border: "1px solid var(--cmc-border)" } : {}}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between transition-colors hover:brightness-110"
        style={{
          background: isPlatform
            ? "var(--cmc-neutral-1)"
            : "rgba(255,255,255,0.015)",
          padding: isPlatform ? "12px 16px" : "10px 16px",
          borderBottom: open ? "1px solid var(--cmc-border)" : "none",
        }}
      >
        <div className="flex items-center gap-2.5">
          {icon}
          <span
            className={`font-semibold ${isPlatform ? "text-sm" : "text-xs"}`}
            style={{ color: "var(--cmc-text)" }}
          >
            {title}
          </span>
          {link && (
            <ExternalLink
              size={11}
              style={{ color: "var(--cmc-neutral-5)" }}
            />
          )}
          {badge}
        </div>
        <div className="flex items-center gap-2.5">
          <span
            className={`font-bold ${isPlatform ? "text-sm" : "text-xs"}`}
            style={{ color: "var(--cmc-text)" }}
          >
            {value}
          </span>
          <ChevronUp
            size={14}
            className={`transition-transform duration-200 ${open ? "" : "rotate-180"}`}
            style={{ color: "var(--cmc-neutral-5)" }}
          />
        </div>
      </button>
      <div
        className="transition-all duration-200 overflow-hidden"
        style={{
          maxHeight: open ? "2000px" : "0",
          opacity: open ? 1 : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
