const { getPool } = require("../config/database");

async function list(req, res, next) {
  try {
    const wallet = req.headers["x-wallet-address"];
    if (!wallet) return res.status(400).json({ error: "Wallet address required" });
    const pool = getPool();
    const [rows] = await pool.execute(
      "SELECT id, coin_id, symbol, target_price, direction, triggered, triggered_at, created_at FROM alerts WHERE wallet = ? ORDER BY created_at DESC",
      [wallet]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const wallet = req.headers["x-wallet-address"];
    if (!wallet) return res.status(400).json({ error: "Wallet address required" });
    const { coinId, symbol, targetPrice, direction } = req.body;
    if (!coinId || !targetPrice) return res.status(400).json({ error: "coinId and targetPrice required" });
    const pool = getPool();
    const [result] = await pool.execute(
      "INSERT INTO alerts (wallet, coin_id, symbol, target_price, direction) VALUES (?, ?, ?, ?, ?)",
      [wallet, coinId, symbol || "", targetPrice, direction || "above"]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const wallet = req.headers["x-wallet-address"];
    if (!wallet) return res.status(400).json({ error: "Wallet address required" });
    const { id } = req.params;
    const pool = getPool();
    await pool.execute("DELETE FROM alerts WHERE id = ? AND wallet = ?", [id, wallet]);
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function trigger(req, res, next) {
  try {
    const wallet = req.headers["x-wallet-address"];
    if (!wallet) return res.status(400).json({ error: "Wallet address required" });
    const { id } = req.params;
    const pool = getPool();
    await pool.execute(
      "UPDATE alerts SET triggered = 1, triggered_at = NOW() WHERE id = ? AND wallet = ?",
      [id, wallet]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { list, create, remove, trigger };
