"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, BellRing, Plus, Trash2, TrendingUp, TrendingDown, Check, Search, RefreshCw, Percent, DollarSign } from "lucide-react";
import { Button } from "@/Components/ui/button";
import { toast } from "sonner";
import { getAlerts, addAlert, removeAlert, checkAlerts, syncAlertsFromBackend, setWalletRef, type PriceAlert, type AlertMode } from "@/lib/price-alerts";
import { fetchPythPrices } from "@/lib/api/backend";
import { fetchPythPricesBatch, subscribePythStream } from "@/lib/pyth-prices";
import { searchJupiterTokens } from "@/lib/jupiter";
import { fmtCurrency as fmtUsd } from "@/lib/format";

const QUICK_ASSETS = [
  { symbol: "BTC", name: "Bitcoin", logo: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png" },
  { symbol: "ETH", name: "Ethereum", logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png" },
  { symbol: "SOL", name: "Solana", logo: "https://assets.coingecko.com/coins/images/4128/small/solana.png" },
  { symbol: "BNB", name: "BNB", logo: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png" },
  { symbol: "XRP", name: "XRP", logo: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png" },
  { symbol: "DOGE", name: "Dogecoin", logo: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png" },
  { symbol: "LINK", name: "Chainlink", logo: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png" },
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "TSLA", name: "Tesla" },
];

interface SearchResult {
  symbol: string;
  name: string;
  logo?: string;
  mint?: string;
}

interface AlertsTabProps {
  wallet: string;
}

export default function AlertsTab({ wallet }: AlertsTabProps) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [showAdd, setShowAdd] = useState(false);

  // Form state
  const [formMode, setFormMode] = useState<AlertMode>("price");
  const [formDirection, setFormDirection] = useState<"above" | "below">("above");
  const [formPrice, setFormPrice] = useState("");
  const [formPercent, setFormPercent] = useState("");
  const [formRecurring, setFormRecurring] = useState(false);

  // Token search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<SearchResult | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setAlerts(getAlerts());
    if (wallet) {
      setWalletRef(wallet);
      syncAlertsFromBackend(wallet).then(setAlerts);
    }
  }, [wallet]);

  // Token search with debounce
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        // Search Jupiter tokens
        const jupResults = await searchJupiterTokens(searchQuery);
        const mapped: SearchResult[] = jupResults.slice(0, 8).map((t: { symbol: string; name: string; logoURI?: string; address?: string }) => ({
          symbol: t.symbol,
          name: t.name,
          logo: t.logoURI,
          mint: t.address,
        }));
        // Also include matching quick assets
        const lower = searchQuery.toLowerCase();
        const quickMatches = QUICK_ASSETS.filter(
          a => a.symbol.toLowerCase().includes(lower) || a.name.toLowerCase().includes(lower)
        ).filter(a => !mapped.find(m => m.symbol === a.symbol));
        setSearchResults([...quickMatches, ...mapped]);
        setShowSearchResults(true);
      } catch {
        // Fallback to quick assets only
        const lower = searchQuery.toLowerCase();
        setSearchResults(QUICK_ASSETS.filter(
          a => a.symbol.toLowerCase().includes(lower) || a.name.toLowerCase().includes(lower)
        ));
        setShowSearchResults(true);
      }
      setSearching(false);
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery]);

  const refreshAndCheck = useCallback(async () => {
    const currentAlerts = getAlerts();
    if (currentAlerts.length === 0) return;
    const symbols = [...new Set(currentAlerts.map((a) => a.symbol.toUpperCase()))];
    try {
      const hermesPrices = await fetchPythPricesBatch(symbols);
      const priceMap: Record<string, number> = {};
      const checkMap = new Map<string, number>();
      for (const [sym, p] of Object.entries(hermesPrices)) {
        if (p > 0) { priceMap[sym] = p; checkMap.set(sym.toLowerCase(), p); }
      }
      const missing = symbols.filter(s => !priceMap[s]);
      if (missing.length > 0) {
        try {
          const backendPrices = await fetchPythPrices(missing);
          for (const [sym, data] of Object.entries(backendPrices)) {
            if (!priceMap[sym]) { priceMap[sym] = data.price; checkMap.set(sym.toLowerCase(), data.price); }
          }
        } catch {}
      }
      setLivePrices(priceMap);
      checkAlerts(checkMap);
      setAlerts(getAlerts());
    } catch {}
  }, []);

  useEffect(() => {
    const currentAlerts = getAlerts();
    if (currentAlerts.length === 0) return;
    const symbols = [...new Set(currentAlerts.map(a => a.symbol.toUpperCase()))];
    const handlePrice = (sym: string, price: number) => {
      if (price <= 0) return;
      setLivePrices(lp => ({ ...lp, [sym]: price }));
      const checkMap = new Map([[sym.toLowerCase(), price]]);
      checkAlerts(checkMap);
      setAlerts(getAlerts());
    };
    let sseCleanup: (() => void) | null = null;
    let pollIv: NodeJS.Timeout | null = null;
    subscribePythStream(symbols, handlePrice)
      .then(unsub => { sseCleanup = unsub; })
      .catch(() => { refreshAndCheck(); pollIv = setInterval(refreshAndCheck, 10_000); });
    const backupIv = setInterval(refreshAndCheck, 30_000);
    refreshAndCheck();
    return () => { sseCleanup?.(); if (pollIv) clearInterval(pollIv); clearInterval(backupIv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts.length]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const selectAsset = (asset: SearchResult) => {
    setSelectedAsset(asset);
    setSearchQuery("");
    setShowSearchResults(false);
    // Pre-fill current price if available
    const currentPrice = livePrices[asset.symbol.toUpperCase()];
    if (currentPrice && formMode === "price") {
      setFormPrice(String(Math.round(currentPrice * (formDirection === "above" ? 1.1 : 0.9) * 100) / 100));
    }
  };

  const handleAdd = () => {
    if (!selectedAsset) { toast.error("Select an asset first"); return; }

    const currentPrice = livePrices[selectedAsset.symbol.toUpperCase()] || 0;

    if (formMode === "percentage") {
      const pct = parseFloat(formPercent);
      if (!pct || pct <= 0) { toast.error("Enter a valid percentage"); return; }
      if (currentPrice <= 0) { toast.error("No live price available — try again in a moment"); return; }
      // Compute target price from percentage
      const targetPrice = formDirection === "above"
        ? currentPrice * (1 + pct / 100)
        : currentPrice * (1 - pct / 100);
      addAlert({
        symbol: selectedAsset.symbol,
        name: selectedAsset.name,
        targetPrice,
        direction: formDirection,
        mode: "percentage",
        percentThreshold: pct,
        referencePrice: currentPrice,
        recurring: formRecurring,
        logo: selectedAsset.logo,
        mint: selectedAsset.mint,
      });
    } else {
      const price = parseFloat(formPrice);
      if (!price || price <= 0) { toast.error("Enter a valid target price"); return; }
      addAlert({
        symbol: selectedAsset.symbol,
        name: selectedAsset.name,
        targetPrice: price,
        direction: formDirection,
        mode: "price",
        recurring: formRecurring,
        logo: selectedAsset.logo,
        mint: selectedAsset.mint,
      });
    }

    setAlerts(getAlerts());
    setSelectedAsset(null);
    setFormPrice("");
    setFormPercent("");
    setFormRecurring(false);
    setShowAdd(false);
  };

  const handleRemove = (id: string) => {
    removeAlert(id);
    setAlerts(getAlerts());
    toast.success("Alert removed");
  };

  const activeAlerts = alerts.filter((a) => !a.triggered);
  const triggeredAlerts = alerts.filter((a) => a.triggered);

  return (
    <div>
      {/* Header + Add button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {alerts.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold" style={{ background: "rgba(153,69,255,0.1)", color: "var(--pf-accent)" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--pf-accent)" }} />
              Pyth Live
            </div>
          )}
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="gap-1.5 h-7 text-[11px]" style={{ background: "var(--pf-accent)", color: "#fff" }}>
          <Plus size={12} /> New Alert
        </Button>
      </div>

      {/* ═══ Enhanced Add Form ═══ */}
      {showAdd && (
        <div className="rounded-xl p-4 mb-4" style={{ border: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
          <p className="text-xs font-bold mb-3" style={{ color: "var(--cmc-text)" }}>Create Alert</p>

          {/* Token Search */}
          <div className="relative mb-3">
            <label className="text-[10px] font-medium block mb-1" style={{ color: "var(--cmc-neutral-5)" }}>Search any token or asset</label>
            {selectedAsset ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--cmc-neutral-2)", border: "1px solid var(--cmc-border)" }}>
                {selectedAsset.logo && <img src={selectedAsset.logo} alt="" className="w-5 h-5 rounded-full" />}
                <span className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>{selectedAsset.symbol}</span>
                <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{selectedAsset.name}</span>
                {livePrices[selectedAsset.symbol.toUpperCase()] && (
                  <span className="text-[10px] font-semibold ml-auto tabular-nums" style={{ color: "var(--cmc-text)" }}>
                    {fmtUsd(livePrices[selectedAsset.symbol.toUpperCase()])}
                  </span>
                )}
                <button onClick={() => setSelectedAsset(null)} className="ml-1 p-0.5 rounded hover:bg-white/10 transition-colors">
                  <Trash2 size={10} style={{ color: "var(--cmc-neutral-5)" }} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--cmc-neutral-5)" }} />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => { if (searchResults.length > 0) setShowSearchResults(true); }}
                    placeholder="Search BTC, SOL, BONK, AAPL..."
                    className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
                    style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}
                  />
                  {searching && <div className="absolute right-2.5 top-1/2 -translate-y-1/2"><RefreshCw size={11} className="animate-spin" style={{ color: "var(--cmc-neutral-5)" }} /></div>}
                </div>
                {/* Search results dropdown */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden shadow-lg z-10" style={{ background: "var(--cmc-bg)", border: "1px solid var(--cmc-border)" }}>
                    {searchResults.map((r) => (
                      <button
                        key={`${r.symbol}-${r.mint || r.name}`}
                        onClick={() => selectAsset(r)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors hover:bg-white/5"
                        style={{ borderBottom: "1px solid var(--cmc-border)" }}
                      >
                        {r.logo ? (
                          <img src={r.logo} alt="" className="w-5 h-5 rounded-full shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}>{r.symbol.slice(0, 2)}</div>
                        )}
                        <span className="text-xs font-semibold" style={{ color: "var(--cmc-text)" }}>{r.symbol}</span>
                        <span className="text-[10px] truncate" style={{ color: "var(--cmc-neutral-5)" }}>{r.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {/* Quick pick chips */}
                {!searchQuery && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {QUICK_ASSETS.slice(0, 7).map(a => (
                      <button
                        key={a.symbol}
                        onClick={() => selectAsset(a)}
                        className="flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-semibold transition-colors hover:brightness-110"
                        style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)", border: "1px solid var(--cmc-border)" }}
                      >
                        {a.logo && <img src={a.logo} alt="" className="w-3 h-3 rounded-full" />}
                        {a.symbol}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Mode toggle + Direction + Value */}
          <div className="flex flex-wrap items-end gap-3">
            {/* Mode: Price vs Percentage */}
            <div>
              <label className="text-[10px] font-medium block mb-1" style={{ color: "var(--cmc-neutral-5)" }}>Mode</label>
              <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
                <button onClick={() => setFormMode("price")} className="px-2.5 py-1.5 text-xs font-medium transition-all flex items-center gap-1"
                  style={{ background: formMode === "price" ? "rgba(153,69,255,0.15)" : "var(--cmc-neutral-2)", color: formMode === "price" ? "var(--pf-accent)" : "var(--cmc-neutral-5)" }}>
                  <DollarSign size={10} /> Price
                </button>
                <button onClick={() => setFormMode("percentage")} className="px-2.5 py-1.5 text-xs font-medium transition-all flex items-center gap-1"
                  style={{ background: formMode === "percentage" ? "rgba(153,69,255,0.15)" : "var(--cmc-neutral-2)", color: formMode === "percentage" ? "var(--pf-accent)" : "var(--cmc-neutral-5)" }}>
                  <Percent size={10} /> %
                </button>
              </div>
            </div>

            {/* Direction */}
            <div>
              <label className="text-[10px] font-medium block mb-1" style={{ color: "var(--cmc-neutral-5)" }}>Direction</label>
              <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
                <button onClick={() => setFormDirection("above")} className="px-3 py-1.5 text-xs font-medium transition-all"
                  style={{ background: formDirection === "above" ? "rgba(22,199,132,0.15)" : "var(--cmc-neutral-2)", color: formDirection === "above" ? "#16c784" : "var(--cmc-neutral-5)" }}>
                  {formMode === "percentage" ? "↑ Up" : "Above"}
                </button>
                <button onClick={() => setFormDirection("below")} className="px-3 py-1.5 text-xs font-medium transition-all"
                  style={{ background: formDirection === "below" ? "rgba(234,57,67,0.15)" : "var(--cmc-neutral-2)", color: formDirection === "below" ? "#ea3943" : "var(--cmc-neutral-5)" }}>
                  {formMode === "percentage" ? "↓ Down" : "Below"}
                </button>
              </div>
            </div>

            {/* Target value */}
            {formMode === "price" ? (
              <div>
                <label className="text-[10px] font-medium block mb-1" style={{ color: "var(--cmc-neutral-5)" }}>Target ($)</label>
                <input type="number" step="any" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} placeholder="100000"
                  className="rounded-lg px-3 py-1.5 text-xs outline-none w-28 tabular-nums"
                  style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }} />
              </div>
            ) : (
              <div>
                <label className="text-[10px] font-medium block mb-1" style={{ color: "var(--cmc-neutral-5)" }}>Threshold (%)</label>
                <input type="number" step="0.1" value={formPercent} onChange={(e) => setFormPercent(e.target.value)} placeholder="5"
                  className="rounded-lg px-3 py-1.5 text-xs outline-none w-20 tabular-nums"
                  style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }} />
              </div>
            )}

            {/* Recurring toggle */}
            <div className="flex items-center gap-1.5 pb-1">
              <button
                onClick={() => setFormRecurring(!formRecurring)}
                className="relative rounded-full transition-colors"
                style={{ background: formRecurring ? "var(--pf-accent)" : "var(--cmc-neutral-3)", width: 28, height: 16 }}
              >
                <span className="absolute top-[2px] left-[2px] w-[12px] h-[12px] rounded-full bg-white transition-transform" style={{ transform: formRecurring ? "translateX(12px)" : "translateX(0)" }} />
              </button>
              <span className="text-[10px] font-medium" style={{ color: formRecurring ? "var(--pf-accent)" : "var(--cmc-neutral-5)" }}>Recurring</span>
            </div>

            <Button size="sm" onClick={handleAdd} className="h-7 text-[11px]" style={{ background: "#16c784", color: "#fff" }}>Create</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setSelectedAsset(null); }} className="h-7 text-[11px]">Cancel</Button>
          </div>

          {/* Live price hint */}
          {selectedAsset && livePrices[selectedAsset.symbol.toUpperCase()] && (
            <div className="mt-2 text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>
              Current: <span className="font-semibold" style={{ color: "var(--cmc-text)" }}>{fmtUsd(livePrices[selectedAsset.symbol.toUpperCase()])}</span>
              {formMode === "percentage" && formPercent && (
                <span className="ml-2">
                  → Target: <span className="font-semibold" style={{ color: formDirection === "above" ? "#16c784" : "#ea3943" }}>
                    {fmtUsd(livePrices[selectedAsset.symbol.toUpperCase()] * (1 + (formDirection === "above" ? 1 : -1) * parseFloat(formPercent || "0") / 100))}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ Alert Lists ═══ */}
      {activeAlerts.length === 0 && triggeredAlerts.length === 0 ? (
        <div className="py-12 text-center rounded-xl" style={{ border: "1px dashed var(--cmc-border)" }}>
          <Bell size={28} className="mx-auto mb-3" style={{ color: "var(--pf-accent)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--cmc-text)" }}>No alerts yet</p>
          <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: "var(--cmc-neutral-5)" }}>
            Create alerts for any token — price targets or percentage moves.
          </p>
          <button onClick={() => setShowAdd(true)} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white" style={{ background: "var(--pf-accent)" }}>
            <Plus size={11} /> Create first alert
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {activeAlerts.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "var(--cmc-neutral-5)" }}>
                <Bell size={12} /> Active ({activeAlerts.length})
              </h3>
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
                {activeAlerts.map((alert, idx) => {
                  const currentPrice = livePrices[alert.symbol.toUpperCase()] || 0;
                  const isAbove = alert.direction === "above";
                  const isPercentage = alert.mode === "percentage";
                  const hasLivePrice = currentPrice > 0;

                  let distancePct = 0;
                  let progressPct = 0;
                  if (hasLivePrice) {
                    if (isPercentage && alert.referencePrice) {
                      const changePct = ((currentPrice - alert.referencePrice) / alert.referencePrice) * 100;
                      distancePct = isAbove ? (alert.percentThreshold || 0) - changePct : (alert.percentThreshold || 0) + changePct;
                      progressPct = Math.min(100, Math.max(0, (Math.abs(changePct) / (alert.percentThreshold || 1)) * 100));
                    } else {
                      distancePct = ((alert.targetPrice - currentPrice) / currentPrice) * 100;
                      progressPct = Math.min(100, Math.max(0,
                        isAbove ? (currentPrice / alert.targetPrice) * 100 : (alert.targetPrice / currentPrice) * 100
                      ));
                    }
                  }

                  const accentColor = isAbove ? "#16c784" : "#ea3943";
                  return (
                    <div
                      key={alert.id}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/2"
                      style={{
                        borderBottom: idx < activeAlerts.length - 1 ? "1px solid var(--cmc-border)" : "none",
                        borderLeft: `3px solid ${accentColor}`,
                      }}
                    >
                      {alert.logo ? (
                        <img src={alert.logo} alt="" className="w-7 h-7 rounded-full shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: `${accentColor}12`, color: accentColor }}>
                          {alert.symbol.slice(0, 3)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>{alert.name}</span>
                          <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>{alert.symbol}</span>
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${accentColor}12`, color: accentColor }}>
                            {isAbove ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
                            {isPercentage ? `${alert.percentThreshold}%` : alert.direction}
                          </span>
                          {isPercentage && (
                            <span className="text-[8px] font-semibold px-1 py-0.5 rounded" style={{ background: "rgba(153,69,255,0.1)", color: "var(--pf-accent)" }}>%</span>
                          )}
                          {alert.recurring && (
                            <span className="text-[8px] font-semibold px-1 py-0.5 rounded" style={{ background: "rgba(6,182,212,0.1)", color: "#06b6d4" }}>
                              <RefreshCw size={7} className="inline mr-0.5" />recurring
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] tabular-nums" style={{ color: "var(--cmc-neutral-5)" }}>
                            {hasLivePrice ? fmtUsd(currentPrice) : "..."}
                          </span>
                          <span className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>→</span>
                          <span className="text-[10px] font-semibold tabular-nums" style={{ color: "var(--cmc-text)" }}>
                            {isPercentage ? `${isAbove ? "+" : "-"}${alert.percentThreshold}%` : fmtUsd(alert.targetPrice)}
                          </span>
                          {hasLivePrice && (
                            <span className="text-[10px] font-bold tabular-nums" style={{ color: progressPct >= 85 ? accentColor : "var(--cmc-neutral-5)" }}>
                              ({distancePct >= 0 ? "+" : ""}{distancePct.toFixed(1)}% away)
                            </span>
                          )}
                        </div>
                      </div>
                      {hasLivePrice && (
                        <div className="w-16 shrink-0">
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--cmc-neutral-2)" }}>
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: progressPct >= 85 ? accentColor : `${accentColor}60` }} />
                          </div>
                          <p className="text-[9px] text-right mt-0.5 tabular-nums" style={{ color: "var(--cmc-neutral-5)" }}>{progressPct.toFixed(0)}%</p>
                        </div>
                      )}
                      <button onClick={() => handleRemove(alert.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 shrink-0">
                        <Trash2 size={12} style={{ color: "var(--cmc-neutral-5)" }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {triggeredAlerts.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "var(--cmc-neutral-5)" }}>
                <BellRing size={12} /> Triggered ({triggeredAlerts.length})
              </h3>
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
                {triggeredAlerts.map((alert, idx) => (
                  <div
                    key={alert.id}
                    className="flex items-center gap-3 px-4 py-2.5 opacity-50"
                    style={{ borderBottom: idx < triggeredAlerts.length - 1 ? "1px solid var(--cmc-border)" : "none" }}
                  >
                    <Check size={14} className="shrink-0" style={{ color: "#16c784" }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold line-through" style={{ color: "var(--cmc-text)" }}>{alert.name}</span>
                      <span className="text-[10px] ml-1.5" style={{ color: "var(--cmc-neutral-5)" }}>{alert.symbol}</span>
                      <p className="text-[10px]" style={{ color: "var(--cmc-neutral-5)" }}>
                        {alert.mode === "percentage"
                          ? `${alert.direction === "above" ? "Rose" : "Dropped"} ${alert.percentThreshold}% from ${fmtUsd(alert.referencePrice || 0)}`
                          : `${alert.direction === "above" ? "Rose above" : "Dropped below"} ${fmtUsd(alert.targetPrice)}`
                        }
                      </p>
                    </div>
                    <button onClick={() => handleRemove(alert.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 shrink-0">
                      <Trash2 size={12} style={{ color: "var(--cmc-neutral-5)" }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
