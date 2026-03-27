"use client";

import { getUserData, setUserData } from "@/lib/api/backend";
import type { NotificationType } from "@/Components/shared/NotificationCenter";

/**
 * Notification persistence — syncs localStorage notifications and preferences
 * with the backend via the generic user_data key-value store.
 */

const NOTIF_KEY = "pythfeeds_notifications";
const PREFS_KEY = "pythfeeds_notif_prefs";
const BACKEND_NOTIF_KEY = "notifications";
const BACKEND_PREFS_KEY = "notif_prefs";

export interface SyncedNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  link?: string;
  groupKey?: string;
}

export interface SyncedPrefs {
  sound: boolean;
  browserPush: boolean;
  mutedTypes: NotificationType[];
  dndUntil: number;
}

// ── Debounce write to backend ──

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let prefsTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSaveNotifications(wallet: string) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const raw = localStorage.getItem(NOTIF_KEY);
      if (!raw) return;
      const notifs: SyncedNotification[] = JSON.parse(raw);
      // Only persist the last 50 to keep payload small
      const trimmed = notifs.slice(0, 50).map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        timestamp: n.timestamp,
        read: n.read,
        link: n.link,
        groupKey: n.groupKey,
      }));
      setUserData(wallet, BACKEND_NOTIF_KEY, trimmed).catch(() => {});
    } catch {}
  }, 3000);
}

function debouncedSavePrefs(wallet: string) {
  if (prefsTimer) clearTimeout(prefsTimer);
  prefsTimer = setTimeout(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return;
      setUserData(wallet, BACKEND_PREFS_KEY, JSON.parse(raw)).catch(() => {});
    } catch {}
  }, 2000);
}

// ── Public sync API ──

/**
 * Load notifications from backend and merge with localStorage.
 * Backend notifications that are newer or don't exist locally are added.
 * Returns the merged list.
 */
export async function syncNotificationsFromBackend(wallet: string): Promise<SyncedNotification[]> {
  if (!wallet) return [];
  try {
    const remote = await getUserData<SyncedNotification[]>(wallet, BACKEND_NOTIF_KEY);
    if (!remote || !Array.isArray(remote) || remote.length === 0) return [];

    const localRaw = localStorage.getItem(NOTIF_KEY);
    const local: SyncedNotification[] = localRaw ? JSON.parse(localRaw) : [];
    const localIds = new Set(local.map(n => n.id));

    // Add remote notifications not present locally
    let merged = false;
    for (const rn of remote) {
      if (!localIds.has(rn.id)) {
        local.push(rn);
        merged = true;
      }
    }

    if (merged) {
      // Sort by timestamp descending
      local.sort((a, b) => b.timestamp - a.timestamp);
      localStorage.setItem(NOTIF_KEY, JSON.stringify(local.slice(0, 100)));
    }

    return local;
  } catch {
    return [];
  }
}

/**
 * Load notification preferences from backend and merge with localStorage.
 */
export async function syncPrefsFromBackend(wallet: string): Promise<SyncedPrefs | null> {
  if (!wallet) return null;
  try {
    const remote = await getUserData<SyncedPrefs>(wallet, BACKEND_PREFS_KEY);
    if (!remote) return null;

    const localRaw = localStorage.getItem(PREFS_KEY);
    if (!localRaw) {
      // No local prefs — use remote
      localStorage.setItem(PREFS_KEY, JSON.stringify(remote));
      return remote;
    }
    // Local prefs exist — keep local as source of truth (user's current device)
    return null;
  } catch {
    return null;
  }
}

/**
 * Call after any notification change to schedule a backend sync.
 */
export function scheduleNotificationSync(wallet: string) {
  if (!wallet) return;
  debouncedSaveNotifications(wallet);
}

/**
 * Call after any preference change to schedule a backend sync.
 */
export function schedulePrefsSync(wallet: string) {
  if (!wallet) return;
  debouncedSavePrefs(wallet);
}
