import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignore ESLint during builds to prevent build failures from generated files
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Skip initial page compilation in development
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 2,
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
  // Turbopack configuration (moved from experimental)
  turbopack: {
    rules: {
      // Turbopack optimization rules can be added here if needed
    },
  },
};

export default nextConfig;
