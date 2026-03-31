/**
 * PM2: run from repo root, e.g. `pm2 start ecosystem.config.js`
 * Secrets live in pythackonserver/.env (loaded by server.js). Only non-secret defaults here.
 * After editing .env: `pm2 restart pythfeeds-backend --update-env` (or restart all with --update-env).
 */
module.exports = {
  apps: [
    {
      name: "pythfeeds-backend",
      cwd: "./pythackonserver",
      script: "server.js",
      exec_mode: "fork",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      error_file: "./logs/backend-error.log",
      out_file: "./logs/backend-out.log",
      autorestart: true,
      min_uptime: "10s",
      max_restarts: 0,           // 0 = unlimited — never permanently stop the backend
      restart_delay: 5000,
      exp_backoff_restart_delay: 1000,  // PM2 exponential backoff: 1s, 2s, 4s, 8s… between rapid restarts
      // Reduced memory limits for VPS — leave headroom for MySQL + nginx + OS
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
        GEMINI_ENABLED: "false",  // Set to "true" when you have a paid Gemini API plan
        FRONTEND_URL:
          "https://pythfeeds.com,https://www.pythfeeds.com,http://localhost:3000",
      },
    },
    {
      name: "pythfeeds-frontend",
      cwd: "./pythckathon",
      script: "node_modules/.bin/next",
      args: "start",
      exec_mode: "fork",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      error_file: "./logs/frontend-error.log",
      out_file: "./logs/frontend-out.log",
      autorestart: true,
      max_memory_restart: "512M",
      min_uptime: "10s",
      max_restarts: 0,           // 0 = unlimited
      restart_delay: 5000,
      exp_backoff_restart_delay: 1000,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        BACKEND_URL: "http://127.0.0.1:4000",
      },
    },
  ],
};
