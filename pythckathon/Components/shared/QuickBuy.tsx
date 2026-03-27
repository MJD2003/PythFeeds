"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getUltraOrder, signUltraOrder, executeUltraSwap } from "@/lib/jupiter";
import { trackTransaction } from "@/Components/shared/TxTracker";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const AMOUNTS = [0.1, 0.5, 1];

interface QuickBuyProps {
  tokenMint: string;
  tokenSymbol: string;
}

export default function QuickBuy({ tokenMint, tokenSymbol }: QuickBuyProps) {
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const [buying, setBuying] = useState<number | null>(null);

  const handleBuy = async (solAmount: number) => {
    if (!connected) { setVisible(true); return; }
    if (!publicKey || !signTransaction) return;

    setBuying(solAmount);
    try {
      const rawAmount = Math.floor(solAmount * 1e9);
      const quote = await getUltraOrder(
        SOL_MINT,
        tokenMint,
        rawAmount,
        publicKey.toBase58(),
        50 // 0.5% slippage
      );

      if (!quote || quote.errorMessage) {
        throw new Error(quote?.errorMessage || "No route found");
      }

      const signed = await signUltraOrder(quote.transaction, signTransaction);
      const result = await executeUltraSwap(signed, quote.requestId);

      if (result.signature) {
        trackTransaction(result.signature, `Buy ${tokenSymbol} with ${solAmount} SOL`);
      }
      toast.success(`Buying ${tokenSymbol}`, {
        description: `${solAmount} SOL → ${tokenSymbol}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Swap failed";
      toast.error("Quick buy failed", { description: msg });
    }
    setBuying(null);
  };

  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      {AMOUNTS.map((amt) => (
        <button
          key={amt}
          onClick={() => handleBuy(amt)}
          disabled={buying !== null}
          className="px-1.5 py-0.5 rounded text-[8px] font-bold tabular-nums transition-all hover:brightness-125 disabled:opacity-50"
          style={{
            background: "rgba(22,199,132,0.15)",
            color: "#16c784",
            border: "1px solid rgba(22,199,132,0.2)",
          }}
          title={`Buy with ${amt} SOL`}
        >
          {buying === amt ? (
            <Loader2 size={8} className="animate-spin" />
          ) : (
            `${amt}◎`
          )}
        </button>
      ))}
    </div>
  );
}
