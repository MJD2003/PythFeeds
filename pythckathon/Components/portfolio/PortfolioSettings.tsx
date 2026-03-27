"use client";

import { useState, useEffect, useRef } from "react";
import { X, Eye, EyeOff, LayoutGrid, List, Bell, Trash2, Download, Clock } from "lucide-react";
import { toast } from "sonner";

const SETTINGS_KEY = "pythfeeds_portfolio_settings";

export interface PortfolioSettingsData {
  compactMode: boolean;
  autoRefreshInterval: number; // seconds, 0 = off
  showSmallBalances: boolean;
  smallBalanceThreshold: number; // USD
  defaultTab: string;
}

const DEFAULT_SETTINGS: PortfolioSettingsData = {
  compactMode: false,
  autoRefreshInterval: 30,
  showSmallBalances: true,
  smallBalanceThreshold: 1,
  defaultTab: "positions",
};

export function loadPortfolioSettings(): PortfolioSettingsData {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function savePortfolioSettings(settings: PortfolioSettingsData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

interface PortfolioSettingsProps {
  open: boolean;
  onClose: () => void;
  wallet: string;
  onClearData: () => void;
  settings: PortfolioSettingsData;
  onSettingsChange: (settings: PortfolioSettingsData) => void;
}

export default function PortfolioSettings({ open, onClose, wallet, onClearData, settings, onSettingsChange }: PortfolioSettingsProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const update = (partial: Partial<PortfolioSettingsData>) => {
    const updated = { ...settings, ...partial };
    onSettingsChange(updated);
    savePortfolioSettings(updated);
  };

  const handleClearSnapshots = () => {
    if (typeof window === "undefined") return;
    const keys = Object.keys(localStorage).filter(k => k.startsWith("pf_snap_") || k.startsWith("pf_prices"));
    keys.forEach(k => localStorage.removeItem(k));
    toast.success("Portfolio history cleared");
  };

  const handleClearAll = () => {
    onClearData();
    toast.success("Portfolio data cleared");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={ref}
        className="relative mt-16 mr-4 w-[320px] max-h-[calc(100dvh-100px)] overflow-y-auto rounded-xl shadow-2xl animate-in slide-in-from-right-4 duration-200"
        style={{ background: "var(--cmc-bg)", border: "1px solid var(--cmc-border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-10" style={{ background: "var(--cmc-bg)", borderBottom: "1px solid var(--cmc-border)" }}>
          <span className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>Portfolio Settings</span>
          <button onClick={onClose} className="p-1 rounded-lg transition-colors hover:bg-white/5">
            <X size={14} style={{ color: "var(--cmc-neutral-5)" }} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Display Section */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--cmc-neutral-5)" }}>Display</p>
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex items-center gap-2">
                  {settings.compactMode ? <List size={13} style={{ color: "var(--pf-accent)" }} /> : <LayoutGrid size={13} style={{ color: "var(--cmc-neutral-5)" }} />}
                  <span className="text-[11px] font-medium" style={{ color: "var(--cmc-text)" }}>Compact mode</span>
                </div>
                <button
                  onClick={() => update({ compactMode: !settings.compactMode })}
                  className="relative w-9 h-5 rounded-full transition-colors"
                  style={{ background: settings.compactMode ? "var(--pf-accent)" : "var(--cmc-neutral-3)" }}
                >
                  <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform" style={{ transform: settings.compactMode ? "translateX(16px)" : "translateX(0)" }} />
                </button>
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex items-center gap-2">
                  {settings.showSmallBalances ? <Eye size={13} style={{ color: "var(--cmc-neutral-5)" }} /> : <EyeOff size={13} style={{ color: "var(--cmc-neutral-5)" }} />}
                  <span className="text-[11px] font-medium" style={{ color: "var(--cmc-text)" }}>Show small balances</span>
                </div>
                <button
                  onClick={() => update({ showSmallBalances: !settings.showSmallBalances })}
                  className="relative w-9 h-5 rounded-full transition-colors"
                  style={{ background: settings.showSmallBalances ? "var(--pf-accent)" : "var(--cmc-neutral-3)" }}
                >
                  <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform" style={{ transform: settings.showSmallBalances ? "translateX(16px)" : "translateX(0)" }} />
                </button>
              </label>

              {!settings.showSmallBalances && (
                <div className="pl-7">
                  <label className="text-[9px] font-medium block mb-1" style={{ color: "var(--cmc-neutral-5)" }}>
                    Hide tokens below (USD)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.01"
                    max="100"
                    value={settings.smallBalanceThreshold}
                    onChange={(e) => update({ smallBalanceThreshold: Math.max(0.01, parseFloat(e.target.value) || 1) })}
                    className="w-20 px-2 py-1 rounded-lg text-[11px] outline-none"
                    style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Data Section */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: "var(--cmc-neutral-5)" }}>Data</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={13} style={{ color: "var(--cmc-neutral-5)" }} />
                  <span className="text-[11px] font-medium" style={{ color: "var(--cmc-text)" }}>Auto-refresh</span>
                </div>
                <select
                  value={settings.autoRefreshInterval}
                  onChange={(e) => update({ autoRefreshInterval: parseInt(e.target.value) })}
                  className="px-2 py-1 rounded-lg text-[10px] outline-none"
                  style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}
                >
                  <option value="10">10s</option>
                  <option value="30">30s</option>
                  <option value="60">1min</option>
                  <option value="0">Off</option>
                </select>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: "#ea3943" }}>Danger Zone</p>
            <div className="space-y-2">
              <button
                onClick={handleClearSnapshots}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors hover:bg-red-500/10"
                style={{ border: "1px solid var(--cmc-border)", color: "var(--cmc-text)" }}
              >
                <Trash2 size={12} style={{ color: "#ea3943" }} />
                Clear portfolio history
              </button>
              <button
                onClick={handleClearAll}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors hover:bg-red-500/10"
                style={{ border: "1px solid rgba(234,57,67,0.3)", color: "#ea3943" }}
              >
                <Trash2 size={12} />
                Clear all portfolio data
              </button>
            </div>
          </div>

          {/* Wallet Info */}
          {wallet && (
            <div className="pt-2" style={{ borderTop: "1px solid var(--cmc-border)" }}>
              <p className="text-[9px] font-mono" style={{ color: "var(--cmc-neutral-5)" }}>
                Wallet: {wallet.slice(0, 8)}...{wallet.slice(-4)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
