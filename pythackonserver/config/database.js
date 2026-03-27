const mysql = require("mysql2/promise");

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || "localhost",
      port: parseInt(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "",
      database: process.env.MYSQL_DATABASE || "pythfeeds",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
  }
  return pool;
}

const MIGRATIONS = [
  // watchlists
  `CREATE TABLE IF NOT EXISTS watchlists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    wallet VARCHAR(64) NOT NULL,
    coin_id VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL DEFAULT '',
    name VARCHAR(100) NOT NULL DEFAULT '',
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wallet_coin (wallet, coin_id),
    INDEX idx_wallet (wallet)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // alerts
  `CREATE TABLE IF NOT EXISTS alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    wallet VARCHAR(64) NOT NULL,
    coin_id VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL DEFAULT '',
    target_price DOUBLE NOT NULL,
    direction ENUM('above','below') NOT NULL DEFAULT 'above',
    triggered TINYINT(1) NOT NULL DEFAULT 0,
    triggered_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wallet (wallet),
    INDEX idx_active (wallet, triggered)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // portfolio snapshots (daily value tracking)
  `CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    wallet VARCHAR(64) NOT NULL,
    total_value_usd DOUBLE NOT NULL DEFAULT 0,
    snapshot_date DATE NOT NULL,
    holdings JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wallet_date (wallet, snapshot_date),
    INDEX idx_wallet (wallet)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // user data (JSON blobs for watchlists, settings, etc.)
  `CREATE TABLE IF NOT EXISTS user_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    wallet VARCHAR(64) NOT NULL,
    data_key VARCHAR(50) NOT NULL,
    data_value LONGTEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wallet_key (wallet, data_key),
    INDEX idx_wallet (wallet)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // AI cache (global digests, asset analyses — shared across all users)
  `CREATE TABLE IF NOT EXISTS ai_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cache_key VARCHAR(200) NOT NULL,
    content LONGTEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cache_key (cache_key),
    INDEX idx_expires (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // polls (persistent voting)
  `CREATE TABLE IF NOT EXISTS poll_votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    wallet VARCHAR(64) DEFAULT NULL,
    session_id VARCHAR(64) NOT NULL,
    asset_id VARCHAR(50) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    vote ENUM('bull','bear') NOT NULL,
    vote_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_session_asset_tf_date (session_id, asset_id, timeframe, vote_date),
    INDEX idx_asset_tf_date (asset_id, timeframe, vote_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

async function initDatabase() {
  try {
    // Create database if it doesn't exist
    const conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST || "localhost",
      port: parseInt(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "",
    });
    await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${process.env.MYSQL_DATABASE || "pythfeeds"}\``);
    await conn.end();

    // Run migrations
    const p = getPool();
    for (const sql of MIGRATIONS) {
      await p.execute(sql);
    }
    console.log("[MySQL] Database initialized, all tables ready");
    return true;
  } catch (err) {
    console.warn("[MySQL] Database not available, running without persistence:", err.message);
    return false;
  }
}

module.exports = { getPool, initDatabase };
