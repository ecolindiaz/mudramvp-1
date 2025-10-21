import { PrismaClient } from '@prisma/client'
import path from 'path'

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const env = (
  (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {}
);

// Convert relative SQLite paths to absolute paths for API routes
const getDatabaseUrl = () => {
  const envUrl = env.DATABASE_URL || '';
  
  // If it's a remote database or already absolute, use as-is
  if (envUrl.startsWith('postgresql://') || envUrl.startsWith('postgres://') || path.isAbsolute(envUrl)) {
    return envUrl;
  }
  
  // For SQLite file:// URLs, convert to absolute path
  if (envUrl.startsWith('file:')) {
    const relativePath = envUrl.replace('file:', '');
    const absolutePath = path.resolve(process.cwd(), relativePath);
    return `file:${absolutePath}`;
  }
  
  return envUrl;
};

// Create a single Prisma instance with absolute path support
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
  log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

// Store the instance globally in development to prevent hot-reload issues
if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Graceful shutdown handling
if (typeof window === 'undefined') {
  const processObj = (globalThis as unknown as { process?: { on: Function } }).process;
  if (processObj) {
    processObj.on('beforeExit', async () => {
      await prisma.$disconnect()
    })
  }
}