const { getPool } = require("../config/database");

// GET /api/polls/results?assetId=bitcoin&timeframe=24H
async function results(req, res, next) {
  try {
    const { assetId, timeframe } = req.query;
    if (!assetId || !timeframe) return res.status(400).json({ error: "assetId and timeframe required" });
    const today = new Date().toISOString().slice(0, 10);
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT vote, COUNT(*) as cnt FROM poll_votes
       WHERE asset_id = ? AND timeframe = ? AND vote_date = ?
       GROUP BY vote`,
      [assetId, timeframe, today]
    );
    let bullish = 0, bearish = 0;
    for (const r of rows) {
      if (r.vote === "bull") bullish = r.cnt;
      else if (r.vote === "bear") bearish = r.cnt;
    }
    // Check if current session already voted
    const sessionId = req.headers["x-session-id"] || "";
    let voted = null;
    if (sessionId) {
      const [vr] = await pool.execute(
        "SELECT vote FROM poll_votes WHERE session_id = ? AND asset_id = ? AND timeframe = ? AND vote_date = ?",
        [sessionId, assetId, timeframe, today]
      );
      if (vr.length > 0) voted = vr[0].vote;
    }
    res.json({ bullish, bearish, voted });
  } catch (err) { next(err); }
}

// POST /api/polls/vote
async function vote(req, res, next) {
  try {
    const sessionId = req.headers["x-session-id"];
    if (!sessionId) return res.status(400).json({ error: "Session ID required (x-session-id header)" });
    const wallet = req.headers["x-wallet-address"] || null;
    const { assetId, timeframe, side } = req.body;
    if (!assetId || !timeframe || !side) return res.status(400).json({ error: "assetId, timeframe, side required" });
    if (!["bull", "bear"].includes(side)) return res.status(400).json({ error: "side must be bull or bear" });
    const today = new Date().toISOString().slice(0, 10);
    const pool = getPool();
    try {
      await pool.execute(
        "INSERT INTO poll_votes (wallet, session_id, asset_id, timeframe, vote, vote_date) VALUES (?, ?, ?, ?, ?, ?)",
        [wallet, sessionId, assetId, timeframe, side, today]
      );
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Already voted" });
      throw err;
    }
    // Return updated counts
    const [rows] = await pool.execute(
      `SELECT vote, COUNT(*) as cnt FROM poll_votes
       WHERE asset_id = ? AND timeframe = ? AND vote_date = ?
       GROUP BY vote`,
      [assetId, timeframe, today]
    );
    let bullish = 0, bearish = 0;
    for (const r of rows) {
      if (r.vote === "bull") bullish = r.cnt;
      else if (r.vote === "bear") bearish = r.cnt;
    }
    res.json({ success: true, bullish, bearish, voted: side });
  } catch (err) { next(err); }
}

// GET /api/polls/batch-results?assets=bitcoin,ethereum&timeframe=24H
async function batchResults(req, res, next) {
  try {
    const { assets, timeframe } = req.query;
    if (!assets || !timeframe) return res.status(400).json({ error: "assets and timeframe required" });
    const assetList = assets.split(",").filter(Boolean);
    if (!assetList.length) return res.json({});
    const today = new Date().toISOString().slice(0, 10);
    const pool = getPool();
    const placeholders = assetList.map(() => "?").join(",");
    const [rows] = await pool.execute(
      `SELECT asset_id, vote, COUNT(*) as cnt FROM poll_votes
       WHERE asset_id IN (${placeholders}) AND timeframe = ? AND vote_date = ?
       GROUP BY asset_id, vote`,
      [...assetList, timeframe, today]
    );
    const result = {};
    for (const id of assetList) result[id] = { bullish: 0, bearish: 0, voted: null };
    for (const r of rows) {
      if (r.vote === "bull") result[r.asset_id].bullish = r.cnt;
      else if (r.vote === "bear") result[r.asset_id].bearish = r.cnt;
    }
    // Check session votes
    const sessionId = req.headers["x-session-id"] || "";
    if (sessionId) {
      const [vr] = await pool.execute(
        `SELECT asset_id, vote FROM poll_votes
         WHERE session_id = ? AND asset_id IN (${placeholders}) AND timeframe = ? AND vote_date = ?`,
        [sessionId, ...assetList, timeframe, today]
      );
      for (const v of vr) result[v.asset_id].voted = v.vote;
    }
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { results, vote, batchResults };
