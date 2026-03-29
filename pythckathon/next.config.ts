import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.coingecko.com" },
      { protocol: "https", hostname: "coin-images.coingecko.com" },
      { protocol: "https", hostname: "logo.clearbit.com" },
      { protocol: "https", hostname: "www.google.com" },
      { protocol: "https", hostname: "assets.coincap.io" },
      { protocol: "https", hostname: "flagcdn.com" },
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "static.jup.ag" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "arweave.net" },
      { protocol: "https", hostname: "**.pyth.network" },
      { protocol: "https", hostname: "app.meteora.ag" },
      { protocol: "https", hostname: "metadata.jito.network" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 3600,
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 24, 32, 48, 64, 96],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "motion/react", "react-sparklines"],
  },
  async rewrites() {
    // Must match where Express runs in production (same VPS: 127.0.0.1:4000, or split: https://api.yourdomain.com).
    // Hardcoded localhost breaks hosted Next when the API is on another host or not reachable from the Next process.
    const backend = (process.env.BACKEND_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
    return [
      {
        source: "/api/cryptoserve/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/:path*.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
