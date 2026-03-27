import { VersionedTransaction } from "@solana/web3.js";

const getBase = () =>
  typeof window === "undefined"
    ? `${process.env.BACKEND_URL || "http://localhost:4000"}/api`
    : "/api/cryptoserve";

// ── Types (Recurring V1 API) ──

export interface DcaParams {
  payer: string;
  inputMint: string;
  outputMint: string;
  totalInAmount: string;
  inAmountPerCycle: string;
  cycleSecondsApart: number;
  numberOfOrders?: number;
}

export interface RecurringOrder {
  orderKey: string;
  userPubkey: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  numberOfOrders: number;
  completedOrders: number;
  interval: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDcaResponse {
  requestId: string;
  transaction: string;
}

export interface CloseDcaResponse {
  transaction: string;
}

// ── Frequency presets ──

export const DCA_FREQUENCIES = [
  { label: "Hourly", seconds: 3600 },
  { label: "4h", seconds: 14400 },
  { label: "Daily", seconds: 86400 },
  { label: "Weekly", seconds: 604800 },
] as const;

// ── API Calls ──

export async function createDcaPosition(params: DcaParams): Promise<CreateDcaResponse> {
  const base = getBase();
  const res = await fetch(`${base}/jup/dca/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Create DCA failed: ${text || res.statusText}`);
  }
  return res.json();
}

export async function fetchDcaPositions(wallet: string): Promise<RecurringOrder[]> {
  const base = getBase();
  const res = await fetch(`${base}/jup/dca/positions/${wallet}`);
  if (!res.ok) throw new Error(`Fetch DCA positions failed: ${res.statusText}`);
  return res.json();
}

export async function closeDcaPosition(user: string, orderKey: string): Promise<CloseDcaResponse> {
  const base = getBase();
  const res = await fetch(`${base}/jup/dca/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, orderKey }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Close DCA failed: ${text || res.statusText}`);
  }
  return res.json();
}

// ── Transaction Helpers ──

export function deserializeDcaTx(base64Tx: string): VersionedTransaction {
  const buffer = Buffer.from(base64Tx, "base64");
  return VersionedTransaction.deserialize(buffer);
}
