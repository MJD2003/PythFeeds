import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-16 flex flex-col items-center gap-3">
      <Loader2 size={28} className="animate-spin" style={{ color: "var(--cmc-neutral-4)" }} />
      <p className="text-xs" style={{ color: "var(--cmc-neutral-5)" }}>Loading analytics...</p>
    </div>
  );
}
