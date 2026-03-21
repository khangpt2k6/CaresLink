import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "puppeteer", "@huggingface/transformers"],
};

export default nextConfig;
