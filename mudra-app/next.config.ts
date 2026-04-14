import type { NextConfig } from "next";

const POSTHOG_HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/+$/, "");

const nextConfig: NextConfig = {
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
  async rewrites() {
    return [
      {
        source: "/ingest/:path*",
        destination: `${POSTHOG_HOST}/:path*`,
      },
    ];
  },
  // Webpack configuration for file watching
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // FORCE polling mode to avoid ENOMEM errors in Docker
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/.git/**',
          '**/docs/**',
          '**/scripts/**',
          '**/llm/**',
          '**/*.md',
          '**/*.log',
          '**/coverage/**',
          '**/dist/**',
          '**/build/**',
          '**/.prisma/**',
          '**/prisma/migrations/**',
          '**/*.js.map',
          '**/check-*.js',
          '**/test-*.js',
          '**/debug-*.js',
        ],
        aggregateTimeout: 2000,
        poll: 3000, // Poll every 3 seconds
        followSymlinks: false,
      };
      // Disable native file watching completely
      config.snapshot = {
        ...config.snapshot,
        managedPaths: [],
        immutablePaths: [],
      };
    }
    return config;
  },
};

export default nextConfig;
