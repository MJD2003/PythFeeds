export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      {/* Header skeleton */}
      <div className="mb-6 space-y-3">
        <div className="h-7 w-48 rounded-lg animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
        <div className="h-4 w-80 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4" style={{ borderColor: "var(--cmc-border)" }}>
            <div className="h-3 w-20 rounded animate-pulse mb-2" style={{ background: "var(--cmc-neutral-2)" }} />
            <div className="h-5 w-28 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--cmc-border)" }}>
        <div className="h-10 w-full" style={{ background: "var(--cmc-neutral-1)" }} />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
            <div className="h-4 w-4 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
            <div className="h-8 w-8 rounded-full animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-32 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
              <div className="h-2.5 w-20 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
            </div>
            <div className="h-3.5 w-16 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
            <div className="h-3.5 w-12 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
            <div className="h-3.5 w-20 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
