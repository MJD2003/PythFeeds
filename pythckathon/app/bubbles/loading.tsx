export default function BubblesLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-6 w-36 rounded-lg animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
          <div className="h-3 w-52 rounded animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 w-16 rounded-lg animate-pulse" style={{ background: "var(--cmc-neutral-2)" }} />
          ))}
        </div>
      </div>

      {/* Bubbles skeleton — circles of varying sizes */}
      <div
        className="rounded-xl flex items-center justify-center"
        style={{ border: "1px solid var(--cmc-border)", minHeight: "70vh" }}
      >
        <div className="relative w-full h-[60vh] flex items-center justify-center">
          {[120, 90, 80, 70, 60, 50, 45, 40, 35, 30, 28, 26].map((size, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-pulse"
              style={{
                width: size,
                height: size,
                background: "var(--cmc-neutral-2)",
                left: `${15 + (i * 6) % 70}%`,
                top: `${10 + (i * 7) % 60}%`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
