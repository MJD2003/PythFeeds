import { VersionedTransaction } from "@solana/web3.js";

// ── Kamino API ──
const KAMINO_BASE = "https://api.kamino.finance";
const KAMINO_MAIN_MARKET = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";
const KAMINO_ALL_MARKETS = [
  "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF", // Main Market
  "DxXdAyU3kCjnyggvHmY5nAwg5cRbbmdyX3npfDMjjMek", // JLP Market
  "ByYiZxp8QrdN9qbdtaAiePN8AAr3qvTPppNJDpf5DVJ5", // Altcoin Market
  "BJnbcRHqvppTyGesLzWASGKnmnF1wq9jdSKoFxfHPnEb", // Ethena Market
  "EyV4jxSMd6vpuRgrxMFem7CKRhcB4Vv6WMRDtxPQNP4",  // Jito Market
];
const NULL_ADDR = "11111111111111111111111111111111";

const KNOWN_MINTS: Record<string, { symbol: string; decimals: number }> = {
  "So11111111111111111111111111111111111111112": { symbol: "SOL", decimals: 9 },
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { symbol: "USDC", decimals: 6 },
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": { symbol: "USDT", decimals: 6 },
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn": { symbol: "JitoSOL", decimals: 9 },
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So": { symbol: "mSOL", decimals: 9 },
  "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1": { symbol: "bSOL", decimals: 9 },
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": { symbol: "BONK", decimals: 5 },
  "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL": { symbol: "JTO", decimals: 9 },
  "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3": { symbol: "PYTH", decimals: 6 },
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": { symbol: "ETH", decimals: 8 },
  "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5": { symbol: "MEW", decimals: 5 },
  "WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk": { symbol: "WEN", decimals: 5 },
  "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof": { symbol: "RENDER", decimals: 8 },
  "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux": { symbol: "HNT", decimals: 8 },
  "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v": { symbol: "jupSOL", decimals: 9 },
  "vSoLxydx6akxyMD9XEcPvGYNGq6Nn66oqVb3UkGkei7": { symbol: "vSOL", decimals: 9 },
  "he1iusmfkpAdwvFbDgKYheMBfUaMKkdjUipKMmCRn3v": { symbol: "hSOL", decimals: 9 },
  "LSTxxxnJzKDFSLr4dUkPcmCf5VyryEqzPLz5j4bpxFp": { symbol: "LST", decimals: 9 },
};

// ═══════════════════════════════════════════
// kSwap — Quote & Execute
// ═══════════════════════════════════════════

export interface KaminoSwapQuote {
  transaction: string; // base64 encoded
  expectedAmountOut: string;
  minAmountOut: string;
  routerType: string; // e.g. "metis"
}

export interface KaminoSwapResponse {
  data: KaminoSwapQuote;
  traceId: string;
}

/**
 * Get a swap quote from Kamino kSwap.
 * amountIn is in smallest units (lamports, etc.).
 */
export async function getKaminoSwapQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: number,
  wallet: string,
  maxSlippageBps = 50
): Promise<KaminoSwapQuote | null> {
  try {
    const params = new URLSearchParams({
      tokenIn,
      tokenOut,
      amountIn: Math.floor(amountIn).toString(),
      maxSlippageBps: maxSlippageBps.toString(),
      wallet,
    });
    const res = await fetch(`${KAMINO_BASE}/kswap/swap/?${params}`);
    if (!res.ok) {
      console.warn("[Kamino kSwap] Quote failed:", res.status);
      return null;
    }
    const json: KaminoSwapResponse = await res.json();
    return json.data || null;
  } catch (err) {
    console.warn("[Kamino kSwap] Quote error:", err);
    return null;
  }
}

/**
 * Sign a Kamino kSwap transaction with the user's wallet.
 * The Kamino API returns a base64 versioned transaction that needs signing + sending.
 */
export async function signKaminoSwapTx(
  transaction: string,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
): Promise<VersionedTransaction> {
  const txBuf = Buffer.from(transaction, "base64");
  const versionedTx = VersionedTransaction.deserialize(txBuf);
  return await signTransaction(versionedTx);
}

// ═══════════════════════════════════════════
// Kamino Earn — Vault Data
// ═══════════════════════════════════════════

export interface KaminoVault {
  address: string;
  programId: string;
  state: {
    tokenMint: string;
    tokenMintDecimals: number;
    sharesMint: string;
    sharesMintDecimals: number;
    sharesIssued: string;
    tokenAvailable: string;
    performanceFeeBps: number;
    managementFeeBps: number;
    name: string;
    cumulativeEarnedInterest: string;
  };
}

/**
 * Fetch all Kamino Earn vaults.
 */
export async function fetchKaminoVaults(): Promise<KaminoVault[]> {
  try {
    const res = await fetch(`${KAMINO_BASE}/kvaults/vaults`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn("[Kamino] Failed to fetch vaults:", err);
    return [];
  }
}

// ═══════════════════════════════════════════
// Kamino Earn — User Vault Shares
// GET /kvaults/users/{pubkey}/shares
// ═══════════════════════════════════════════

export interface KaminoVaultShare {
  vaultAddress: string;
  stakedShares: string;
  unstakedShares: string;
  totalShares: string;
}

export async function fetchKaminoEarnShares(wallet: string): Promise<KaminoVaultShare[]> {
  // Try /positions first (returns [] instead of 404 for empty), fall back to /shares
  try {
    const res = await fetch(`${KAMINO_BASE}/kvaults/users/${wallet}/positions`);
    if (res.ok) {
      const data = await res.json();
      const positions = Array.isArray(data) ? data : [];
      // Map position objects to KaminoVaultShare format
      const shares: KaminoVaultShare[] = positions.map((p: any) => ({
        vaultAddress: p.vaultAddress || p.kvault || "",
        stakedShares: String(p.stakedShares || "0"),
        unstakedShares: String(p.unstakedShares || "0"),
        totalShares: String(p.totalShares || "0"),
      }));
      return shares.filter(s => parseFloat(s.totalShares) > 0);
    }
    // Fallback to /shares
    const res2 = await fetch(`${KAMINO_BASE}/kvaults/users/${wallet}/shares`);
    if (!res2.ok) return [];
    const data2 = await res2.json();
    const shares2: KaminoVaultShare[] = Array.isArray(data2) ? data2 : [];
    return shares2.filter(s => parseFloat(s.totalShares) > 0);
  } catch (err) {
    console.warn("[Kamino Earn] Failed to fetch shares:", err);
    return [];
  }
}

// ═══════════════════════════════════════════
// Kamino Earn — User Totals (metrics/history)
// GET /kvaults/users/{pubkey}/metrics/history
// ═══════════════════════════════════════════

export interface KaminoEarnTotals {
  usdAmount: number;
  solAmount: number;
  weightedApy: number;
  cumulativeInterestEarnedUsd: number;
  cumulativeInterestEarnedSol: number;
}

export async function fetchKaminoEarnTotals(wallet: string): Promise<KaminoEarnTotals | null> {
  try {
    const now = new Date().toISOString();
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const res = await fetch(`${KAMINO_BASE}/kvaults/users/${wallet}/metrics/history?start=${dayAgo}&end=${now}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const latest = data[data.length - 1];
    return {
      usdAmount: parseFloat(latest.usdAmount || "0"),
      solAmount: parseFloat(latest.solAmount || "0"),
      weightedApy: parseFloat(latest.weightedApy || "0"),
      cumulativeInterestEarnedUsd: parseFloat(latest.cumulativeInterestEarnedUsd || "0"),
      cumulativeInterestEarnedSol: parseFloat(latest.cumulativeInterestEarnedSol || "0"),
    };
  } catch (err) {
    console.warn("[Kamino Earn] Failed to fetch totals:", err);
    return null;
  }
}

// ═══════════════════════════════════════════
// Kamino Earn — Individual Vault Metrics
// GET /kvaults/{pubkey}/metrics
// ═══════════════════════════════════════════

export interface KaminoVaultMetrics {
  vaultAddress: string;
  apy: number;
  apy7d: number;
  tokenPrice: number;
  sharePrice: number;
  tokensPerShare: number;
  tokensAvailableUsd: number;
  tokensInvestedUsd: number;
  numberOfHolders: number;
  apyFarmRewards: number;
}

export async function fetchKaminoVaultMetrics(vaultAddress: string): Promise<KaminoVaultMetrics | null> {
  try {
    const res = await fetch(`${KAMINO_BASE}/kvaults/${vaultAddress}/metrics`);
    if (!res.ok) return null;
    const d = await res.json();
    return {
      vaultAddress,
      apy: parseFloat(d.apy || "0"),
      apy7d: parseFloat(d.apy7d || "0"),
      tokenPrice: parseFloat(d.tokenPrice || "0"),
      sharePrice: parseFloat(d.sharePrice || "0"),
      tokensPerShare: parseFloat(d.tokensPerShare || "1"),
      tokensAvailableUsd: parseFloat(d.tokensAvailableUsd || "0"),
      tokensInvestedUsd: parseFloat(d.tokensInvestedUsd || "0"),
      numberOfHolders: d.numberOfHolders || 0,
      apyFarmRewards: parseFloat(d.apyFarmRewards || "0"),
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════
// Kamino Earn — User Rewards (season points)
// GET /kvaults/users/{pubkey}/rewards
// ═══════════════════════════════════════════

export async function fetchKaminoEarnRewards(wallet: string): Promise<any> {
  try {
    const res = await fetch(`${KAMINO_BASE}/kvaults/users/${wallet}/rewards`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════
// Kamino Lend — User Rewards
// GET /klend/users/{pubkey}/rewards
// ═══════════════════════════════════════════

export async function fetchKaminoLendRewards(wallet: string): Promise<any> {
  try {
    const res = await fetch(`${KAMINO_BASE}/klend/users/${wallet}/rewards`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════
// Kamino Season Rewards (combined KLend + KVault)
// GET /season-rewards/users/{pubkey}
// ═══════════════════════════════════════════

export interface KaminoSeasonReward {
  source: string;
  totalPoints: number;
  klendPoints: number;
  kvaultPoints: number;
}

export async function fetchKaminoSeasonRewards(wallet: string): Promise<KaminoSeasonReward | null> {
  try {
    const res = await fetch(`${KAMINO_BASE}/season-rewards/users/${wallet}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      source: data.source || "",
      totalPoints: parseFloat(data.totalPoints || "0"),
      klendPoints: parseFloat(data.klendPoints || "0"),
      kvaultPoints: parseFloat(data.kvaultPoints || "0"),
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════
// Kamino Farming — User Transactions
// GET /farms/users/{pubkey}/transactions
// ═══════════════════════════════════════════

export interface KaminoFarmTx {
  instruction: string;
  rewardMint?: string;
  rewardAmount?: string;
  rewardSymbol?: string;
  rewardUsdValue?: number;
  timestamp: string;
  signature: string;
  farmAddress: string;
}

export async function fetchKaminoFarmingTxs(wallet: string): Promise<KaminoFarmTx[]> {
  try {
    const res = await fetch(`${KAMINO_BASE}/farms/users/${wallet}/transactions?limit=50&sort=desc`);
    if (!res.ok) return [];
    const data = await res.json();
    const results = data.result || [];
    return results.map((tx: any) => ({
      instruction: tx.instruction || "",
      rewardMint: tx.rewardMint || tx.tokenMint || "",
      rewardAmount: tx.rewardAmount || tx.tokenAmount || "0",
      rewardSymbol: tx.rewardSymbol || tx.tokenSymbol || "",
      rewardUsdValue: parseFloat(tx.rewardUsdValue || tx.usdValue || "0"),
      timestamp: tx.timestamp || tx.createdOn || "",
      signature: tx.signature || "",
      farmAddress: tx.farm || tx.farmAddress || "",
    }));
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════
// Kamino Lend — Token Resolution
// Hardcoded reserve → token map + oracle prices for enrichment
// ═══════════════════════════════════════════

// Known reserve addresses for the main Kamino markets
// (reserve address → { symbol, mint, decimals })
const KNOWN_RESERVES: Record<string, { symbol: string; mint: string; decimals: number }> = {
  // Main Market
  "d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q":  { symbol: "SOL",     mint: "So11111111111111111111111111111111111111112",  decimals: 9 },
  "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59": { symbol: "USDC",    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  "H3t6qZ1JkguCNTi9uzVKqQ7dvt2cum4XiXWom6Gn5e5S": { symbol: "USDT",    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
  "Ga4rZytCpFkCBVMrSR8DGHQiqJGskpCe8VFVxuoP5h6D": { symbol: "JitoSOL", mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", decimals: 9 },
  "H9vmCVd77N1HZa36eBn3UnftYmg4vQzPfm1RxabHAMER": { symbol: "mSOL",    mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", decimals: 9 },
  "GvPEtF7MsZceLbrrjprfcKN9quJ7EW221c4H3kbxnmpM": { symbol: "bSOL",    mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", decimals: 9 },
  "H6rHXmXoCQvq8Ue81MqNh7ow5ysPa1dSozwW3PU1HLAR": { symbol: "ETH",     mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", decimals: 8 },
  "FERjPVNEa7Udq4MaLeSsnGMgerMhEQhKM4sYMPsEcJnX": { symbol: "BONK",    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5 },
  "GBiLQLv7CVgLBzFE4bBDDgz9sME9JfRXBNhKJKUraZBL": { symbol: "JTO",     mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", decimals: 9 },
  "EVbyPKrHG6WBfm4dLkMz1ofH6f67VCPJoB5jBCNbeVcA": { symbol: "jupSOL",  mint: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v", decimals: 9 },
  "Hcz1o77tF2MMRFe1RH4maNRwZSi1brbkYSFkBDjDMump": { symbol: "JLP",     mint: "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4", decimals: 6 },
  "FGRXexHSVbPFVmMezJRYkP8VtoBE1HWbRYW6bpBbfFpT": { symbol: "PYTH",    mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", decimals: 6 },
  "6gKkMmHmNh1JhZ7i3MG81xp2SjLJCy6i2ePFXhYbMZ9G": { symbol: "USDe",    mint: "DEkqHyPN7GMRJ5cArtQFAWefqbZb33Hyf6s5iCwjEonT", decimals: 9 },
  "DJRYMaiM7hVjwPh3pxtp7QVH5ux7VibDhwJm5PHK4Jdb": { symbol: "USDS",    mint: "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA",  decimals: 6 },
  "EAjMbMVBV6mgaFq3eTMjMm7APwnuXeoEHkmiMy5HDCWN": { symbol: "WIF",     mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", decimals: 6 },
};

interface ReserveTokenInfo {
  symbol: string;
  mint: string;
  decimals: number;
}

let _reserveCache: Map<string, ReserveTokenInfo> | null = null;
let _reserveCacheTs = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getReserveMap(): Promise<Map<string, ReserveTokenInfo>> {
  if (_reserveCache && Date.now() - _reserveCacheTs < CACHE_TTL_MS) return _reserveCache;
  const map = new Map<string, ReserveTokenInfo>();

  // 1. Seed with KNOWN_MINTS (keyed by mint address)
  for (const [mint, info] of Object.entries(KNOWN_MINTS)) {
    map.set(mint, { ...info, mint });
  }

  // 2. Seed with KNOWN_RESERVES (keyed by reserve address)
  for (const [reserve, info] of Object.entries(KNOWN_RESERVES)) {
    map.set(reserve, info);
  }

  // 3. Enrich from Kamino oracle prices (fields: mint, name, price)
  try {
    const res = await fetch(`${KAMINO_BASE}/oracles/prices?markets=all`);
    if (res.ok) {
      const data = await res.json();
      for (const o of (Array.isArray(data) ? data : [])) {
        const mint = o.mint || "";
        const name = o.name || "";
        if (mint && name && !map.has(mint)) {
          // Oracle doesn't provide decimals; look up from KNOWN_MINTS
          const dec = KNOWN_MINTS[mint]?.decimals ?? 0;
          map.set(mint, { symbol: name, mint, decimals: dec });
        }
      }
    }
  } catch {}

  _reserveCache = map;
  _reserveCacheTs = Date.now();
  return map;
}

// ═══════════════════════════════════════════
// Kamino Lend — User Obligations
// GET /kamino-market/{marketPubkey}/users/{userPubkey}/obligations
// Checks ALL known Kamino markets
// ═══════════════════════════════════════════

export interface KaminoLendPosition {
  reserveAddress: string;
  tokenSymbol: string;
  tokenMint: string;
  amount: number;
  valueUsd: number;
  type: "supply" | "borrow";
}

export interface KaminoObligation {
  obligationAddress: string;
  tag: string;
  deposits: KaminoLendPosition[];
  borrows: KaminoLendPosition[];
  stats: {
    totalDeposit: number;
    totalBorrow: number;
    netAccountValue: number;
    leverage: number;
    loanToValue: number;
    borrowUtilization: number;
    borrowLimit: number;
    liquidationLtv: number;
  };
}

export async function fetchKaminoObligations(wallet: string): Promise<KaminoObligation[]> {
  try {
    // Fetch obligations from ALL known markets + reserve map in parallel
    const [reserveMap, ...marketResults] = await Promise.all([
      getReserveMap(),
      ...KAMINO_ALL_MARKETS.map(market =>
        fetch(`${KAMINO_BASE}/kamino-market/${market}/users/${wallet}/obligations`)
          .then(r => r.ok ? r.json() : [])
          .catch(() => [])
      ),
    ]);

    const allObligations: KaminoObligation[] = [];

    for (const data of marketResults) {
      const obligations = Array.isArray(data) ? data : [];

      for (const ob of obligations) {
        const state = ob.state || {};
        const stats = ob.refreshedStats || {};

        // Parse deposits
        const rawDeposits = (state.deposits || []) as any[];
        const totalDepositSf = parseFloat(state.depositedValueSf || "0");
        const totalDepositUsd = parseFloat(stats.userTotalDeposit || "0");

        const deposits: KaminoLendPosition[] = rawDeposits
          .filter((d: any) => d.depositReserve !== NULL_ADDR && d.depositedAmount !== "0")
          .map((d: any) => {
            const reserve = reserveMap.get(d.depositReserve);
            const symbol = reserve?.symbol || KNOWN_MINTS[reserve?.mint || ""]?.symbol || d.depositReserve.slice(0, 6) + "…";
            const mint = reserve?.mint || "";
            const decimals = reserve?.decimals || (KNOWN_MINTS[mint]?.decimals ?? 0);
            const amount = decimals > 0 ? Number(d.depositedAmount) / Math.pow(10, decimals) : 0;

            let valueUsd = 0;
            const dSf = parseFloat(d.marketValueSf || "0");
            if (totalDepositSf > 0) {
              valueUsd = totalDepositUsd * (dSf / totalDepositSf);
            }

            return { reserveAddress: d.depositReserve, tokenSymbol: symbol, tokenMint: mint, amount, valueUsd, type: "supply" as const };
          });

        // Parse borrows
        const rawBorrows = (state.borrows || []) as any[];
        const totalBorrowSf = parseFloat(state.borrowedAssetsMarketValueSf || "0");
        const totalBorrowUsd = parseFloat(stats.userTotalBorrow || "0");

        const borrows: KaminoLendPosition[] = rawBorrows
          .filter((b: any) => b.borrowReserve !== NULL_ADDR && b.borrowedAmountSf !== "0")
          .map((b: any) => {
            const reserve = reserveMap.get(b.borrowReserve);
            const symbol = reserve?.symbol || KNOWN_MINTS[reserve?.mint || ""]?.symbol || b.borrowReserve.slice(0, 6) + "…";
            const mint = reserve?.mint || "";
            const decimals = reserve?.decimals || (KNOWN_MINTS[mint]?.decimals ?? 0);
            const amount = decimals > 0
              ? Number(b.borrowedAmountOutsideElevationGroups || "0") / Math.pow(10, decimals)
              : 0;

            let valueUsd = 0;
            const bSf = parseFloat(b.marketValueSf || "0");
            if (totalBorrowSf > 0) {
              valueUsd = totalBorrowUsd * (bSf / totalBorrowSf);
            }

            return { reserveAddress: b.borrowReserve, tokenSymbol: symbol, tokenMint: mint, amount, valueUsd, type: "borrow" as const };
          });

        if (deposits.length === 0 && borrows.length === 0) continue;

        allObligations.push({
          obligationAddress: ob.obligationAddress || "",
          tag: ob.humanTag || "",
          deposits,
          borrows,
          stats: {
            totalDeposit: totalDepositUsd,
            totalBorrow: totalBorrowUsd,
            netAccountValue: parseFloat(stats.netAccountValue || "0"),
            leverage: parseFloat(stats.leverage || "0"),
            loanToValue: parseFloat(stats.loanToValue || "0"),
            borrowUtilization: parseFloat(stats.borrowUtilization || "0"),
            borrowLimit: parseFloat(stats.borrowLimit || "0"),
            liquidationLtv: parseFloat(stats.liquidationLtv || "0"),
          },
        });
      }
    }

    return allObligations;
  } catch (err) {
    console.warn("[Kamino Lend] Failed to fetch obligations:", err);
    return [];
  }
}

// ═══════════════════════════════════════════
// Kamino Earn — User Vault PnL
// GET /kvaults/users/{user}/vaults/{vault}/pnl
// ═══════════════════════════════════════════

export interface KaminoVaultPnl {
  totalPnlUsd: number;
  totalPnlToken: number;
  totalCostBasisUsd: number;
}

export async function fetchKaminoVaultPnl(wallet: string, vault: string): Promise<KaminoVaultPnl | null> {
  try {
    const res = await fetch(`${KAMINO_BASE}/kvaults/users/${wallet}/vaults/${vault}/pnl`);
    if (!res.ok) return null;
    const d = await res.json();
    return {
      totalPnlUsd: parseFloat(d.totalPnl?.usd || "0"),
      totalPnlToken: parseFloat(d.totalPnl?.token || "0"),
      totalCostBasisUsd: parseFloat(d.totalCostBasis?.usd || "0"),
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════
// Kamino Liquidity — Strategy Positions
// Uses /strategies?status=LIVE + /strategies/{addr}/metrics
// Cross-references user wallet tokens with strategy share mints
// ═══════════════════════════════════════════

export interface KaminoStrategy {
  address: string;
  shareMint: string;
  tokenAMint: string;
  tokenBMint: string;
  type: string;
  status: string;
}

export interface KaminoLiquidityPosition {
  strategyAddress: string;
  shareMint: string;
  tokenA: string;
  tokenB: string;
  tokenAMint: string;
  tokenBMint: string;
  sharesHeld: number;
  sharePrice: number;
  usdValue: number;
  tokenAUsd: number;
  tokenBUsd: number;
  tvl: number;
  apy: number;
}

interface UserTokenBalance {
  mint: string;
  amount: number;
}

let _strategyCache: KaminoStrategy[] | null = null;
let _strategyCacheTs = 0;

async function fetchKaminoStrategies(): Promise<KaminoStrategy[]> {
  if (_strategyCache && Date.now() - _strategyCacheTs < CACHE_TTL_MS) return _strategyCache;
  try {
    const res = await fetch(`${KAMINO_BASE}/strategies?status=LIVE`);
    if (!res.ok) return [];
    const data = await res.json();
    const strategies: KaminoStrategy[] = (Array.isArray(data) ? data : []).map((s: any) => ({
      address: s.address || "",
      shareMint: s.shareMint || "",
      tokenAMint: s.tokenAMint || "",
      tokenBMint: s.tokenBMint || "",
      type: s.type || "",
      status: s.status || "",
    }));
    _strategyCache = strategies;
    _strategyCacheTs = Date.now();
    return strategies;
  } catch {
    return [];
  }
}

async function fetchStrategyMetrics(strategyAddress: string): Promise<any> {
  try {
    const res = await fetch(`${KAMINO_BASE}/strategies/${strategyAddress}/metrics`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchKaminoLiquidityPositions(
  userTokens: UserTokenBalance[]
): Promise<KaminoLiquidityPosition[]> {
  try {
    const strategies = await fetchKaminoStrategies();
    if (strategies.length === 0) return [];

    // Build shareMint → strategy map
    const shareMintMap = new Map<string, KaminoStrategy>();
    for (const s of strategies) {
      if (s.shareMint) shareMintMap.set(s.shareMint, s);
    }

    // Find which user tokens match strategy share mints
    const matched: { strategy: KaminoStrategy; amount: number }[] = [];
    for (const token of userTokens) {
      const strategy = shareMintMap.get(token.mint);
      if (strategy && token.amount > 0) {
        matched.push({ strategy, amount: token.amount });
      }
    }

    if (matched.length === 0) return [];

    // Fetch metrics for matched strategies in parallel
    const metricsResults = await Promise.all(
      matched.map(m => fetchStrategyMetrics(m.strategy.address))
    );

    const positions: KaminoLiquidityPosition[] = [];
    for (let i = 0; i < matched.length; i++) {
      const { strategy, amount } = matched[i];
      const metrics = metricsResults[i];
      if (!metrics) continue;

      const sharePrice = parseFloat(metrics.sharePrice || "0");
      const usdValue = amount * sharePrice;
      const tvl = parseFloat(metrics.totalValueLocked || "0");
      const tokenA = metrics.tokenA || KNOWN_MINTS[strategy.tokenAMint]?.symbol || strategy.tokenAMint.slice(0, 6);
      const tokenB = metrics.tokenB || KNOWN_MINTS[strategy.tokenBMint]?.symbol || strategy.tokenBMint.slice(0, 6);
      const apy = parseFloat(metrics.apy?.vault?.totalApy || metrics.kaminoApy?.vault?.apy7d || "0");

      positions.push({
        strategyAddress: strategy.address,
        shareMint: strategy.shareMint,
        tokenA,
        tokenB,
        tokenAMint: strategy.tokenAMint,
        tokenBMint: strategy.tokenBMint,
        sharesHeld: amount,
        sharePrice,
        usdValue,
        tokenAUsd: parseFloat(metrics.vaultBalances?.tokenA?.totalUsd || "0"),
        tokenBUsd: parseFloat(metrics.vaultBalances?.tokenB?.totalUsd || "0"),
        tvl,
        apy,
      });
    }

    return positions.sort((a, b) => b.usdValue - a.usdValue);
  } catch (err) {
    console.warn("[Kamino Liquidity] Failed to fetch positions:", err);
    return [];
  }
}

// ═══════════════════════════════════════════
// Combined user positions for portfolio
// ═══════════════════════════════════════════

export interface KaminoEnrichedVault {
  vaultAddress: string;
  vaultName: string;
  tokenSymbol: string;
  tokenMint: string;
  totalShares: number;
  stakedShares: number;
  unstakedShares: number;
  sharePrice: number;
  tokenPrice: number;
  tokensPerShare: number;
  tokenBalance: number;
  usdValue: number;
  apy: number;
  apy7d: number;
  apyFarmRewards: number;
  pnlUsd: number;
  costBasisUsd: number;
}

export interface KaminoUserPosition {
  // Earn vaults with enriched data
  earnVaults: KaminoEnrichedVault[];
  earnTotalUsd: number;
  earnWeightedApy: number;
  earnInterestUsd: number;
  // Lending obligations (actual token positions)
  obligations: KaminoObligation[];
  lendTotalSupply: number;
  lendTotalBorrow: number;
  lendNetValue: number;
  // Liquidity (LP positions)
  liquidityPositions: KaminoLiquidityPosition[];
  liquidityTotalUsd: number;
  // Farming
  farmingTxs: KaminoFarmTx[];
  hasFarming: boolean;
  farmingTotalUsd: number;
  // Season rewards
  seasonRewards: KaminoSeasonReward | null;
}

export async function fetchKaminoUserPositions(
  wallet: string,
  walletTokens?: { mint: string; amount: number }[]
): Promise<KaminoUserPosition> {
  // Phase 1: Fetch everything in parallel
  const [shares, allVaults, earnTotals, obligations, farmTxs, seasonRewards] = await Promise.all([
    fetchKaminoEarnShares(wallet),
    fetchKaminoVaults(),
    fetchKaminoEarnTotals(wallet),
    fetchKaminoObligations(wallet),
    fetchKaminoFarmingTxs(wallet),
    fetchKaminoSeasonRewards(wallet),
  ]);

  // Phase 2: Enrich earn vaults with metrics + PnL
  const vaultMap = new Map<string, KaminoVault>();
  for (const v of allVaults) vaultMap.set(v.address, v);

  const enrichedVaults: KaminoEnrichedVault[] = [];
  const metricsPromises = shares.map(s => fetchKaminoVaultMetrics(s.vaultAddress));
  const pnlPromises = shares.map(s => fetchKaminoVaultPnl(wallet, s.vaultAddress));
  const [metricsResults, pnlResults] = await Promise.all([
    Promise.all(metricsPromises),
    Promise.all(pnlPromises),
  ]);

  for (let i = 0; i < shares.length; i++) {
    const share = shares[i];
    const vault = vaultMap.get(share.vaultAddress);
    const metrics = metricsResults[i];
    const totalShares = parseFloat(share.totalShares);
    const tokensPerShare = metrics?.tokensPerShare || 1;
    const tokenPrice = metrics?.tokenPrice || 0;
    const tokenBalance = totalShares * tokensPerShare;
    const usdValue = tokenBalance * tokenPrice;

    // Try to resolve token symbol from vault name or known mints
    const tokenMint = vault?.state?.tokenMint || "";
    let tokenSymbol = KNOWN_MINTS[tokenMint]?.symbol || "";
    if (!tokenSymbol && vault?.state?.name) {
      const parts = vault.state.name.split(/[-_\s]/);
      tokenSymbol = parts[0] || "";
    }

    const pnl = pnlResults[i];
    enrichedVaults.push({
      vaultAddress: share.vaultAddress,
      vaultName: vault?.state?.name || share.vaultAddress.slice(0, 8) + "\u2026",
      tokenSymbol,
      tokenMint,
      totalShares,
      stakedShares: parseFloat(share.stakedShares),
      unstakedShares: parseFloat(share.unstakedShares),
      sharePrice: metrics?.sharePrice || 0,
      tokenPrice,
      tokensPerShare,
      tokenBalance,
      usdValue,
      apy: metrics?.apy || 0,
      apy7d: metrics?.apy7d || 0,
      apyFarmRewards: metrics?.apyFarmRewards || 0,
      pnlUsd: pnl?.totalPnlUsd || 0,
      costBasisUsd: pnl?.totalCostBasisUsd || 0,
    });
  }

  enrichedVaults.sort((a, b) => b.usdValue - a.usdValue);

  // Phase 3: Fetch liquidity positions if wallet tokens provided
  let liquidityPositions: KaminoLiquidityPosition[] = [];
  if (walletTokens && walletTokens.length > 0) {
    liquidityPositions = await fetchKaminoLiquidityPositions(walletTokens);
  }
  const liquidityTotalUsd = liquidityPositions.reduce((s, p) => s + p.usdValue, 0);

  // Aggregate lending stats across all obligations
  let lendTotalSupply = 0;
  let lendTotalBorrow = 0;
  let lendNetValue = 0;
  for (const ob of obligations) {
    lendTotalSupply += ob.stats.totalDeposit;
    lendTotalBorrow += ob.stats.totalBorrow;
    lendNetValue += ob.stats.netAccountValue;
  }

  const farmingTotalUsd = farmTxs.reduce((s, tx) => s + (tx.rewardUsdValue || 0), 0);

  return {
    earnVaults: enrichedVaults,
    earnTotalUsd: earnTotals?.usdAmount || enrichedVaults.reduce((s, v) => s + v.usdValue, 0),
    earnWeightedApy: earnTotals?.weightedApy || 0,
    earnInterestUsd: earnTotals?.cumulativeInterestEarnedUsd || 0,
    obligations,
    lendTotalSupply,
    lendTotalBorrow,
    lendNetValue,
    liquidityPositions,
    liquidityTotalUsd,
    farmingTxs: farmTxs,
    hasFarming: farmTxs.length > 0,
    farmingTotalUsd,
    seasonRewards,
  };
}
