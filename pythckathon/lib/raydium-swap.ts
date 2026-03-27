import { VersionedTransaction } from "@solana/web3.js";

// ── Raydium Swap API (v3, free, no key) ──
const RAY_TX_BASE = "https://transaction-v1.raydium.io";

export interface RaydiumSwapQuote {
  transaction: string; // base64 encoded versioned transaction
  expectedAmountOut: string;
  minAmountOut: string;
  priceImpactPct: number;
  routePlan: string[];
}

/**
 * Get a swap quote from Raydium's compute endpoint.
 * amountIn is in smallest units (lamports, etc.).
 */
export async function getRaydiumSwapQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number,
  wallet: string,
  slippageBps = 50
): Promise<RaydiumSwapQuote | null> {
  try {
    // Step 1: Compute swap route
    const computeRes = await fetch(
      `${RAY_TX_BASE}/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${Math.floor(amountIn)}&slippageBps=${slippageBps}&txVersion=V0`,
      { headers: { Accept: "application/json" } }
    );

    if (!computeRes.ok) {
      console.warn("[Raydium] Compute failed:", computeRes.status);
      return null;
    }

    const computeData = await computeRes.json();
    if (!computeData.success || !computeData.data) {
      console.warn("[Raydium] Compute returned no data");
      return null;
    }

    const { outputAmount, otherAmountThreshold, priceImpactPct, routePlan } = computeData.data;

    // Step 2: Build transaction
    const txRes = await fetch(`${RAY_TX_BASE}/transaction/swap-base-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        computeUnitPriceMicroLamports: "auto",
        swapResponse: computeData,
        txVersion: "V0",
        wallet,
        wrapSol: true,
        unwrapSol: true,
      }),
    });

    if (!txRes.ok) {
      // Still return quote without transaction for display
      return {
        transaction: "",
        expectedAmountOut: String(outputAmount || "0"),
        minAmountOut: String(otherAmountThreshold || "0"),
        priceImpactPct: priceImpactPct || 0,
        routePlan: (routePlan || []).map((r: any) =>
          r.poolInfoList?.map((p: any) => p.label || p.poolType || "Raydium").join(" → ") || "Raydium"
        ),
      };
    }

    const txData = await txRes.json();
    const txBase64 = txData.data?.[0]?.transaction || "";

    return {
      transaction: txBase64,
      expectedAmountOut: String(outputAmount || "0"),
      minAmountOut: String(otherAmountThreshold || "0"),
      priceImpactPct: priceImpactPct || 0,
      routePlan: (routePlan || []).map((r: any) =>
        r.poolInfoList?.map((p: any) => p.label || p.poolType || "Raydium").join(" → ") || "Raydium"
      ),
    };
  } catch (err) {
    console.warn("[Raydium] Swap quote error:", err);
    return null;
  }
}

/**
 * Sign a Raydium swap transaction.
 * Returns the signed transaction ready for sending.
 */
export async function signRaydiumSwapTx(
  base64Tx: string,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
): Promise<VersionedTransaction> {
  const buf = Buffer.from(base64Tx, "base64");
  const tx = VersionedTransaction.deserialize(buf);
  return signTransaction(tx);
}
