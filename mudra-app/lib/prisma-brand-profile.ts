import { prisma } from './prisma'

// Export prisma instance for other modules
export { prisma }

function serializeProfile(profile: any) {
  // Convert competitors/resources to string for PostgreSQL
  return {
    ...profile,
    competitors: Array.isArray(profile.competitors) ? profile.competitors.join(",") : profile.competitors || "",
    resources: typeof profile.resources === "object" ? JSON.stringify(profile.resources) : profile.resources || ""
  };
}

function deserializeProfile(dbProfile: any) {
  // Safely parse resources - it might be JSON or a plain string
  let parsedResources = {};
  if (dbProfile.resources) {
    try {
      // Try to parse as JSON first
      parsedResources = JSON.parse(dbProfile.resources);
    } catch {
      // If it's not valid JSON, keep it as a string value
      parsedResources = dbProfile.resources;
    }
  }

  return {
    ...dbProfile,
    competitors: dbProfile.competitors ? dbProfile.competitors.split(",") : [],
    resources: parsedResources
  };
}

/**
 * Get brand profile for a specific user (authenticated)
 * Also handles migration: if user has no profile but an orphaned profile exists,
 * it will link and return it.
 */
export async function getBrandProfileByUserId(userId: string) {
  // First, try to find a profile already linked to this user
  let dbProfile = await prisma.brandProfile.findFirst({ 
    where: {
      userId: userId,
      id: {
        not: 0
      }
    },
    orderBy: { updatedAt: "desc" } 
  });
  
  // If no profile found, check if there's an orphaned profile we can link
  // This handles migration from pre-auth profiles
  if (!dbProfile) {
    console.log("🔍 [getBrandProfileByUserId] No profile found for user, checking for orphaned profiles...");
    
    // Find profile without userId (orphaned) - prioritize most recently updated
    const orphanedProfile = await prisma.brandProfile.findFirst({
      where: {
        userId: null,
        id: {
          not: 0
        }
      },
      orderBy: { updatedAt: "desc" }
    });
    
    if (orphanedProfile) {
      console.log("🔗 [getBrandProfileByUserId] Found orphaned profile ID:", orphanedProfile.id, "- linking to user:", userId);
      // Link the orphaned profile to this user
      dbProfile = await prisma.brandProfile.update({
        where: { id: orphanedProfile.id },
        data: { userId: userId }
      });
    }
  }
  
  return dbProfile ? deserializeProfile(dbProfile) : null;
}

/**
 * Save/update brand profile for a specific user (authenticated)
 */
export async function saveBrandProfileForUser(userId: string, profile: any) {
  const data = serializeProfile(profile);
  
  // Remove id: 0 from data to prevent invalid updates
  if (data.id === 0) {
    delete data.id;
  }
  
  // Find existing profile for this user
  const existing = await prisma.brandProfile.findFirst({
    where: {
      userId: userId,
      id: {
        not: 0
      }
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });
  
  if (existing && existing.id > 0) {
    // Update existing profile
    console.log("🟢 [saveBrandProfileForUser] Updating profile ID:", existing.id, "for user:", userId);
    const updated = await prisma.brandProfile.update({ 
      where: { id: existing.id }, 
      data: { ...data, userId } 
    });
    return deserializeProfile(updated);
  } else {
    // Create new profile for this user
    console.log("🟢 [saveBrandProfileForUser] Creating new profile for user:", userId);
    
    // Generate unique siteId for tracking
    const crypto = require('crypto');
    const siteId = `site_${crypto.randomBytes(16).toString('hex')}`;
    
    const created = await prisma.brandProfile.create({ 
      data: {
        ...data,
        userId,
        siteId,
      }
    });
    return deserializeProfile(created);
  }
}

// Legacy function - kept for backward compatibility during migration
export async function getBrandProfile() {
  const dbProfile = await prisma.brandProfile.findFirst({ 
    where: {
      id: {
        not: 0
      }
    },
    orderBy: { updatedAt: "desc" } 
  });
  return dbProfile ? deserializeProfile(dbProfile) : null;
}

export async function saveBrandProfile(profile: any) {
  const data = serializeProfile(profile);
  
  // Remove id: 0 from data to prevent invalid updates
  if (data.id === 0) {
    delete data.id;
  }
  
  // Find existing profile (exclude any invalid id=0 records)
  const existing = await prisma.brandProfile.findFirst({
    where: {
      id: {
        not: 0
      }
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });
  
  if (existing && existing.id > 0) {
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
}