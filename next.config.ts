import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
