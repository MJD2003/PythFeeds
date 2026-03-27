"use client";

import { useEffect } from "react";
import { prewarmPythFeeds } from "@/lib/pyth-prices";

/** Invisible component that pre-warms the Pyth feed ID cache on app init */
export default function PythPrewarm() {
  useEffect(() => {
    prewarmPythFeeds();
  }, []);
  return null;
}
