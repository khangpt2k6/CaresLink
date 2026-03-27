import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdf-parse",
    "puppeteer",
    "puppeteer-extra",
    "puppeteer-extra-plugin-stealth",
    "adm-zip",
    "@huggingface/transformers",
  ],
};

export default nextConfig;
