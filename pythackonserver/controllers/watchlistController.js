const { getPool } = require("../config/database");

async function list(req, res, next) {
  try {
    const wallet = req.headers["x-wallet-address"];
    if (!wallet) return res.status(400).json({ error: "Wallet address required" });
    const pool = getPool();
    const [rows] = await pool.execute(
      "SELECT coin_id, symbol, name, added_at FROM watchlists WHERE wallet = ? ORDER BY added_at DESC",
      [wallet]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function add(req, res, next) {
  try {
    const wallet = req.headers["x-wallet-address"];
    if (!wallet) return res.status(400).json({ error: "Wallet address required" });
    const { coinId, symbol, name } = req.body;
    if (!coinId) return res.status(400).json({ error: "coinId required" });
    const pool = getPool();
    await pool.execute(
      "INSERT IGNORE INTO watchlists (wallet, coin_id, symbol, name) VALUES (?, ?, ?, ?)",
      [wallet, coinId, symbol || "", name || ""]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const wallet = req.headers["x-wallet-address"];
    if (!wallet) return res.status(400).json({ error: "Wallet address required" });
    const { coinId } = req.params;
    if (!coinId) return res.status(400).json({ error: "coinId required" });
    const pool = getPool();
    await pool.execute("DELETE FROM watchlists WHERE wallet = ? AND coin_id = ?", [wallet, coinId]);
    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { list, add, remove };
