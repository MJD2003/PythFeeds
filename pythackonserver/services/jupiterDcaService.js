const { cache } = require("../config/cache");
const { getBreaker } = require("../middleware/circuitBreaker");

const cb = getBreaker("jupiter-dca");
const BASE = "https://api.jup.ag/recurring/v1";
const JUP_API_KEY = process.env.JUPITER_API_KEY || "";

async function jupFetch(url, options = {}) {
  return cb.call(async () => {
    const headers = { Accept: "application/json", "Content-Type": "application/json", ...options.headers };
    if (JUP_API_KEY) headers["x-api-key"] = JUP_API_KEY;
    const res = await fetch(url, { headers, ...options });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Jupiter Recurring ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json();
  });
}

// POST /recurring/v1/createOrder
async function createDca(params) {
  const body = {
    user: params.payer,
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    params: {
      time: {
        inAmount: parseInt(params.totalInAmount),
        numberOfOrders: parseInt(params.numberOfOrders || Math.ceil(parseInt(params.totalInAmount) / parseInt(params.inAmountPerCycle))),
        interval: params.cycleSecondsApart,
      },
    },
  };
  return jupFetch(`${BASE}/createOrder`, { method: "POST", body: JSON.stringify(body) });
}

// GET /recurring/v1/getRecurringOrders?user=...
async function getDcaPositions(wallet) {
  const key = `jup_recurring_${wallet}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const data = await jupFetch(`${BASE}/getRecurringOrders?user=${wallet}`);
  const orders = data.orders || [];
  cache.set(key, orders, 15);
  return orders;
}

// POST /recurring/v1/cancelOrder
async function closeDca(user, orderKey) {
  return jupFetch(`${BASE}/cancelOrder`, {
    method: "POST",
    body: JSON.stringify({ user, orderKey, computeUnitPrice: "auto" }),
  });
}

module.exports = {
  createDca,
  getDcaPositions,
  closeDca,
};
