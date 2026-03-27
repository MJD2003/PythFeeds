"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Resolves CSS custom property values to their computed hex/rgb strings.
 * MUI Charts, TradingView, and other libraries that don't support CSS variables
 * need actual color strings — this hook reads the computed values at runtime.
 *
 * Usage:
 *   const colors = useResolvedColors(["--pf-accent", "--pf-up", "--pf-down"]);
 *   // colors = { "--pf-accent": "#8B5CF6", "--pf-up": "#00E59B", ... }
 */
export function useResolvedColors(varNames: string[]): Record<string, string> {
  const [colors, setColors] = useState<Record<string, string>>({});

  const resolve = useCallback(() => {
    if (typeof window === "undefined") return;
    const style = getComputedStyle(document.documentElement);
    const resolved: Record<string, string> = {};
    for (const name of varNames) {
      const raw = style.getPropertyValue(name).trim();
      resolved[name] = raw || "";
    }
    setColors(resolved);
  }, [varNames.join(",")]);

  useEffect(() => {
    resolve();

    // Re-resolve when theme or mode changes (class changes on <html>)
    const obs = new MutationObserver(resolve);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => obs.disconnect();
  }, [resolve]);

  return colors;
}

/**
 * Resolves a single CSS variable to its computed value.
 * Returns fallback if not yet resolved (SSR-safe).
 */
export function useResolvedColor(varName: string, fallback: string = "#8B5CF6"): string {
  const [color, setColor] = useState(fallback);

  useEffect(() => {
    const resolve = () => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      if (raw) setColor(raw);
    };
    resolve();

    const obs = new MutationObserver(resolve);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, [varName]);

  return color;
}
