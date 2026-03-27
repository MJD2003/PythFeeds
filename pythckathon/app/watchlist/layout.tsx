import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Watchlist — Track Your Favorite Cryptos | PythFeeds",
  description: "Create a personalized watchlist of cryptocurrencies and stocks with real-time Pyth Network prices.",
};

export default function WatchlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
