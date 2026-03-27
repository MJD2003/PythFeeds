"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Loader2, Wallet, ChevronDown, Timer } from "lucide-react";
import { toast } from "sonner";
import {
  createDcaPosition,
  deserializeDcaTx,
  DCA_FREQUENCIES,
} from "@/lib/jupiter-dca";
import { POPULAR_TOKENS, type TokenInfo } from "@/lib/jupiter";
import { fetchPythPricesBatch } from "@/lib/pyth-prices";
import { fmtAmount } from "@/lib/format";
import { trackTransaction } from "@/Components/shared/TxTracker";
import TokenSelector from "@/Components/swap/TokenSelector";
import { scanWallet, type WalletToken } from "@/lib/wallet-scanner";

export default function DcaTab() {
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();

  const [inputToken, setInputToken] = useState<TokenInfo>(POPULAR_TOKENS[1]); // USDC
  const [outputToken, setOutputToken] = useState<TokenInfo>(POPULAR_TOKENS[0]); // SOL
  const [totalAmount, setTotalAmount] = useState("");
  const [numOrders, setNumOrders] = useState("7");
  const [frequency, setFrequency] = useState(86400);
  const [showInputSelector, setShowInputSelector] = useState(false);
  const [showOutputSelector, setShowOutputSelector] = useState(false);
  const [creating, setCreating] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [walletTokens, setWalletTokens] = useState<WalletToken[]>([]);
  const [solBalance, setSolBalance] = useState<number | null>(null);

  const orders = parseInt(numOrders || "0");
  const amountPerOrder = totalAmount && orders > 0 ? (parseFloat(totalAmount) / orders).toFixed(inputToken.decimals > 6 ? 6 : inputToken.decimals) : "0";
  const totalDuration = orders * frequency;
  const durationLabel = totalDuration >= 604800 ? `${(totalDuration / 604800).toFixed(1)}w` : totalDuration >= 86400 ? `${(totalDuration / 86400).toFixed(1)}d` : `${(totalDuration / 3600).toFixed(1)}h`;

  useEffect(() => { fetchPythPricesBatch(POPULAR_TOKENS.map((t) => t.symbol)).then(setPrices).catch(() => {}); }, []);

  useEffect(() => {
    if (!publicKey || !connection) return;
    scanWallet(connection, publicKey).then((r) => { setSolBalance(r.solBalance); setWalletTokens(r.tokens); }).catch(() => {});
  }, [publicKey, connection]);

  const handleCreate = async () => {
    if (!publicKey || !signTransaction || !totalAmount || !numOrders) return;
    const total = parseFloat(totalAmount);
    if (total <= 0 || orders <= 0) return;

    setCreating(true);
    try {
      const totalRaw = Math.floor(total * Math.pow(10, inputToken.decimals)).toString();
      const perCycleRaw = Math.floor((total / orders) * Math.pow(10, inputToken.decimals)).toString();

      const result = await createDcaPosition({ payer: publicKey.toBase58(), inputMint: inputToken.mint, outputMint: outputToken.mint, totalInAmount: totalRaw, inAmountPerCycle: perCycleRaw, cycleSecondsApart: frequency });
      const tx = deserializeDcaTx(result.transaction);
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
      trackTransaction(sig, `DCA: ${totalAmount} ${inputToken.symbol} → ${outputToken.symbol}`);
      toast.success("DCA created!", { description: `${orders} orders over ${durationLabel}` });
      setTotalAmount("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error("DCA failed", { description: msg });
    }
    setCreating(false);
  };

  return (
    <div>
      {/* ═══ Total to spend ═══ */}
      <div className="mx-3 mt-2 rounded-xl p-3" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
        <span className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--cmc-neutral-5)" }}>Total to spend</span>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowInputSelector(true)} className="flex items-center gap-2 pl-2 pr-3 py-2 rounded-full shrink-0 transition-all hover:brightness-110" style={{ background: "var(--cmc-neutral-2)", border: "1px solid var(--cmc-border)" }}>
            <img src={inputToken.logo} alt="" className="w-6 h-6 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>{inputToken.symbol}</span>
            <ChevronDown size={12} style={{ color: "var(--cmc-neutral-5)" }} />
          </button>
          <div className="flex-1 text-right">
            <input type="text" inputMode="decimal" placeholder="0.00" value={totalAmount} onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); if (v.split(".").length <= 2) setTotalAmount(v); }} className="w-full text-right text-2xl font-bold bg-transparent outline-none placeholder:opacity-20" style={{ color: "var(--cmc-text)" }} />
          </div>
        </div>
      </div>

      {/* ═══ Buy token ═══ */}
      <div className="mx-3 mt-2 rounded-xl p-3" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
        <span className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--cmc-neutral-5)" }}>Buy token</span>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowOutputSelector(true)} className="flex items-center gap-2 pl-2 pr-3 py-2 rounded-full shrink-0 transition-all hover:brightness-110" style={{ background: "var(--cmc-neutral-2)", border: "1px solid var(--cmc-border)" }}>
            <img src={outputToken.logo} alt="" className="w-6 h-6 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>{outputToken.symbol}</span>
            <ChevronDown size={12} style={{ color: "var(--cmc-neutral-5)" }} />
          </button>
          <div className="flex-1 text-right">
            <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>
              {prices[inputToken.symbol] && prices[outputToken.symbol] ? `1 ${inputToken.symbol} ≈ ${fmtAmount(prices[inputToken.symbol] / prices[outputToken.symbol])} ${outputToken.symbol}` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ Config ═══ */}
      <div className="mx-3 mt-2 space-y-2">
        <div>
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Orders</span>
          <div className="flex gap-1 mt-1">
            {["3", "5", "7", "14", "30"].map((n) => (
              <button key={n} onClick={() => setNumOrders(n)} className="flex-1 py-1 rounded-md text-[10px] font-bold transition-colors" style={{ background: numOrders === n ? "#f59e0b" : "var(--cmc-neutral-2)", color: numOrders === n ? "#000" : "var(--cmc-neutral-5)" }}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Frequency</span>
          <div className="flex gap-1 mt-1">
            {DCA_FREQUENCIES.map((f) => (
              <button key={f.seconds} onClick={() => setFrequency(f.seconds)} className="flex-1 py-1 rounded-md text-[8px] font-bold transition-colors" style={{ background: frequency === f.seconds ? "#f59e0b" : "var(--cmc-neutral-2)", color: frequency === f.seconds ? "#000" : "var(--cmc-neutral-5)" }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary line */}
        {totalAmount && parseFloat(totalAmount) > 0 && (
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg text-[9px]" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.12)" }}>
            <span style={{ color: "var(--cmc-neutral-5)" }}>{amountPerOrder} {inputToken.symbol}/order</span>
            <span style={{ color: "var(--cmc-neutral-5)" }}>×{numOrders}</span>
            <span className="font-bold" style={{ color: "var(--cmc-text)" }}>{durationLabel}</span>
          </div>
        )}
      </div>

      {/* ═══ Button ═══ */}
      <div className="px-3 pt-2 pb-3">
        {!connected ? (
          <button onClick={() => setVisible(true)} className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110 flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)", color: "#fff" }}>
            <Wallet size={15} /> Connect Wallet
          </button>
        ) : !totalAmount || parseFloat(totalAmount) <= 0 ? (
          <button disabled className="w-full py-3 rounded-xl text-sm font-bold cursor-not-allowed" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>Enter amount</button>
        ) : creating ? (
          <button disabled className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-wait" style={{ background: "#f59e0b", color: "#000", opacity: 0.7 }}>
            <Loader2 size={15} className="animate-spin" /> Creating…
          </button>
        ) : (
          <button onClick={handleCreate} className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/20 active:scale-[0.98] flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)", color: "#000" }}>
            <Timer size={14} /> Start DCA
          </button>
        )}
      </div>

      {/* Token Selectors */}
      <TokenSelector open={showInputSelector} onClose={() => setShowInputSelector(false)} onSelect={setInputToken} exclude={outputToken.mint} prices={prices} walletTokens={walletTokens} solBalance={solBalance} connected={connected} />
      <TokenSelector open={showOutputSelector} onClose={() => setShowOutputSelector(false)} onSelect={setOutputToken} exclude={inputToken.mint} prices={prices} walletTokens={walletTokens} solBalance={solBalance} connected={connected} />
    </div>
  );
}
