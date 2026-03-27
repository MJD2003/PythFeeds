"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WatchlistPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/portfolio?tab=watchlist");
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-sm animate-pulse" style={{ color: "var(--cmc-neutral-5)" }}>Redirecting to Portfolio...</p>
    </div>
  );
}
