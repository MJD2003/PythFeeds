import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Price Alerts — Get Notified on Price Changes | PythFeeds",
  description: "Set price alerts for crypto and stocks. Get notified when prices hit your targets using Pyth Network data.",
};

export default function AlertsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
