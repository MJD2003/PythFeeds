/**
 * Swap transaction history — persisted in localStorage per wallet,
 * with background sync to backend via user_data.
 */
import { getUserData, setUserData } from "@/lib/api/backend";

export interface SwapRecord {
  id: string;
  timestamp: number;
  inputSymbol: string;
  outputSymbol: string;
  inputAmount: string;
  outputAmount: string;
  txHash: string;
  inputMint: string;
  outputMint: string;
}

const STORAGE_KEY = "pythfeeds_swap_history";
const MAX_RECORDS = 20;

function getKey(wallet: string): string {
  return `${STORAGE_KEY}_${wallet}`;
}

export function getSwapHistory(wallet: string): SwapRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getKey(wallet));
    if (!raw) return [];
    return JSON.parse(raw) as SwapRecord[];
  } catch {
    return [];
  }
}

export function addSwapRecord(wallet: string, record: Omit<SwapRecord, "id" | "timestamp">): void {
  if (typeof window === "undefined") return;
  const history = getSwapHistory(wallet);
  history.unshift({
    ...record,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  });
  // Keep only most recent
  if (history.length > MAX_RECORDS) history.length = MAX_RECORDS;
  localStorage.setItem(getKey(wallet), JSON.stringify(history));
  scheduleBackendSync(wallet);
}

export function clearSwapHistory(wallet: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(getKey(wallet));
  setUserData(wallet, "swap_history", []).catch(() => {});
}

// ── Backend sync ──
let _syncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleBackendSync(wallet: string) {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    const history = getSwapHistory(wallet);
    setUserData(wallet, "swap_history", history).catch(() => {});
  }, 3000);
}

export async function syncSwapHistoryFromBackend(wallet: string): Promise<SwapRecord[]> {
  const remote = await getUserData<SwapRecord[]>(wallet, "swap_history");
  const local = getSwapHistory(wallet);
  if (!remote || remote.length === 0) {
    // Push local to backend if we have local data
    if (local.length > 0) setUserData(wallet, "swap_history", local).catch(() => {});
    return local;
  }
  // Merge: combine unique records by id, sort by timestamp desc, cap at MAX_RECORDS
  const merged = new Map<string, SwapRecord>();
  for (const r of [...local, ...remote]) merged.set(r.id, r);
  const sorted = [...merged.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_RECORDS);
  localStorage.setItem(getKey(wallet), JSON.stringify(sorted));
  return sorted;
}

// ── Recent Pairs ──
export interface RecentPair {
  inputMint: string;
  outputMint: string;
  inputSymbol: string;
  outputSymbol: string;
  inputLogo: string;
  outputLogo: string;
  ts: number;
}

const PAIRS_KEY = "pythfeeds_recent_pairs";
const MAX_PAIRS = 5;

export function getRecentPairs(): RecentPair[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(PAIRS_KEY) || "[]") as RecentPair[];
  } catch { return []; }
}

export function saveRecentPair(pair: Omit<RecentPair, "ts">): void {
  if (typeof window === "undefined") return;
  const pairs = getRecentPairs().filter(
    p => !(p.inputMint === pair.inputMint && p.outputMint === pair.outputMint)
  );
  pairs.unshift({ ...pair, ts: Date.now() });
  if (pairs.length > MAX_PAIRS) pairs.length = MAX_PAIRS;
  localStorage.setItem(PAIRS_KEY, JSON.stringify(pairs));
}
