import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portfolio Tracker — Solana Wallet Holdings | PythFeeds",
  description: "Track your Solana wallet holdings, staking positions, and DeFi activity. Real-time prices powered by Pyth Network.",
};

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
