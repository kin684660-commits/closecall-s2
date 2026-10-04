import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["node:sqlite"],
  poweredByHeader: false,
  experimental: { cpus: 1, webpackMemoryOptimizations: true },
};
export default config;
