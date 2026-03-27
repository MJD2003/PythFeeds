
"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { CheckCircle2, XCircle, Loader2, ExternalLink, X, ChevronDown, ChevronUp } from "lucide-react";

export type TxStatus = "pending" | "confirmed" | "failed";

export interface TrackedTx {
  id: string;
  signature: string;
  label: string;
  description?: string;
  status: TxStatus;
  timestamp: number;
  confirmedAt?: number;
}

type Listener = () => void;
let _transactions: TrackedTx[] = [];
const _listeners = new Set<Listener>();

function notify() { _listeners.forEach((fn) => fn()); }

export function trackTransaction(sig: string, label: string, description?: string) {
  if (_transactions.find((t) => t.signature === sig)) return;
  _transactions = [
    { id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, signature: sig, label, description, status: "pending" as TxStatus, timestamp: Date.now() },
    ..._transactions,
  ].slice(0, 20);
  notify();
}

function updateTxStatus(sig: string, status: TxStatus) {
  _transactions = _transactions.map((t) =>
    t.signature === sig ? { ...t, status, confirmedAt: status === "confirmed" ? Date.now() : t.confirmedAt } : t
  );
  notify();
}

function removeTx(id: string) { _transactions = _transactions.filter((t) => t.id !== id); notify(); }
function clearConfirmed() { _transactions = _transactions.filter((t) => t.status === "pending"); notify(); }

function useTrackedTransactions() {
  const [txs, setTxs] = useState<TrackedTx[]>(_transactions);
  useEffect(() => {
    const handler = () => setTxs([..._transactions]);
    _listeners.add(handler);
    return () => { _listeners.delete(handler); };
  }, []);
  return txs;
}

function truncSig(sig: string) { return sig.slice(0, 4) + "\u2026" + sig.slice(-4); }

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  return Math.floor(m / 60) + "h ago";
}

const STATUS_CFG: Record<TxStatus, { icon: typeof Loader2; color: string; label: string }> = {
  pending: { icon: Loader2, color: "#f59e0b", label: "Pending" },
  confirmed: { icon: CheckCircle2, color: "#16c784", label: "Confirmed" },
  failed: { icon: XCircle, color: "#ea3943", label: "Failed" },
};

export default function TxTracker() {
  const txs = useTrackedTransactions();
  const { connection } = useConnection();
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const confirmPending = useCallback(async () => {
    const pending = _transactions.filter((t) => t.status === "pending");
    for (const tx of pending) {
      try {
        const result = await connection.getSignatureStatus(tx.signature);
        if (result?.value) {
          if (result.value.err) updateTxStatus(tx.signature, "failed");
          else if (result.value.confirmationStatus === "confirmed" || result.value.confirmationStatus === "finalized") updateTxStatus(tx.signature, "confirmed");
        }
      } catch { /* retry next cycle */ }
    }
  }, [connection]);

  useEffect(() => {
    if (txs.filter((t) => t.status === "pending").length === 0) return;
    confirmPending();
    const iv = setInterval(confirmPending, 3000);
    return () => clearInterval(iv);
  }, [txs, confirmPending]);

  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      const old = _transactions.filter((t) => t.status !== "pending" && t.confirmedAt && now - t.confirmedAt > 60000);
      if (old.length > 0) { _transactions = _transactions.filter((t) => !old.includes(t)); notify(); }
    }, 10000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { if (txs.length > 0 && dismissed) setDismissed(false); }, [txs.length, dismissed]);

  if (txs.length === 0 || dismissed) return null;

  const pendingCount = txs.filter((t) => t.status === "pending").length;
  const confirmedCount = txs.filter((t) => t.status === "confirmed").length;
  const failedCount = txs.filter((t) => t.status === "failed").length;

  return (
    <div className="fixed bottom-4 right-4 z-999 w-[300px] rounded-xl overflow-hidden shadow-2xl" style={{ background: "color-mix(in srgb, var(--cmc-bg) 92%, transparent)", backdropFilter: "blur(16px)", border: "1px solid var(--cmc-border)" }}>
      <div className="flex items-center justify-between px-3 py-2 cursor-pointer select-none" style={{ borderBottom: collapsed ? "none" : "1px solid var(--cmc-border)" }} onClick={() => setCollapsed(!collapsed)}>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && <Loader2 size={12} className="animate-spin" style={{ color: "#f59e0b" }} />}
          <span className="text-[11px] font-bold" style={{ color: "var(--cmc-text)" }}>Transactions</span>
          <div className="flex items-center gap-1">
            {pendingCount > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>{pendingCount}</span>}
            {confirmedCount > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(22,199,132,0.15)", color: "#16c784" }}>{confirmedCount}</span>}
            {failedCount > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(234,57,67,0.15)", color: "#ea3943" }}>{failedCount}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {confirmedCount > 0 && <button onClick={(e) => { e.stopPropagation(); clearConfirmed(); }} className="text-[9px] font-medium px-1.5 py-0.5 rounded transition-colors hover:bg-white/10" style={{ color: "var(--cmc-neutral-5)" }}>Clear</button>}
          <button onClick={(e) => { e.stopPropagation(); setDismissed(true); }} className="p-0.5 rounded transition-colors hover:bg-white/10"><X size={11} style={{ color: "var(--cmc-neutral-5)" }} /></button>
          {collapsed ? <ChevronUp size={12} style={{ color: "var(--cmc-neutral-5)" }} /> : <ChevronDown size={12} style={{ color: "var(--cmc-neutral-5)" }} />}
        </div>
      </div>

      {!collapsed && (
        <div className="max-h-[240px] overflow-y-auto">
          {txs.map((tx) => {
            const cfg = STATUS_CFG[tx.status];
            const Icon = cfg.icon;
            return (
              <div key={tx.id} className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-white/2" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                <Icon size={14} className={tx.status === "pending" ? "animate-spin" : ""} style={{ color: cfg.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold truncate" style={{ color: "var(--cmc-text)" }}>{tx.label}</span>
                    <span className="text-[8px] font-bold uppercase px-1 py-0.5 rounded shrink-0" style={{ background: cfg.color + "18", color: cfg.color }}>{cfg.label}</span>
                  </div>
                  {tx.description && <p className="text-[9px] truncate mt-0.5" style={{ color: "var(--cmc-neutral-5)" }}>{tx.description}</p>}
                  <div className="flex items-center gap-2 mt-0.5">
                    <a href={"https://solscan.io/tx/" + tx.signature} target="_blank" rel="noopener noreferrer" className="text-[9px] font-medium flex items-center gap-0.5 transition-colors hover:opacity-80" style={{ color: "var(--pf-accent)" }} onClick={(e) => e.stopPropagation()}>
                      {truncSig(tx.signature)} <ExternalLink size={7} />
                    </a>
                    <span className="text-[8px]" style={{ color: "var(--cmc-neutral-5)" }}>{timeAgo(tx.timestamp)}</span>
                  </div>
                </div>
                <button onClick={() => removeTx(tx.id)} className="p-1 rounded transition-colors hover:bg-white/10 shrink-0 opacity-40 hover:opacity-100"><X size={9} style={{ color: "var(--cmc-neutral-5)" }} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
