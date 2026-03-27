const { cache } = require("../config/cache");
const { getBreaker } = require("../middleware/circuitBreaker");

const cb = getBreaker("jupiter-limit");
const BASE = "https://api.jup.ag/trigger/v1";
const JUP_API_KEY = process.env.JUPITER_API_KEY || "";

async function jupFetch(url, options = {}) {
  return cb.call(async () => {
    const headers = { Accept: "application/json", "Content-Type": "application/json", ...options.headers };
    if (JUP_API_KEY) headers["x-api-key"] = JUP_API_KEY;
    const res = await fetch(url, { headers, ...options });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Jupiter Trigger ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json();
  });
}

// POST /trigger/v1/createOrder
async function createOrder(params) {
  const body = {
    maker: params.maker,
    payer: params.maker,
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    params: {
      makingAmount: params.makingAmount,
      takingAmount: params.takingAmount,
    },
    computeUnitPrice: "auto",
  };
  if (params.expiredAt) body.expiredAt = params.expiredAt;
  return jupFetch(`${BASE}/createOrder`, { method: "POST", body: JSON.stringify(body) });
}

// GET /trigger/v1/getTriggerOrders?user=...&orderStatus=active
async function getOpenOrders(wallet) {
  const key = `jup_trigger_orders_${wallet}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const data = await jupFetch(`${BASE}/getTriggerOrders?user=${wallet}&orderStatus=active`);
  const orders = data.orders || [];
  cache.set(key, orders, 10);
  return orders;
}

// GET /trigger/v1/getTriggerOrders?user=...&orderStatus=history
async function getOrderHistory(wallet, page = 1) {
  const key = `jup_trigger_history_${wallet}_${page}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const data = await jupFetch(`${BASE}/getTriggerOrders?user=${wallet}&orderStatus=history&page=${page}`);
  cache.set(key, data, 30);
  return data;
}

// POST /trigger/v1/cancelOrder
async function cancelOrders(maker, orderKeys) {
  // V1 API cancels one at a time — batch them
  const txs = [];
  for (const orderKey of orderKeys) {
    const data = await jupFetch(`${BASE}/cancelOrder`, {
      method: "POST",
      body: JSON.stringify({ maker, orderKey, computeUnitPrice: "auto" }),
    });
    if (data.transaction) txs.push(data.transaction);
  }
  return { txs };
}

module.exports = {
  createOrder,
  getOpenOrders,
  getOrderHistory,
  cancelOrders,
};
