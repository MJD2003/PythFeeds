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
      // ~8GB VPS: leave headroom for MySQL/nginx/OS; raise if you still see PM2 memory restarts in logs
      max_memory_restart: "3G",
      min_uptime: "10s",
      max_restarts: 15,
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
        PORT: 4000,
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
      max_memory_restart: "2G",
      min_uptime: "10s",
      max_restarts: 15,
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        BACKEND_URL: "http://127.0.0.1:4000",
      },
    },
  ],
};
