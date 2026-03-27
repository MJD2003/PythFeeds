"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "theme";

function getSnapshot(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot(): boolean {
  return true;
}

/** One MutationObserver for all subscribers — avoids N observers firing on every class change. */
let htmlClassListeners = new Set<() => void>();
let htmlClassObserver: MutationObserver | null = null;

function ensureHtmlClassObserver(): void {
  if (typeof document === "undefined" || htmlClassObserver) return;
  htmlClassObserver = new MutationObserver(() => {
    htmlClassListeners.forEach((fn) => fn());
  });
  htmlClassObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
}

function subscribe(onStoreChange: () => void): () => void {
  htmlClassListeners.add(onStoreChange);
  ensureHtmlClassObserver();
  return () => {
    htmlClassListeners.delete(onStoreChange);
    if (htmlClassListeners.size === 0 && htmlClassObserver) {
      htmlClassObserver.disconnect();
      htmlClassObserver = null;
    }
  };
}

/** Dark/light without next-themes — avoids re-rendering the whole app on toggle. */
export function useIsDarkMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setLightDarkMode(next: "light" | "dark"): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (next === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
}

export function toggleLightDarkMode(): void {
  setLightDarkMode(getSnapshot() ? "light" : "dark");
}

export const themeClient = { setLightDarkMode, toggleLightDarkMode };
