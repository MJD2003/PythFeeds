"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/Components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ErrorBoundary]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <AlertTriangle size={48} className="mx-auto mb-4" style={{ color: "#ea3943" }} />
      <h2 className="text-xl font-bold mb-2" style={{ color: "var(--cmc-text)" }}>Something went wrong</h2>
      <p className="text-sm mb-6" style={{ color: "var(--cmc-neutral-5)" }}>
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <Button onClick={reset} className="gap-2">
        <RefreshCw size={14} /> Try again
      </Button>
    </div>
  );
}
