import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@just-plan/plan-schema"],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
