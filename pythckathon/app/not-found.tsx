import Link from "next/link";
import { Home, Search, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      {/* Big 404 with gradient */}
      <div
        className="mb-2 text-[120px] font-black leading-none select-none"
        style={{
          background: "linear-gradient(135deg, var(--cmc-text) 0%, var(--cmc-neutral-4) 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        404
      </div>

      <h1 className="mb-2 text-2xl font-bold" style={{ color: "var(--cmc-text)" }}>
        Page Not Found
      </h1>
      <p className="mb-8 text-sm leading-relaxed max-w-xs" style={{ color: "var(--cmc-neutral-5)" }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
        Try searching or head back to the homepage.
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all hover:brightness-110"
          style={{
            background: "linear-gradient(135deg, #16c784 0%, var(--pf-teal) 100%)",
            color: "#000",
          }}
        >
          <Home size={14} />
          Go Home
        </Link>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors"
          style={{
            background: "var(--cmc-neutral-2)",
            color: "var(--cmc-text)",
          }}
        >
          <Search size={14} />
          Search
        </Link>
      </div>

      {/* Quick links */}
      <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-medium" style={{ color: "var(--cmc-neutral-5)" }}>
        {[
          { href: "/", label: "Markets" },
          { href: "/heatmap", label: "Heatmap" },
          { href: "/swap", label: "Swap" },
          { href: "/portfolio", label: "Portfolio" },
          { href: "/stocks", label: "Stocks" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="hover:underline transition-colors" style={{ color: "var(--cmc-neutral-5)" }}>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
