"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Loader2 } from "lucide-react";
import {
  POPULAR_TOKENS,
  type TokenInfo,
  searchJupiterTokens,
} from "@/lib/jupiter";
import type { WalletToken } from "@/lib/wallet-scanner";
import { fmtCurrency as fmtUsd, fmtAmount } from "@/lib/format";

interface TokenSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (token: TokenInfo) => void;
  exclude?: string;
  prices: Record<string, number>;
  walletTokens: WalletToken[];
  solBalance: number | null;
  connected: boolean;
}

export default function TokenSelector({
  open,
  onClose,
  onSelect,
  exclude,
  prices,
  walletTokens,
  solBalance,
  connected,
}: TokenSelectorProps) {
  const [query, setQuery] = useState("");
  const [jupResults, setJupResults] = useState<TokenInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open) { setQuery(""); setJupResults([]); setTimeout(() => inputRef.current?.focus(), 100); }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Debounced Jupiter token search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!query || query.length < 2) { setJupResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchJupiterTokens(query);
      setJupResults(results.filter((t) => t.mint !== exclude && !POPULAR_TOKENS.some((p) => p.mint === t.mint)));
      setSearching(false);
    }, 500);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [query, exclude]);

  if (!open) return null;

  const getBal = (t: TokenInfo): number | null => {
    if (!connected) return null;
    if (t.symbol === "SOL") return solBalance;
    const wt = walletTokens.find((w) => w.mint === t.mint);
    return wt ? wt.amount : 0;
  };

  const filtered = POPULAR_TOKENS.filter((t) => {
    if (t.mint === exclude) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    const bA = getBal(a) ?? 0, bB = getBal(b) ?? 0;
    if (bA > 0 && bB <= 0) return -1;
    if (bB > 0 && bA <= 0) return 1;
    return 0;
  });

  return (
    <div className="fixed inset-0 z-1000 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md sm:mx-4 rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl max-h-dvh sm:max-h-[85dvh] flex flex-col" style={{ background: "var(--cmc-card, var(--cmc-bg))", border: "1px solid var(--cmc-border)" }}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
          <h3 className="text-base font-bold" style={{ color: "var(--cmc-text)" }}>Select a token</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition"><X size={16} style={{ color: "var(--cmc-neutral-5)" }} /></button>
        </div>

        <div className="p-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--cmc-neutral-5)" }} />
            <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or symbol…" className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm outline-none transition-colors focus:ring-1 focus:ring-blue-500/30" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }} />
          </div>
        </div>

        {!query && (
          <div className="px-3 pb-2 flex flex-wrap gap-1.5">
            {POPULAR_TOKENS.slice(0, 7).filter(t => t.mint !== exclude).map((t) => (
              <button key={t.mint} onClick={() => { onSelect(t); onClose(); }} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all hover:bg-white/10 hover:scale-105" style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-text)" }}>
                <div className="w-4 h-4 rounded-full shrink-0 overflow-hidden flex items-center justify-center" style={{ background: "var(--cmc-neutral-2)" }}><img src={t.logo} alt="" className="w-4 h-4 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /></div>
                {t.symbol}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto" style={{ borderTop: "1px solid var(--cmc-border)" }}>
          {connected && walletTokens.length > 0 && !query && (
            <div className="px-4 pt-2 pb-1"><span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Your tokens</span></div>
          )}
          {sorted.map((t) => {
            const price = prices[t.symbol.toUpperCase()];
            const bal = getBal(t);
            const hasBalance = bal !== null && bal > 0;
            return (
              <button key={t.mint} onClick={() => { onSelect(t); onClose(); }} className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/5 text-left">
                <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden flex items-center justify-center" style={{ background: "var(--cmc-neutral-2)" }}><img src={t.logo} alt="" className="w-8 h-8 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /></div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>{t.symbol}</span>
                  <span className="text-xs ml-1.5" style={{ color: "var(--cmc-neutral-5)" }}>{t.name}</span>
                </div>
                <div className="text-right shrink-0">
                  {hasBalance && <div className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>{fmtAmount(bal)}</div>}
                  {price ? <div className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{fmtUsd(price)}</div> : null}
                </div>
              </button>
            );
          })}
          {/* Jupiter search results */}
          {query && jupResults.length > 0 && (
            <>
              <div className="px-4 pt-2 pb-1"><span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>All tokens</span></div>
              {jupResults.map((t) => (
                <button key={t.mint} onClick={() => { onSelect(t); onClose(); }} className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/5 text-left">
                  {t.logo ? <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden flex items-center justify-center" style={{ background: "var(--cmc-neutral-2)" }}><img src={t.logo} alt="" className="w-8 h-8 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /></div> : <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)" }}>{t.symbol.slice(0, 2)}</div>}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold" style={{ color: "var(--cmc-text)" }}>{t.symbol}</span>
                    <span className="text-xs ml-1.5" style={{ color: "var(--cmc-neutral-5)" }}>{t.name}</span>
                  </div>
                  <div className="text-[9px] truncate max-w-[80px]" style={{ color: "var(--cmc-neutral-5)" }}>{t.mint.slice(0, 4)}…{t.mint.slice(-4)}</div>
                </button>
              ))}
            </>
          )}
          {searching && <div className="py-4 text-center"><Loader2 size={16} className="animate-spin mx-auto" style={{ color: "var(--cmc-neutral-5)" }} /></div>}
          {sorted.length === 0 && jupResults.length === 0 && !searching && <div className="py-10 text-center text-sm" style={{ color: "var(--cmc-neutral-5)" }}>No tokens found</div>}
        </div>
      </div>
    </div>
  );
}
