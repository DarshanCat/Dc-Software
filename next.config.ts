import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions || {}),
        ignored: [
          "**/.git/**",
          "**/.next/**",
          "**/node_modules/**",
          "C:/**",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;