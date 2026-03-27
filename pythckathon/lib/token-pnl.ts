/**
 * Per-token P&L tracking.
 * Stores cost basis snapshots per token per wallet in localStorage.
 * Computes unrealized P&L against current prices.
 */

const TOKEN_PNL_KEY = "pythfeeds_token_pnl";

export interface TokenCostBasis {
  symbol: string;
  mint: string;
  /** Average cost basis price per unit (USD) */
  avgCost: number;
  /** Total units held at time of last update */
  totalUnits: number;
  /** Total USD invested (cost basis * units) */
  totalCost: number;
  /** Timestamp of first record */
  firstSeen: number;
  /** Timestamp of last update */
  lastUpdated: number;
}

export interface TokenPnLResult {
  symbol: string;
  mint: string;
  avgCost: number;
  currentPrice: number;
  units: number;
  costBasis: number;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  holdingDays: number;
}

function getKey(wallet: string): string {
  return `${TOKEN_PNL_KEY}_${wallet}`;
}

export function getTokenCostBases(wallet: string): TokenCostBasis[] {
  if (typeof window === "undefined" || !wallet) return [];
  try {
    return JSON.parse(localStorage.getItem(getKey(wallet)) || "[]");
  } catch {
    return [];
  }
}

function saveCostBases(wallet: string, bases: TokenCostBasis[]): void {
  if (typeof window === "undefined" || !wallet) return;
  localStorage.setItem(getKey(wallet), JSON.stringify(bases));
}

/**
 * Update cost basis for all held tokens.
 * Uses a simple "mark-to-first-seen" approach:
 * - If this is the first time we see the token, record current price as cost basis
 * - If the user's holdings increased, blend the new cost in (weighted average)
 * - If holdings decreased (sold), keep the average cost but reduce units
 */
export function updateCostBases(
  wallet: string,
  holdings: { symbol: string; mint: string; amount: number; price: number }[]
): void {
  if (!wallet || !holdings.length) return;

  const existing = getTokenCostBases(wallet);
  const map = new Map(existing.map(e => [e.mint, e]));
  const now = Date.now();

  for (const h of holdings) {
    if (!h.price || h.price <= 0 || !h.amount || h.amount <= 0) continue;

    const prev = map.get(h.mint);
    if (!prev) {
      // First time seeing this token — record current price as cost basis
      map.set(h.mint, {
        symbol: h.symbol,
        mint: h.mint,
        avgCost: h.price,
        totalUnits: h.amount,
        totalCost: h.price * h.amount,
        firstSeen: now,
        lastUpdated: now,
      });
    } else {
      if (h.amount > prev.totalUnits) {
        // Holdings increased — blend new cost
        const addedUnits = h.amount - prev.totalUnits;
        const newTotalCost = prev.totalCost + addedUnits * h.price;
        prev.totalUnits = h.amount;
        prev.totalCost = newTotalCost;
        prev.avgCost = newTotalCost / h.amount;
      } else {
        // Holdings same or decreased — keep avg cost, update units
        prev.totalUnits = h.amount;
        prev.totalCost = prev.avgCost * h.amount;
      }
      prev.symbol = h.symbol;
      prev.lastUpdated = now;
    }
  }

  // Remove tokens no longer held (0 balance for > 24h)
  const result = Array.from(map.values()).filter(e => {
    const holding = holdings.find(h => h.mint === e.mint);
    if (holding && holding.amount > 0) return true;
    // Keep for 24h after disappearing so user can see "sold" status
    return now - e.lastUpdated < 86400_000;
  });

  saveCostBases(wallet, result);
}

/**
 * Compute P&L for each token given current prices.
 */
export function computeTokenPnL(
  wallet: string,
  currentPrices: Map<string, number>
): TokenPnLResult[] {
  const bases = getTokenCostBases(wallet);
  const now = Date.now();

  return bases
    .map(b => {
      const currentPrice = currentPrices.get(b.symbol) || currentPrices.get(b.mint) || 0;
      const currentValue = currentPrice * b.totalUnits;
      const costBasis = b.avgCost * b.totalUnits;
      const unrealizedPnl = currentValue - costBasis;
      const unrealizedPnlPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;
      const holdingDays = Math.max(1, Math.floor((now - b.firstSeen) / 86400_000));

      return {
        symbol: b.symbol,
        mint: b.mint,
        avgCost: b.avgCost,
        currentPrice,
        units: b.totalUnits,
        costBasis,
        currentValue,
        unrealizedPnl,
        unrealizedPnlPct,
        holdingDays,
      };
    })
    .filter(r => r.units > 0 && r.currentPrice > 0)
    .sort((a, b) => Math.abs(b.unrealizedPnl) - Math.abs(a.unrealizedPnl));
}

/**
 * Manually set cost basis for a token (e.g., user-entered purchase price).
 */
export function setManualCostBasis(
  wallet: string,
  mint: string,
  symbol: string,
  avgCost: number,
  units: number
): void {
  const bases = getTokenCostBases(wallet);
  const idx = bases.findIndex(b => b.mint === mint);
  const now = Date.now();

  const entry: TokenCostBasis = {
    symbol,
    mint,
    avgCost,
    totalUnits: units,
    totalCost: avgCost * units,
    firstSeen: idx >= 0 ? bases[idx].firstSeen : now,
    lastUpdated: now,
  };

  if (idx >= 0) {
    bases[idx] = entry;
  } else {
    bases.push(entry);
  }

  saveCostBases(wallet, bases);
}
