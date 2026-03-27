"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell, X, Trash2, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, ArrowRightLeft, XCircle, Trophy, Zap, Info,
  Volume2, VolumeX, Settings2, ExternalLink,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  syncNotificationsFromBackend,
  syncPrefsFromBackend,
  scheduleNotificationSync,
  schedulePrefsSync,
} from "@/lib/notification-sync";

// ═══ Types ═══

export type NotificationType =
  | "alert_triggered"
  | "alert_created"
  | "price_move"
  | "swap_completed"
  | "swap_failed"
  | "portfolio_milestone"
  | "whale_move"
  | "token_launch"
  | "system";

export interface NotificationAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  link?: string;
  actions?: NotificationAction[];
  groupKey?: string;
}

// ═══ Preferences ═══

export interface NotificationPrefs {
  sound: boolean;
  browserPush: boolean;
  mutedTypes: NotificationType[];
  dndUntil: number;
}

const NOTIF_KEY = "pythfeeds_notifications";
const PREFS_KEY = "pythfeeds_notif_prefs";

const DEFAULT_PREFS: NotificationPrefs = {
  sound: true,
  browserPush: false,
  mutedTypes: [],
  dndUntil: 0,
};

function getPrefs(): NotificationPrefs {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; } catch { return DEFAULT_PREFS; }
}

function savePrefs(prefs: NotificationPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

// ═══ Storage helpers ═══

function getNotifications(): Notification[] {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || "[]"); } catch { return []; }
}

function saveNotifications(notifs: Notification[]) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(notifs));
}

// ═══ Sound ═══

let audioCtx: AudioContext | null = null;

function playNotifSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.25);
  } catch { /* silent fallback */ }
}

// ═══ Module-level wallet ref for push sync ═══

let _notifWalletRef = "";
export function setNotifWalletRef(wallet: string) { _notifWalletRef = wallet; }

// ═══ Push API ═══

export function pushNotification(notif: Omit<Notification, "id" | "timestamp" | "read">) {
  const prefs = getPrefs();

  // DND check
  if (prefs.dndUntil > Date.now()) return;

  // Muted type check
  if (prefs.mutedTypes.includes(notif.type)) return;

  const list = getNotifications();

  // Grouping: if a notification with the same groupKey exists within 60s, update count instead of duplicating
  if (notif.groupKey) {
    const recent = list.find(n => n.groupKey === notif.groupKey && !n.read && Date.now() - n.timestamp < 60_000);
    if (recent) {
      // Update title to show count
      const match = recent.title.match(/^\((\d+)\)\s/);
      const count = match ? parseInt(match[1]) + 1 : 2;
      recent.title = `(${count}) ${recent.title.replace(/^\(\d+\)\s/, "")}`;
      recent.message = notif.message;
      recent.timestamp = Date.now();
      saveNotifications(list);
      window.dispatchEvent(new CustomEvent("pythfeeds_notification"));
      return;
    }
  }

  list.unshift({
    ...notif,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    read: false,
  });
  saveNotifications(list.slice(0, 100));

  // Sound
  if (prefs.sound) playNotifSound();

  // Browser push
  if (prefs.browserPush && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    new window.Notification(notif.title, { body: notif.message, icon: "/favicon.ico" });
  }

  window.dispatchEvent(new CustomEvent("pythfeeds_notification"));

  // Schedule backend sync if wallet is connected
  if (_notifWalletRef) scheduleNotificationSync(_notifWalletRef);
}

// ═══ Helpers ═══

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const ICON_MAP: Record<NotificationType, { icon: typeof Bell; color: string }> = {
  alert_triggered: { icon: AlertTriangle, color: "#f59e0b" },
  alert_created: { icon: CheckCircle2, color: "#16c784" },
  price_move: { icon: TrendingUp, color: "var(--pf-accent)" },
  swap_completed: { icon: ArrowRightLeft, color: "#16c784" },
  swap_failed: { icon: XCircle, color: "#ea3943" },
  portfolio_milestone: { icon: Trophy, color: "#f59e0b" },
  whale_move: { icon: Zap, color: "#06b6d4" },
  token_launch: { icon: Zap, color: "#C7F284" },
  system: { icon: Info, color: "var(--cmc-neutral-5)" },
};

const TYPE_LABELS: Record<NotificationType, string> = {
  alert_triggered: "Alerts",
  alert_created: "Alerts",
  price_move: "Price Moves",
  swap_completed: "Swaps",
  swap_failed: "Swaps",
  portfolio_milestone: "Portfolio",
  whale_move: "Whale Alerts",
  token_launch: "New Tokens",
  system: "System",
};

// ═══ Component ═══

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const ref = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const router = useRouter();
  const { publicKey } = useWallet();
  const walletAddr = publicKey?.toBase58() || "";

  const refresh = useCallback(() => {
    const list = getNotifications();
    setNotifications(list);
    setPrefs(getPrefs());
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("pythfeeds_notification", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("pythfeeds_notification", handler);
      window.removeEventListener("storage", handler);
    };
  }, [refresh]);

  // Sync from backend when wallet connects
  useEffect(() => {
    if (!walletAddr) return;
    setNotifWalletRef(walletAddr);
    syncNotificationsFromBackend(walletAddr).then((merged) => {
      if (merged.length > 0) refresh();
    });
    syncPrefsFromBackend(walletAddr).then((remote) => {
      if (remote) setPrefs(remote);
    });
  }, [walletAddr, refresh]);

  // Pulse animation when new unread arrives
  const unreadCount = notifications.filter((n) => !n.read).length;
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (unreadCount > prevCountRef.current && !open) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 2000);
      return () => clearTimeout(t);
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setShowPrefs(false); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    saveNotifications(updated);
    scheduleNotificationSync(walletAddr);
  };

  const clearAll = () => {
    setNotifications([]);
    saveNotifications([]);
    scheduleNotificationSync(walletAddr);
  };

  const removeOne = (id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    saveNotifications(updated);
    scheduleNotificationSync(walletAddr);
  };

  const updatePrefs = (partial: Partial<NotificationPrefs>) => {
    const updated = { ...prefs, ...partial };
    setPrefs(updated);
    savePrefs(updated);
    schedulePrefsSync(walletAddr);
  };

  const requestBrowserPush = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    updatePrefs({ browserPush: perm === "granted" });
  };

  const handleDnd = (hours: number) => {
    updatePrefs({ dndUntil: hours > 0 ? Date.now() + hours * 3600_000 : 0 });
  };

  const toggleMuteType = (type: NotificationType) => {
    const muted = prefs.mutedTypes.includes(type)
      ? prefs.mutedTypes.filter(t => t !== type)
      : [...prefs.mutedTypes, type];
    updatePrefs({ mutedTypes: muted });
  };

  const getIcon = (type: NotificationType) => {
    const { icon: Icon, color } = ICON_MAP[type] || ICON_MAP.system;
    return <Icon size={14} style={{ color }} />;
  };

  const filtered = filter === "unread" ? notifications.filter(n => !n.read) : notifications;
  const isDnd = prefs.dndUntil > Date.now();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) markAllRead(); }}
        className="group flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-(--cmc-neutral-2) relative"
        aria-label="Notifications"
      >
        <svg viewBox="0 0 448 512" className={`w-4 h-4 ${pulse ? "animate-[bellRing_0.9s_both]" : "group-hover:animate-[bellRing_0.9s_both]"}`} style={{ transformOrigin: "top" }}>
          <path
            d="M224 0c-17.7 0-32 14.3-32 32V49.9C119.5 61.4 64 124.2 64 200v33.4c0 45.4-15.5 89.5-43.8 124.9L5.3 377c-5.8 7.2-6.9 17.1-2.9 25.4S14.8 416 24 416H424c9.2 0 17.6-5.3 21.6-13.6s2.9-18.2-2.9-25.4l-14.9-18.6C399.5 322.9 384 278.8 384 233.4V200c0-75.8-55.5-138.6-128-150.1V32c0-17.7-14.3-32-32-32zm0 96h8c57.4 0 104 46.6 104 104v33.4c0 47.9 13.9 94.6 39.7 134.6H72.3C98.1 328 112 281.3 112 233.4V200c0-57.4 46.6-104 104-104h8zm64 352H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7s18.7-28.3 18.7-45.3z"
            fill="currentColor"
            style={{ color: unreadCount > 0 ? "#f59e0b" : "var(--cmc-neutral-5)" }}
          />
        </svg>
        {unreadCount > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white bg-[#ea3943] ${pulse ? "animate-pulse" : ""}`}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        {isDnd && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 border border-(--cmc-bg)" title="Do Not Disturb" />
        )}
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-2 w-[360px] max-h-[500px] rounded-xl border shadow-xl flex flex-col overflow-hidden"
          style={{ background: "var(--cmc-bg)", borderColor: "var(--cmc-border)", zIndex: 1001 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 shrink-0" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold" style={{ color: "var(--cmc-text)" }}>Notifications</span>
              {isDnd && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500">DND</span>}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowPrefs(!showPrefs)}
                className="p-1 rounded transition-colors hover:bg-white/5"
                title="Notification settings"
              >
                <Settings2 size={13} style={{ color: showPrefs ? "var(--pf-accent)" : "var(--cmc-neutral-5)" }} />
              </button>
              {notifications.length > 0 && (
                <button onClick={clearAll} className="text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors hover:bg-red-500/10" style={{ color: "#ea3943" }}>
                  Clear
                </button>
              )}
              <button onClick={() => { setOpen(false); setShowPrefs(false); }} className="p-0.5 rounded transition-colors hover:bg-white/5">
                <X size={14} style={{ color: "var(--cmc-neutral-5)" }} />
              </button>
            </div>
          </div>

          {/* Preferences Panel */}
          {showPrefs && (
            <div className="px-3.5 py-3 space-y-3" style={{ borderBottom: "1px solid var(--cmc-border)", background: "var(--cmc-neutral-1)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>Settings</p>

              {/* Sound toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {prefs.sound ? <Volume2 size={12} style={{ color: "var(--pf-accent)" }} /> : <VolumeX size={12} style={{ color: "var(--cmc-neutral-5)" }} />}
                  <span className="text-[11px] font-medium" style={{ color: "var(--cmc-text)" }}>Notification sound</span>
                </div>
                <button
                  onClick={() => { updatePrefs({ sound: !prefs.sound }); if (!prefs.sound) playNotifSound(); }}
                  className="relative w-8 h-4.5 rounded-full transition-colors"
                  style={{ background: prefs.sound ? "var(--pf-accent)" : "var(--cmc-neutral-3)", width: 32, height: 18 }}
                >
                  <span className="absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform" style={{ transform: prefs.sound ? "translateX(14px)" : "translateX(0)" }} />
                </button>
              </div>

              {/* Browser push */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium" style={{ color: "var(--cmc-text)" }}>Browser notifications</span>
                {typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted" ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(22,199,132,0.1)", color: "#16c784" }}>Enabled</span>
                ) : (
                  <button onClick={requestBrowserPush} className="text-[10px] font-semibold px-2 py-0.5 rounded transition-colors hover:bg-white/5" style={{ color: "var(--pf-accent)", border: "1px solid var(--cmc-border)" }}>
                    Enable
                  </button>
                )}
              </div>

              {/* DND */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium" style={{ color: "var(--cmc-text)" }}>Do Not Disturb</span>
                <div className="flex items-center gap-1">
                  {[1, 4, 24].map(h => (
                    <button
                      key={h}
                      onClick={() => handleDnd(isDnd ? 0 : h)}
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded transition-colors"
                      style={{
                        background: isDnd ? "rgba(245,158,11,0.1)" : "var(--cmc-neutral-2)",
                        color: isDnd ? "#f59e0b" : "var(--cmc-neutral-5)",
                        border: "1px solid var(--cmc-border)",
                      }}
                    >
                      {isDnd ? "Off" : `${h}h`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mute by type */}
              <div>
                <p className="text-[9px] font-semibold mb-1.5" style={{ color: "var(--cmc-neutral-5)" }}>Mute by type</p>
                <div className="flex flex-wrap gap-1">
                  {(Object.entries(TYPE_LABELS) as [NotificationType, string][])
                    .filter(([, label], i, arr) => arr.findIndex(([, l]) => l === label) === i)
                    .map(([type, label]) => {
                      const muted = prefs.mutedTypes.includes(type);
                      return (
                        <button
                          key={type}
                          onClick={() => toggleMuteType(type)}
                          className="text-[9px] font-medium px-2 py-0.5 rounded-full transition-colors"
                          style={{
                            background: muted ? "rgba(234,57,67,0.1)" : "var(--cmc-neutral-2)",
                            color: muted ? "#ea3943" : "var(--cmc-neutral-5)",
                            border: `1px solid ${muted ? "rgba(234,57,67,0.2)" : "var(--cmc-border)"}`,
                            textDecoration: muted ? "line-through" : "none",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* Filter tabs */}
          {notifications.length > 0 && (
            <div className="flex items-center gap-1 px-3.5 py-1.5 shrink-0" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
              {(["all", "unread"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors"
                  style={{
                    background: filter === f ? "var(--pf-accent-muted)" : "transparent",
                    color: filter === f ? "var(--pf-accent)" : "var(--cmc-neutral-5)",
                  }}
                >
                  {f === "all" ? `All (${notifications.length})` : `Unread (${unreadCount})`}
                </button>
              ))}
            </div>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Bell size={28} style={{ color: "var(--cmc-neutral-5)", opacity: 0.4 }} />
                <p className="text-xs mt-2" style={{ color: "var(--cmc-neutral-5)" }}>
                  {filter === "unread" ? "No unread notifications" : "No notifications yet"}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--cmc-neutral-5)" }}>
                  Set price alerts to get notified
                </p>
              </div>
            ) : (
              filtered.slice(0, 40).map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-white/2 group cursor-pointer"
                  style={{ borderBottom: "1px solid var(--cmc-border)", opacity: n.read ? 0.65 : 1 }}
                  onClick={() => { if (n.link) { router.push(n.link); setOpen(false); } }}
                >
                  <div className="mt-0.5 shrink-0">{getIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-semibold leading-tight" style={{ color: "var(--cmc-text)" }}>{n.title}</p>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--pf-accent)" }} />}
                    </div>
                    <p className="text-[10px] mt-0.5 leading-snug" style={{ color: "var(--cmc-neutral-5)" }}>{n.message}</p>

                    {/* Action buttons */}
                    {n.actions && n.actions.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {n.actions.map((action, i) => (
                          action.href ? (
                            <Link
                              key={i}
                              href={action.href}
                              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                              className="text-[9px] font-semibold px-2 py-0.5 rounded transition-colors hover:brightness-110 flex items-center gap-1"
                              style={{
                                background: i === 0 ? "var(--pf-accent-muted)" : "var(--cmc-neutral-2)",
                                color: i === 0 ? "var(--pf-accent)" : "var(--cmc-neutral-5)",
                                border: "1px solid var(--cmc-border)",
                              }}
                            >
                              {action.label}
                              {action.href.startsWith("http") && <ExternalLink size={8} />}
                            </Link>
                          ) : (
                            <button
                              key={i}
                              onClick={(e) => { e.stopPropagation(); action.onClick?.(); }}
                              className="text-[9px] font-semibold px-2 py-0.5 rounded transition-colors hover:brightness-110"
                              style={{
                                background: i === 0 ? "var(--pf-accent-muted)" : "var(--cmc-neutral-2)",
                                color: i === 0 ? "var(--pf-accent)" : "var(--cmc-neutral-5)",
                                border: "1px solid var(--cmc-border)",
                              }}
                            >
                              {action.label}
                            </button>
                          )
                        ))}
                      </div>
                    )}

                    <span className="text-[9px] mt-1 block" style={{ color: "var(--cmc-neutral-5)" }}>{timeAgo(n.timestamp)}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeOne(n.id); }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 shrink-0 mt-0.5"
                  >
                    <Trash2 size={10} style={{ color: "#ea3943" }} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between px-3.5 py-2" style={{ borderTop: "1px solid var(--cmc-border)" }}>
            <Link
              href="/portfolio?tab=alerts"
              onClick={() => setOpen(false)}
              className="text-[11px] font-semibold transition-colors"
              style={{ color: "var(--pf-accent)" }}
            >
              Manage Alerts →
            </Link>
            {notifications.length > 0 && (
              <span className="text-[9px]" style={{ color: "var(--cmc-neutral-5)" }}>{notifications.length} total</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
