"use client";

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Trash2,
  Wallet,
  RefreshCw,
  LogIn,
  Loader2,
  ShieldCheck,
  Copy,
  Check,
  Bookmark,
  Settings,
  ChevronUp,
  ExternalLink,
  Maximize2,
  Minimize2,
  Lock,
  Coins,
  CircleDollarSign,
  Image as ImageIcon,
  ArrowUpRight,
  CheckCircle,
  Download,
  Share2,
  PieChart,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import html2canvas from "html2canvas";
import { Button } from "@/Components/ui/button";
import KaminoPositions from "@/Components/portfolio/KaminoPositions";
import DeFiYields from "@/Components/portfolio/DeFiYields";
import { toast } from "sonner";
import { fetchPythPrices } from "@/lib/api/backend";
import AIPortfolioInsights from "@/Components/shared/AIPortfolioInsights";
import { fetchPythPricesBatch, subscribePythStream } from "@/lib/pyth-prices";
import {
  scanWallet,
  scanWalletByAddress,
  buildSignInMessage,
  isSignedIn,
  setSignedIn,
  TOKEN_PLATFORMS,
  type WalletToken,
  type NativeStake,
} from "@/lib/wallet-scanner";
import {
  getWatchedWallets,
  addWatchedWallet,
  removeWatchedWallet,
  isValidSolanaAddress,
  type WatchedWallet,
} from "@/lib/multi-wallet";
import {
  saveSnapshot,
  getSnapshots,
  getAllSnapshots,
  getPnL,
  savePrices,
  get24hChange,
} from "@/lib/portfolio-history";
import CollapsibleSection from "@/Components/portfolio/CollapsibleSection";
import { detectAllStakingPositions, type StakingPosition } from "@/lib/helius-api";
import { BorderBeam } from "@/Components/magicui/border-beam";
import { MagicCard } from "@/Components/magicui/magic-card";
import { TextAnimate } from "@/Components/magicui/text-animate";
import { toggleWatchlist, isInWatchlist } from "@/lib/watchlist";
import { addAlert } from "@/lib/price-alerts";
import { computeMetrics, type PortfolioMetrics } from "@/lib/portfolio-analytics";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/Components/ui/tabs";
import { Star, Bell as BellIcon, Layers, Zap } from "lucide-react";
import { useIsDegen } from "@/lib/mode-store";
import {
  type ManualHolding,
  type HoldingWithPnL,
  loadHoldings,
  saveHoldings,
  fmtUsd,
  fmtPrice,
  fmtBalance,
  MANUAL_ASSETS,
  STAKING_TOKENS,
  PLATFORM_COLORS,
  COIN_SLUGS,
} from "@/Components/portfolio/portfolio-types";
import { PortfolioSkeleton, MiniSparkline, TokenRow, TableHead } from "@/Components/portfolio/PortfolioTableParts";
import PortfolioConnectPrompt from "@/Components/portfolio/PortfolioConnectPrompt";
import NetWorthHero from "@/Components/portfolio/NetWorthHero";
import StatsRibbon from "@/Components/portfolio/StatsRibbon";
import AllocationBar from "@/Components/portfolio/AllocationBar";
import PortfolioSettingsPanel, { loadPortfolioSettings, savePortfolioSettings, type PortfolioSettingsData } from "@/Components/portfolio/PortfolioSettings";
import { updateCostBases, computeTokenPnL, type TokenPnLResult } from "@/lib/token-pnl";

const ActivityFeed = dynamic(
  () => import("@/Components/portfolio/ActivityFeed"),
  { ssr: false }
);

const PortfolioChart = dynamic(
  () => import("@/Components/portfolio/PortfolioChart"),
  { ssr: false }
);

const WatchlistTab = dynamic(
  () => import("@/Components/portfolio/WatchlistTab"),
  { ssr: false }
);

const AlertsTab = dynamic(
  () => import("@/Components/portfolio/AlertsTab"),
  { ssr: false }
);

// Types, constants, format helpers, and sub-components imported from extracted modules



function PortfolioPageInner() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const wallet = publicKey?.toBase58() || "";
  const isDegen = useIsDegen();

  const [holdings, setHoldings] = useState<ManualHolding[]>([]);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [signed, setSigned] = useState(true);
  const [walletTokens, setWalletTokens] = useState<WalletToken[]>([]);
  const [nativeStakes, setNativeStakes] = useState<NativeStake[]>([]);
  const [stakingPositions, setStakingPositions] = useState<StakingPosition[]>([]);
  const [stakingLoading, setStakingLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const searchParams = useSearchParams();
  const [activeView, setActiveView] = useState<"positions" | "nfts" | "watchlist" | "alerts" | "activity" | "defi">(() => {
    const tab = searchParams.get("tab");
    if (tab === "nfts" || tab === "watchlist" || tab === "alerts" || tab === "activity" || tab === "defi") return tab;
    return "positions";
  });
  const [collapsed, setCollapsed] = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [copied, setCopied] = useState(false);
  const [kaminoTotal, setKaminoTotal] = useState(0);
  const { signMessage } = useWallet();
  const [showSettings, setShowSettings] = useState(false);
  const [portfolioSettings, setPortfolioSettings] = useState<PortfolioSettingsData>(() => loadPortfolioSettings());
  const [tokenSearch, setTokenSearch] = useState("");
  const [tokenPnlResults, setTokenPnlResults] = useState<TokenPnLResult[]>([]);
  const pnlTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Multi-wallet state
  const [watchedWallets, setWatchedWallets] = useState<WatchedWallet[]>([]);
  const [showWalletManager, setShowWalletManager] = useState(false);
  const [newWalletAddr, setNewWalletAddr] = useState("");
  const [newWalletLabel, setNewWalletLabel] = useState("");
  const [watchedData, setWatchedData] = useState<
    Record<string, { solBalance: number; tokens: WalletToken[]; nativeStakes: NativeStake[]; loading: boolean }>
  >({});

  // Form state
  const [formSymbol, setFormSymbol] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formBuyPrice, setFormBuyPrice] = useState("");

  // Auto-sign: skip message-signing wall, auto-scan on connect
  useEffect(() => {
    if (wallet) {
      setSigned(true);
      setSignedIn(wallet);
    }
  }, [wallet]);

  // Sign in handler
  const handleSignIn = async () => {
    if (!signMessage || !publicKey) {
      toast.error("Wallet does not support message signing");
      return;
    }
    try {
      const msg = buildSignInMessage(wallet);
      const encoded = new TextEncoder().encode(msg);
      await signMessage(encoded);
      setSignedIn(wallet);
      setSigned(true);
      toast.success("Signed in successfully!");
      doScan();
    } catch {
      toast.error("Sign-in cancelled");
    }
  };

  // Scan wallet for tokens
  const doScan = async () => {
    if (!publicKey || !connection) return;
    setScanning(true);
    try {
      const { solBalance: sol, tokens, nativeStakes: stakes } = await scanWallet(
        connection,
        publicKey
      );
      setSolBalance(sol);
      setWalletTokens(tokens);
      setNativeStakes(stakes);
      if (tokens.length > 0)
        toast.success(
          `Found ${tokens.length} token${tokens.length > 1 ? "s" : ""} in wallet`
        );
      // Detect staking positions from on-chain programs + Jupiter API
      const tokenPrices: Record<string, number> = {};
      for (const t of tokens) {
        if (t.price && t.symbol) tokenPrices[t.symbol] = t.price;
      }
      console.log("[Portfolio] Token prices for staking:", tokenPrices);
      setStakingLoading(true);
      detectAllStakingPositions(publicKey.toBase58(), tokenPrices)
        .then((pos) => {
          console.log("[Portfolio] Staking positions received:", pos.length, pos);
          setStakingPositions(pos);
        })
        .catch((e) => {
          console.error("[Portfolio] Staking detection error:", e);
        })
        .finally(() => setStakingLoading(false));
    } catch {
      /* silent */
    }
    setScanning(false);
  };

  // Auto-scan on wallet connect (no sign-in required)
  useEffect(() => {
    if (wallet && publicKey && connection) doScan();
  }, [wallet, publicKey, connection]);

  // Load holdings from localStorage
  useEffect(() => {
    if (wallet) setHoldings(loadHoldings(wallet));
  }, [wallet]);

  // ── Multi-wallet: load watched wallets from localStorage ──
  useEffect(() => {
    setWatchedWallets(getWatchedWallets());
  }, []);

  // Scan all watched wallets
  const scanWatchedWallets = useCallback(async () => {
    for (const w of watchedWallets) {
      if (w.address === wallet) continue; // skip connected wallet
      setWatchedData((prev) => ({
        ...prev,
        [w.address]: { ...(prev[w.address] || { solBalance: 0, tokens: [], nativeStakes: [] }), loading: true },
      }));
      try {
        const result = await scanWalletByAddress(w.address);
        setWatchedData((prev) => ({
          ...prev,
          [w.address]: { ...result, loading: false },
        }));
      } catch {
        setWatchedData((prev) => ({
          ...prev,
          [w.address]: { solBalance: 0, tokens: [], nativeStakes: [], loading: false },
        }));
      }
    }
  }, [watchedWallets, wallet]);

  // Auto-scan watched wallets when signed in
  useEffect(() => {
    if (signed && watchedWallets.length > 0) scanWatchedWallets();
  }, [signed, watchedWallets, scanWatchedWallets]);

  // Add watched wallet handler
  const handleAddWallet = () => {
    if (!newWalletAddr) { toast.error("Enter a wallet address"); return; }
    if (!isValidSolanaAddress(newWalletAddr)) { toast.error("Invalid Solana address"); return; }
    if (newWalletAddr === wallet) { toast.error("This is your connected wallet"); return; }
    const updated = addWatchedWallet(newWalletAddr, newWalletLabel || undefined);
    setWatchedWallets(updated);
    setNewWalletAddr("");
    setNewWalletLabel("");
    toast.success("Wallet added");
  };

  // Remove watched wallet handler
  const handleRemoveWallet = (addr: string) => {
    const updated = removeWatchedWallet(addr);
    setWatchedWallets(updated);
    setWatchedData((prev) => { const next = { ...prev }; delete next[addr]; return next; });
    toast.success("Wallet removed");
  };

  // Fetch live prices from backend Pyth endpoint
  const refreshPrices = useCallback(async () => {
    const symbols = [
      ...new Set(holdings.map((h) => h.symbol)),
      "SOL",
    ];
    try {
      const prices = await fetchPythPrices(symbols);
      const priceMap: Record<string, number> = {};
      for (const [sym, data] of Object.entries(prices)) {
        priceMap[sym] = data.price;
      }
      setLivePrices((prev) => ({ ...prev, ...priceMap }));
      // Track prices for 24h change
      savePrices(priceMap);
    } catch {
      /* silent */
    }
  }, [holdings]);

  useEffect(() => {
    refreshPrices();
    const interval = setInterval(refreshPrices, 30000);
    return () => clearInterval(interval);
  }, [refreshPrices]);

  // ── Pyth Hermes SSE stream for ALL wallet tokens ──
  const prevPortfolioPricesRef = useRef<Record<string, number>>({});
  const [portfolioFlash, setPortfolioFlash] = useState<Record<string, "up" | "down">>({});
  useEffect(() => {
    const allSymbols = [
      ...new Set([
        ...holdings.map(h => h.symbol),
        ...walletTokens.map(t => t.symbol),
        "SOL",
      ]),
    ];
    if (allSymbols.length === 0) return;

    const applyPrice = (sym: string, price: number) => {
      if (price <= 0) return;
      const prev = prevPortfolioPricesRef.current;
      const flash: Record<string, "up" | "down"> = {};
      if (prev[sym] && prev[sym] !== price) flash[sym] = price > prev[sym] ? "up" : "down";
      prev[sym] = price;
      setLivePrices(lp => ({ ...lp, [sym]: price }));
      if (Object.keys(flash).length > 0) {
        setPortfolioFlash(flash);
        setTimeout(() => setPortfolioFlash({}), 700);
      }
    };

    let sseCleanup: (() => void) | null = null;
    let pollIv: NodeJS.Timeout | null = null;
    const doPoll = async () => {
      try {
        const prices = await fetchPythPricesBatch(allSymbols);
        for (const [sym, p] of Object.entries(prices)) {
          if (typeof p === 'number' && p > 0) applyPrice(sym, p);
          else if (typeof p === 'object' && p && (p as { price: number }).price > 0) applyPrice(sym, (p as { price: number }).price);
        }
      } catch {}
    };

    subscribePythStream(allSymbols, (sym, price) => applyPrice(sym, price))
      .then(unsub => { sseCleanup = unsub; })
      .catch(() => { doPoll(); pollIv = setInterval(doPoll, 10_000); });

    doPoll();
    const backupIv = setInterval(doPoll, 30_000);
    return () => {
      sseCleanup?.();
      if (pollIv) clearInterval(pollIv);
      clearInterval(backupIv);
    };
  }, [holdings, walletTokens]);

  // Copy address
  const copyAddress = () => {
    navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Add holding
  const handleAdd = () => {
    if (!formSymbol || !formAmount || !formBuyPrice) {
      toast.error("Fill in all fields");
      return;
    }
    const asset = MANUAL_ASSETS.find((a) => a.symbol === formSymbol);
    if (!asset) return;
    const newHolding: ManualHolding = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      symbol: asset.symbol,
      name: asset.name,
      type: asset.type,
      amount: parseFloat(formAmount),
      buyPrice: parseFloat(formBuyPrice),
      addedAt: Date.now(),
    };
    const updated = [...holdings, newHolding];
    setHoldings(updated);
    saveHoldings(wallet, updated);
    setFormSymbol("");
    setFormAmount("");
    setFormBuyPrice("");
    setShowAdd(false);
    toast.success(`Added ${asset.name} to portfolio`);
  };

  // Remove holding
  const handleRemove = (id: string) => {
    const updated = holdings.filter((h) => h.id !== id);
    setHoldings(updated);
    saveHoldings(wallet, updated);
    toast.success("Removed from portfolio");
  };

  // Calculate P&L
  const enriched: HoldingWithPnL[] = holdings.map((h) => {
    const currentPrice = livePrices[h.symbol] || h.buyPrice;
    const value = h.amount * currentPrice;
    const cost = h.amount * h.buyPrice;
    const pnl = value - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    return { ...h, currentPrice, value, pnl, pnlPct };
  });

  // On-chain wallet value
  const solValue = (solBalance || 0) * (livePrices.SOL || 0);
  const tokenTotalValue = walletTokens.reduce(
    (s, t) => s + (t.value || 0),
    0
  );
  const onChainTotal = solValue + tokenTotalValue;

  // Manual holdings value
  const manualTotal = enriched.reduce((s, h) => s + h.value, 0);
  const totalCost = enriched.reduce(
    (s, h) => s + h.amount * h.buyPrice,
    0
  );

  // Native staking value
  const nativeStakeTotal = nativeStakes.reduce(
    (s, st) => s + st.activeStake * (livePrices.SOL || 0),
    0
  );

  // Jupiter staking positions value
  const jupiterPositionsTotal = stakingPositions.reduce(
    (s, sp) => s + sp.value,
    0
  );

  // Watched wallets aggregated value
  const watchedWalletsTotal = Object.values(watchedData).reduce((sum, wd) => {
    const wSol = (wd.solBalance || 0) * (livePrices.SOL || 0);
    const wTokens = wd.tokens.reduce((s, t) => s + (t.value || 0), 0);
    const wStakes = wd.nativeStakes.reduce((s, st) => s + st.activeStake * (livePrices.SOL || 0), 0);
    return sum + wSol + wTokens + wStakes;
  }, 0);

  // Combined total (includes Kamino DeFi positions)
  const totalValue = onChainTotal + manualTotal + nativeStakeTotal + jupiterPositionsTotal + watchedWalletsTotal + kaminoTotal;
  const totalPnl = manualTotal - totalCost;

  // Save snapshot for chart & PnL tracking
  useEffect(() => {
    if (wallet && totalValue > 0) saveSnapshot(wallet, totalValue);
  }, [wallet, totalValue]);

  // Recurring snapshot scheduler — auto-save every 10 minutes while page is open
  useEffect(() => {
    if (!wallet || totalValue <= 0) return;
    const iv = setInterval(() => {
      saveSnapshot(wallet, totalValue);
    }, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [wallet, totalValue]);

  // Real PnL from history
  const realPnl = wallet ? getPnL(wallet, totalValue) : { pnl24h: 0, pnlPct24h: 0, pnlTotal: 0, pnlPctTotal: 0 };

  // Chart snapshots
  const chartSnapshots = wallet ? getAllSnapshots(wallet) : [];

  // Portfolio analytics
  const portfolioMetrics = useMemo(() => computeMetrics(chartSnapshots), [chartSnapshots]);

  // ── Not connected state ──
  if (!connected) {
    return <PortfolioConnectPrompt onConnect={() => setVisible(true)} />;
  }

  // Sign-in wall removed — auto-scan on connect (Phase 1A)

  // ── Derived data ──
  const nfts = walletTokens.filter(
    (t) => t.decimals === 0 && t.amount === 1
  );
  const fungible = walletTokens.filter(
    (t) => !(t.decimals === 0 && t.amount === 1)
  );
  const solEquiv =
    livePrices.SOL && totalValue > 0
      ? (totalValue / livePrices.SOL).toFixed(2)
      : "0";

  // All displayable holdings
  const allHoldings: {
    symbol: string;
    name: string;
    value: number;
    logo?: string;
  }[] = [];
  if (solBalance && solBalance > 0 && livePrices.SOL) {
    allHoldings.push({
      symbol: "SOL",
      name: "Solana",
      value: solBalance * livePrices.SOL,
      logo: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
    });
  }
  for (const t of fungible) {
    if (t.value && t.value > 0)
      allHoldings.push({
        symbol: t.symbol,
        name: t.name !== "Token" ? t.name : t.symbol,
        value: t.value,
        logo: t.logo,
      });
  }
  // Add manual holdings to allocation
  for (const h of enriched) {
    if (h.value > 0) {
      const existing = allHoldings.find((a) => a.symbol === h.symbol);
      if (existing) existing.value += h.value;
      else allHoldings.push({ symbol: h.symbol, name: h.name, value: h.value });
    }
  }
  allHoldings.sort((a, b) => b.value - a.value);

  // Per-token P&L: update cost bases when holdings change
  useEffect(() => {
    if (!wallet || !walletTokens.length) return;
    // Debounce to avoid rapid updates from SSE price ticks
    if (pnlTimerRef.current) clearTimeout(pnlTimerRef.current);
    pnlTimerRef.current = setTimeout(() => {
      const fung = walletTokens.filter(t => !(t.decimals === 0 && t.amount === 1));
      const h = [
        ...(solBalance && livePrices.SOL ? [{ symbol: "SOL", mint: "So11111111111111111111111111111111", amount: solBalance, price: livePrices.SOL }] : []),
        ...fung.filter(t => t.price && t.amount).map(t => ({ symbol: t.symbol, mint: t.mint, amount: t.amount, price: t.price || 0 })),
      ];
      updateCostBases(wallet, h);
      const priceMap = new Map<string, number>();
      if (livePrices.SOL) priceMap.set("SOL", livePrices.SOL);
      for (const t of fung) { if (t.price) priceMap.set(t.symbol, t.price); }
      setTokenPnlResults(computeTokenPnL(wallet, priceMap));
    }, 2000);
    return () => { if (pnlTimerRef.current) clearTimeout(pnlTimerRef.current); };
  }, [wallet, walletTokens, solBalance]);

  // Helper to look up P&L for a given symbol
  const getPnlForSymbol = (symbol: string): { amount: number; pct: number } | undefined => {
    const r = tokenPnlResults.find(p => p.symbol === symbol);
    if (!r || r.unrealizedPnl === 0) return undefined;
    return { amount: r.unrealizedPnl, pct: r.unrealizedPnlPct };
  };

  // Group tokens by platform
  const walletHoldings = fungible.filter(
    (t) => !STAKING_TOKENS[t.symbol]?.platform || STAKING_TOKENS[t.symbol]?.type === "Holdings"
  );
  const walletHoldingsValue =
    solValue +
    walletHoldings.reduce((s, t) => s + (t.value || 0), 0);

  // Platform groups from staking tokens
  const platformGroups: Record<
    string,
    { tokens: WalletToken[]; value: number }
  > = {};
  for (const t of fungible) {
    const info = STAKING_TOKENS[t.symbol];
    if (info && info.type === "Staked") {
      if (!platformGroups[info.platform])
        platformGroups[info.platform] = { tokens: [], value: 0 };
      platformGroups[info.platform].tokens.push(t);
      platformGroups[info.platform].value += t.value || 0;
    }
  }

  // Platform pills data
  const pills: { icon: React.ReactNode; label: string; value: number }[] =
    [];
  if (walletHoldingsValue > 0)
    pills.push({
      icon: (
        <Coins
          size={14}
          style={{ color: PLATFORM_COLORS.Wallet }}
        />
      ),
      label: "Holdings",
      value: walletHoldingsValue,
    });
  for (const [platform, data] of Object.entries(platformGroups)) {
    if (data.value > 0)
      pills.push({
        icon: (
          <Lock
            size={14}
            style={{
              color: PLATFORM_COLORS[platform] || "var(--cmc-text)",
            }}
          />
        ),
        label: platform,
        value: data.value,
      });
  }
  // Jupiter Portfolio positions (Pyth, Jupiter DAO, Kamino, etc.)
  // Group by platform to avoid duplicate pills
  const jupPlatformTotals: Record<string, { value: number; icon?: string }> = {};
  for (const sp of stakingPositions) {
    if (sp.value > 0) {
      if (!jupPlatformTotals[sp.platform]) jupPlatformTotals[sp.platform] = { value: 0, icon: sp.platformIcon };
      jupPlatformTotals[sp.platform].value += sp.value;
    }
  }
  for (const [platform, data] of Object.entries(jupPlatformTotals)) {
    pills.push({
      icon: data.icon ? (
        <img src={data.icon} alt={platform} className="h-4 w-4 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      ) : (
        <Lock size={14} style={{ color: "var(--cmc-text)" }} />
      ),
      label: platform,
      value: data.value,
    });
  }
  // Native staking pill
  if (nativeStakeTotal > 0)
    pills.push({
      icon: (
        <Lock
          size={14}
          style={{ color: "var(--cmc-text)" }}
        />
      ),
      label: "Native Staking",
      value: nativeStakeTotal,
    });
  if (manualTotal > 0)
    pills.push({
      icon: (
        <CircleDollarSign
          size={14}
          style={{ color: PLATFORM_COLORS.Manual }}
        />
      ),
      label: "Manual",
      value: manualTotal,
    });
  const tokenCount =
    (solBalance && solBalance > 0 ? 1 : 0) + fungible.length;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 animate-fade-in-up">
      {/* ═══════════════════ COMPACT HEADER BAR ═══════════════════ */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2.5">
          <button
            onClick={copyAddress}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-all hover:brightness-110"
            style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}
            title="Copy address"
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: "linear-gradient(135deg, var(--pf-accent), var(--pf-teal))", color: "#fff" }}>{wallet.slice(0, 2).toUpperCase()}</span>
            {wallet.slice(0, 4)}...{wallet.slice(-4)}
            {copied ? <Check size={11} style={{ color: "var(--pf-up)" }} /> : <Copy size={11} style={{ color: "var(--cmc-neutral-5)" }} />}
          </button>
          <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: "var(--pf-up)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--pf-up)" }} /> Connected
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={doScan}
            disabled={scanning}
            className="h-7 w-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/5"
            style={{ border: "1px solid var(--cmc-border)" }}
            title="Refresh"
          >
            {scanning ? (
              <Loader2 size={13} className="animate-spin" style={{ color: "var(--cmc-neutral-5)" }} />
            ) : (
              <RefreshCw size={13} style={{ color: "var(--cmc-neutral-5)" }} />
            )}
          </button>
          <button
            onClick={() => setShowWalletManager(!showWalletManager)}
            className="h-8 w-8 rounded-xl flex items-center justify-center transition-all hover-surface"
            style={{
              border: "1px solid var(--cmc-border)",
              background: showWalletManager ? "var(--pf-accent-muted)" : "transparent",
            }}
            title="Manage wallets"
          >
            <Plus
              size={14}
              style={{ color: showWalletManager ? "var(--pf-accent)" : "var(--cmc-neutral-5)" }}
            />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="h-8 w-8 rounded-xl flex items-center justify-center transition-all hover-surface"
            style={{
              border: "1px solid var(--cmc-border)",
              background: showSettings ? "var(--pf-accent-muted)" : "transparent",
            }}
            title="Portfolio settings"
          >
            <Settings
              size={14}
              style={{ color: showSettings ? "var(--pf-accent)" : "var(--cmc-neutral-5)" }}
            />
          </button>
        </div>
      </div>

      {/* ═══════════════════ MULTI-WALLET MANAGER ═══════════════════ */}
      {showWalletManager && (
        <div className="mb-4 rounded-xl overflow-hidden" style={{ border: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
            <div className="flex items-center gap-2">
              <Wallet size={14} style={{ color: "var(--pf-up)" }} />
              <p className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>Multi-Wallet Portfolio</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(20,241,149,0.1)", color: "var(--pf-up)" }}>
                {watchedWallets.filter(w => w.address !== wallet).length + 1} wallet{watchedWallets.filter(w => w.address !== wallet).length > 0 ? "s" : ""}
              </span>
              <span className="text-[10px] font-bold" style={{ color: "var(--cmc-text)" }}>
                Aggregate: {fmtUsd(totalValue)}
              </span>
            </div>
          </div>

          <div className="p-4 space-y-2">
            {/* Connected wallet — primary */}
            <div className="flex items-center gap-3 rounded-xl px-3.5 py-2.5" style={{ background: "rgba(20,241,149,0.05)", border: "1px solid rgba(20,241,149,0.15)" }}>
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: "rgba(20,241,149,0.15)", color: "var(--pf-up)" }}>
                {wallet.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] font-bold truncate" style={{ color: "var(--cmc-text)" }}>Connected Wallet</p>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "rgba(20,241,149,0.15)", color: "var(--pf-up)" }}>PRIMARY</span>
                </div>
                <p className="text-[10px] font-mono truncate" style={{ color: "var(--cmc-neutral-5)" }}>
                  {wallet}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] font-bold" style={{ color: "var(--pf-up)" }}>{fmtUsd(onChainTotal + nativeStakeTotal + jupiterPositionsTotal)}</p>
                <p className="text-[9px]" style={{ color: "var(--cmc-neutral-5)" }}>{tokenCount} tokens</p>
              </div>
            </div>

            {/* Watched wallets */}
            {watchedWallets.filter((w) => w.address !== wallet).map((w) => {
              const wd = watchedData[w.address];
              const wSolVal = (wd?.solBalance || 0) * (livePrices.SOL || 0);
              const wTokenVal = wd ? wd.tokens.reduce((s, t) => s + (t.value || 0), 0) : 0;
              const wStakeVal = wd ? wd.nativeStakes.reduce((s, st) => s + st.activeStake * (livePrices.SOL || 0), 0) : 0;
              const wValue = wSolVal + wTokenVal + wStakeVal;
              const wTokenCount = wd ? (wd.solBalance > 0 ? 1 : 0) + wd.tokens.length : 0;
              return (
                <div key={w.address} className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 group" style={{ background: "var(--cmc-neutral-2)", border: "1px solid var(--cmc-border)" }}>
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: "var(--cmc-neutral-1)", color: "var(--cmc-text)" }}>
                    {w.label.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-bold truncate" style={{ color: "var(--cmc-text)" }}>{w.label}</p>
                      <span className="text-[8px] font-medium px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "var(--cmc-neutral-1)", color: "var(--cmc-neutral-5)" }}>WATCH</span>
                    </div>
                    <p className="text-[10px] font-mono truncate" style={{ color: "var(--cmc-neutral-5)" }}>
                      {w.address}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    {wd?.loading ? (
                      <Loader2 size={13} className="animate-spin" style={{ color: "var(--cmc-neutral-5)" }} />
                    ) : (
                      <div>
                        <p className="text-[11px] font-bold" style={{ color: "var(--cmc-text)" }}>{fmtUsd(wValue)}</p>
                        <p className="text-[9px]" style={{ color: "var(--cmc-neutral-5)" }}>{wTokenCount} tokens</p>
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveWallet(w.address); }}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10"
                      title="Remove wallet"
                    >
                      <Trash2 size={12} style={{ color: "#ea3943" }} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Add wallet form — improved */}
            <div className="rounded-xl p-3.5 mt-1" style={{ border: "1px dashed var(--cmc-border)", background: "var(--cmc-bg)" }}>
              <p className="text-[10px] font-semibold mb-2.5" style={{ color: "var(--cmc-text)" }}>Add Watch-Only Wallet</p>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-[9px] font-medium block mb-1" style={{ color: "var(--cmc-neutral-5)" }}>Solana Wallet Address</label>
                  <input
                    value={newWalletAddr}
                    onChange={(e) => setNewWalletAddr(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddWallet()}
                    placeholder="e.g. 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
                    className="w-full rounded-lg px-3 py-2 text-[11px] font-mono outline-none transition-colors focus:ring-1"
                    style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}
                  />
                </div>
                <div style={{ width: 120 }}>
                  <label className="text-[9px] font-medium block mb-1" style={{ color: "var(--cmc-neutral-5)" }}>Label (optional)</label>
                  <input
                    value={newWalletLabel}
                    onChange={(e) => setNewWalletLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddWallet()}
                    placeholder="My Ledger"
                    className="w-full rounded-lg px-3 py-2 text-[11px] outline-none transition-colors focus:ring-1"
                    style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}
                  />
                </div>
                <button
                  onClick={handleAddWallet}
                  className="h-8 px-4 rounded-lg text-[11px] font-bold shrink-0 transition-all hover:brightness-110 flex items-center gap-1"
                  style={{ background: "var(--pf-up)", color: "#000" }}
                >
                  <Plus size={12} /> Add Wallet
                </button>
              </div>
              <p className="text-[9px] mt-2 flex items-center gap-1" style={{ color: "var(--cmc-neutral-5)" }}>
                <ShieldCheck size={9} /> Watch-only — no signing or private keys needed. Balances are read from the blockchain.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ SETTINGS PANEL ═══════════════════ */}
      <PortfolioSettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(false)}
        wallet={wallet}
        onClearData={() => {
          setHoldings([]);
          saveHoldings(wallet, []);
        }}
        settings={portfolioSettings}
        onSettingsChange={setPortfolioSettings}
      />

      {/* ═══════════════════ HERO: NET WORTH ═══════════════════ */}
      <NetWorthHero
        totalValue={totalValue}
        solEquiv={solEquiv}
        hasSolPrice={!!livePrices.SOL}
        balanceHidden={balanceHidden}
        setBalanceHidden={setBalanceHidden}
        realPnl={realPnl}
        wallet={wallet}
        refreshPrices={refreshPrices}
        solBalance={solBalance}
        livePrices={livePrices}
        fungible={fungible}
        nativeStakes={nativeStakes}
        kaminoTotal={kaminoTotal}
      />

      {/* ═══════════════════ STATS RIBBON ═══════════════════ */}
      {totalValue > 0 && !balanceHidden && (
        <StatsRibbon realPnl={realPnl} tokenCount={tokenCount} portfolioMetrics={portfolioMetrics} />
      )}

      {/* ═══════════════════ ALLOCATION BAR ═══════════════════ */}
      {totalValue > 0 && !balanceHidden && (
        <AllocationBar
          totalValue={totalValue}
          segments={[
            { label: "Holdings", value: walletHoldingsValue, color: "var(--pf-accent)" },
            { label: "Staking", value: nativeStakeTotal + jupiterPositionsTotal, color: "var(--pf-teal)" },
            { label: "Kamino", value: kaminoTotal, color: "var(--pf-info)" },
            { label: "Manual", value: manualTotal, color: "var(--pf-warning)" },
            { label: "Watched", value: watchedWalletsTotal, color: "var(--cmc-neutral-5)" },
          ].filter(s => s.value > 0)}
        />
      )}

      {/* ═══════════════════ CHART ═══════════════════ */}
      <div className="mb-6 rounded-xl overflow-hidden" style={{ border: "1px solid var(--cmc-border)" }}>
        <PortfolioChart
          totalValue={totalValue}
          allocations={allHoldings.map((h) => ({ symbol: h.symbol, value: h.value, logo: h.logo }))}
          platformAllocations={[
            ...(walletHoldingsValue > 0 ? [{ name: "Holdings", value: walletHoldingsValue, icon: "https://assets.coingecko.com/coins/images/4128/small/solana.png" }] : []),
            ...Object.entries(platformGroups).map(([p, d]) => ({ name: p, value: d.value })),
            ...Object.entries(jupPlatformTotals).map(([p, d]) => ({ name: p, value: d.value, icon: d.icon })),
            ...(nativeStakeTotal > 0 ? [{ name: "Native Staking", value: nativeStakeTotal }] : []),
            ...(manualTotal > 0 ? [{ name: "Manual", value: manualTotal }] : []),
          ]}
          tokenCount={tokenCount}
          snapshots={chartSnapshots}
        />
      </div>

      {/* AI Insights */}
      {totalValue > 0 && (
        <div className="mb-6">
          <AIPortfolioInsights
            holdings={[
              ...(solBalance ? [{ symbol: "SOL", amount: solBalance, price: livePrices.SOL || 0, change24h: 0 }] : []),
              ...fungible.filter(t => t.value && t.value > 1).map(t => ({ symbol: t.symbol, amount: t.amount, price: t.price || 0, change24h: 0 })),
              ...enriched.filter(h => h.value > 1).map(h => ({ symbol: h.symbol, amount: h.amount, price: h.currentPrice, change24h: 0 })),
            ]}
          />
        </div>
      )}

      {/* ═══════════════════ UNIFIED HUB TABS ═══════════════════ */}
      <div
        className="flex items-center justify-between mb-4"
        style={{ borderBottom: "1px solid var(--cmc-border)" }}
      >
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-1">
          {([
            { key: "positions" as const, label: "Positions", icon: <Wallet size={13} /> },
            { key: "nfts" as const, label: `NFTs${nfts.length > 0 ? ` (${nfts.length})` : ""}`, icon: <ImageIcon size={13} /> },
            { key: "watchlist" as const, label: "Watchlist", icon: <Star size={13} /> },
            { key: "alerts" as const, label: "Alerts", icon: <BellIcon size={13} /> },
            { key: "activity" as const, label: "Activity", icon: <RefreshCw size={13} /> },
            { key: "defi" as const, label: "DeFi", icon: <Layers size={13} /> },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveView(t.key)}
              className="relative pb-2.5 px-3 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 rounded-t-lg press-scale"
              style={{
                color:
                  activeView === t.key
                    ? "var(--pf-accent)"
                    : "var(--cmc-neutral-5)",
                background:
                  activeView === t.key
                    ? "var(--pf-accent-muted)"
                    : "transparent",
              }}
            >
              {t.icon} {t.label}
              {activeView === t.key && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full" style={{ background: "var(--pf-accent)" }} />
              )}
            </button>
          ))}
        </div>
        {activeView === "positions" && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="pb-2.5 text-xs font-medium flex items-center gap-1 transition-colors hover:opacity-80 shrink-0 press-scale"
            style={{ color: "var(--cmc-neutral-5)" }}
          >
            {collapsed ? "Expand" : "Collapse"}{" "}
            {collapsed ? (
              <Maximize2 size={12} />
            ) : (
              <Minimize2 size={12} />
            )}
          </button>
        )}
      </div>

      {/* ═══════════════════ PLATFORM PILLS ═══════════════════ */}
      {activeView === "positions" && pills.length > 0 && !collapsed && (
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
          {pills.map((p) => (
            <div
              key={p.label}
              className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 shrink-0 transition-all hover:brightness-110 cursor-pointer"
              style={{
                background: "var(--cmc-neutral-1)",
                border: "1px solid var(--cmc-border)",
                minWidth: 130,
              }}
            >
              {p.icon}
              <div>
                <p
                  className="text-[11px] font-semibold"
                  style={{ color: "var(--cmc-text)" }}
                >
                  {p.label}
                </p>
                <p
                  className="text-[10px] font-bold"
                  style={{ color: "var(--cmc-neutral-5)" }}
                >
                  {p.value > 0
                    ? fmtUsd(p.value)
                    : p.label === "NFTs"
                      ? `${nfts.length} items`
                      : "$0.00"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════ TOKEN SEARCH / FILTER ═══════════════════ */}
      {activeView === "positions" && !collapsed && (walletHoldingsValue > 0 || enriched.length > 0) && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--cmc-neutral-5)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              value={tokenSearch}
              onChange={(e) => setTokenSearch(e.target.value)}
              placeholder="Search tokens..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-[11px] outline-none transition-colors focus:ring-1"
              style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}
            />
            {tokenSearch && (
              <button
                onClick={() => setTokenSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/10 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--cmc-neutral-5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            )}
          </div>
          {!portfolioSettings.showSmallBalances && (
            <span className="text-[9px] font-medium px-2 py-1 rounded-lg" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-neutral-5)", border: "1px solid var(--cmc-border)" }}>
              Hiding &lt;${portfolioSettings.smallBalanceThreshold}
            </span>
          )}
        </div>
      )}

      {/* ═══════════════════ POSITIONS CONTENT ═══════════════════ */}
      {activeView === "positions" && !collapsed && scanning && walletHoldingsValue === 0 && (
        <PortfolioSkeleton />
      )}

      {activeView === "positions" && !collapsed && (
        <div className="space-y-3">
          {/* ── Holdings Section ── */}
          {walletHoldingsValue > 0 && (
            <CollapsibleSection
              icon={
                <Coins
                  size={16}
                  style={{ color: "var(--pf-up)" }}
                />
              }
              title="Holdings"
              value={fmtUsd(walletHoldingsValue)}
            >
              <CollapsibleSection
                icon={
                  <Wallet
                    size={14}
                    style={{ color: "var(--cmc-neutral-5)" }}
                  />
                }
                title="Wallet"
                value={fmtUsd(walletHoldingsValue)}
                level="subsection"
              >
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <TableHead
                      columns={[
                        "Asset",
                        "Balance",
                        "Price/24hΔ",
                        "Value",
                        "",
                      ]}
                    />
                    <tbody>
                      {solBalance !== null && solBalance > 0 && (!tokenSearch || "sol solana".includes(tokenSearch.toLowerCase())) && (
                        <TokenRow
                          logo="https://assets.coingecko.com/coins/images/4128/small/solana.png"
                          symbol="SOL"
                          name="SOL"
                          coinId="solana"
                          balance={fmtBalance(solBalance)}
                          price={
                            livePrices.SOL
                              ? fmtPrice(livePrices.SOL)
                              : "—"
                          }
                          value={
                            livePrices.SOL
                              ? fmtUsd(
                                  solBalance * livePrices.SOL
                                )
                              : "—"
                          }
                          verified
                          change24h={get24hChange("SOL")}
                          onSwap={() => window.open("/swap?from=SOL", "_blank")}
                          onAlert={() => { addAlert({ symbol: "SOL", name: "Solana", targetPrice: livePrices.SOL || 0, direction: "above" }); toast.success("SOL alert created"); }}
                          starred={isInWatchlist(wallet, "solana", "coin")}
                          onStar={() => { const r = toggleWatchlist(wallet, { id: "solana", type: "coin", symbol: "SOL", name: "Solana", image: "https://assets.coingecko.com/coins/images/4128/small/solana.png" }); toast.success(r.added ? "SOL added to watchlist" : "SOL removed from watchlist"); }}
                          pnl={getPnlForSymbol("SOL")}
                        />
                      )}
                      {walletHoldings
                        .filter((t) => {
                          if (tokenSearch && !t.symbol.toLowerCase().includes(tokenSearch.toLowerCase()) && !(t.name || "").toLowerCase().includes(tokenSearch.toLowerCase())) return false;
                          if (!portfolioSettings.showSmallBalances && (t.value || 0) < portfolioSettings.smallBalanceThreshold) return false;
                          return true;
                        })
                        .map((t) => {
                        const slug = COIN_SLUGS[t.symbol];
                        return (
                        <TokenRow
                          key={t.mint}
                          logo={t.logo}
                          symbol={t.symbol}
                          name={t.symbol}
                          coinId={slug}
                          balance={fmtBalance(t.amount)}
                          price={
                            t.price ? fmtPrice(t.price) : "—"
                          }
                          value={
                            t.value ? fmtUsd(t.value) : "—"
                          }
                          pnl={getPnlForSymbol(t.symbol)}
                          verified
                          change24h={
                            t.price
                              ? get24hChange(t.symbol)
                              : undefined
                          }
                          onSwap={() => window.open(`/swap?from=${t.symbol}`, "_blank")}
                          onAlert={() => { addAlert({ symbol: t.symbol, name: t.symbol, targetPrice: t.price || 0, direction: "above" }); toast.success(`${t.symbol} alert created`); }}
                          starred={slug ? isInWatchlist(wallet, slug, "coin") : false}
                          onStar={slug ? () => { const r = toggleWatchlist(wallet, { id: slug, type: "coin", symbol: t.symbol, name: t.symbol, image: t.logo }); toast.success(r.added ? `${t.symbol} added to watchlist` : `${t.symbol} removed from watchlist`); } : undefined}
                        />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CollapsibleSection>
            </CollapsibleSection>
          )}

          {/* ── Native SOL Staking Section ── */}
          {nativeStakes.length > 0 && nativeStakeTotal > 0 && (
            <CollapsibleSection
              icon={
                <Lock
                  size={16}
                  style={{ color: "var(--cmc-text)" }}
                />
              }
              title="Native Staking"
              value={fmtUsd(nativeStakeTotal)}
            >
              <CollapsibleSection
                icon={
                  <Lock
                    size={14}
                    style={{ color: "var(--cmc-neutral-5)" }}
                  />
                }
                title="Staked SOL"
                value={fmtUsd(nativeStakeTotal)}
                level="subsection"
              >
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <TableHead
                      columns={[
                        "Validator",
                        "Stake (SOL)",
                        "Price/24hΔ",
                        "Value",
                      ]}
                    />
                    <tbody>
                      {nativeStakes.map((st) => (
                        <TokenRow
                          key={st.pubkey}
                          logo="https://assets.coingecko.com/coins/images/4128/small/solana.png"
                          symbol="SOL"
                          name="SOL"
                          balance={fmtBalance(st.activeStake)}
                          price={
                            livePrices.SOL
                              ? fmtPrice(livePrices.SOL)
                              : "—"
                          }
                          value={
                            livePrices.SOL
                              ? fmtUsd(
                                  st.activeStake * livePrices.SOL
                                )
                              : "—"
                          }
                          verified
                          badge={{
                            label: st.state === "active" ? "Active" : "Deactivating",
                            color: st.state === "active" ? "#16c784" : "#f59e0b",
                          }}
                          change24h={get24hChange("SOL")}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </CollapsibleSection>
            </CollapsibleSection>
          )}

          {/* ── Staking Platform Sections ── */}
          {Object.entries(platformGroups).map(
            ([platform, data]) => (
              <CollapsibleSection
                key={platform}
                icon={
                  <div
                    className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold"
                    style={{
                      background: "var(--cmc-neutral-2)",
                      color: "var(--cmc-text)",
                    }}
                  >
                    {platform.slice(0, 1)}
                  </div>
                }
                title={platform}
                value={fmtUsd(data.value)}
              >
                <CollapsibleSection
                  icon={
                    <Lock
                      size={14}
                      style={{ color: "var(--cmc-neutral-5)" }}
                    />
                  }
                  title="Staked"
                  value={fmtUsd(data.value)}
                  level="subsection"
                  link={platform}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <TableHead
                        columns={[
                          "Name",
                          "Balance",
                          "Price/24hΔ",
                          "Value",
                        ]}
                      />
                      <tbody>
                        {data.tokens.map((t) => (
                          <TokenRow
                            key={t.mint}
                            logo={t.logo}
                            symbol={t.symbol}
                            name={t.symbol}
                            balance={fmtBalance(t.amount)}
                            price={
                              t.price
                                ? fmtPrice(t.price)
                                : "—"
                            }
                            value={
                              t.value
                                ? fmtUsd(t.value)
                                : "—"
                            }
                            verified
                            badge={{
                              label: "Staked",
                              color: "var(--cmc-neutral-5)",
                            }}
                            change24h={
                              t.price
                                ? get24hChange(t.symbol)
                                : undefined
                            }
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleSection>
              </CollapsibleSection>
            )
          )}

          {/* ── Staking Loading Skeleton ── */}
          {stakingLoading && stakingPositions.length === 0 && (
            <div
              className="rounded-xl p-4 animate-pulse"
              style={{ border: "1px solid var(--cmc-border)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full" style={{ background: "var(--cmc-neutral-2)" }} />
                  <div className="h-3 w-24 rounded" style={{ background: "var(--cmc-neutral-2)" }} />
                </div>
                <div className="h-3 w-16 rounded" style={{ background: "var(--cmc-neutral-2)" }} />
              </div>
              <div className="space-y-2">
                <div className="h-8 rounded" style={{ background: "var(--cmc-neutral-2)" }} />
                <div className="h-8 rounded" style={{ background: "var(--cmc-neutral-2)" }} />
              </div>
              <p className="text-[10px] mt-3 text-center" style={{ color: "var(--cmc-neutral-5)" }}>
                Detecting staking positions...
              </p>
            </div>
          )}

          {/* ── Jupiter Portfolio Positions (Pyth, Jupiter DAO, Kamino, etc.) ── */}
          {(() => {
            // Group positions by platform for collapsible sections
            const grouped: Record<string, StakingPosition[]> = {};
            for (const sp of stakingPositions) {
              const key = sp.platform;
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(sp);
            }
            return Object.entries(grouped).map(([platform, positions]) => {
              const platformValue = positions.reduce((s, p) => s + p.value, 0);
              const firstPos = positions[0];
              return (
                <CollapsibleSection
                  key={platform}
                  icon={
                    firstPos.platformIcon ? (
                      <div className="h-5 w-5 rounded-full shrink-0 overflow-hidden flex items-center justify-center" style={{ background: "var(--cmc-neutral-2)" }}>
                        <img
                          src={firstPos.platformIcon}
                          alt={platform}
                          className="h-5 w-5 rounded-full"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                    ) : (
                      <div
                        className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold"
                        style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}
                      >
                        {platform.slice(0, 1)}
                      </div>
                    )
                  }
                  title={platform}
                  value={fmtUsd(platformValue)}
                >
                  <CollapsibleSection
                    icon={<Lock size={14} style={{ color: "var(--cmc-neutral-5)" }} />}
                    title={firstPos.type}
                    value={fmtUsd(platformValue)}
                    level="subsection"
                    link={platform}
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <TableHead columns={["Name", "Balance", "Price/24hΔ", "Value", ""]} />
                        <tbody>
                          {positions.map((sp, idx) => (
                            <TokenRow
                              key={`${sp.symbol}-${idx}`}
                              logo={sp.logo}
                              symbol={sp.symbol}
                              name={sp.symbol}
                              balance={fmtBalance(sp.amount)}
                              price={sp.price > 0 ? fmtPrice(sp.price) : "—"}
                              value={fmtUsd(sp.value)}
                              verified
                              badge={{
                                label: sp.type,
                                color: sp.type === "Locked" ? "var(--cmc-neutral-5)"
                                  : sp.type === "Staked" ? "#16c784"
                                  : "var(--cmc-neutral-5)",
                              }}
                              change24h={get24hChange(sp.symbol)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleSection>
                </CollapsibleSection>
              );
            });
          })()}

          {/* ── Manual Holdings Section ── */}
          <div id="manual-holdings-section" />
          {enriched.length > 0 && (
            <CollapsibleSection
              icon={
                <CircleDollarSign
                  size={16}
                  style={{ color: "var(--cmc-text)" }}
                />
              }
              title="Manual Holdings"
              value={fmtUsd(manualTotal)}
            >
              <CollapsibleSection
                icon={
                  <Plus
                    size={14}
                    style={{ color: "var(--cmc-neutral-5)" }}
                  />
                }
                title="Tracked"
                value={fmtUsd(manualTotal)}
                level="subsection"
              >
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <TableHead
                      columns={[
                        "Asset",
                        "Balance",
                        "Price/24hΔ",
                        "Value",
                      ]}
                    />
                    <tbody>
                      {enriched.map((h) => (
                        <TokenRow
                          key={h.id}
                          symbol={h.symbol}
                          name={h.symbol}
                          balance={fmtBalance(h.amount)}
                          price={fmtPrice(h.currentPrice)}
                          value={fmtUsd(h.value)}
                          badge={
                            h.pnl >= 0
                              ? {
                                  label: `+${h.pnlPct.toFixed(1)}%`,
                                  color: "#16c784",
                                }
                              : {
                                  label: `${h.pnlPct.toFixed(1)}%`,
                                  color: "#ea3943",
                                }
                          }
                          onRemove={() =>
                            handleRemove(h.id)
                          }
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </CollapsibleSection>
            </CollapsibleSection>
          )}

          {/* Empty state */}
          {walletTokens.length === 0 &&
            !solBalance &&
            enriched.length === 0 && (
              <div className="py-12 text-center rounded-xl" style={{ border: "1px dashed var(--cmc-border)" }}>
                <div className="relative mx-auto mb-4 w-16 h-16">
                  <div className="absolute inset-0 rounded-2xl rotate-6" style={{ background: "rgba(153,69,255,0.08)", border: "1px solid rgba(153,69,255,0.15)" }} />
                  <div className="absolute inset-0 rounded-2xl -rotate-3" style={{ background: "rgba(20,241,149,0.06)", border: "1px solid rgba(20,241,149,0.12)" }} />
                  <div className="absolute inset-0 rounded-2xl flex items-center justify-center" style={{ background: "var(--cmc-bg)", border: "1px solid var(--cmc-border)" }}>
                    <Coins size={22} style={{ color: "var(--pf-accent)" }} />
                  </div>
                </div>
                <p className="text-sm font-semibold" style={{ color: "var(--cmc-text)" }}>
                  No positions found
                </p>
                <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: "var(--cmc-neutral-5)" }}>
                  Scan your wallet to auto-detect tokens, or add holdings manually below.
                </p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    onClick={doScan}
                    disabled={scanning}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:brightness-110"
                    style={{ background: "var(--pf-accent)", color: "#fff" }}
                  >
                    <RefreshCw size={12} className={scanning ? "animate-spin" : ""} /> Scan Wallet
                  </button>
                  <button
                    onClick={() => document.getElementById("manual-holdings-section")?.scrollIntoView({ behavior: "smooth" })}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors hover:bg-white/5"
                    style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-text)" }}
                  >
                    <Plus size={12} /> Add Manually
                  </button>
                </div>
              </div>
            )}
        </div>
      )}

      {/* ═══════════════════ NFTs TAB ═══════════════════ */}
      {activeView === "nfts" && (
        <div>
          {nfts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {nfts.map((t) => (
                <div
                  key={t.mint}
                  className="rounded-xl overflow-hidden transition-all hover:scale-[1.02] group relative"
                  style={{ border: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}
                >
                  {t.logo ? (
                    <img
                      src={t.logo}
                      alt={t.name}
                      className="w-full aspect-square object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div
                      className="w-full aspect-square flex items-center justify-center text-lg font-bold"
                      style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(129,140,248,0.2))", color: "var(--cmc-text)" }}
                    >
                      {(t.name !== "Token" ? t.name : t.symbol).slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <a
                      href={`https://solscan.io/token/${t.mint}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-colors"
                      style={{ background: "var(--pf-accent)" }}
                    >
                      View on Solscan
                    </a>
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold truncate" style={{ color: "var(--cmc-text)" }}>
                      {t.name !== "Token" ? t.name : t.symbol}
                    </p>
                    <p className="text-[10px] font-mono truncate mt-0.5" style={{ color: "var(--cmc-neutral-5)" }}>
                      {t.mint.slice(0, 4)}...{t.mint.slice(-4)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center rounded-xl" style={{ border: "1px dashed var(--cmc-border)" }}>
              <ImageIcon size={28} className="mx-auto mb-3" style={{ color: "var(--cmc-neutral-5)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--cmc-text)" }}>No NFTs found</p>
              <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: "var(--cmc-neutral-5)" }}>
                NFTs in your wallet will appear here automatically.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ ACTIVITY TAB ═══════════════════ */}
      {activeView === "activity" && (
        <ActivityFeed walletAddress={wallet} />
      )}

      {/* ═══════════════════ WATCHLIST TAB ═══════════════════ */}
      {activeView === "watchlist" && (
        <WatchlistTab wallet={wallet} />
      )}

      {/* ═══════════════════ ALERTS TAB ═══════════════════ */}
      {activeView === "alerts" && (
        <AlertsTab wallet={wallet} />
      )}

      {/* ═══════════════════ DEFI TAB ═══════════════════ */}
      {activeView === "defi" && (
        <div className="space-y-6">
          <KaminoPositions wallet={wallet} walletTokens={walletTokens.map(t => ({ mint: t.mint, amount: t.amount }))} onTotalChange={setKaminoTotal} />
          <DeFiYields />
        </div>
      )}

      {/* ═══════════════════ ADD HOLDING FORM ═══════════════════ */}
      {activeView === "positions" && (
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="h-8 px-3 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all hover:opacity-80"
          style={{
            background: showAdd
              ? "rgba(20,241,149,0.1)"
              : "var(--cmc-neutral-1)",
            color: showAdd ? "var(--pf-up)" : "var(--cmc-text)",
            border: "1px solid var(--cmc-border)",
          }}
        >
          <Plus size={12} /> Add Manual Holding
        </button>
      </div>
      )}

      {activeView === "positions" && showAdd && (
        <div
          className="mt-3 rounded-xl p-4"
          style={{ border: "1px solid var(--cmc-border)" }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label
                className="text-[10px] font-medium block mb-1"
                style={{ color: "var(--cmc-neutral-5)" }}
              >
                Asset
              </label>
              <select
                value={formSymbol}
                onChange={(e) => setFormSymbol(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-xs outline-none w-40"
                style={{
                  background: "var(--cmc-neutral-2)",
                  color: "var(--cmc-text)",
                  border: "1px solid var(--cmc-border)",
                }}
              >
                <option value="">Select...</option>
                <optgroup label="Crypto">
                  {MANUAL_ASSETS.filter((a) => a.type === "coin").map(
                    (a) => (
                      <option key={a.symbol} value={a.symbol}>
                        {a.symbol} — {a.name}
                      </option>
                    )
                  )}
                </optgroup>
                <optgroup label="Stocks">
                  {MANUAL_ASSETS.filter(
                    (a) => a.type === "stock"
                  ).map((a) => (
                    <option key={a.symbol} value={a.symbol}>
                      {a.symbol} — {a.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label
                className="text-[10px] font-medium block mb-1"
                style={{ color: "var(--cmc-neutral-5)" }}
              >
                Amount
              </label>
              <input
                type="number"
                step="any"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0.5"
                className="rounded-lg px-3 py-1.5 text-xs outline-none w-28"
                style={{
                  background: "var(--cmc-neutral-2)",
                  color: "var(--cmc-text)",
                  border: "1px solid var(--cmc-border)",
                }}
              />
            </div>
            <div>
              <label
                className="text-[10px] font-medium block mb-1"
                style={{ color: "var(--cmc-neutral-5)" }}
              >
                Buy Price ($)
              </label>
              <input
                type="number"
                step="any"
                value={formBuyPrice}
                onChange={(e) => setFormBuyPrice(e.target.value)}
                placeholder="95000"
                className="rounded-lg px-3 py-1.5 text-xs outline-none w-32"
                style={{
                  background: "var(--cmc-neutral-2)",
                  color: "var(--cmc-text)",
                  border: "1px solid var(--cmc-border)",
                }}
              />
            </div>
            <button
              onClick={handleAdd}
              className="h-7 px-4 rounded-lg text-[11px] font-bold transition-all hover:brightness-110"
              style={{ background: "var(--pf-up)", color: "#000" }}
            >
              Add
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="h-7 px-3 rounded-lg text-[11px] font-medium"
              style={{ color: "var(--cmc-neutral-5)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* L12: Hidden share card for image export — kept in normal flow but visually hidden */}
      <div style={{ position: "absolute", left: 0, top: 0, overflow: "hidden", width: 0, height: 0, pointerEvents: "none" }}>
        <div
          id="portfolio-share-card"
          style={{
            display: "flex",
            flexDirection: "column",
            width: 480,
            padding: 28,
            background: "#0b0b12",
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "#fff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, var(--pf-up), var(--pf-accent))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800 }}>P</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Portfolio Summary</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{wallet.slice(0, 6)}...{wallet.slice(-4)} · {new Date().toLocaleDateString()}</div>
            </div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>{fmtUsd(totalValue)}</div>
          <div style={{ fontSize: 12, color: realPnl.pnl24h >= 0 ? "#16c784" : "#ea3943", marginBottom: 18 }}>
            24h: {realPnl.pnl24h >= 0 ? "+" : ""}{realPnl.pnlPct24h.toFixed(2)}%
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 14 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: 1 }}>Top Holdings</div>
            {allHoldings.slice(0, 5).map((h) => (
              <div key={h.symbol} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6, paddingBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{h.symbol}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtUsd(h.value)}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>Powered by Pyth Network & Helius</span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>PythFeeds</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════ BOTTOM BAR ═══════════════════ */}
      <div
        className="mt-4 flex items-center justify-between py-2.5 text-[10px]"
        style={{
          color: "var(--cmc-neutral-5)",
          borderTop: "1px solid var(--cmc-border)",
        }}
      >
        <span className="font-mono">
          {wallet.slice(0, 6)}...{wallet.slice(-4)} ·{" "}
          {fmtUsd(totalValue)}
        </span>
        <span>Powered by Pyth Network & Helius</span>
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 size={24} className="animate-spin" style={{ color: "var(--cmc-neutral-5)" }} /></div>}>
      <PortfolioPageInner />
    </Suspense>
  );
}
