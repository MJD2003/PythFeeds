/**
 * Portfolio value snapshots stored in localStorage.
 * Used for chart data and PnL calculations.
 */

const SNAPSHOT_KEY = "pf_snap";
const PRICE_KEY = "pf_prices";
const MIN_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes between snapshots

export interface Snapshot {
  t: number; // timestamp ms
  v: number; // total value USD
}

/* ── Snapshots ── */

export function saveSnapshot(wallet: string, value: number): void {
  if (typeof window === "undefined" || !wallet || value <= 0) return;
  const key = `${SNAPSHOT_KEY}_${wallet}`;
  let history: Snapshot[];
  try {
    history = JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    history = [];
  }
  const now = Date.now();

  // Throttle: update last snapshot if recent, otherwise push new
  if (
    history.length > 0 &&
    now - history[history.length - 1].t < MIN_INTERVAL_MS
  ) {
    history[history.length - 1].v = value;
  } else {
    history.push({ t: now, v: value });
  }

  // Keep max 4000 entries (~28 days at 10 min intervals)
  if (history.length > 4000) history.splice(0, history.length - 4000);
  localStorage.setItem(key, JSON.stringify(history));
}

export function getSnapshots(
  wallet: string,
  period: "1W" | "1M" | "3M"
): Snapshot[] {
  if (typeof window === "undefined" || !wallet) return [];
  let history: Snapshot[];
  try {
    history = JSON.parse(
      localStorage.getItem(`${SNAPSHOT_KEY}_${wallet}`) || "[]"
    );
  } catch {
    return [];
  }
  const days = period === "1W" ? 7 : period === "1M" ? 30 : 90;
  const cutoff = Date.now() - days * 86400_000;
  return history.filter((s) => s.t >= cutoff);
}

export function getAllSnapshots(wallet: string): Snapshot[] {
  if (typeof window === "undefined" || !wallet) return [];
  try {
    return JSON.parse(
      localStorage.getItem(`${SNAPSHOT_KEY}_${wallet}`) || "[]"
    );
  } catch {
    return [];
  }
}

/* ── PnL ── */

export function getPnL(
  wallet: string,
  currentValue: number
): {
  pnl24h: number;
  pnlPct24h: number;
  pnlTotal: number;
  pnlPctTotal: number;
} {
  const zero = { pnl24h: 0, pnlPct24h: 0, pnlTotal: 0, pnlPctTotal: 0 };
  if (typeof window === "undefined" || !wallet || currentValue <= 0)
    return zero;

  let history: Snapshot[];
  try {
    history = JSON.parse(
      localStorage.getItem(`${SNAPSHOT_KEY}_${wallet}`) || "[]"
    );
  } catch {
    return zero;
  }
  if (history.length === 0) return zero;

  // Total PnL (vs first ever snapshot)
  const first = history[0];
  const pnlTotal = currentValue - first.v;
  const pnlPctTotal = first.v > 0 ? (pnlTotal / first.v) * 100 : 0;

  // 24h PnL (vs closest snapshot to 24h ago)
  const target24h = Date.now() - 86400_000;
  let closest = history[0];
  for (const s of history) {
    if (Math.abs(s.t - target24h) < Math.abs(closest.t - target24h))
      closest = s;
  }
  const pnl24h = currentValue - closest.v;
  const pnlPct24h = closest.v > 0 ? (pnl24h / closest.v) * 100 : 0;

  return { pnl24h, pnlPct24h, pnlTotal, pnlPctTotal };
}

/* ── Price tracking for 24h change ── */

interface PriceEntry {
  t: number;
  p: number;
}

export function savePrices(prices: Record<string, number>): void {
  if (typeof window === "undefined") return;
  let stored: Record<string, PriceEntry[]>;
  try {
    stored = JSON.parse(localStorage.getItem(PRICE_KEY) || "{}");
  } catch {
    stored = {};
  }
  const now = Date.now();
  for (const [sym, price] of Object.entries(prices)) {
    if (!price || price <= 0) continue;
    if (!stored[sym]) stored[sym] = [];
    // Only add if last entry is > 10min old
    const last = stored[sym][stored[sym].length - 1];
    if (last && now - last.t < MIN_INTERVAL_MS) {
      last.p = price;
    } else {
      stored[sym].push({ t: now, p: price });
    }
    // Keep last 200 entries per symbol
    if (stored[sym].length > 200)
      stored[sym].splice(0, stored[sym].length - 200);
  }
  localStorage.setItem(PRICE_KEY, JSON.stringify(stored));
}

export function get24hChange(symbol: string): number | undefined {
  if (typeof window === "undefined") return undefined;
  let stored: Record<string, PriceEntry[]>;
  try {
    stored = JSON.parse(localStorage.getItem(PRICE_KEY) || "{}");
  } catch {
    return undefined;
  }
  const entries = stored[symbol];
  if (!entries || entries.length < 2) return undefined;

  const current = entries[entries.length - 1].p;
  const target = Date.now() - 86400_000;
  let closest = entries[0];
  for (const e of entries) {
    if (Math.abs(e.t - target) < Math.abs(closest.t - target)) closest = e;
  }
  // Only return if the closest entry is reasonably close to 24h ago (within 2h)
  if (Math.abs(closest.t - target) > 2 * 3600_000) return undefined;
  return closest.p > 0 ? ((current - closest.p) / closest.p) * 100 : undefined;
}
