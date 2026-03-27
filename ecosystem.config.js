module.exports = {
  apps: [
    {
      name: "pythfeeds-backend",
      cwd: "./pythackonserver",
      script: "server.js",
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
        FRONTEND_URL: "https://pythfeeds.com",
      },
    },
    {
      name: "pythfeeds-frontend",
      cwd: "./pythckathon",
      script: "node_modules/.bin/next",
      args: "start",
      instances: 1,
      autorestart: true,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        BACKEND_URL: "http://localhost:4000",
      },
    },
  ],
};
