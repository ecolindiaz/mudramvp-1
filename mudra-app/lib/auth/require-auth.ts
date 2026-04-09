/**
 * Authentication utilities for API routes
 * Provides helper functions to require and validate user sessions
 */

import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { getDefaultBrandProfileIdForUser, getUserBrandAccessRole } from '@/lib/services/team-members.service';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string | null;
  brandProfileId?: number | null;
}

export type BrandAccessRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export type AuthResult = {
  success: true;
  user: AuthenticatedUser;
} | {
  success: false;
  response: NextResponse;
}

/**
 * Require authentication for an API route
 * Returns the authenticated user or an error response
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      ),
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      name: true,
    }
  });

  if (!user) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: { message: 'User not found', code: 'USER_NOT_FOUND' } },
        { status: 401 }
      ),
    };
  }

  const defaultBrandProfileId = await getDefaultBrandProfileIdForUser(user.id)

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email!,
      name: user.name,
      brandProfileId: defaultBrandProfileId,
    },
  };
}

/**
 * Verify that the user has access to the specified brandProfileId
 * Use this to prevent cross-user data access
 */
export async function verifyBrandProfileAccess(
  user: AuthenticatedUser,
  requestedBrandProfileId: number
): Promise<{ allowed: boolean; response?: NextResponse; role?: BrandAccessRole }> {
  // Verify brand profile exists first
  const brandProfile = await prisma.brandProfile.findUnique({
    where: { id: requestedBrandProfileId },
    select: { id: true }
  });

  if (!brandProfile) {
    return {
      allowed: false,
      response: NextResponse.json(
        { success: false, error: { message: 'Brand profile not found', code: 'NOT_FOUND' } },
        { status: 404 }
      ),
    };
  }

  const role = await getUserBrandAccessRole(user.id, requestedBrandProfileId)

  if (!role) {
    return {
      allowed: false,
      response: NextResponse.json(
        { success: false, error: { message: 'Access denied', code: 'FORBIDDEN' } },
        { status: 403 }
      ),
    };
  }

  return { allowed: true, role };
}

/**
 * Combined helper: require auth and verify brand profile access
 */
export async function requireAuthWithBrandAccess(
  brandProfileId: number | string | null | undefined
): Promise<AuthResult & { brandProfileId?: number; accessRole?: BrandAccessRole }> {
  const authResult = await requireAuth();
  
  if (!authResult.success) {
    return authResult;
  }

  // If no brandProfileId provided, use the user's default
  if (brandProfileId === null || brandProfileId === undefined) {
    if (!authResult.user.brandProfileId) {
      return {
        success: false,
        response: NextResponse.json(
          { success: false, error: { message: 'No brand profile found', code: 'NO_BRAND_PROFILE' } },
          { status: 400 }
        ),
      };
    }

    const accessResult = await verifyBrandProfileAccess(authResult.user, authResult.user.brandProfileId)
    if (!accessResult.allowed) {
      return {
        success: false,
        response: accessResult.response!,
      }
    }

    return {
      ...authResult,
      brandProfileId: authResult.user.brandProfileId,
      accessRole: accessResult.role,
    };
  }

  // Parse brandProfileId if it's a string
  const parsedId = typeof brandProfileId === 'string' 
    ? parseInt(brandProfileId, 10) 
    : brandProfileId;

  if (isNaN(parsedId)) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: { message: 'Invalid brandProfileId', code: 'INVALID_ID' } },
        { status: 400 }
      ),
    };
  }

  // Verify access
  const accessResult = await verifyBrandProfileAccess(authResult.user, parsedId);
  
  if (!accessResult.allowed) {
    return {
      success: false,
      response: accessResult.response!,
    };
  }

  return {
    ...authResult,
    brandProfileId: parsedId,
    accessRole: accessResult.role,
  };
}

/**
 * Validate a cron job secret
 * Used for scheduled tasks that need to bypass user authentication
 * Returns boolean - for simple use cases
 */
export function validateCronSecret(authHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    console.error('[Auth] CRON_SECRET not configured');
    return false;
  }

  if (!authHeader) {
    return false;
  }

  // Support both "Bearer {secret}" and raw secret
  const providedSecret = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;

  const hashA = crypto.createHash('sha256').update(providedSecret).digest();
  const hashB = crypto.createHash('sha256').update(cronSecret).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Validate cron secret from request - returns full result with status
 * Used when you need to return proper HTTP responses
 */
export function validateCronSecretFromRequest(request: Request): 
  { success: true } | { success: false; error: string; status: number } {
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    return { success: false, error: 'CRON_SECRET not configured', status: 500 };
  }

  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return { success: false, error: 'Authorization header required', status: 401 };
  }

  const providedSecret = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;

  const hashA2 = crypto.createHash('sha256').update(providedSecret).digest();
  const hashB2 = crypto.createHash('sha256').update(cronSecret).digest();
  if (!crypto.timingSafeEqual(hashA2, hashB2)) {
    return { success: false, error: 'Invalid CRON_SECRET', status: 401 };
  }

  return { success: true };
}

/**
 * Validate internal API secret for service-to-service calls
 */
export function validateInternalApiSecret(authHeader: string | null): boolean {
  const apiSecret = process.env.INTERNAL_API_SECRET;
  
  if (!apiSecret) {
    console.error('[Auth] INTERNAL_API_SECRET not configured');
    return false;
  }

  if (!authHeader) {
    return false;
  }

  const providedSecret = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;

  const hashC = crypto.createHash('sha256').update(providedSecret).digest();
  const hashD = crypto.createHash('sha256').update(apiSecret).digest();
  return crypto.timingSafeEqual(hashC, hashD);
}
