"use client";

import { useSyncExternalStore } from "react";

export type AppMode = "standard" | "degen";

const STORAGE_KEY = "pythfeeds_mode";
const EVENT_NAME = "modechange";

let currentMode: AppMode = "degen";

/** Keep `<html>` class in sync with `currentMode` (React hydration resets `className` to `dark` only). */
export function applyModeClassToHtml() {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  if (currentMode === "degen") {
    root.classList.add("degen");
  } else {
    root.classList.remove("degen");
  }
}

// Default platform mode is degen; only exact "standard" opts out. Persist degen for first visits / bad values.
if (typeof window !== "undefined") {
  let stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== "standard" && stored !== "degen") {
    stored = "degen";
    try {
      localStorage.setItem(STORAGE_KEY, "degen");
    } catch {
      /* private mode / quota */
    }
  }
  currentMode = stored === "standard" ? "standard" : "degen";
  applyModeClassToHtml();
}

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((fn) => fn());
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: currentMode }));
  }
}

export function getMode(): AppMode {
  return currentMode;
}

export function setMode(mode: AppMode) {
  if (mode === currentMode) return;
  currentMode = mode;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
    applyModeClassToHtml();
  }
  emitChange();
}

export function toggleMode() {
  setMode(currentMode === "standard" ? "degen" : "standard");
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): AppMode {
  return currentMode;
}

function getServerSnapshot(): AppMode {
  return "degen";
}

/**
 * React hook — returns the current app mode and re-renders on change.
 */
export function useMode(): AppMode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Helper to check if current mode is degen.
 */
export function useIsDegen(): boolean {
  return useMode() === "degen";
}
