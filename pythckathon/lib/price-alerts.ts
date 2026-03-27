"use client";

import { toast } from "sonner";
import { getUserData, setUserData } from "@/lib/api/backend";
import { pushNotification } from "@/Components/shared/NotificationCenter";

export type AlertMode = "price" | "percentage";

export interface PriceAlert {
  id: string;
  symbol: string;
  name: string;
  targetPrice: number;
  direction: "above" | "below";
  createdAt: number;
  triggered: boolean;
  /** Alert mode: absolute price target or percentage change */
  mode?: AlertMode;
  /** For percentage alerts: the % threshold (e.g. 5 = 5%) */
  percentThreshold?: number;
  /** For percentage alerts: reference price when alert was created */
  referencePrice?: number;
  /** Whether alert should re-arm after triggering */
  recurring?: boolean;
  /** Optional logo URL for display */
  logo?: string;
  /** Optional mint address for on-chain tokens */
  mint?: string;
}

const STORAGE_KEY = "cryptoserve_price_alerts";

export function getAlerts(): PriceAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// In-memory wallet reference for async saves
let _walletRef = "";

export function setWalletRef(wallet: string) { _walletRef = wallet; }

export function saveAlerts(alerts: PriceAlert[], wallet?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  const w = wallet || _walletRef;
  if (w) setUserData(w, "price_alerts", alerts).catch(() => {});
}

export function addAlert(alert: Omit<PriceAlert, "id" | "createdAt" | "triggered">): PriceAlert {
  const newAlert: PriceAlert = {
    ...alert,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    triggered: false,
  };
  const alerts = getAlerts();
  alerts.push(newAlert);
  saveAlerts(alerts);

  const isPercentage = alert.mode === "percentage";
  const desc = isPercentage
    ? `${alert.name} (${alert.symbol.toUpperCase()}) ${alert.direction === "above" ? "↑" : "↓"} ${alert.percentThreshold}% from $${(alert.referencePrice || 0).toLocaleString()}`
    : `${alert.name} (${alert.symbol.toUpperCase()}) ${alert.direction} $${alert.targetPrice.toLocaleString()}`;

  toast.success(`Alert set`, { description: desc });

  pushNotification({
    type: "alert_created",
    title: `Alert created: ${alert.symbol.toUpperCase()}`,
    message: desc,
    link: "/portfolio?tab=alerts",
    groupKey: `alert_create_${alert.symbol}`,
  });

  return newAlert;
}

export function removeAlert(id: string) {
  const alerts = getAlerts().filter((a) => a.id !== id);
  saveAlerts(alerts);
}

export function updateAlert(id: string, updates: Partial<Pick<PriceAlert, "targetPrice" | "direction" | "percentThreshold" | "referencePrice" | "recurring" | "mode">>) {
  const alerts = getAlerts();
  const idx = alerts.findIndex((a) => a.id === id);
  if (idx === -1) return;
  Object.assign(alerts[idx], updates);
  alerts[idx].triggered = false;
  saveAlerts(alerts);
}

export function clearTriggered() {
  const alerts = getAlerts().filter((a) => !a.triggered);
  saveAlerts(alerts);
}

function sendBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  }
}

// ═══ Backend sync ═══

export async function syncAlertsFromBackend(wallet: string): Promise<PriceAlert[]> {
  if (!wallet) return getAlerts();
  setWalletRef(wallet);
  try {
    const remote = await getUserData<PriceAlert[]>(wallet, "price_alerts");
    const local = getAlerts();
    if (!remote || remote.length === 0) {
      // Push local to backend if remote is empty
      if (local.length > 0) setUserData(wallet, "price_alerts", local).catch(() => {});
      return local;
    }
    // Merge: union by id, remote wins on conflicts
    const map = new Map(local.map(a => [a.id, a]));
    for (const r of remote) map.set(r.id, r);
    const merged = Array.from(map.values());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    setUserData(wallet, "price_alerts", merged).catch(() => {});
    return merged;
  } catch {
    return getAlerts();
  }
}

export function checkAlerts(currentPrices: Map<string, number>) {
  const alerts = getAlerts();
  let updated = false;

  for (const alert of alerts) {
    if (alert.triggered) continue;

    const price = currentPrices.get(alert.symbol.toLowerCase());
    if (!price) continue;

    let shouldTrigger = false;
    let msg = "";

    if (alert.mode === "percentage" && alert.referencePrice && alert.percentThreshold) {
      // Percentage-based alert
      const changePct = ((price - alert.referencePrice) / alert.referencePrice) * 100;
      shouldTrigger =
        (alert.direction === "above" && changePct >= alert.percentThreshold) ||
        (alert.direction === "below" && changePct <= -alert.percentThreshold);
      msg = `${alert.name} (${alert.symbol.toUpperCase()}) moved ${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}% to $${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (threshold: ${alert.direction === "above" ? "+" : "-"}${alert.percentThreshold}%)`;
    } else {
      // Absolute price alert
      shouldTrigger =
        (alert.direction === "above" && price >= alert.targetPrice) ||
        (alert.direction === "below" && price <= alert.targetPrice);
      msg = `${alert.name} (${alert.symbol.toUpperCase()}) is now $${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — ${alert.direction} your target of $${alert.targetPrice.toLocaleString()}`;
    }

    if (shouldTrigger) {
      updated = true;
      const isUp = alert.direction === "above";

      if (alert.recurring) {
        // Recurring: re-arm with new reference price
        alert.referencePrice = price;
        alert.triggered = false;
      } else {
        alert.triggered = true;
      }

      toast(isUp ? "🚀 Price Alert Triggered!" : "📉 Price Alert Triggered!", {
        description: msg,
        duration: 10000,
        action: {
          label: "Dismiss",
          onClick: () => {},
        },
      });

      pushNotification({
        type: "alert_triggered",
        title: isUp ? "🚀 Price Alert Triggered!" : "📉 Price Alert Triggered!",
        message: msg,
        link: "/portfolio?tab=alerts",
        actions: [
          { label: "View Alerts", href: "/portfolio?tab=alerts" },
          { label: "Swap", href: `/swap?from=${alert.symbol}` },
        ],
        groupKey: `alert_trigger_${alert.symbol}`,
      });
    }
  }

  if (updated) saveAlerts(alerts);
}
