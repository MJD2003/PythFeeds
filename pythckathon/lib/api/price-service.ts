/**
 * Unified price service: Pyth as primary, CoinGecko as fallback.
 * Merges Pyth real-time prices into CoinGecko market data.
 */

import { fetchPythPrices, PYTH_CRYPTO_FEEDS, PYTH_EQUITY_FEEDS } from "./pyth";
import { fetchCoins, fetchCoinDetail, fetchGlobalData, fetchExchanges, searchCoinGecko } from "./coingecko";
import type { CGCoin, CGCoinDetail, CGGlobalData, CGExchange, CGSearchResult } from "./coingecko";

// Map CoinGecko symbol → Pyth feed ID
const CG_TO_PYTH: Record<string, string> = {};
for (const [sym, id] of Object.entries(PYTH_CRYPTO_FEEDS)) {
  CG_TO_PYTH[sym.toLowerCase()] = id;
}

/**
 * Fetch coins with Pyth price overlay
 * 1. Fetch CoinGecko market data (sparklines, ranks, volumes, etc.)
 * 2. Fetch Pyth prices for supported symbols
 * 3. Overlay Pyth prices onto CoinGecko data where available
 */
export async function getCoinsWithPythPrices(page = 1, perPage = 100): Promise<CGCoin[]> {
  // Fetch both in parallel
  const [coins, pythPrices] = await Promise.all([
    fetchCoins(page, perPage),
    fetchPythPrices(Object.values(PYTH_CRYPTO_FEEDS)).catch(() => new Map()),
  ]);

  // Build symbol → pyth price lookup
  const pythBySymbol = new Map<string, number>();
  for (const [, pp] of pythPrices) {
    if (pp.symbol && pp.price > 0) {
      pythBySymbol.set(pp.symbol.toLowerCase(), pp.price);
    }
  }

  // Overlay Pyth prices where available
  return coins.map((coin) => {
    const pythPrice = pythBySymbol.get(coin.symbol.toLowerCase());
    if (pythPrice && pythPrice > 0) {
      // Calculate new 24h change based on Pyth vs CoinGecko open
      const oldPrice = coin.current_price;
      const pctChange = oldPrice > 0 ? ((pythPrice - oldPrice) / oldPrice) * 100 : 0;

      return {
        ...coin,
        current_price: pythPrice,
        // Keep CoinGecko's 24h change if the price difference is small (< 2%)
        // Otherwise recalculate to avoid misleading data
        price_change_percentage_24h: Math.abs(pctChange) < 2
          ? coin.price_change_percentage_24h
          : coin.price_change_percentage_24h + pctChange,
        _pythPowered: true,
      } as CGCoin & { _pythPowered?: boolean };
    }
    return coin;
  });
}

/**
 * Fetch coin detail with Pyth price overlay
 */
export async function getCoinDetailWithPyth(id: string): Promise<CGCoinDetail | null> {
  const detail = await fetchCoinDetail(id);
  if (!detail) return null;

  const feedId = CG_TO_PYTH[detail.symbol.toLowerCase()];
  if (!feedId) return detail;

  try {
    const pythPrices = await fetchPythPrices([feedId]);
    const pp = pythPrices.get(feedId);
    if (pp && pp.price > 0) {
      detail.market_data.current_price.usd = pp.price;
    }
  } catch {
    // Fall back to CoinGecko price silently
  }

  return detail;
}

/**
 * Fetch stock prices from Pyth (primary source for equities)
 */
export async function getStockPricesFromPyth(): Promise<Map<string, number>> {
  const prices = new Map<string, number>();

  try {
    const feedIds = Object.values(PYTH_EQUITY_FEEDS);
    if (feedIds.length === 0) return prices;

    const pythPrices = await fetchPythPrices(feedIds);
    for (const [, pp] of pythPrices) {
      if (pp.symbol && pp.price > 0) {
        prices.set(pp.symbol.toUpperCase(), pp.price);
      }
    }
  } catch {
    // Return empty map - caller handles fallback
  }

  return prices;
}

// Re-export for convenience
export { fetchGlobalData, fetchExchanges, searchCoinGecko };
export type { CGCoin, CGCoinDetail, CGGlobalData, CGExchange, CGSearchResult };
