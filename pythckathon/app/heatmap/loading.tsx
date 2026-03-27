export default function HeatmapLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-6 w-40 rounded-lg animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
          <div className="h-3 w-64 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 w-16 rounded-lg animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
          ))}
        </div>
      </div>

      {/* Heatmap grid skeleton */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--cmc-border)", aspectRatio: "16/9" }}
      >
        <div className="grid grid-cols-6 grid-rows-4 gap-0.5 h-full p-0.5">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="rounded animate-pulse"
              style={{
                background: "var(--cmc-neutral-2)",
                gridColumn: i < 2 ? "span 2" : undefined,
                gridRow: i < 2 ? "span 2" : undefined,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
