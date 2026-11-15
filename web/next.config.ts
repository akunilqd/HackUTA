import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: __dirname, // HackUTA/ has its own lockfile; keep the web app self-contained
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
