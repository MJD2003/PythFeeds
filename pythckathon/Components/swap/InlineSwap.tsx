"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ArrowDownUp, Loader2, Wallet, Check, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  POPULAR_TOKENS,
  type TokenInfo,
  getUltraOrder,
  signUltraOrder,
  executeUltraSwap,
} from "@/lib/jupiter";
import { scanWallet } from "@/lib/wallet-scanner";
import { fetchPythPricesBatch } from "@/lib/pyth-prices";
import { fmtAmount, truncAddr } from "@/lib/format";
import { pushNotification } from "@/Components/shared/NotificationCenter";
import { trackTransaction } from "@/Components/shared/TxTracker";

const SOL_TOKEN = POPULAR_TOKENS[0]; // SOL is always first

interface InlineSwapProps {
  tokenSymbol: string;
  tokenMint: string;
  tokenLogo?: string;
  tokenDecimals?: number;
}

const QUICK_AMOUNTS = [0.1, 0.25, 0.5, 1];

export default function InlineSwap({ tokenSymbol, tokenMint, tokenLogo, tokenDecimals = 9 }: InlineSwapProps) {
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();

  const [amount, setAmount] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [outputAmount, setOutputAmount] = useState(0);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [solPrice, setSolPrice] = useState(0);

  const quoteTimerRef = useRef<NodeJS.Timeout | null>(null);

  const outputToken: TokenInfo = {
    symbol: tokenSymbol,
    name: tokenSymbol,
    mint: tokenMint,
    logo: tokenLogo || "",
    decimals: tokenDecimals,
  };

  // Load SOL balance
  useEffect(() => {
    if (!publicKey || !connection) return;
    scanWallet(connection, publicKey).then((r) => setSolBalance(r.solBalance)).catch(() => {});
  }, [publicKey, connection]);

  // Load SOL price
  useEffect(() => {
    fetchPythPricesBatch(["SOL"]).then((m) => { if (m.SOL) setSolPrice(m.SOL); });
  }, []);

  // Debounced quote fetch
  const fetchQuote = useCallback(async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setOutputAmount(0); return; }
    setQuoteLoading(true);
    try {
      const rawAmount = amt * Math.pow(10, SOL_TOKEN.decimals);
      const taker = publicKey?.toBase58();
      const order = await getUltraOrder(SOL_TOKEN.mint, tokenMint, rawAmount, taker, 100);
      if (order && order.outAmount) {
        setOutputAmount(parseInt(order.outAmount) / Math.pow(10, tokenDecimals));
      } else {
        setOutputAmount(0);
      }
    } catch {
      setOutputAmount(0);
    }
    setQuoteLoading(false);
  }, [amount, publicKey, tokenMint, tokenDecimals]);

  useEffect(() => {
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    setOutputAmount(0);
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    quoteTimerRef.current = setTimeout(fetchQuote, 600);
    return () => { if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current); };
  }, [amount, fetchQuote]);

  const handleSwap = async () => {
    if (!connected || !publicKey || !signTransaction) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;

    setSwapping(true);
    setTxHash(null);
    try {
      const rawAmount = amt * Math.pow(10, SOL_TOKEN.decimals);
      const taker = publicKey.toBase58();
      const order = await getUltraOrder(SOL_TOKEN.mint, tokenMint, rawAmount, taker, 100);
      if (!order || !order.transaction) { toast.error("No route found"); setSwapping(false); return; }

      const signedTx = await signUltraOrder(order.transaction, signTransaction);
      const result = await executeUltraSwap(signedTx, order.requestId);

      if (result.status === "Success" && result.signature) {
        setTxHash(result.signature);
        const out = parseInt(order.outAmount) / Math.pow(10, tokenDecimals);
        trackTransaction(result.signature, `Buy ${tokenSymbol}`, `${amt} SOL \u2192 ${fmtAmount(out)} ${tokenSymbol}`);
        toast.success(`Bought ${fmtAmount(out)} ${tokenSymbol}!`);
        pushNotification({
          type: "swap_completed",
          title: `Bought ${tokenSymbol}`,
          message: `${amt} SOL \u2192 ${fmtAmount(out)} ${tokenSymbol}`,
          actions: [{ label: "View tx", href: `https://solscan.io/tx/${result.signature}` }],
        });
        setAmount("");
        setOutputAmount(0);
        // Refresh balance after delay
        setTimeout(() => {
          if (publicKey && connection) scanWallet(connection, publicKey).then((r) => setSolBalance(r.solBalance)).catch(() => {});
        }, 2000);
      } else {
        toast.error("Swap failed");
      }
    } catch (err: any) {
      console.error("[InlineSwap] Error:", err);
      toast.error(err?.message || "Swap failed");
    }
    setSwapping(false);
  };

  const inputUsd = parseFloat(amount || "0") * solPrice;
  const insufficientBalance = connected && solBalance !== null && parseFloat(amount || "0") > solBalance;

  return (
    <div className="rounded-xl p-4" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowDownUp size={13} style={{ color: "var(--pf-accent)" }} />
          <span className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>Quick Buy</span>
        </div>
        {connected && solBalance !== null && (
          <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>
            {fmtAmount(solBalance)} SOL
          </span>
        )}
      </div>

      {/* Quick amount buttons */}
      <div className="flex gap-1.5 mb-3">
        {QUICK_AMOUNTS.map((a) => (
          <button
            key={a}
            onClick={() => setAmount(String(a))}
            className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-colors"
            style={{
              background: amount === String(a) ? "var(--cmc-text)" : "var(--cmc-neutral-2)",
              color: amount === String(a) ? "var(--cmc-bg)" : "var(--cmc-text)",
            }}
          >
            {a} SOL
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1" style={{ background: "var(--cmc-neutral-2)", border: "1px solid var(--cmc-border)" }}>
          <img src={SOL_TOKEN.logo} alt="SOL" className="w-5 h-5 rounded-full" />
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); if (v.split(".").length <= 2) setAmount(v); }}
            className="flex-1 bg-transparent outline-none text-sm font-bold text-right"
            style={{ color: insufficientBalance ? "#ea3943" : "var(--cmc-text)" }}
          />
          <span className="text-[10px] font-bold shrink-0" style={{ color: "var(--cmc-neutral-5)" }}>SOL</span>
        </div>
      </div>

      {/* Output preview */}
      {(quoteLoading || outputAmount > 0) && (
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>You receive</span>
          <div className="flex items-center gap-1.5">
            {quoteLoading ? (
              <Loader2 size={11} className="animate-spin" style={{ color: "var(--cmc-neutral-5)" }} />
            ) : (
              <>
                {tokenLogo && <img src={tokenLogo} alt="" className="w-4 h-4 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                <span className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>
                  ~{fmtAmount(outputAmount)} {tokenSymbol}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {inputUsd > 0 && !quoteLoading && (
        <div className="text-[10px] text-right mb-3 px-1" style={{ color: "var(--cmc-neutral-5)" }}>
          ~${inputUsd.toFixed(2)} USD
        </div>
      )}

      {/* Swap button */}
      {!connected ? (
        <button
          onClick={() => setVisible(true)}
          className="w-full py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110 flex items-center justify-center gap-1.5"
          style={{ background: "linear-gradient(135deg, #16c784, var(--pf-accent))", color: "#000" }}
        >
          <Wallet size={13} /> Connect Wallet
        </button>
      ) : !amount || parseFloat(amount) <= 0 ? (
        <button disabled className="w-full py-2.5 rounded-xl text-xs font-bold cursor-not-allowed" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>
          Enter SOL amount
        </button>
      ) : insufficientBalance ? (
        <button disabled className="w-full py-2.5 rounded-xl text-xs font-bold cursor-not-allowed" style={{ background: "rgba(234,57,67,0.12)", color: "#ea3943" }}>
          Insufficient SOL
        </button>
      ) : quoteLoading ? (
        <button disabled className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-wait" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>
          <Loader2 size={13} className="animate-spin" /> Getting quote...
        </button>
      ) : outputAmount <= 0 ? (
        <button disabled className="w-full py-2.5 rounded-xl text-xs font-bold cursor-not-allowed" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>
          No route found
        </button>
      ) : swapping ? (
        <button disabled className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-wait" style={{ background: "#16c784", color: "#000", opacity: 0.7 }}>
          <Loader2 size={13} className="animate-spin" /> Swapping...
        </button>
      ) : (
        <button
          onClick={handleSwap}
          className="w-full py-2.5 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-500/20 active:scale-[0.98] flex items-center justify-center gap-1.5"
          style={{ background: "linear-gradient(135deg, #16c784, var(--pf-accent))", color: "#000" }}
        >
          Buy {tokenSymbol}
        </button>
      )}

      {/* Success */}
      {txHash && (
        <div className="mt-3 rounded-lg p-2.5 flex items-center gap-2" style={{ background: "rgba(22,199,132,0.08)", border: "1px solid rgba(22,199,132,0.2)" }}>
          <Check size={13} style={{ color: "#16c784" }} />
          <span className="text-[10px] font-medium flex-1" style={{ color: "#16c784" }}>Purchase confirmed!</span>
          <a href={`https://solscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-[9px] font-semibold hover:underline" style={{ color: "var(--cmc-text)" }}>
            {truncAddr(txHash)} <ExternalLink size={8} />
          </a>
        </div>
      )}
    </div>
  );
}
