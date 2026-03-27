import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const HELIUS_RPC = process.env.NEXT_PUBLIC_HELIUS_RPC || `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY || ""}`;

export interface WalletToken {
  symbol: string;
  name: string;
  mint: string;
  amount: number;
  decimals: number;
  logo?: string;
  cgId?: string;
  price?: number;
  value?: number;
  platform?: string;
  platformType?: "wallet" | "staked" | "lp";
  apy?: number;
}

export interface NativeStake {
  pubkey: string;
  activeStake: number; // in SOL
  state: "active" | "deactivating" | "inactive";
  voter?: string;
}

// Known token → platform assignments with live-ish APYs
export const TOKEN_PLATFORMS: Record<
  string,
  { platform: string; type: "staked" | "lp" | "wallet"; apy?: number }
> = {
  mSOL: { platform: "Marinade", type: "staked", apy: 7.2 },
  jitoSOL: { platform: "Jito", type: "staked", apy: 7.8 },
  JitoSOL: { platform: "Jito", type: "staked", apy: 7.8 },
  bSOL: { platform: "BlazeStake", type: "staked", apy: 6.5 },
  stSOL: { platform: "Lido", type: "staked", apy: 6.8 },
  jupSOL: { platform: "Jupiter", type: "staked", apy: 7.5 },
  hSOL: { platform: "Helius", type: "staked", apy: 7.0 },
  INF: { platform: "Sanctum", type: "staked", apy: 7.3 },
  vSOL: { platform: "The Vault", type: "staked", apy: 7.1 },
  PYTH: { platform: "Pyth", type: "wallet" },
  JUP: { platform: "Jupiter DAO", type: "wallet" },
  RAY: { platform: "Raydium", type: "wallet" },
  ORCA: { platform: "Orca", type: "wallet" },
  MNDE: { platform: "Marinade", type: "wallet" },
  BLZE: { platform: "BlazeStake", type: "wallet" },
};

/**
 * Create a Helius-backed connection for reliable RPC
 */
export function getHeliusConnection(): Connection {
  return new Connection(HELIUS_RPC, "confirmed");
}

/**
 * Scan wallet using Helius RPC for SOL + all SPL tokens
 */
export async function scanWallet(_connection: Connection, publicKey: PublicKey): Promise<{
  solBalance: number;
  tokens: WalletToken[];
  nativeStakes: NativeStake[];
}> {
  const helius = getHeliusConnection();
  const results: WalletToken[] = [];
  let solBalance = 0;
  const nativeStakes: NativeStake[] = [];

  // 1. SOL balance via Helius RPC
  try {
    const lamports = await helius.getBalance(publicKey);
    solBalance = lamports / LAMPORTS_PER_SOL;
  } catch (e) {
    console.warn("[WalletScanner] SOL balance failed:", e);
  }

  // 2. All token accounts via Helius RPC
  try {
    const tokenAccounts = await helius.getParsedTokenAccountsByOwner(
      publicKey,
      { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") }
    );

    for (const acct of tokenAccounts.value) {
      const info = acct.account.data.parsed?.info;
      if (!info) continue;
      const mint = info.mint as string;
      const uiAmount = Number(info.tokenAmount?.uiAmount || 0);
      const decimals = Number(info.tokenAmount?.decimals || 0);
      if (uiAmount <= 0) continue;

      results.push({
        symbol: mint.slice(0, 4) + "...",
        name: "Token",
        mint,
        amount: uiAmount,
        decimals,
      });
    }
  } catch (e) {
    console.warn("[WalletScanner] Token accounts failed:", e);
  }

  // 3. Enrich with Helius DAS API for metadata (name, symbol, logo)
  if (results.length > 0) {
    try {
      const mints = results.map((t) => t.mint);
      const res = await fetch(HELIUS_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "das-batch",
          method: "getAssetBatch",
          params: { ids: mints },
        }),
      });
      const json = await res.json();
      const assets = json?.result || [];
      for (const asset of assets) {
        const token = results.find((t) => t.mint === asset.id);
        if (!token) continue;
        const content = asset.content || {};
        const meta = content.metadata || {};
        token.symbol = meta.symbol || asset.token_info?.symbol || token.symbol;
        token.name = meta.name || token.name;
        token.logo = content.links?.image || content.json_uri || undefined;
        if (asset.token_info?.price_info?.price_per_token) {
          token.price = asset.token_info.price_info.price_per_token;
          token.value = token.amount * (token.price ?? 0);
        }
        // Assign platform info from known tokens
        const pInfo = TOKEN_PLATFORMS[token.symbol];
        if (pInfo) {
          token.platform = pInfo.platform;
          token.platformType = pInfo.type;
          token.apy = pInfo.apy;
        }
      }
    } catch (e) {
      console.warn("[WalletScanner] DAS metadata failed:", e);
    }
  }

  // 4. Native SOL stake accounts
  try {
    const stakeAccounts = await helius.getParsedProgramAccounts(
      new PublicKey("Stake11111111111111111111111111111111111111"),
      {
        filters: [
          { memcmp: { offset: 44, bytes: publicKey.toBase58() } },
        ],
      }
    );
    for (const acct of stakeAccounts) {
      const parsed = (acct.account.data as any)?.parsed;
      if (!parsed) continue;
      const info = parsed.info;
      const stake = info?.stake;
      const delegation = stake?.delegation;
      if (delegation) {
        const deactivationEpoch = delegation.deactivationEpoch;
        nativeStakes.push({
          pubkey: acct.pubkey.toBase58(),
          activeStake: Number(delegation.stake) / LAMPORTS_PER_SOL,
          state:
            deactivationEpoch === "18446744073709551615"
              ? "active"
              : "deactivating",
          voter: delegation.voter,
        });
      }
    }
  } catch (e) {
    console.warn("[WalletScanner] Native stakes failed:", e);
  }

  // Sort by value descending
  results.sort((a, b) => (b.value || 0) - (a.value || 0));

  return { solBalance, tokens: results, nativeStakes };
}

/**
 * Scan a wallet by address string (for watch-only / multi-wallet support).
 * Does not require a wallet adapter connection.
 */
export async function scanWalletByAddress(address: string): Promise<{
  solBalance: number;
  tokens: WalletToken[];
  nativeStakes: NativeStake[];
}> {
  const pk = new PublicKey(address);
  const conn = getHeliusConnection();
  return scanWallet(conn, pk);
}

/**
 * Sign a message to verify wallet ownership
 */
export function buildSignInMessage(wallet: string): string {
  return `Sign in to PythFeeds\n\nWallet: ${wallet}\nTimestamp: ${new Date().toISOString()}`;
}

/**
 * Check if user has signed in this session
 */
export function isSignedIn(wallet: string): boolean {
  if (typeof window === "undefined") return false;
  // Check localStorage first (persists across sessions), fallback to sessionStorage
  return !!localStorage.getItem(`pythfeeds_session_${wallet}`) || !!sessionStorage.getItem(`pythfeeds_session_${wallet}`);
}

export function setSignedIn(wallet: string): void {
  if (typeof window === "undefined") return;
  const ts = Date.now().toString();
  localStorage.setItem(`pythfeeds_session_${wallet}`, ts);
  sessionStorage.setItem(`pythfeeds_session_${wallet}`, ts);
}

export function clearSignIn(wallet: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`pythfeeds_session_${wallet}`);
  sessionStorage.removeItem(`pythfeeds_session_${wallet}`);
}
