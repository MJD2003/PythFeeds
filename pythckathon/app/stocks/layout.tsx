import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stocks — Real-Time Pyth Oracle Prices | PythFeeds",
  description: "Live stock prices powered by Pyth Network oracle. Track AAPL, MSFT, NVDA, TSLA, GOOGL, AMZN, META and more.",
};

export default function StocksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
