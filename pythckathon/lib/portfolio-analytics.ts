/**
 * Portfolio performance analytics computed from snapshot history.
 */

import type { Snapshot } from "./portfolio-history";

export interface PortfolioMetrics {
  maxDrawdown: number;       // % (negative)
  bestDay: number;           // % gain
  worstDay: number;          // % loss
  sharpeRatio: number;       // annualized
  volatility: number;        // annualized %
  totalReturn: number;       // %
}

const RISK_FREE_ANNUAL = 0.05; // 5% annual risk-free rate
const RISK_FREE_DAILY = RISK_FREE_ANNUAL / 365;

/**
 * Compute analytics from an array of snapshots.
 * Requires at least 2 snapshots to produce meaningful results.
 */
export function computeMetrics(snapshots: Snapshot[]): PortfolioMetrics | null {
  if (snapshots.length < 2) return null;

  // Sort by time ascending
  const sorted = [...snapshots].sort((a, b) => a.t - b.t);

  // Group snapshots by calendar day and take last value per day
  const dayMap = new Map<string, number>();
  for (const s of sorted) {
    const d = new Date(s.t);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    dayMap.set(key, s.v);
  }

  const dailyValues = Array.from(dayMap.values());
  if (dailyValues.length < 2) return null;

  // Daily returns
  const dailyReturns: number[] = [];
  for (let i = 1; i < dailyValues.length; i++) {
    const prev = dailyValues[i - 1];
    if (prev > 0) {
      dailyReturns.push((dailyValues[i] - prev) / prev);
    }
  }

  if (dailyReturns.length === 0) return null;

  // Total return
  const first = dailyValues[0];
  const last = dailyValues[dailyValues.length - 1];
  const totalReturn = first > 0 ? ((last - first) / first) * 100 : 0;

  // Best day / worst day
  const bestDay = Math.max(...dailyReturns) * 100;
  const worstDay = Math.min(...dailyReturns) * 100;

  // Max drawdown
  let peak = -Infinity;
  let maxDD = 0;
  for (const v of dailyValues) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? ((v - peak) / peak) * 100 : 0;
    if (dd < maxDD) maxDD = dd;
  }

  // Mean and std dev of daily returns
  const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / dailyReturns.length;
  const stdDev = Math.sqrt(variance);

  // Annualized volatility
  const volatility = stdDev * Math.sqrt(365) * 100;

  // Sharpe ratio (annualized)
  const sharpeRatio = stdDev > 0 ? ((mean - RISK_FREE_DAILY) / stdDev) * Math.sqrt(365) : 0;

  return {
    maxDrawdown: maxDD,
    bestDay,
    worstDay,
    sharpeRatio,
    volatility,
    totalReturn,
  };
}
