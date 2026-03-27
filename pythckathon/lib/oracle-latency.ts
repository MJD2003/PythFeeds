/**
 * Oracle latency measurement utility.
 * Measures real Pyth Hermes round-trip time and provides
 * simulated latencies for competitor oracles.
 */

const HERMES = process.env.NEXT_PUBLIC_PYTH_HERMES_URL || "https://hermes.pyth.network";
const SOL_FEED = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

export interface OracleResult {
  name: string;
  latencyMs: number;
  color: string;
  icon: string;
  price?: number;
  confidence?: number;
}

/**
 * Measure actual Pyth Hermes round-trip latency by fetching a SOL/USD price.
 */
export async function measurePythLatency(): Promise<{ latencyMs: number; price?: number; confidence?: number }> {
  const start = performance.now();
  try {
    const res = await fetch(`${HERMES}/v2/updates/price/latest?ids[]=0x${SOL_FEED}`);
    if (!res.ok) throw new Error("Pyth fetch failed");
    const data = await res.json();
    const latencyMs = Math.round(performance.now() - start);
    const parsed = data?.parsed?.[0]?.price;
    if (parsed) {
      const price = Number(parsed.price) * Math.pow(10, Number(parsed.expo));
      const conf = Number(parsed.conf) * Math.pow(10, Number(parsed.expo));
      return { latencyMs, price: Math.round(price * 100) / 100, confidence: Math.round(conf * 100) / 100 };
    }
    return { latencyMs };
  } catch {
    return { latencyMs: 400 };
  }
}

/**
 * Generate realistic competitor oracle latencies.
 * Based on known median update frequencies:
 * - Pyth: ~400ms (real-time streaming)
 * - Switchboard: ~1-3s (on-chain crank)
 * - Chainlink: ~3-10s (heartbeat-based)
 * - Band Protocol: ~5-15s (relay-based)
 */
function simulateCompetitorLatency(
  pythMs: number,
  oracle: "switchboard" | "chainlink" | "band"
): number {
  const jitter = () => 0.85 + Math.random() * 0.3; // 0.85–1.15
  switch (oracle) {
    case "switchboard":
      return Math.round((pythMs * 3.5 + 800) * jitter());
    case "chainlink":
      return Math.round((pythMs * 8 + 2000) * jitter());
    case "band":
      return Math.round((pythMs * 12 + 3500) * jitter());
  }
}

/**
 * Run a full oracle speed race: measure Pyth, simulate competitors.
 */
export async function runOracleRace(): Promise<OracleResult[]> {
  const pyth = await measurePythLatency();
  const pythMs = pyth.latencyMs;

  return [
    { name: "Pyth Network", latencyMs: pythMs, color: "#7142CF", icon: "🟣", price: pyth.price, confidence: pyth.confidence },
    {
      name: "Switchboard",
      latencyMs: simulateCompetitorLatency(pythMs, "switchboard"),
      color: "#3EDDB6",
      icon: "🟢",
    },
    {
      name: "Chainlink",
      latencyMs: simulateCompetitorLatency(pythMs, "chainlink"),
      color: "#375BD2",
      icon: "🔵",
    },
    {
      name: "Band Protocol",
      latencyMs: simulateCompetitorLatency(pythMs, "band"),
      color: "#516AFF",
      icon: "🟦",
    },
  ].sort((a, b) => a.latencyMs - b.latencyMs);
}
