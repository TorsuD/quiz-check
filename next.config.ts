import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    // PDF uploads pass through proxy.ts, which buffers request bodies up to this size.
    proxyClientMaxBodySize: "10mb",
  },
  cacheComponents: true,
  partialPrefetching: true,
  // pdf-parse ships pdf.js, and @napi-rs/canvas is a native module: load both with native require instead of bundling.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
