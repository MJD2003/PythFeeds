// ── Pyth Express Relay — Swap Quote API ──
const ER_BASE = "https://per-mainnet.dourolabs.app";

export interface ExpressRelayQuote {
  referenceId: string;
  inputToken: { token: string; amount: number };
  outputToken: { token: string; amount: number };
  platformFee: { token: string; amount: number };
  referrerFee: { token: string; amount: number };
  transaction: string | null; // base64, null if indicative only
  expirationTime: number | null;
}

/**
 * Get a swap quote from Pyth Express Relay.
 * Uses the REST API directly (no SDK dependency for quote-only).
 * amountIn is in smallest units (lamports, etc.).
 * If wallet is provided, returns an executable transaction.
 * If wallet is null, returns an indicative price only.
 */
export async function getExpressRelayQuote(
  inputMint: string,
  outputMint: string,
  amountIn: number,
  wallet?: string
): Promise<ExpressRelayQuote | null> {
  try {
    const body: any = {
      chain_id: "solana",
      input_token_mint: inputMint,
      output_token_mint: outputMint,
      specified_token_amount: {
        side: "input",
        amount: Math.floor(amountIn),
      },
    };
    if (wallet) {
      body.user_wallet_address = wallet;
    }

    const res = await fetch(`${ER_BASE}/v1/opportunities/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn("[Express Relay] Quote failed:", res.status, errText);
      return null;
    }

    const data = await res.json();

    // Express Relay returns versioned responses
    const inner = data.v1 || data;

    return {
      referenceId: inner.reference_id || "",
      inputToken: inner.input_token || { token: inputMint, amount: amountIn },
      outputToken: inner.output_token || { token: outputMint, amount: 0 },
      platformFee: inner.platform_fee || { token: "", amount: 0 },
      referrerFee: inner.referrer_fee || { token: "", amount: 0 },
      transaction: inner.transaction || null,
      expirationTime: inner.expiration_time || null,
    };
  } catch (err) {
    console.warn("[Express Relay] Quote error:", err);
    return null;
  }
}

/**
 * Submit a signed quote back to Express Relay for execution.
 */
export async function submitExpressRelayQuote(
  referenceId: string,
  userSignature: string
): Promise<{ transaction: string } | null> {
  try {
    const res = await fetch(`${ER_BASE}/v1/solana/quotes/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference_id: referenceId,
        user_signature: userSignature,
      }),
    });
    if (!res.ok) {
      console.warn("[Express Relay] Submit failed:", res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn("[Express Relay] Submit error:", err);
    return null;
  }
}
