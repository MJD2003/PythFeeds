"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  ArrowDownUp,
  ChevronDown,
  Loader2,
  ExternalLink,
  Settings2,
  Wallet,
  Check,
  RefreshCw,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { pushNotification } from "@/Components/shared/NotificationCenter";
import {
  POPULAR_TOKENS,
  type TokenInfo,
  type UltraOrder,
  getUltraOrder,
  signUltraOrder,
  executeUltraSwap,
} from "@/lib/jupiter";
import { getKaminoSwapQuote, signKaminoSwapTx, type KaminoSwapQuote } from "@/lib/kamino";
import { scanWallet, type WalletToken } from "@/lib/wallet-scanner";
import { fetchPythPricesBatch } from "@/lib/pyth-prices";
import { BorderBeam } from "@/Components/magicui/border-beam";
import { Particles } from "@/Components/magicui/particles";
import { getSwapHistory, addSwapRecord, clearSwapHistory, syncSwapHistoryFromBackend, type SwapRecord, getRecentPairs, saveRecentPair, type RecentPair } from "@/lib/swap-history";
import { getExpressRelayQuote, type ExpressRelayQuote } from "@/lib/express-relay";
import { getRaydiumSwapQuote, signRaydiumSwapTx, type RaydiumSwapQuote } from "@/lib/raydium-swap";
import { fmtCurrency as fmtUsd, fmtAmount, truncAddr } from "@/lib/format";

import TokenSelector from "@/Components/swap/TokenSelector";
import SlippageSettings from "@/Components/swap/SlippageSettings";
import RouteComparison from "@/Components/swap/RouteComparison";
import SwapHistoryModal from "@/Components/swap/SwapHistory";
import { trackTransaction } from "@/Components/shared/TxTracker";

// ═══════════════════════════════════════════════════
// ── Main Swap Page ──
// ═══════════════════════════════════════════════════
export default function SwapPage() {
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();

  const searchParams = useSearchParams();
  const fromParam = searchParams?.get("from")?.toUpperCase();
  const toParam = searchParams?.get("to")?.toUpperCase();
  const [inputToken, setInputToken] = useState<TokenInfo>(() => {
    if (fromParam) {
      const found = POPULAR_TOKENS.find(t => t.symbol.toUpperCase() === fromParam);
      if (found) return found;
    }
    return POPULAR_TOKENS[0];
  });
  const [outputToken, setOutputToken] = useState<TokenInfo>(() => {
    if (toParam) {
      const found = POPULAR_TOKENS.find(t => t.symbol.toUpperCase() === toParam);
      if (found) return found;
    }
    return POPULAR_TOKENS[1];
  });
  const [inputAmount, setInputAmount] = useState("");
  const [quote, setQuote] = useState<UltraOrder | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [slippage, setSlippage] = useState(0.5);
  const [showSettings, setShowSettings] = useState(false);
  const [showInputSelector, setShowInputSelector] = useState(false);
  const [showOutputSelector, setShowOutputSelector] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [walletTokens, setWalletTokens] = useState<WalletToken[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [swapHistory, setSwapHistory] = useState<SwapRecord[]>([]);
  const [isDark, setIsDark] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [recentPairs, setRecentPairs] = useState<RecentPair[]>([]);

  // ── Multi-source quotes ──
  const [kaminoQuote, setKaminoQuote] = useState<KaminoSwapQuote | null>(null);
  const [expressRelayQuote, setExpressRelayQuote] = useState<ExpressRelayQuote | null>(null);
  const [raydiumQuote, setRaydiumQuote] = useState<RaydiumSwapQuote | null>(null);
  const [quoteCountdown, setQuoteCountdown] = useState(0);

  const quoteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const quoteRefreshRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const QUOTE_REFRESH_SEC = 15;

  // ── Fetch prices from Pyth Hermes (dynamic, no hardcoded feeds) ──
  const refreshPrices = useCallback(async () => {
    const symbols = POPULAR_TOKENS.map((t) => t.symbol);
    const map = await fetchPythPricesBatch(symbols);
    setPrices(map);
  }, []);

  useEffect(() => {
    refreshPrices();
    const iv = setInterval(refreshPrices, 12000);
    return () => clearInterval(iv);
  }, [refreshPrices]);

  // ── Scan wallet via Helius (reliable RPC + DAS metadata) ──
  const refreshBalances = useCallback(async () => {
    if (!publicKey || !connection) { setSolBalance(null); setWalletTokens([]); return; }
    setBalancesLoading(true);
    try {
      const result = await scanWallet(connection, publicKey);
      setSolBalance(result.solBalance);
      setWalletTokens(result.tokens);
      console.log(`[Swap] Balances loaded: ${result.solBalance.toFixed(4)} SOL + ${result.tokens.length} tokens`);
    } catch (err) {
      console.error("[Swap] Balance scan failed:", err);
    }
    setBalancesLoading(false);
  }, [publicKey, connection]);

  useEffect(() => {
    if (connected && publicKey) refreshBalances();
  }, [connected, publicKey, refreshBalances]);

  // ── Theme detection for Particles color ──
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // ── Load swap history + recent pairs (sync with backend on wallet connect) ──
  useEffect(() => {
    if (publicKey) {
      const wallet = publicKey.toBase58();
      setSwapHistory(getSwapHistory(wallet));
      syncSwapHistoryFromBackend(wallet).then((merged) => setSwapHistory(merged)).catch(() => {});
    } else setSwapHistory([]);
    setRecentPairs(getRecentPairs());
  }, [publicKey]);

  // ── Fetch quotes (reusable) ──
  const fetchQuotes = useCallback(async (silent = false) => {
    const amount = parseFloat(inputAmount);
    if (!amount || amount <= 0 || !inputToken || !outputToken) return;
    if (!silent) { setQuote(null); setKaminoQuote(null); setExpressRelayQuote(null); setRaydiumQuote(null); setQuoteLoading(true); }
    const rawAmount = amount * Math.pow(10, inputToken.decimals);
    const taker = publicKey?.toBase58();
    const slipBps = Math.round(slippage * 100);

    const [jupOrder, kQuote, erQuote, rayQuote] = await Promise.all([
      getUltraOrder(inputToken.mint, outputToken.mint, rawAmount, taker, slipBps),
      taker
        ? getKaminoSwapQuote(inputToken.mint, outputToken.mint, rawAmount, taker, slipBps)
        : Promise.resolve(null),
      getExpressRelayQuote(inputToken.mint, outputToken.mint, rawAmount, taker || undefined),
      taker
        ? getRaydiumSwapQuote(inputToken.mint, outputToken.mint, rawAmount, taker, slipBps)
        : Promise.resolve(null),
    ]);

    setQuote(jupOrder);
    setKaminoQuote(kQuote);
    setExpressRelayQuote(erQuote);
    setRaydiumQuote(rayQuote);
    setQuoteLoading(false);
    setQuoteCountdown(QUOTE_REFRESH_SEC);
  }, [inputAmount, inputToken, outputToken, slippage, publicKey]);

  // ── Auto-fetch quotes on input change (debounced) ──
  useEffect(() => {
    if (quoteTimeoutRef.current) clearTimeout(quoteTimeoutRef.current);
    if (quoteRefreshRef.current) clearInterval(quoteRefreshRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setQuote(null);
    setKaminoQuote(null);
    setExpressRelayQuote(null);
    setRaydiumQuote(null);
    setQuoteCountdown(0);
    const amount = parseFloat(inputAmount);
    if (!amount || amount <= 0 || !inputToken || !outputToken) return;

    quoteTimeoutRef.current = setTimeout(() => {
      fetchQuotes(false);
      // Start auto-refresh interval
      quoteRefreshRef.current = setInterval(() => fetchQuotes(true), QUOTE_REFRESH_SEC * 1000);
      // Countdown ticker
      countdownRef.current = setInterval(() => {
        setQuoteCountdown(prev => prev > 0 ? prev - 1 : QUOTE_REFRESH_SEC);
      }, 1000);
    }, 400);

    return () => {
      if (quoteTimeoutRef.current) clearTimeout(quoteTimeoutRef.current);
      if (quoteRefreshRef.current) clearInterval(quoteRefreshRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [inputAmount, inputToken, outputToken, slippage, publicKey, fetchQuotes]);

  // ── Computed values ──
  const outputAmount = quote ? parseInt(quote.outAmount) / Math.pow(10, outputToken.decimals) : 0;
  const kaminoOutputAmount = kaminoQuote ? parseInt(kaminoQuote.expectedAmountOut) / Math.pow(10, outputToken.decimals) : 0;
  const inputPrice = prices[inputToken.symbol.toUpperCase()] || 0;
  const outputPrice = prices[outputToken.symbol.toUpperCase()] || 0;
  const inputUsd = parseFloat(inputAmount || "0") * inputPrice;
  const priceImpact = quote ? parseFloat(quote.priceImpactPct) : 0;
  const routeLabels = quote?.routePlan?.map((r) => r.swapInfo.label).filter(Boolean) || [];

  // Pyth oracle fair-price reference (what you'd get at oracle rate, no fees)
  const pythFairOutput = inputPrice > 0 && outputPrice > 0 ? parseFloat(inputAmount || "0") * inputPrice / outputPrice : 0;

  // Express Relay output
  const erOutputAmount = expressRelayQuote ? expressRelayQuote.outputToken.amount / Math.pow(10, outputToken.decimals) : 0;

  // Raydium output
  const raydiumOutputAmount = raydiumQuote ? parseInt(raydiumQuote.expectedAmountOut) / Math.pow(10, outputToken.decimals) : 0;

  // Best output across Jupiter, Kamino, Express Relay & Raydium — auto-select best
  const bestOutput = Math.max(outputAmount, kaminoOutputAmount, erOutputAmount, raydiumOutputAmount);
  const bestProvider: "jupiter" | "kamino" | "express-relay" | "raydium" =
    bestOutput > 0 && raydiumOutputAmount === bestOutput && raydiumOutputAmount > outputAmount && raydiumOutputAmount > kaminoOutputAmount && raydiumOutputAmount > erOutputAmount ? "raydium" :
    bestOutput > 0 && erOutputAmount === bestOutput && erOutputAmount > outputAmount && erOutputAmount > kaminoOutputAmount ? "express-relay" :
    bestOutput > 0 && kaminoOutputAmount === bestOutput && kaminoOutputAmount > outputAmount ? "kamino" : "jupiter";
  const activeQuote = bestProvider === "kamino" ? kaminoQuote : bestProvider === "express-relay" ? expressRelayQuote : bestProvider === "raydium" ? raydiumQuote : quote;
  const activeOutputAmount = bestProvider === "kamino" ? kaminoOutputAmount : bestProvider === "express-relay" ? erOutputAmount : bestProvider === "raydium" ? raydiumOutputAmount : outputAmount;
  const outputUsd = activeOutputAmount * outputPrice;
  const rate = activeOutputAmount > 0 && parseFloat(inputAmount) > 0 ? activeOutputAmount / parseFloat(inputAmount) : 0;

  // ── Balance lookup ──
  const getBalance = useCallback((token: TokenInfo): number | null => {
    if (!connected) return null;
    if (token.symbol === "SOL") return solBalance;
    const wt = walletTokens.find((t) => t.mint === token.mint);
    return wt ? wt.amount : 0;
  }, [connected, solBalance, walletTokens]);

  const inputBalance = getBalance(inputToken);
  const outputBalance = getBalance(outputToken);
  const insufficientBalance = connected && inputBalance !== null && parseFloat(inputAmount || "0") > inputBalance;

  const flipTokens = () => {
    setInputToken(outputToken);
    setOutputToken(inputToken);
    setInputAmount(outputAmount > 0 ? String(outputAmount) : "");
    setQuote(null);
  };

  const setMax = () => {
    if (inputBalance === null) return;
    const max = inputToken.symbol === "SOL" ? Math.max(0, inputBalance - 0.01) : inputBalance;
    setInputAmount(max > 0 ? String(max) : "0");
  };

  const setHalf = () => {
    if (inputBalance === null) return;
    const half = inputToken.symbol === "SOL" ? Math.max(0, (inputBalance - 0.01) / 2) : inputBalance / 2;
    setInputAmount(half > 0 ? String(half) : "0");
  };

  // ── Execute swap (multi-provider) ──
  const handleSwap = async () => {
    if (!connected || !publicKey || !signTransaction) return;
    setSwapping(true);
    setTxHash(null);
    try {
      let signature: string | null = null;
      const usedOutput = activeOutputAmount;

      if (bestProvider === "jupiter") {
        if (!quote || !quote.transaction) { toast.error("No Jupiter transaction available"); setSwapping(false); return; }
        const signedTx = await signUltraOrder(quote.transaction, signTransaction);
        const result = await executeUltraSwap(signedTx, quote.requestId);
        if (result.status === "Success") signature = result.signature;
      } else if (bestProvider === "kamino") {
        if (!kaminoQuote || !kaminoQuote.transaction) { toast.error("No Kamino transaction available"); setSwapping(false); return; }
        const signed = await signKaminoSwapTx(kaminoQuote.transaction, signTransaction);
        const rawTx = signed.serialize();
        const sig = await connection.sendRawTransaction(rawTx, { skipPreflight: true });
        await connection.confirmTransaction(sig, "confirmed");
        signature = sig;
      } else if (bestProvider === "express-relay") {
        if (!expressRelayQuote || !expressRelayQuote.transaction) { toast.error("No Express Relay transaction available"); setSwapping(false); return; }
        const { VersionedTransaction } = await import("@solana/web3.js");
        const txBuf = Buffer.from(expressRelayQuote.transaction, "base64");
        const tx = VersionedTransaction.deserialize(txBuf);
        const signed = await signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
        await connection.confirmTransaction(sig, "confirmed");
        signature = sig;
      } else if (bestProvider === "raydium") {
        if (!raydiumQuote || !raydiumQuote.transaction) { toast.error("No Raydium transaction available"); setSwapping(false); return; }
        const signed = await signRaydiumSwapTx(raydiumQuote.transaction, signTransaction);
        const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true });
        await connection.confirmTransaction(sig, "confirmed");
        signature = sig;
      }

      if (signature) {
        setTxHash(signature);
        const providerLabel = bestProvider === "jupiter" ? "Jupiter" : bestProvider === "kamino" ? "Kamino" : bestProvider === "raydium" ? "Raydium" : "Express Relay";
        trackTransaction(signature, `Swap via ${providerLabel}`, `${inputAmount} ${inputToken.symbol} \u2192 ${fmtAmount(usedOutput)} ${outputToken.symbol}`);
        toast.success(`Swap via ${providerLabel} successful!`, {
          description: `${inputAmount} ${inputToken.symbol} → ${fmtAmount(usedOutput)} ${outputToken.symbol}`,
          action: { label: "View on Solscan", onClick: () => window.open(`https://solscan.io/tx/${signature}`, "_blank") },
        });
        pushNotification({
          type: "swap_completed",
          title: `Swap completed via ${providerLabel}`,
          message: `${inputAmount} ${inputToken.symbol} → ${fmtAmount(usedOutput)} ${outputToken.symbol}`,
          actions: [
            { label: "View tx", href: `https://solscan.io/tx/${signature}` },
            { label: "Portfolio", href: "/portfolio" },
          ],
        });
        const wallet = publicKey.toBase58();
        addSwapRecord(wallet, {
          inputSymbol: inputToken.symbol,
          outputSymbol: outputToken.symbol,
          inputAmount: inputAmount,
          outputAmount: String(usedOutput),
          txHash: signature,
          inputMint: inputToken.mint,
          outputMint: outputToken.mint,
        });
        setSwapHistory(getSwapHistory(wallet));
        saveRecentPair({ inputMint: inputToken.mint, outputMint: outputToken.mint, inputSymbol: inputToken.symbol, outputSymbol: outputToken.symbol, inputLogo: inputToken.logo, outputLogo: outputToken.logo });
        setRecentPairs(getRecentPairs());
        setInputAmount("");
        setQuote(null);
        setKaminoQuote(null);
        setExpressRelayQuote(null);
        setRaydiumQuote(null);
        setTimeout(() => refreshBalances(), 2000);
      } else {
        toast.error("Swap failed — check your wallet and try again");
        pushNotification({
          type: "swap_failed",
          title: "Swap failed",
          message: `${inputAmount} ${inputToken.symbol} → ${outputToken.symbol} failed. Check your wallet and try again.`,
          actions: [{ label: "Retry", href: "/swap" }],
        });
      }
    } catch (err: any) {
      console.error("[Swap] Error:", err);
      const raw = (err?.message || "").toLowerCase();
      let title = "Swap failed";
      let desc = err?.message || "An unexpected error occurred";
      if (raw.includes("user rejected") || raw.includes("user denied") || raw.includes("cancelled")) {
        title = "Transaction cancelled";
        desc = "You rejected the transaction in your wallet.";
      } else if (raw.includes("insufficient") || raw.includes("not enough") || raw.includes("0x1")) {
        title = "Insufficient balance";
        desc = `Not enough ${inputToken.symbol} to complete this swap. Check your balance and try a smaller amount.`;
      } else if (raw.includes("slippage") || raw.includes("exceeds desired")) {
        title = "Slippage exceeded";
        desc = `Price moved too much. Try increasing your slippage tolerance (currently ${slippage}%).`;
      } else if (raw.includes("blockhash") || raw.includes("expired") || raw.includes("timeout")) {
        title = "Transaction expired";
        desc = "The network is congested. Please try again — a fresh quote will be fetched.";
      } else if (raw.includes("network") || raw.includes("fetch") || raw.includes("503") || raw.includes("429")) {
        title = "Network error";
        desc = "Could not reach the swap service. Check your connection and try again.";
      }
      toast.error(title, { description: desc });
      pushNotification({
        type: "swap_failed",
        title,
        message: desc,
        actions: [{ label: "Retry", href: "/swap" }],
      });
    }
    setSwapping(false);
  };

  // ═══════════════════ RENDER ═══════════════════
  return (
    <div className="min-h-[calc(100dvh-56px)] flex flex-col items-center justify-center pb-20 px-4 relative overflow-hidden" style={{ background: "var(--cmc-bg)" }}>
      {/* ── Animated gradient mesh background ── */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[600px] h-[600px] rounded-full opacity-[0.07] blur-[120px]" style={{ background: "var(--pf-accent)", top: "-10%", left: "-10%", animation: "float-blob-1 20s ease-in-out infinite" }} />
        <div className="absolute w-[500px] h-[500px] rounded-full opacity-[0.05] blur-[100px]" style={{ background: "var(--pf-up)", bottom: "-10%", right: "-10%", animation: "float-blob-2 25s ease-in-out infinite" }} />
        <div className="absolute w-[300px] h-[300px] rounded-full opacity-[0.04] blur-[80px]" style={{ background: "var(--pf-info)", top: "40%", left: "50%", transform: "translate(-50%, -50%)", animation: "float-blob-3 18s ease-in-out infinite" }} />
      </div>
      <style>{`
        @keyframes float-blob-1 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(30px,-20px) scale(1.05); } 66% { transform: translate(-20px,30px) scale(0.95); } }
        @keyframes float-blob-2 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(-25px,20px) scale(1.08); } 66% { transform: translate(20px,-25px) scale(0.92); } }
        @keyframes float-blob-3 { 0%,100% { transform: translate(-50%,-50%) scale(1); } 50% { transform: translate(-50%,-50%) scale(1.15); } }
      `}</style>

      {/* ══════ Swap Card ══════ */}
      <div className="w-full max-w-[460px] relative z-10">
        <div className="rounded-2xl overflow-visible backdrop-blur-xl relative" style={{ background: "color-mix(in srgb, var(--cmc-bg) 85%, transparent)", border: "1px solid color-mix(in srgb, var(--cmc-border) 50%, transparent)", boxShadow: "0 12px 48px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.03)" }}>
          <BorderBeam size={120} duration={8} colorFrom="#a855f7" colorTo="#6366f1" borderWidth={1.5} />

          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <div className="flex items-center gap-1">
              {connected && (
                <button onClick={refreshBalances} disabled={balancesLoading} className="p-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: "var(--cmc-neutral-5)" }} title="Refresh balances" aria-label="Refresh balances">
                  <RefreshCw size={12} className={balancesLoading ? "animate-spin" : ""} />
                </button>
              )}
              {connected && swapHistory.length > 0 && (
                <button onClick={() => setShowHistory(true)} className="p-1.5 rounded-lg transition-colors hover:bg-white/5 flex items-center gap-1" style={{ color: "var(--cmc-neutral-5)" }} title="Swap history" aria-label="Swap history">
                  <Clock size={12} />
                  <span className="text-[9px] font-bold">{swapHistory.length}</span>
                </button>
              )}
            </div>
            <div className="relative" ref={settingsRef}>
              <button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors hover:bg-white/5" style={{ color: "var(--cmc-neutral-5)" }} aria-label="Slippage settings">
                <Settings2 size={13} />
                <span className="text-[10px] font-bold">{slippage}%</span>
              </button>
              <SlippageSettings slippage={slippage} setSlippage={setSlippage} open={showSettings} onClose={() => setShowSettings(false)} />
            </div>
          </div>

          <>
          {/* ═══ Recent Pairs ═══ */}
          {recentPairs.length > 0 && (
            <div className="flex items-center gap-1.5 px-4 pb-1 overflow-x-auto scrollbar-none">
              <span className="text-[8px] font-bold uppercase tracking-wider shrink-0" style={{ color: "var(--cmc-neutral-5)" }}>Recent:</span>
              {recentPairs.map((p, i) => (
                <button
                  key={`${p.inputMint}-${p.outputMint}-${i}`}
                  onClick={() => {
                    const inp = POPULAR_TOKENS.find(t => t.mint === p.inputMint) || { mint: p.inputMint, symbol: p.inputSymbol, logo: p.inputLogo, name: p.inputSymbol, decimals: 9 };
                    const out = POPULAR_TOKENS.find(t => t.mint === p.outputMint) || { mint: p.outputMint, symbol: p.outputSymbol, logo: p.outputLogo, name: p.outputSymbol, decimals: 9 };
                    setInputToken(inp); setOutputToken(out);
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-semibold shrink-0 transition-all hover:bg-white/10"
                  style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-text)" }}
                >
                  <div className="w-3.5 h-3.5 rounded-full overflow-hidden flex items-center justify-center" style={{ background: "var(--cmc-neutral-2)" }}><img src={p.inputLogo} alt="" className="w-3.5 h-3.5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /></div>
                  {p.inputSymbol}
                  <span style={{ color: "var(--cmc-neutral-5)" }}>→</span>
                  <div className="w-3.5 h-3.5 rounded-full overflow-hidden flex items-center justify-center" style={{ background: "var(--cmc-neutral-2)" }}><img src={p.outputLogo} alt="" className="w-3.5 h-3.5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /></div>
                  {p.outputSymbol}
                </button>
              ))}
            </div>
          )}

          {/* ═══ SELL ═══ */}
          <div className="mx-3 mt-1 rounded-xl p-4" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>You pay</span>
              {connected && inputBalance !== null && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>Bal: {fmtAmount(inputBalance)}</span>
                  <button onClick={setHalf} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md transition hover:bg-white/10" style={{ color: "var(--cmc-text)" }}>HALF</button>
                  <button onClick={setMax} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md transition hover:bg-white/10" style={{ color: "var(--cmc-text)" }}>MAX</button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowInputSelector(true)} className="flex items-center gap-2 pl-2 pr-3 py-2 rounded-full shrink-0 transition-all hover:brightness-110" style={{ background: "var(--cmc-neutral-2)", border: "1px solid var(--cmc-border)" }}>
                <div className="w-7 h-7 rounded-full shrink-0 overflow-hidden flex items-center justify-center" style={{ background: "var(--cmc-neutral-2)" }}><img src={inputToken.logo} alt="" className="w-7 h-7 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /></div>
                <span className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>{inputToken.symbol}</span>
                <ChevronDown size={14} style={{ color: "var(--cmc-neutral-5)" }} />
              </button>
              <div className="flex-1 text-right">
                <input type="text" inputMode="decimal" placeholder="0" value={inputAmount} onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); if (v.split(".").length <= 2) setInputAmount(v); }} className="w-full text-right text-[26px] font-bold bg-transparent outline-none placeholder:opacity-20" style={{ color: insufficientBalance ? "#ea3943" : "var(--cmc-text)" }} />
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  {inputUsd > 0 && <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>≈ {fmtUsd(inputUsd)}</span>}
                  {insufficientBalance && <span className="text-[10px] font-semibold" style={{ color: "#ea3943" }}>Exceeds balance</span>}
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Flip ═══ */}
          <div className="flex justify-center -my-3 relative z-10">
            <button onClick={flipTokens} aria-label="Swap input and output tokens" className="group h-11 w-11 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 hover:shadow-xl active:scale-95" style={{ background: "linear-gradient(135deg, var(--pf-accent), var(--pf-info))", color: "#fff", border: "3px solid color-mix(in srgb, var(--cmc-bg) 85%, transparent)" }}>
              <ArrowDownUp size={15} className="transition-transform group-hover:rotate-180" style={{ transitionDuration: "300ms" }} />
            </button>
          </div>

          {/* ═══ BUY ═══ */}
          <div className="mx-3 rounded-xl p-4" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>You receive</span>
              {connected && outputBalance !== null && <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>Bal: {fmtAmount(outputBalance)}</span>}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowOutputSelector(true)} className="flex items-center gap-2 pl-2 pr-3 py-2 rounded-full shrink-0 transition-all hover:brightness-110" style={{ background: "var(--cmc-neutral-2)", border: "1px solid var(--cmc-border)" }}>
                <div className="w-7 h-7 rounded-full shrink-0 overflow-hidden flex items-center justify-center" style={{ background: "var(--cmc-neutral-2)" }}><img src={outputToken.logo} alt="" className="w-7 h-7 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /></div>
                <span className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>{outputToken.symbol}</span>
                <ChevronDown size={14} style={{ color: "var(--cmc-neutral-5)" }} />
              </button>
              <div className="flex-1 text-right">
                <div className="text-[26px] font-bold" style={{ color: quoteLoading ? "var(--cmc-neutral-5)" : "var(--cmc-text)" }}>
                  {quoteLoading ? <Loader2 size={20} className="animate-spin ml-auto" /> : activeOutputAmount > 0 ? fmtAmount(activeOutputAmount) : <span style={{ color: "var(--cmc-neutral-4)" }}>0</span>}
                </div>
                {outputUsd > 0 && !quoteLoading && <span className="text-[11px]" style={{ color: "var(--cmc-neutral-5)" }}>≈ {fmtUsd(outputUsd)}</span>}
              </div>
            </div>
          </div>

          {/* ═══ Compact rate line ═══ */}
          {activeOutputAmount > 0 && !quoteLoading && (
            <div className="mx-3 flex items-center justify-between px-1 py-1">
              <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>
                1 {inputToken.symbol} ≈ {fmtAmount(activeOutputAmount / parseFloat(inputAmount || "1"))} {outputToken.symbol}
              </span>
              <span className="text-[10px] font-semibold flex items-center gap-1.5" style={{ color: "var(--cmc-neutral-5)" }}>
                <span style={{ color: "#16c784" }}>{bestProvider === "jupiter" ? "Jupiter" : bestProvider === "kamino" ? "Kamino" : bestProvider === "raydium" ? "Raydium" : "Express Relay"}</span>
                <span>·</span>
                <span>{slippage}% slip</span>
              </span>
            </div>
          )}

          {/* ═══ Swap Button ═══ */}
          <div className="p-3">
            <style>{`
              @keyframes swapIconRotate {
                0% { opacity:0; transform:translateY(8px) scale(.5); }
                5% { opacity:1; transform:translateY(0) scale(1); }
                15% { opacity:1; transform:translateY(0) scale(1); }
                20% { opacity:0; transform:translateY(-8px) scale(.5); }
                100% { opacity:0; transform:translateY(-8px) scale(.5); }
              }
              .swap-btn:hover .swap-icon { animation:none; }
              .swap-btn:hover .swap-icon-default { opacity:0!important; }
              .swap-btn:hover .swap-icon-1 { animation:swapIconRotate 2.5s infinite 0s; }
              .swap-btn:hover .swap-icon-2 { animation:swapIconRotate 2.5s infinite .5s; }
              .swap-btn:hover .swap-icon-3 { animation:swapIconRotate 2.5s infinite 1s; }
              .swap-btn:hover .swap-icon-4 { animation:swapIconRotate 2.5s infinite 1.5s; }
            `}</style>
            {!connected ? (
              <button onClick={() => setVisible(true)} className="w-full py-3.5 rounded-xl text-sm font-bold transition-all hover:brightness-110 flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #16c784 0%, var(--pf-accent) 100%)", color: "#000" }}>
                <Wallet size={16} /> Connect Wallet
              </button>
            ) : !inputAmount || parseFloat(inputAmount) <= 0 ? (
              <button disabled className="w-full py-3.5 rounded-xl text-sm font-bold cursor-not-allowed" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>Enter an amount</button>
            ) : insufficientBalance ? (
              <button disabled className="w-full py-3.5 rounded-xl text-sm font-bold cursor-not-allowed" style={{ background: "rgba(234,57,67,0.12)", color: "#ea3943" }}>Insufficient {inputToken.symbol} balance</button>
            ) : quoteLoading ? (
              <button disabled className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-wait" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}><Loader2 size={16} className="animate-spin" /> Fetching route…</button>
            ) : !activeQuote ? (
              <button disabled className="w-full py-3.5 rounded-xl text-sm font-bold cursor-not-allowed" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>No route found</button>
            ) : (bestProvider === "jupiter" && quote?.errorMessage) ? (
              <button disabled className="w-full py-3.5 rounded-xl text-sm font-bold cursor-not-allowed" style={{ background: "rgba(234,57,67,0.12)", color: "#ea3943" }}>{quote.errorMessage}</button>
            ) : swapping ? (
              <button disabled className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-wait" style={{ background: "#16c784", color: "#000", opacity: 0.7 }}><Loader2 size={16} className="animate-spin" /> Confirming swap…</button>
            ) : (
              <button
                onClick={handleSwap}
                className="swap-btn w-full py-3.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-500/20 active:scale-[0.98] flex items-center justify-center gap-2.5"
                style={{ background: "linear-gradient(135deg, #16c784 0%, var(--pf-accent) 100%)", color: "#000" }}
              >
                <span className="font-extrabold">Swap via {bestProvider === "jupiter" ? "Jupiter" : bestProvider === "kamino" ? "Kamino" : bestProvider === "raydium" ? "Raydium" : "Express Relay"}</span>
                <span className="relative w-5 h-5">
                  {/* Default icon */}
                  <svg viewBox="0 0 24 24" className="swap-icon swap-icon-default absolute inset-0 w-5 h-5" style={{ opacity: 1 }}>
                    <path d="M21,18V19A2,2 0 0,1 19,21H5C3.89,21 3,20.1 3,19V5A2,2 0 0,1 5,3H19A2,2 0 0,1 21,5V6H12C10.89,6 10,6.9 10,8V16A2,2 0 0,0 12,18M12,16H22V8H12M16,13.5A1.5,1.5 0 0,1 14.5,12A1.5,1.5 0 0,1 16,10.5A1.5,1.5 0 0,1 17.5,12A1.5,1.5 0 0,1 16,13.5Z" fill="currentColor" />
                  </svg>
                  {/* Rotating icons on hover */}
                  <svg viewBox="0 0 24 24" className="swap-icon swap-icon-1 absolute inset-0 w-5 h-5" style={{ opacity: 0 }}>
                    <path d="M20,8H4V6H20M20,18H4V12H20M20,4H4C2.89,4 2,4.89 2,6V18C2,19.11 2.89,20 4,20H20C21.11,20 22,19.11 22,18V6C22,4.89 21.11,4 20,4Z" fill="currentColor" />
                  </svg>
                  <svg viewBox="0 0 24 24" className="swap-icon swap-icon-2 absolute inset-0 w-5 h-5" style={{ opacity: 0 }}>
                    <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" fill="currentColor" />
                  </svg>
                  <svg viewBox="0 0 24 24" className="swap-icon swap-icon-3 absolute inset-0 w-5 h-5" style={{ opacity: 0 }}>
                    <path d="M2,17H22V21H2V17M6.25,7H9V6H6V3H18V6H15V7H17.75L19,17H5L6.25,7M9,10H15V8H9V10M9,13H15V11H9V13Z" fill="currentColor" />
                  </svg>
                  <svg viewBox="0 0 24 24" className="swap-icon swap-icon-4 absolute inset-0 w-5 h-5" style={{ opacity: 0 }}>
                    <path d="M9,16.17L4.83,12L3.41,13.41L9,19L21,7L19.59,5.59L9,16.17Z" fill="currentColor" />
                  </svg>
                </span>
              </button>
            )}
          </div>
        </>
        </div>

        {/* ═══ Route & Details (below swap button, collapsible) ═══ */}
        {(activeOutputAmount > 0 || quoteLoading) && (
          <details className="mt-2 rounded-xl overflow-hidden group/details" style={{ background: "var(--cmc-neutral-1)", border: "1px solid var(--cmc-border)" }} open>
            <summary className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden" style={{ color: "var(--cmc-neutral-5)" }}>
              <span className="text-[10px] font-bold uppercase tracking-wider">Route & Details</span>
              <ChevronDown size={12} className="transition-transform group-open/details:rotate-180" />
            </summary>
            <div className="px-1 pb-2">
              <RouteComparison
                quote={quote} kaminoQuote={kaminoQuote} expressRelayQuote={expressRelayQuote} raydiumQuote={raydiumQuote}
                outputToken={outputToken} inputToken={inputToken} inputAmount={inputAmount}
                outputAmount={outputAmount} kaminoOutputAmount={kaminoOutputAmount} erOutputAmount={erOutputAmount} raydiumOutputAmount={raydiumOutputAmount}
                bestProvider={bestProvider} activeOutputAmount={activeOutputAmount} pythFairOutput={pythFairOutput}
                quoteCountdown={quoteCountdown} quoteRefreshSec={QUOTE_REFRESH_SEC} onRefresh={() => fetchQuotes(true)} quoteLoading={quoteLoading}
              />

              {quote && !quoteLoading && bestProvider === "jupiter" && (
                <div className="mx-2 mt-1 mb-1 rounded-xl p-3 space-y-1" style={{ background: "rgba(255,255,255,0.015)" }}>
                  {[
                    ["Rate", `1 ${inputToken.symbol} ≈ ${fmtAmount(rate)} ${outputToken.symbol}`],
                    ["Price Impact", { text: `${priceImpact < 0.01 ? "<0.01" : priceImpact.toFixed(2)}%`, color: priceImpact > 1 ? "#ea3943" : priceImpact > 0.3 ? "#f59e0b" : "#16c784" }],
                    ["Min. Received", `${fmtAmount(parseInt(quote.otherAmountThreshold) / Math.pow(10, outputToken.decimals))} ${outputToken.symbol}`],
                    ["Slippage", `${slippage}%`],
                    routeLabels.length > 0 ? ["Route", routeLabels.join(" → ")] : null,
                  ].filter(Boolean).map((row, i) => {
                    const [label, val] = row as [string, string | { text: string; color: string }];
                    const isObj = typeof val === "object";
                    return (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{label}</span>
                        <span className="text-[10px] font-semibold truncate ml-4" style={{ color: isObj ? val.color : "var(--cmc-text)" }}>{isObj ? val.text : val}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {kaminoQuote && !quoteLoading && bestProvider === "kamino" && (
                <div className="mx-2 mt-1 mb-1 rounded-xl p-3 space-y-1" style={{ background: "rgba(255,255,255,0.015)" }}>
                  {[
                    ["Rate", `1 ${inputToken.symbol} ≈ ${fmtAmount(kaminoOutputAmount / parseFloat(inputAmount || "1"))} ${outputToken.symbol}`],
                    ["Min. Received", `${fmtAmount(parseInt(kaminoQuote.minAmountOut) / Math.pow(10, outputToken.decimals))} ${outputToken.symbol}`],
                    ["Router", kaminoQuote.routerType],
                    ["Slippage", `${slippage}%`],
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{row[0]}</span>
                      <span className="text-[10px] font-semibold" style={{ color: "var(--cmc-text)" }}>{row[1]}</span>
                    </div>
                  ))}
                </div>
              )}
              {expressRelayQuote && !quoteLoading && bestProvider === "express-relay" && (
                <div className="mx-2 mt-1 mb-1 rounded-xl p-3 space-y-1" style={{ background: "rgba(255,255,255,0.015)" }}>
                  {[
                    ["Rate", `1 ${inputToken.symbol} ≈ ${fmtAmount(erOutputAmount / parseFloat(inputAmount || "1"))} ${outputToken.symbol}`],
                    ["Provider", "Pyth Express Relay"],
                    ["Slippage", `${slippage}%`],
                    expressRelayQuote.expirationTime ? ["Expires", `${Math.max(0, Math.round((expressRelayQuote.expirationTime - Date.now() / 1000)))}s`] : null,
                  ].filter(Boolean).map((row, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{(row as string[])[0]}</span>
                      <span className="text-[10px] font-semibold" style={{ color: "var(--cmc-text)" }}>{(row as string[])[1]}</span>
                    </div>
                  ))}
                </div>
              )}
              {raydiumQuote && !quoteLoading && bestProvider === "raydium" && (
                <div className="mx-2 mt-1 mb-1 rounded-xl p-3 space-y-1" style={{ background: "rgba(255,255,255,0.015)" }}>
                  {[
                    ["Rate", `1 ${inputToken.symbol} ≈ ${fmtAmount(raydiumOutputAmount / parseFloat(inputAmount || "1"))} ${outputToken.symbol}`],
                    ["Min. Received", `${fmtAmount(parseInt(raydiumQuote.minAmountOut) / Math.pow(10, outputToken.decimals))} ${outputToken.symbol}`],
                    raydiumQuote.priceImpactPct > 0 ? ["Price Impact", `${raydiumQuote.priceImpactPct.toFixed(2)}%`] : null,
                    ["Router", "Raydium V3"],
                    ["Slippage", `${slippage}%`],
                  ].filter(Boolean).map((row, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{(row as string[])[0]}</span>
                      <span className="text-[10px] font-semibold" style={{ color: "var(--cmc-text)" }}>{(row as string[])[1]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        )}

        {/* ═══ Success TX ═══ */}
        {txHash && (
          <div className="mt-3 rounded-xl p-3 flex items-center gap-2" style={{ background: "rgba(22,199,132,0.08)", border: "1px solid rgba(22,199,132,0.2)" }}>
            <Check size={16} style={{ color: "#16c784" }} />
            <span className="text-xs font-medium flex-1" style={{ color: "#16c784" }}>Swap confirmed!</span>
            <a href={`https://solscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: "var(--cmc-text)" }}>{truncAddr(txHash)} <ExternalLink size={10} /></a>
          </div>
        )}

        <div className="mt-3 text-center text-[10px] flex items-center justify-center gap-3 flex-wrap" style={{ color: "var(--cmc-neutral-5)" }}>
          <span><span className="font-semibold">Jupiter</span></span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span><span className="font-semibold">Kamino kSwap</span></span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span><span className="font-semibold">Pyth Express Relay</span></span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span><span className="font-semibold">Raydium</span></span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span>Prices by <span className="font-semibold">Pyth Network</span></span>
        </div>
      </div>

      {/* Token selectors */}
      <TokenSelector open={showInputSelector} onClose={() => setShowInputSelector(false)} onSelect={setInputToken} exclude={outputToken.mint} prices={prices} walletTokens={walletTokens} solBalance={solBalance} connected={connected} />
      <TokenSelector open={showOutputSelector} onClose={() => setShowOutputSelector(false)} onSelect={setOutputToken} exclude={inputToken.mint} prices={prices} walletTokens={walletTokens} solBalance={solBalance} connected={connected} />

      {/* ═══ History Modal ═══ */}
      <SwapHistoryModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        history={swapHistory}
        onClear={() => { if (publicKey) { clearSwapHistory(publicKey.toBase58()); setSwapHistory([]); setShowHistory(false); } }}
      />


    </div>
  );
}
