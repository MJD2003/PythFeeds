/**
 * Optional audio ping for significant price movements.
 * Uses Web Audio API to generate short tones — no external audio files needed.
 * Respects user preference stored in localStorage.
 */

const STORAGE_KEY = "pythfeeds_price_sound";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const val = localStorage.getItem(STORAGE_KEY);
  // Default to enabled if never set
  if (val === null) return true;
  return val === "true";
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
}

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

/**
 * Play a short tone.
 * @param direction "up" for ascending tone, "down" for descending
 * @param volume 0-1 (default 0.12 — subtle)
 */
export function playPricePing(direction: "up" | "down", volume = 0.12): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  // Resume suspended AudioContext (browser autoplay policy)
  if (ctx.state === "suspended") { ctx.resume().catch(() => {}); return; }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = "sine";
  const now = ctx.currentTime;

  if (direction === "up") {
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(900, now + 0.08);
  } else {
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.linearRampToValueAtTime(300, now + 0.08);
  }

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.start(now);
  osc.stop(now + 0.15);
}
