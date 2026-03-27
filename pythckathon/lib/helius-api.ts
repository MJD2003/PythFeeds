/**
 * Helius Enhanced API helpers for:
 * - Parsed transaction history (Activity tab)
 * - Staking position detection via transaction reconstruction
 * - Protocol position detection (MagicEden, Kamino, Meteora, etc.)
 */

const HELIUS_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || "";
const HELIUS_API = `https://api.helius.xyz/v0`;
const HELIUS_RPC = process.env.NEXT_PUBLIC_HELIUS_RPC || `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

/* ═══════════════ Transaction History ═══════════════ */

export interface TokenTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  fromTokenAccount: string;
  toTokenAccount: string;
  tokenAmount: number;
  mint: string;
  tokenStandard: string;
}

export interface NativeTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number; // lamports
}

export interface EnhancedTransaction {
  signature: string;
  description: string;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  timestamp: number;
  tokenTransfers: TokenTransfer[];
  nativeTransfers: NativeTransfer[];
  accountData?: { account: string; nativeBalanceChange: number; tokenBalanceChanges: { mint: string; rawTokenAmount: { tokenAmount: string; decimals: number }; userAccount: string }[] }[];
}

/**
 * Fetch parsed transaction history from Helius Enhanced Transactions API.
 */
export async function fetchTransactionHistory(
  address: string,
  limit = 50
): Promise<EnhancedTransaction[]> {
  try {
    const url = `${HELIUS_API}/addresses/${address}/transactions?api-key=${HELIUS_KEY}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Helius API ${res.status}`);
    const data: EnhancedTransaction[] = await res.json();
    return data;
  } catch (e) {
    console.warn("[Helius] Transaction history failed:", e);
    return [];
  }
}

/* ═══════════════ Token Registry (icons + metadata) ═══════════════ */

export interface TokenMeta {
  symbol: string;
  name: string;
  decimals: number;
  icon: string;
}

// Comprehensive mint → metadata (symbol, name, decimals, icon)
export const TOKEN_REGISTRY: Record<string, TokenMeta> = {
  So11111111111111111111111111111111111111112: {
    symbol: "SOL", name: "Solana", decimals: 9,
    icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
  HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3: {
    symbol: "PYTH", name: "Pyth Network", decimals: 6,
    icon: "https://pyth.network/token.svg",
  },
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: {
    symbol: "JUP", name: "Jupiter", decimals: 6,
    icon: "https://static.jup.ag/jup/icon.png",
  },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    symbol: "USDC", name: "USD Coin", decimals: 6,
    icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: {
    symbol: "USDT", name: "Tether", decimals: 6,
    icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg",
  },
  jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL: {
    symbol: "JTO", name: "Jito", decimals: 9,
    icon: "https://metadata.jito.network/token/jto/icon.png",
  },
  MEFNBXixkEbait3SN4S5DMk3bYCAVCShSBuDGP5pABY: {
    symbol: "ME", name: "Magic Eden", decimals: 9,
    icon: "https://bafkreihlve3lokwjivscp2apj4geraghah6cnag7qs36ub6m7pw7nkz2ly.ipfs.nftstorage.link",
  },
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: {
    symbol: "mSOL", name: "Marinade SOL", decimals: 9,
    icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png",
  },
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: {
    symbol: "jitoSOL", name: "Jito Staked SOL", decimals: 9,
    icon: "https://storage.googleapis.com/token-metadata/JitoSOL-256.png",
  },
  bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1: {
    symbol: "bSOL", name: "BlazeStake SOL", decimals: 9,
    icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1/logo.png",
  },
  jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v: {
    symbol: "jupSOL", name: "Jupiter SOL", decimals: 9,
    icon: "https://static.jup.ag/jupSOL/icon.png",
  },
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: {
    symbol: "BONK", name: "Bonk", decimals: 5,
    icon: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
  },
  EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: {
    symbol: "WIF", name: "dogwifhat", decimals: 6,
    icon: "https://bafkreibk3covs5ltyqxa272uodhber57ber6yrxagnq7csgyjlscahy2mu.ipfs.nftstorage.link",
  },
  MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey: {
    symbol: "MNDE", name: "Marinade", decimals: 9,
    icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey/logo.png",
  },
  BLZEEuZUBVqFhj8adcCFPJvPVCiCyVmh3hkJMrU8KuJA: {
    symbol: "BLZE", name: "BlazeStake", decimals: 9,
    icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/BLZEEuZUBVqFhj8adcCFPJvPVCiCyVmh3hkJMrU8KuJA/logo.png",
  },
  orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE: {
    symbol: "ORCA", name: "Orca", decimals: 6,
    icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png",
  },
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": {
    symbol: "RAY", name: "Raydium", decimals: 6,
    icon: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png",
  },
};

export function resolveTokenMeta(mint: string): { symbol: string; icon?: string } {
  const meta = TOKEN_REGISTRY[mint];
  if (meta) return { symbol: meta.symbol, icon: meta.icon };
  return { symbol: mint.slice(0, 4) + "..." + mint.slice(-4) };
}

/* ═══════════════ Staking Detection ═══════════════ */

const JUP_API_KEY = process.env.NEXT_PUBLIC_JUPITER_API_KEY || "";
const PYTH_STAKING_PROGRAM = "pytS9TjG1qyAZypk7n8rw8gfW9sUaqqYyMhJQ4E7JCQ";
const PYTH_DECIMALS = 6;

export interface StakingPosition {
  platform: string;
  platformIcon?: string;
  type: string;
  symbol: string;
  amount: number;
  price: number;
  value: number;
  apy?: number;
  logo?: string;
}

// ── Helpers ──

function readU64LE(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const lo = view.getUint32(offset, true);
  const hi = view.getUint32(offset + 4, true);
  return hi * 0x100000000 + lo;
}

function toBase58(bytes: Uint8Array): string {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const ZERO = BigInt(0);
  const BASE = BigInt(256);
  const FIFTYE = BigInt(58);
  let num = ZERO;
  for (const byte of bytes) num = num * BASE + BigInt(byte);
  let str = "";
  while (num > ZERO) { str = ALPHABET[Number(num % FIFTYE)] + str; num = num / FIFTYE; }
  for (const byte of bytes) { if (byte === 0) str = "1" + str; else break; }
  return str || "1";
}

async function anchorDiscriminator(accountName: string): Promise<Uint8Array> {
  const msgBuffer = new TextEncoder().encode(`account:${accountName}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer as unknown as BufferSource);
  return new Uint8Array(hashBuffer).slice(0, 8);
}

async function heliusRpc(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

// ── Pyth staking breakdown (ported from PythTank's proven approach) ──

export interface PythStakingBreakdown {
  total: number;
  governance: number;
  ois: number;
  unallocated: number;
}

async function fetchPythStaking(walletAddress: string): Promise<PythStakingBreakdown | null> {
  try {
    const discriminator = await anchorDiscriminator("PositionData");
    const discriminatorBase58 = toBase58(discriminator);

    const result = await heliusRpc("getProgramAccounts", [
      PYTH_STAKING_PROGRAM,
      {
        encoding: "base64",
        filters: [
          { memcmp: { offset: 0, bytes: discriminatorBase58 } },
          { memcmp: { offset: 8, bytes: walletAddress } },
        ],
      },
    ]);

    if (!result || result.length === 0) return { total: 0, governance: 0, ois: 0, unallocated: 0 };

    let govAmount = 0;
    let oisAmount = 0;
    const custodyAddresses: string[] = [];

    for (const account of result) {
      if (!account.account?.data?.[0]) continue;
      const raw = atob(account.account.data[0]);
      const data = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) data[i] = raw.charCodeAt(i);

      // Parse 20 position slots (200 bytes each) starting at offset 40
      for (let i = 0; i < 20; i++) {
        const offset = 40 + i * 200;
        if (offset >= data.length) break;
        if (data[offset] !== 1) continue; // isSome check

        const amountLots = readU64LE(data, offset + 1);
        const amountUi = amountLots / Math.pow(10, PYTH_DECIMALS);

        // Target tag: Gov=0, OIS=1
        const unlockingTag = data[offset + 17];
        const targetOffset = unlockingTag === 1 ? offset + 26 : offset + 18;
        const targetTag = data[targetOffset];

        if (targetTag === 0) govAmount += amountUi;
        else if (targetTag === 1) oisAmount += amountUi;
      }

      // Derive custody PDA for total
      const { PublicKey } = await import("@solana/web3.js");
      const positionsKey = new PublicKey(account.pubkey);
      const stakingProgram = new PublicKey(PYTH_STAKING_PROGRAM);
      const custodySeed = new TextEncoder().encode("custody");
      const [custodyPDA] = PublicKey.findProgramAddressSync(
        [custodySeed, positionsKey.toBytes()],
        stakingProgram
      );
      custodyAddresses.push(custodyPDA.toBase58());
    }

    // Read custody accounts for absolute total
    let absoluteTotal = 0;
    if (custodyAddresses.length > 0) {
      const custodyResult = await heliusRpc("getMultipleAccounts", [
        custodyAddresses,
        { encoding: "base64" },
      ]);
      for (const acct of custodyResult?.value || []) {
        if (!acct?.data?.[0]) continue;
        const raw = atob(acct.data[0]);
        const custodyData = new Uint8Array(raw.length);
        for (let j = 0; j < raw.length; j++) custodyData[j] = raw.charCodeAt(j);
        if (custodyData.length >= 72) {
          absoluteTotal += readU64LE(custodyData, 64) / Math.pow(10, PYTH_DECIMALS);
        }
      }
    }

    const unallocated = Math.max(0, absoluteTotal - (govAmount + oisAmount));
    return { total: absoluteTotal, governance: govAmount, ois: oisAmount, unallocated };
  } catch (e) {
    console.warn("[Staking] Pyth staking query failed:", e);
    return null;
  }
}

// ── Fetch token prices from Pyth Hermes for staked tokens ──

async function fetchPythOraclePrice(symbol: string): Promise<number> {
  // Pyth price feed IDs
  const FEED_IDS: Record<string, string> = {
    PYTH: "0x0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff",
    JUP: "0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996",
    SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  };
  const feedId = FEED_IDS[symbol];
  if (!feedId) return 0;
  try {
    const res = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feedId}`);
    if (!res.ok) return 0;
    const data = await res.json();
    const parsed = data?.parsed?.[0]?.price;
    if (!parsed) return 0;
    return Number(parsed.price) * Math.pow(10, parsed.expo);
  } catch {
    return 0;
  }
}

/**
 * Detect staking positions:
 *  1. Pyth staking with OIS/Gov breakdown (ported from PythTank, proven approach)
 *  2. Jupiter staked JUP (official API)
 *  3. Fetches real-time prices from Pyth Hermes oracle
 */
export async function detectAllStakingPositions(
  walletAddress: string,
  prices: Record<string, number>
): Promise<StakingPosition[]> {
  const positions: StakingPosition[] = [];

  // Fetch prices for staked tokens (may not be in wallet prices)
  const [pythPrice, jupPrice] = await Promise.all([
    prices.PYTH || fetchPythOraclePrice("PYTH"),
    prices.JUP || fetchPythOraclePrice("JUP"),
  ]);

  // ── 1. Pyth staking (OIS + Gov breakdown) ──
  const pythStaking = await fetchPythStaking(walletAddress);
  if (pythStaking && pythStaking.total > 0) {
    const pythIcon = TOKEN_REGISTRY.HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3?.icon;

    if (pythStaking.ois > 0) {
      positions.push({
        platform: "Pyth",
        platformIcon: "https://pyth.network/token.svg",
        type: "OIS Staked",
        symbol: "PYTH",
        amount: pythStaking.ois,
        price: pythPrice,
        value: pythStaking.ois * pythPrice,
        logo: pythIcon,
      });
    }
    if (pythStaking.governance > 0) {
      positions.push({
        platform: "Pyth",
        platformIcon: "https://pyth.network/token.svg",
        type: "Gov Staked",
        symbol: "PYTH",
        amount: pythStaking.governance,
        price: pythPrice,
        value: pythStaking.governance * pythPrice,
        logo: pythIcon,
      });
    }
    if (pythStaking.unallocated > 0) {
      positions.push({
        platform: "Pyth",
        platformIcon: "https://pyth.network/token.svg",
        type: "Available to Stake",
        symbol: "PYTH",
        amount: pythStaking.unallocated,
        price: pythPrice,
        value: pythStaking.unallocated * pythPrice,
        logo: pythIcon,
      });
    }

    console.log(`[Staking] Pyth: total=${pythStaking.total.toFixed(2)}, OIS=${pythStaking.ois.toFixed(2)}, Gov=${pythStaking.governance.toFixed(2)}, unalloc=${pythStaking.unallocated.toFixed(2)} @ $${pythPrice.toFixed(4)}`);
  }

  // ── 2. Jupiter staked JUP ──
  try {
    const res = await fetch(
      `https://api.jup.ag/portfolio/v1/staked-jup/${walletAddress}`,
      { headers: { "x-api-key": JUP_API_KEY } }
    );
    if (res.ok) {
      const data = await res.json();
      const stakedAmount = data?.stakedAmount || 0;
      if (stakedAmount > 0) {
        positions.push({
          platform: "Jupiter DAO",
          platformIcon: "https://static.jup.ag/jup/icon.png",
          type: "Locked",
          symbol: "JUP",
          amount: stakedAmount,
          price: jupPrice,
          value: stakedAmount * jupPrice,
          
          logo: TOKEN_REGISTRY.JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN?.icon,
        });
        console.log(`[Staking] Jupiter DAO: ${stakedAmount.toFixed(2)} JUP @ $${jupPrice.toFixed(4)} = $${(stakedAmount * jupPrice).toFixed(2)}`);
      }
    }
  } catch (e) {
    console.warn("[Staking] Jupiter staked-jup failed:", e);
  }

  console.log(`[Staking] Total positions: ${positions.length}`);
  return positions;
}
