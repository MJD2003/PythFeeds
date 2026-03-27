import { VersionedTransaction } from "@solana/web3.js";

// ── Jupiter Ultra API (replaces deprecated v6) ──
const JUPITER_BASE = "https://api.jup.ag";
const JUP_API_KEY = process.env.NEXT_PUBLIC_JUPITER_API_KEY || "";

function jupHeaders(json = false): HeadersInit {
  const h: Record<string, string> = {};
  if (JUP_API_KEY) h["x-api-key"] = JUP_API_KEY;
  if (json) h["Content-Type"] = "application/json";
  return h;
}

// ── Popular Solana tokens ──
export interface TokenInfo {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logo: string;
  coingeckoId?: string;
}

export const POPULAR_TOKENS: TokenInfo[] = [
  {
    symbol: "SOL",
    name: "Solana",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    coingeckoId: "solana",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
    coingeckoId: "usd-coin",
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg",
    coingeckoId: "tether",
  },
  {
    symbol: "JUP",
    name: "Jupiter",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    decimals: 6,
    logo: "https://static.jup.ag/jup/icon.png",
    coingeckoId: "jupiter-exchange-solana",
  },
  {
    symbol: "PYTH",
    name: "Pyth Network",
    mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    decimals: 6,
    logo: "https://pyth.network/token.svg",
    coingeckoId: "pyth-network",
  },
  {
    symbol: "BONK",
    name: "Bonk",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    decimals: 5,
    logo: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
    coingeckoId: "bonk",
  },
  {
    symbol: "WIF",
    name: "dogwifhat",
    mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    decimals: 6,
    logo: "https://bafkreibk3covs5ltyqxa272uodhber5gdbueksnce4n6pz3xkdi5vkm2ty.ipfs.nftstorage.link",
    coingeckoId: "dogwifcoin",
  },
  {
    symbol: "JTO",
    name: "Jito",
    mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
    decimals: 9,
    logo: "https://metadata.jito.network/token/jto/icon.png",
    coingeckoId: "jito-governance-token",
  },
  {
    symbol: "RAY",
    name: "Raydium",
    mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    decimals: 6,
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png",
    coingeckoId: "raydium",
  },
  {
    symbol: "ORCA",
    name: "Orca",
    mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
    decimals: 6,
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png",
    coingeckoId: "orca",
  },
  {
    symbol: "mSOL",
    name: "Marinade SOL",
    mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    decimals: 9,
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png",
    coingeckoId: "msol",
  },
  {
    symbol: "jitoSOL",
    name: "Jito Staked SOL",
    mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
    decimals: 9,
    logo: "https://storage.googleapis.com/token-metadata/JitoSOL-256.png",
    coingeckoId: "jito-staked-sol",
  },
  {
    symbol: "W",
    name: "Wormhole",
    mint: "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ",
    decimals: 6,
    logo: "https://wormhole.com/token.png",
    coingeckoId: "wormhole",
  },
  {
    symbol: "RENDER",
    name: "Render Token",
    mint: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof",
    decimals: 8,
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof/logo.png",
    coingeckoId: "render-token",
  },
  {
    symbol: "HNT",
    name: "Helium",
    mint: "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux",
    decimals: 8,
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux/logo.png",
    coingeckoId: "helium",
  },
];

// ── Jupiter Ultra Order (quote + transaction in one call) ──
export interface UltraOrder {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  priceImpact: number;
  inUsdValue: number;
  outUsdValue: number;
  routePlan: {
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
    };
    percent: number;
  }[];
  transaction: string; // base64 unsigned tx
  requestId: string;
  router: string;
  errorCode?: number;
  errorMessage?: string;
}

/**
 * Get a swap order from Jupiter Ultra API.
 * Returns quote data + unsigned transaction in one call.
 * taker = user's wallet public key (required for transaction; omit for quote-only).
 */
export async function getUltraOrder(
  inputMint: string,
  outputMint: string,
  amount: number, // in smallest units (lamports, etc.)
  taker?: string,
  slippageBps = 50
): Promise<UltraOrder | null> {
  try {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: Math.floor(amount).toString(),
    });
    if (taker) params.set("taker", taker);
    if (slippageBps !== 50) params.set("slippageBps", slippageBps.toString());

    const res = await fetch(`${JUPITER_BASE}/ultra/v1/order?${params}`, {
      headers: jupHeaders(),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("[Jupiter Ultra] Order failed:", res.status, errText);
      return null;
    }
    const data: UltraOrder = await res.json();
    if (data.errorCode || data.errorMessage) {
      console.warn("[Jupiter Ultra] Order error:", data.errorCode, data.errorMessage);
    }
    return data;
  } catch (err) {
    console.error("[Jupiter Ultra] Order error:", err);
    return null;
  }
}

/**
 * Execute a signed swap via Jupiter Ultra API.
 * Jupiter handles broadcasting + confirmation.
 * Returns the transaction signature or null.
 */
export async function executeUltraSwap(
  signedTransaction: string, // base64
  requestId: string
): Promise<{ status: string; signature: string | null }> {
  try {
    const res = await fetch(`${JUPITER_BASE}/ultra/v1/execute`, {
      method: "POST",
      headers: jupHeaders(true),
      body: JSON.stringify({ signedTransaction, requestId }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("[Jupiter Ultra] Execute failed:", res.status, errText);
      return { status: "Failed", signature: null };
    }
    const data = await res.json();
    return {
      status: data.status || "Failed",
      signature: data.signature || null,
    };
  } catch (err) {
    console.error("[Jupiter Ultra] Execute error:", err);
    return { status: "Failed", signature: null };
  }
}

/**
 * Helper: sign an Ultra order's transaction with the user's wallet.
 * Returns base64-encoded signed transaction.
 */
export async function signUltraOrder(
  transaction: string, // base64 unsigned
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
): Promise<string> {
  const txBuf = Buffer.from(transaction, "base64");
  const versionedTx = VersionedTransaction.deserialize(txBuf);
  const signed = await signTransaction(versionedTx);
  return Buffer.from(signed.serialize()).toString("base64");
}

// ── Helper: find token by symbol ──
export function findToken(symbol: string): TokenInfo | undefined {
  return POPULAR_TOKENS.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase());
}

// ── Helper: find token by mint ──
export function findTokenByMint(mint: string): TokenInfo | undefined {
  return POPULAR_TOKENS.find((t) => t.mint === mint);
}

// ── Search any Solana token via Jupiter API ──
export interface JupiterSearchResult {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  daily_volume?: number;
}

export async function searchJupiterTokens(query: string): Promise<TokenInfo[]> {
  if (!query || query.length < 2) return [];
  try {
    const res = await fetch(
      `https://tokens.jup.ag/token-list/all`,
      { headers: jupHeaders() }
    );
    if (!res.ok) return [];
    const allTokens: JupiterSearchResult[] = await res.json();
    const q = query.toLowerCase();
    const matches = allTokens
      .filter(
        (t) =>
          t.symbol?.toLowerCase().includes(q) ||
          t.name?.toLowerCase().includes(q) ||
          t.address?.toLowerCase() === q
      )
      .sort((a, b) => (b.daily_volume || 0) - (a.daily_volume || 0))
      .slice(0, 20);
    return matches.map((t) => ({
      symbol: t.symbol || "???",
      name: t.name || "Unknown",
      mint: t.address,
      decimals: t.decimals ?? 6,
      logo: t.logoURI || "",
    }));
  } catch (err) {
    console.warn("[Jupiter] Token search failed:", err);
    return [];
  }
}

