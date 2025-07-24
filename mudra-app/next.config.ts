import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignore ESLint during builds to prevent build failures from generated files
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Speed up development builds
  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-avatar',
      '@radix-ui/react-dropdown-menu', 
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      'recharts',
      'lucide-react'
    ],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Speed up development builds
      config.optimization = {
        ...config.optimization,
        usedExports: false,
        sideEffects: false,
      }
    }
    return config
  },
};

export default nextConfig;
