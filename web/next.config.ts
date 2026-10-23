import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Phone hits the app via Cloudflare tunnel — allow that host in dev
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "replied-critics-activities-station.trycloudflare.com",
  ],
  turbopack: {
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
