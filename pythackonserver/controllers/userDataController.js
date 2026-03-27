const { getPool } = require("../config/database");

// GET /api/user-data/:key
async function get(req, res, next) {
  try {
    const wallet = req.headers["x-wallet-address"];
    if (!wallet) return res.status(400).json({ error: "Wallet address required" });
    const { key } = req.params;
    if (!key) return res.status(400).json({ error: "Key required" });
    const pool = getPool();
    const [rows] = await pool.execute(
      "SELECT data_value FROM user_data WHERE wallet = ? AND data_key = ?",
      [wallet, key]
    );
    if (rows.length === 0) return res.json(null);
    try {
      res.json(JSON.parse(rows[0].data_value));
    } catch {
      res.json(rows[0].data_value);
    }
  } catch (err) { next(err); }
}

// PUT /api/user-data/:key
async function put(req, res, next) {
  try {
    const wallet = req.headers["x-wallet-address"];
    if (!wallet) return res.status(400).json({ error: "Wallet address required" });
    const { key } = req.params;
    if (!key) return res.status(400).json({ error: "Key required" });
    const value = JSON.stringify(req.body.value);
    const pool = getPool();
    await pool.execute(
      `INSERT INTO user_data (wallet, data_key, data_value)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE data_value = VALUES(data_value)`,
      [wallet, key, value]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
}

// DELETE /api/user-data/:key
async function remove(req, res, next) {
  try {
    const wallet = req.headers["x-wallet-address"];
    if (!wallet) return res.status(400).json({ error: "Wallet address required" });
    const { key } = req.params;
    const pool = getPool();
    await pool.execute("DELETE FROM user_data WHERE wallet = ? AND data_key = ?", [wallet, key]);
    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { get, put, remove };
