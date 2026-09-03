import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ["jose"],
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions || {}),
        ignored: /[\\/]\.(git|next|node_modules)[\\/]/,
      };
    }
    return config;
  },
};

export default nextConfig;