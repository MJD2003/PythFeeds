const { getPool } = require("../config/database");

// GET /api/portfolio/snapshots?days=30
async function listSnapshots(req, res, next) {
  try {
    const wallet = req.headers["x-wallet-address"];
    if (!wallet) return res.status(400).json({ error: "Wallet address required" });
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT total_value_usd, snapshot_date, holdings FROM portfolio_snapshots
       WHERE wallet = ? AND snapshot_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       ORDER BY snapshot_date ASC`,
      [wallet, days]
    );
    // Parse holdings JSON
    const parsed = rows.map((r) => ({
      totalValueUsd: r.total_value_usd,
      snapshotDate: r.snapshot_date,
      holdings: typeof r.holdings === "string" ? JSON.parse(r.holdings) : r.holdings,
    }));
    res.json(parsed);
  } catch (err) { next(err); }
}

// POST /api/portfolio/snapshot
async function saveSnapshot(req, res, next) {
  try {
    const wallet = req.headers["x-wallet-address"];
    if (!wallet) return res.status(400).json({ error: "Wallet address required" });
    const { totalValueUsd, holdings } = req.body;
    if (totalValueUsd === undefined) return res.status(400).json({ error: "totalValueUsd required" });
    const today = new Date().toISOString().slice(0, 10);
    const pool = getPool();
    await pool.execute(
      `INSERT INTO portfolio_snapshots (wallet, total_value_usd, snapshot_date, holdings)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE total_value_usd = VALUES(total_value_usd), holdings = VALUES(holdings)`,
      [wallet, totalValueUsd, today, JSON.stringify(holdings || [])]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { listSnapshots, saveSnapshot };
