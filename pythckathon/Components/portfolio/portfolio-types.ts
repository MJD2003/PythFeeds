// ── Portfolio shared types & constants ──

export interface ManualHolding {
  id: string;
  symbol: string;
  name: string;
  type: "coin" | "stock";
  amount: number;
  buyPrice: number;
  addedAt: number;
}

export interface HoldingWithPnL extends ManualHolding {
  currentPrice: number;
  pnl: number;
  pnlPct: number;
  value: number;
}

// ── localStorage helpers ──
const STORAGE_KEY = "pythfeeds_portfolio";
function getKey(w: string) {
  return `${STORAGE_KEY}_${w}`;
}
export function loadHoldings(w: string): ManualHolding[] {
  if (typeof window === "undefined" || !w) return [];
  try {
    return JSON.parse(localStorage.getItem(getKey(w)) || "[]");
  } catch {
    return [];
  }
}
export function saveHoldings(w: string, h: ManualHolding[]) {
  if (typeof window === "undefined" || !w) return;
  localStorage.setItem(getKey(w), JSON.stringify(h));
}

// ── Format helpers (portfolio-specific) ──
import { fmtCurrency } from "@/lib/format";

export function fmtUsd(n: number) {
  return fmtCurrency(n);
}

export function fmtPrice(n: number) {
  if (n >= 1) return fmtUsd(n);
  if (n >= 0.01)
    return "$" + n.toFixed(4);
  // subscript notation for very small prices like $0.0₃10964
  const str = n.toFixed(10);
  const afterDot = str.split(".")[1] || "";
  let zeros = 0;
  for (const c of afterDot) {
    if (c === "0") zeros++;
    else break;
  }
  if (zeros >= 3) {
    const sig = afterDot.slice(zeros, zeros + 5);
    return `$0.0₃${sig}`;
  }
  return "$" + n.toFixed(6);
}

export function fmtBalance(n: number) {
  if (n >= 1)
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n.toFixed(5);
}

export const MANUAL_ASSETS = [
  { symbol: "BTC", name: "Bitcoin", type: "coin" as const },
  { symbol: "ETH", name: "Ethereum", type: "coin" as const },
  { symbol: "SOL", name: "Solana", type: "coin" as const },
  { symbol: "BNB", name: "BNB", type: "coin" as const },
  { symbol: "XRP", name: "XRP", type: "coin" as const },
  { symbol: "ADA", name: "Cardano", type: "coin" as const },
  { symbol: "DOGE", name: "Dogecoin", type: "coin" as const },
  { symbol: "LINK", name: "Chainlink", type: "coin" as const },
  { symbol: "LTC", name: "Litecoin", type: "coin" as const },
  { symbol: "AAPL", name: "Apple Inc.", type: "stock" as const },
  { symbol: "MSFT", name: "Microsoft", type: "stock" as const },
  { symbol: "NVDA", name: "NVIDIA", type: "stock" as const },
  { symbol: "TSLA", name: "Tesla", type: "stock" as const },
];

// ── Known staking derivative tokens ──
export const STAKING_TOKENS: Record<string, { platform: string; type: string }> = {
  mSOL: { platform: "Marinade", type: "Staked" },
  jitoSOL: { platform: "Jito", type: "Staked" },
  bSOL: { platform: "BlazeStake", type: "Staked" },
  JitoSOL: { platform: "Jito", type: "Staked" },
  stSOL: { platform: "Lido", type: "Staked" },
  PYTH: { platform: "Pyth", type: "Holdings" },
  JUP: { platform: "Jupiter DAO", type: "Holdings" },
};

// ── Platform icon colors ──
export const PLATFORM_COLORS: Record<string, string> = {
  Wallet: "var(--cmc-text)",
  Pyth: "var(--cmc-text)",
  "Jupiter DAO": "var(--cmc-text)",
  Marinade: "var(--cmc-text)",
  Jito: "var(--cmc-text)",
  BlazeStake: "var(--cmc-text)",
  Lido: "var(--cmc-text)",
  Manual: "var(--cmc-text)",
  NFTs: "var(--cmc-text)",
  "Native Staking": "var(--cmc-text)",
};

// Known symbol → CoinGecko slug for linking to /coins/[slug]
export const COIN_SLUGS: Record<string, string> = {
  SOL: "solana", PYTH: "pyth-network", JUP: "jupiter-exchange-solana",
  BTC: "bitcoin", ETH: "ethereum", BNB: "binancecoin", XRP: "ripple",
  ADA: "cardano", DOGE: "dogecoin", LINK: "chainlink", LTC: "litecoin",
  BONK: "bonk", WIF: "dogwifcoin", JTO: "jito-governance-token",
  USDC: "usd-coin", USDT: "tether", RAY: "raydium", ORCA: "orca",
  mSOL: "msol", jitoSOL: "jito-staked-sol", bSOL: "blazestake-staked-sol",
};
