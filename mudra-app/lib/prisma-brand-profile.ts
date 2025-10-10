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
    
    // Remove id: 0 from data to prevent invalid updates
    if (data.id === 0) {
      delete data.id;
    }
    
    const existing = await prisma.brandProfile.findFirst();
    
    if (existing) {
      // Update existing profile
      console.log("🟢 [saveBrandProfile] Updating existing profile with ID:", existing.id);
      const updated = await prisma.brandProfile.update({ where: { id: existing.id }, data });
      return deserializeProfile(updated);
    } else {
      // Create new profile
      console.log("🟢 [saveBrandProfile] Creating new brand profile...");
      
      try {
        let userIdToUse = profile.userId;
        
        // If userId is provided from onboarding, use it
        if (userIdToUse) {
          console.log("🟢 [saveBrandProfile] Using provided userId:", userIdToUse);
        } else {
          // Legacy: create user if no userId provided
          const userEmail = profile.companyWebsite 
            ? `user@${new URL(profile.companyWebsite).hostname}`
            : `user-${Date.now()}@mudra.app`;
          
          const userName = profile.userName || profile.companyName || 'New User';
          
          const user = await prisma.user.create({
            data: {
              email: userEmail,
              name: userName,
            }
          });
          
          userIdToUse = user.id;
          console.log("🟢 [saveBrandProfile] Created user with ID:", user.id);
        }
        
        // Create brand profile with userId
        const created = await prisma.brandProfile.create({ 
          data: {
            ...data,
            userId: userIdToUse,
          }
        });
        
        console.log("🟢 [saveBrandProfile] Created brand profile with ID:", created.id, "linked to user:", userIdToUse);
        
        return deserializeProfile(created);
      } catch (userError: any) {
        // If userId column doesn't exist yet, create without it
        console.warn("⚠️ [saveBrandProfile] Could not create with userId (schema not migrated yet), creating without:", userError.message);
        const created = await prisma.brandProfile.create({ data });
        console.log("🟢 [saveBrandProfile] Created brand profile with ID:", created.id);
        return deserializeProfile(created);
      }
    }
  } catch (error) {
    console.error("🔴 [saveBrandProfile] Error saving brand profile:", error);
    throw error;
  } finally {
    await prisma.$disconnect()
  }
}
