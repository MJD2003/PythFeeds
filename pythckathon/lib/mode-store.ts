"use client";

import { useState, useEffect, useSyncExternalStore } from "react";

export type AppMode = "standard" | "degen";

const STORAGE_KEY = "pythfeeds_mode";
const EVENT_NAME = "modechange";

let currentMode: AppMode = "degen";

// Initialize from localStorage (SSR-safe)
if (typeof window !== "undefined") {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "standard") {
    currentMode = "standard";
  } else {
    currentMode = "degen";
    document.documentElement.classList.add("degen");
  }
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
    localStorage.setItem(STORAGE_KEY, mode);
    // Toggle degen class on <html> for CSS variable overrides
    if (mode === "degen") {
      document.documentElement.classList.add("degen");
    } else {
      document.documentElement.classList.remove("degen");
    }
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
