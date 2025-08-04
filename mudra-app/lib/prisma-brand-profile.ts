import { PrismaClient } from '@prisma/client'

// Create a function that returns a fresh Prisma client for each operation
function createFreshPrismaClient() {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: ['query', 'info', 'warn', 'error'],
  })
}

function serializeProfile(profile: any) {
  // Convert competitors/resources to string for PostgreSQL
  return {
    ...profile,
    competitors: Array.isArray(profile.competitors) ? profile.competitors.join(",") : profile.competitors || "",
    resources: typeof profile.resources === "object" ? JSON.stringify(profile.resources) : profile.resources || ""
  };
}

function deserializeProfile(dbProfile: any) {
  return {
    ...dbProfile,
    competitors: dbProfile.competitors ? dbProfile.competitors.split(",") : [],
    resources: dbProfile.resources ? JSON.parse(dbProfile.resources) : {}
  };
}

export async function getBrandProfile() {
  const prisma = createFreshPrismaClient()
  try {
    const dbProfile = await prisma.brandProfile.findFirst({ orderBy: { updatedAt: "desc" } });
    return dbProfile ? deserializeProfile(dbProfile) : null;
  } finally {
    await prisma.$disconnect()
  }
}

export async function saveBrandProfile(profile: any) {
  const prisma = createFreshPrismaClient()
  try {
    const data = serializeProfile(profile);
    const existing = await prisma.brandProfile.findFirst();
    if (existing) {
      const updated = await prisma.brandProfile.update({ where: { id: existing.id }, data });
      return deserializeProfile(updated);
    } else {
      const created = await prisma.brandProfile.create({ data });
      return deserializeProfile(created);
    }
  } finally {
    await prisma.$disconnect()
  }
}
