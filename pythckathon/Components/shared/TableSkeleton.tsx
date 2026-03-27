export default function TableSkeleton({ rows = 10, cols = 11 }: { rows?: number; cols?: number }) {
  return (
    <div className="mx-auto max-w-[1400px] px-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--cmc-border)" }}>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-2.5 py-3">
                  <div
                    className="h-3 rounded animate-pulse"
                    style={{
                      background: "var(--cmc-neutral-2)",
                      width: i === 0 ? 20 : i === 2 ? 120 : 60,
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r} className="border-b" style={{ borderColor: "var(--cmc-border)" }}>
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c} className="px-2.5 py-3.5">
                    <div
                      className="h-4 rounded animate-pulse"
                      style={{
                        background: "var(--cmc-neutral-2)",
                        width: c === 0 ? 14 : c === 1 ? 24 : c === 2 ? `${60 + Math.random() * 80}px` : `${40 + Math.random() * 40}px`,
                        opacity: 0.5 + Math.random() * 0.5,
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
