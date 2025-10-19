import { PrismaClient } from '@prisma/client'

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const env = (
  (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {}
);

// Create a single Prisma instance with optimized settings for pgBouncer
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: env.DATABASE_URL,
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