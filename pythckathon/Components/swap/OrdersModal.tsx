"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { X, Loader2, Trash2, ListOrdered, RefreshCw, Timer } from "lucide-react";
import { toast } from "sonner";
import {
  fetchOpenOrders,
  cancelLimitOrders,
  deserializeLimitTx,
  type TriggerOrder,
} from "@/lib/jupiter-limit";
import {
  fetchDcaPositions,
  closeDcaPosition,
  deserializeDcaTx,
  type RecurringOrder,
} from "@/lib/jupiter-dca";
import { trackTransaction } from "@/Components/shared/TxTracker";

interface OrdersModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = "limits" | "dca";

export default function OrdersModal({ open, onClose }: OrdersModalProps) {
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [tab, setTab] = useState<Tab>("limits");
  const [limitOrders, setLimitOrders] = useState<TriggerOrder[]>([]);
  const [dcaOrders, setDcaOrders] = useState<RecurringOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const [limits, dca] = await Promise.allSettled([
        fetchOpenOrders(publicKey.toBase58()),
        fetchDcaPositions(publicKey.toBase58()),
      ]);
      if (limits.status === "fulfilled") setLimitOrders(limits.value);
      if (dca.status === "fulfilled") setDcaOrders(dca.value);
    } catch {}
    setLoading(false);
  }, [publicKey]);

  useEffect(() => {
    if (open && connected) refresh();
  }, [open, connected, refresh]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const handleCancelLimit = async (orderKey: string) => {
    if (!publicKey || !signTransaction) return;
    setCancelling(orderKey);
    try {
      const result = await cancelLimitOrders(publicKey.toBase58(), [orderKey]);
      if (result.txs?.length) {
        const tx = deserializeLimitTx(result.txs[0]);
        const signed = await signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
        trackTransaction(sig, "Cancel limit order");
        toast.success("Order cancelled");
        setTimeout(refresh, 3000);
      }
    } catch (err: unknown) {
      toast.error("Cancel failed", { description: err instanceof Error ? err.message : "Unknown error" });
    }
    setCancelling(null);
  };

  const handleCloseDca = async (orderKey: string) => {
    if (!publicKey || !signTransaction) return;
    setCancelling(orderKey);
    try {
      const result = await closeDcaPosition(publicKey.toBase58(), orderKey);
      if (result.transaction) {
        const tx = deserializeDcaTx(result.transaction);
        const signed = await signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
        trackTransaction(sig, "Close DCA position");
        toast.success("DCA closed");
        setTimeout(refresh, 3000);
      }
    } catch (err: unknown) {
      toast.error("Close failed", { description: err instanceof Error ? err.message : "Unknown error" });
    }
    setCancelling(null);
  };

  if (!open) return null;

  const totalCount = limitOrders.length + dcaOrders.length;

  return (
    <div className="fixed inset-0 z-1000 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl max-h-[80dvh] flex flex-col" style={{ background: "var(--cmc-card, var(--cmc-bg))", border: "1px solid var(--cmc-border)" }}>

        {/* Header */}
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
          <div className="flex items-center gap-2">
            <ListOrdered size={16} style={{ color: "var(--pf-accent)" }} />
            <h3 className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>
              My Orders {totalCount > 0 && <span className="text-[10px] font-normal ml-1 px-1.5 py-0.5 rounded-full" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>{totalCount}</span>}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={refresh} disabled={loading} className="p-1.5 rounded-lg transition hover:bg-white/5" aria-label="Refresh orders">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} style={{ color: "var(--cmc-neutral-5)" }} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg transition hover:bg-white/10" aria-label="Close">
              <X size={14} style={{ color: "var(--cmc-neutral-5)" }} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mx-3 mt-3 p-0.5 rounded-lg" style={{ background: "var(--cmc-neutral-1)" }}>
          {(["limits", "dca"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className="flex-1 py-1.5 text-[10px] font-bold rounded-md transition-colors flex items-center justify-center gap-1" style={{ background: tab === t ? (t === "limits" ? "#6366f1" : "#f59e0b") : "transparent", color: tab === t ? "#fff" : "var(--cmc-neutral-5)" }}>
              {t === "limits" ? <><ListOrdered size={10} /> Limits ({limitOrders.length})</> : <><Timer size={10} /> DCA ({dcaOrders.length})</>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={18} className="animate-spin" style={{ color: "var(--cmc-neutral-5)" }} />
            </div>
          ) : !connected ? (
            <div className="text-center py-10 text-xs" style={{ color: "var(--cmc-neutral-5)" }}>Connect wallet to view orders</div>
          ) : tab === "limits" ? (
            limitOrders.length === 0 ? (
              <div className="text-center py-10 text-xs" style={{ color: "var(--cmc-neutral-5)" }}>No open limit orders</div>
            ) : (
              <div className="space-y-2">
                {limitOrders.map((order) => {
                  const filled = order.rawMakingAmount && order.rawRemainingMakingAmount
                    ? (1 - parseInt(order.rawRemainingMakingAmount) / parseInt(order.rawMakingAmount)) * 100
                    : 0;
                  return (
                    <div key={order.orderKey} className="rounded-xl p-3" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="min-w-0">
                          <span className="text-[11px] font-bold" style={{ color: "var(--cmc-text)" }}>
                            {order.makingAmount} → {order.takingAmount}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[8px] px-1 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>
                              {order.inputMint.slice(0, 4)}…{order.inputMint.slice(-4)}
                            </span>
                            <span className="text-[8px]" style={{ color: "var(--cmc-neutral-5)" }}>→</span>
                            <span className="text-[8px] px-1 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}>
                              {order.outputMint.slice(0, 4)}…{order.outputMint.slice(-4)}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => handleCancelLimit(order.orderKey)} disabled={cancelling === order.orderKey} className="p-1.5 rounded-lg transition hover:bg-red-500/10 shrink-0" aria-label="Cancel order">
                          {cancelling === order.orderKey ? <Loader2 size={12} className="animate-spin" style={{ color: "#ea3943" }} /> : <Trash2 size={12} style={{ color: "#ea3943" }} />}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--cmc-neutral-2)" }}>
                          <div className="h-full rounded-full" style={{ width: `${filled}%`, background: "#6366f1" }} />
                        </div>
                        <span className="text-[9px] font-medium shrink-0" style={{ color: "var(--cmc-neutral-5)" }}>{filled.toFixed(0)}%</span>
                      </div>
                      {order.expiredAt && (
                        <span className="text-[8px] mt-1 block" style={{ color: "var(--cmc-neutral-5)" }}>Expires: {new Date(order.expiredAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            dcaOrders.length === 0 ? (
              <div className="text-center py-10 text-xs" style={{ color: "var(--cmc-neutral-5)" }}>No active DCA positions</div>
            ) : (
              <div className="space-y-2">
                {dcaOrders.map((order) => {
                  const pct = order.numberOfOrders > 0 ? (order.completedOrders / order.numberOfOrders) * 100 : 0;
                  return (
                    <div key={order.orderKey} className="rounded-xl p-3" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="min-w-0">
                          <span className="text-[11px] font-bold" style={{ color: "var(--cmc-text)" }}>
                            {order.completedOrders}/{order.numberOfOrders} orders
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[8px] px-1 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                              {order.inputMint.slice(0, 4)}…{order.inputMint.slice(-4)}
                            </span>
                            <span className="text-[8px]" style={{ color: "var(--cmc-neutral-5)" }}>→</span>
                            <span className="text-[8px] px-1 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                              {order.outputMint.slice(0, 4)}…{order.outputMint.slice(-4)}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => handleCloseDca(order.orderKey)} disabled={cancelling === order.orderKey} className="p-1.5 rounded-lg transition hover:bg-red-500/10 shrink-0" aria-label="Close DCA">
                          {cancelling === order.orderKey ? <Loader2 size={12} className="animate-spin" style={{ color: "#ea3943" }} /> : <Trash2 size={12} style={{ color: "#ea3943" }} />}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--cmc-neutral-2)" }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #f59e0b, #16c784)" }} />
                        </div>
                        <span className="text-[9px] font-medium shrink-0" style={{ color: "var(--cmc-neutral-5)" }}>{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
