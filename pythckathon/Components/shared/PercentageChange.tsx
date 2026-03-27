import { ChevronUp, ChevronDown } from "lucide-react";

interface PercentageChangeProps {
  value: number;
}

export default function PercentageChange({ value }: PercentageChangeProps) {
  if (value === null || value === undefined) return <span>—</span>;

  const isPositive = value >= 0;
  const formatted = Math.abs(value).toFixed(2);

  return (
    <span
      className="inline-flex items-center gap-0.5 text-sm font-medium"
      style={{ color: isPositive ? "var(--cmc-up)" : "var(--cmc-down)" }}
    >
      {isPositive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      {formatted}%
    </span>
  );
}
