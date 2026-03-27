"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Loader2, Wallet, ChevronDown, Clock, ListOrdered } from "lucide-react";
import { toast } from "sonner";
import {
  createLimitOrder,
  deserializeLimitTx,
} from "@/lib/jupiter-limit";
import { POPULAR_TOKENS, type TokenInfo } from "@/lib/jupiter";
import { fetchPythPricesBatch } from "@/lib/pyth-prices";
import { fmtAmount } from "@/lib/format";
import { trackTransaction } from "@/Components/shared/TxTracker";
import TokenSelector from "@/Components/swap/TokenSelector";
import { scanWallet, type WalletToken } from "@/lib/wallet-scanner";

const EXPIRY_OPTIONS = [
  { label: "1h", value: 3600 },
  { label: "24h", value: 86400 },
  { label: "7d", value: 604800 },
  { label: "30d", value: 2592000 },
  { label: "∞", value: 0 },
] as const;

export default function LimitOrderTab() {
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();

  const [inputToken, setInputToken] = useState<TokenInfo>(POPULAR_TOKENS[0]);
  const [outputToken, setOutputToken] = useState<TokenInfo>(POPULAR_TOKENS[1]);
  const [inputAmount, setInputAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [expirySeconds, setExpirySeconds] = useState(86400);
  const [showInputSelector, setShowInputSelector] = useState(false);
  const [showOutputSelector, setShowOutputSelector] = useState(false);
  const [creating, setCreating] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [walletTokens, setWalletTokens] = useState<WalletToken[]>([]);
  const [solBalance, setSolBalance] = useState<number | null>(null);

  const outputAmount =
    inputAmount && limitPrice
      ? (parseFloat(inputAmount) * parseFloat(limitPrice)).toFixed(outputToken.decimals > 6 ? 6 : outputToken.decimals)
      : "";

  const refreshPrices = useCallback(async () => {
    const map = await fetchPythPricesBatch(POPULAR_TOKENS.map((t) => t.symbol));
    setPrices(map);
  }, []);

  useEffect(() => { refreshPrices(); }, [refreshPrices]);

  useEffect(() => {
    const inP = prices[inputToken.symbol], outP = prices[outputToken.symbol];
    if (inP && outP && !limitPrice) setLimitPrice((inP / outP).toFixed(6));
  }, [prices, inputToken.symbol, outputToken.symbol, limitPrice]);

  useEffect(() => {
    if (!publicKey || !connection) return;
    scanWallet(connection, publicKey).then((r) => { setSolBalance(r.solBalance); setWalletTokens(r.tokens); }).catch(() => {});
  }, [publicKey, connection]);

  const marketRate = prices[inputToken.symbol] && prices[outputToken.symbol] ? prices[inputToken.symbol] / prices[outputToken.symbol] : null;
  const priceDiff = marketRate && limitPrice ? ((parseFloat(limitPrice) - marketRate) / marketRate) * 100 : null;

  const handleCreate = async () => {
    if (!publicKey || !signTransaction || !inputAmount || !limitPrice) return;
    const inAmt = parseFloat(inputAmount), price = parseFloat(limitPrice);
    if (inAmt <= 0 || price <= 0) return;

    setCreating(true);
    try {
      const makingAmount = Math.floor(inAmt * Math.pow(10, inputToken.decimals)).toString();
      const takingAmount = Math.floor(inAmt * price * Math.pow(10, outputToken.decimals)).toString();
      const expiredAt = expirySeconds > 0 ? Math.floor(Date.now() / 1000) + expirySeconds : undefined;

      const result = await createLimitOrder({ maker: publicKey.toBase58(), inputMint: inputToken.mint, outputMint: outputToken.mint, makingAmount, takingAmount, expiredAt });
      const tx = deserializeLimitTx(result.transaction);
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
      trackTransaction(sig, `Limit: ${inputAmount} ${inputToken.symbol} → ${outputToken.symbol}`);
      toast.success("Limit order placed!", { description: `${inputAmount} ${inputToken.symbol} at ${limitPrice} ${outputToken.symbol}` });
      setInputAmount("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error("Limit order failed", { description: msg });
    }
    setCreating(false);
  };

  return (
    <div>
      {/* ═══ You Sell ═══ */}
      <div className="mx-3 mt-2 rounded-xl p-3" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
        <span className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--cmc-neutral-5)" }}>You sell</span>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowInputSelector(true)} className="flex items-center gap-2 pl-2 pr-3 py-2 rounded-full shrink-0 transition-all hover:brightness-110" style={{ background: "var(--cmc-neutral-2)", border: "1px solid var(--cmc-border)" }}>
            <img src={inputToken.logo} alt="" className="w-6 h-6 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>{inputToken.symbol}</span>
            <ChevronDown size={12} style={{ color: "var(--cmc-neutral-5)" }} />
          </button>
          <div className="flex-1 text-right">
            <input type="text" inputMode="decimal" placeholder="0.00" value={inputAmount} onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); if (v.split(".").length <= 2) setInputAmount(v); }} className="w-full text-right text-2xl font-bold bg-transparent outline-none placeholder:opacity-20" style={{ color: "var(--cmc-text)" }} />
          </div>
        </div>
      </div>

      {/* ═══ Limit Price ═══ */}
      <div className="mx-3 mt-2 rounded-xl p-3" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Price ({outputToken.symbol}/{inputToken.symbol})</span>
          {marketRate && (
            <button onClick={() => setLimitPrice(marketRate.toFixed(6))} className="text-[9px] font-bold px-2 py-0.5 rounded-full transition hover:brightness-125" style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8" }}>
              Mkt: {fmtAmount(marketRate)}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input type="text" inputMode="decimal" placeholder="0.00" value={limitPrice} onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); if (v.split(".").length <= 2) setLimitPrice(v); }} className="w-full text-xl font-bold bg-transparent outline-none placeholder:opacity-20" style={{ color: "var(--cmc-text)" }} />
          {priceDiff !== null && (
            <span className="text-[9px] font-bold shrink-0 px-1.5 py-0.5 rounded" style={{ background: priceDiff > 0 ? "rgba(22,199,132,0.1)" : priceDiff < -2 ? "rgba(234,57,67,0.1)" : "var(--cmc-neutral-2)", color: priceDiff > 0 ? "#16c784" : priceDiff < -2 ? "#ea3943" : "var(--cmc-neutral-5)" }}>
              {priceDiff > 0 ? "+" : ""}{priceDiff.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* ═══ You Receive ═══ */}
      <div className="mx-3 mt-2 rounded-xl p-3" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
        <span className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--cmc-neutral-5)" }}>You receive</span>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowOutputSelector(true)} className="flex items-center gap-2 pl-2 pr-3 py-2 rounded-full shrink-0 transition-all hover:brightness-110" style={{ background: "var(--cmc-neutral-2)", border: "1px solid var(--cmc-border)" }}>
            <img src={outputToken.logo} alt="" className="w-6 h-6 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>{outputToken.symbol}</span>
            <ChevronDown size={12} style={{ color: "var(--cmc-neutral-5)" }} />
          </button>
          <div className="flex-1 text-right">
            <span className="text-2xl font-bold" style={{ color: outputAmount ? "var(--cmc-text)" : "var(--cmc-neutral-4)" }}>{outputAmount || "0"}</span>
          </div>
        </div>
      </div>

      {/* ═══ Expiry row ═══ */}
      <div className="flex items-center gap-1.5 mx-3 mt-2">
        <Clock size={10} style={{ color: "var(--cmc-neutral-5)" }} />
        <span className="text-[9px] font-medium shrink-0" style={{ color: "var(--cmc-neutral-5)" }}>Expires:</span>
        <div className="flex gap-1 flex-1">
          {EXPIRY_OPTIONS.map((o) => (
            <button key={o.value} onClick={() => setExpirySeconds(o.value)} className="flex-1 text-[9px] font-bold py-1 rounded-md transition-colors" style={{ background: expirySeconds === o.value ? "#6366f1" : "var(--cmc-neutral-2)", color: expirySeconds === o.value ? "#fff" : "var(--cmc-neutral-5)" }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Button ═══ */}
      <div className="px-3 pt-2 pb-3">
        {!connected ? (
          <button onClick={() => setVisible(true)} className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110 flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff" }}>
            <Wallet size={15} /> Connect Wallet
          </button>
        ) : !inputAmount || !limitPrice || parseFloat(inputAmount) <= 0 ? (
          <button disabled className="w-full py-3 rounded-xl text-sm font-bold cursor-not-allowed" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>Enter amount and price</button>
        ) : creating ? (
          <button disabled className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-wait" style={{ background: "#6366f1", color: "#fff", opacity: 0.7 }}>
            <Loader2 size={15} className="animate-spin" /> Placing…
          </button>
        ) : (
          <button onClick={handleCreate} className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff" }}>
            Place Limit Order
          </button>
        )}
      </div>

      {/* Token Selectors */}
      <TokenSelector open={showInputSelector} onClose={() => setShowInputSelector(false)} onSelect={(t) => { setInputToken(t); setLimitPrice(""); }} exclude={outputToken.mint} prices={prices} walletTokens={walletTokens} solBalance={solBalance} connected={connected} />
      <TokenSelector open={showOutputSelector} onClose={() => setShowOutputSelector(false)} onSelect={(t) => { setOutputToken(t); setLimitPrice(""); }} exclude={inputToken.mint} prices={prices} walletTokens={walletTokens} solBalance={solBalance} connected={connected} />
    </div>
  );
}
