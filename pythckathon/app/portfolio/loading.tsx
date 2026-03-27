export default function PortfolioLoading() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-6 w-36 rounded-lg animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
          <div className="h-3 w-56 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
        </div>
        <div className="h-9 w-32 rounded-xl animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl p-4" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
            <div className="h-2.5 w-16 rounded animate-pulse mb-2" style={{ background: "var(--cmc-neutral-2)" }} />
            <div className="h-5 w-24 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="rounded-xl p-4 mb-6" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
        <div className="h-4 w-32 rounded animate-pulse mb-4" style={{ background: "var(--cmc-neutral-2)" }} />
        <div className="h-48 rounded-lg animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
        <div className="h-10" style={{ background: "var(--cmc-neutral-1)" }} />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
            <div className="h-7 w-7 rounded-full animate-pulse shrink-0" style={{ background: "var(--cmc-neutral-2)" }} />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-24 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
              <div className="h-2 w-16 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
            </div>
            <div className="h-3 w-16 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
            <div className="h-3 w-20 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
