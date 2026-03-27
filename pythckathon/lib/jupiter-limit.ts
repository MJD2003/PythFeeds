import { VersionedTransaction } from "@solana/web3.js";

const getBase = () =>
  typeof window === "undefined"
    ? `${process.env.BACKEND_URL || "http://localhost:4000"}/api`
    : "/api/cryptoserve";

// ── Types (Trigger V1 API) ──

export interface LimitOrderParams {
  maker: string;
  inputMint: string;
  outputMint: string;
  makingAmount: string;
  takingAmount: string;
  expiredAt?: number;
}

export interface TriggerOrder {
  userPubkey: string;
  orderKey: string;
  inputMint: string;
  outputMint: string;
  makingAmount: string;
  takingAmount: string;
  remainingMakingAmount: string;
  remainingTakingAmount: string;
  rawMakingAmount: string;
  rawTakingAmount: string;
  rawRemainingMakingAmount: string;
  rawRemainingTakingAmount: string;
  expiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  status: string;
}

export interface CreateOrderResponse {
  requestId: string;
  transaction: string;
  order: string;
}

export interface CancelOrderResponse {
  txs: string[];
}

// ── API Calls ──

export async function createLimitOrder(params: LimitOrderParams): Promise<CreateOrderResponse> {
  const base = getBase();
  const res = await fetch(`${base}/jup/limit/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Create limit order failed: ${text || res.statusText}`);
  }
  return res.json();
}

export async function fetchOpenOrders(wallet: string): Promise<TriggerOrder[]> {
  const base = getBase();
  const res = await fetch(`${base}/jup/limit/orders/${wallet}`);
  if (!res.ok) throw new Error(`Fetch orders failed: ${res.statusText}`);
  return res.json();
}

export async function fetchOrderHistory(wallet: string, page = 1): Promise<TriggerOrder[]> {
  const base = getBase();
  const res = await fetch(`${base}/jup/limit/history/${wallet}?page=${page}`);
  if (!res.ok) throw new Error(`Fetch history failed: ${res.statusText}`);
  const data = await res.json();
  return data.orders || data;
}

export async function cancelLimitOrders(maker: string, orderKeys: string[]): Promise<CancelOrderResponse> {
  const base = getBase();
  const res = await fetch(`${base}/jup/limit/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ maker, orders: orderKeys }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Cancel orders failed: ${text || res.statusText}`);
  }
  return res.json();
}

// ── Transaction Helpers ──

export function deserializeLimitTx(base64Tx: string): VersionedTransaction {
  const buffer = Buffer.from(base64Tx, "base64");
  return VersionedTransaction.deserialize(buffer);
}
