"use client";

export default function PythIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/pyth.png"
      alt="Pyth"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
