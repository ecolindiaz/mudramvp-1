import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiTokens } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

export interface ApiTokenPayload {
  userId: string;
  tokenId: string;
  scopes: string[];
}

// Hash token for comparison
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Validate API token from Authorization header
export async function validateApiToken(request: NextRequest): Promise<ApiTokenPayload | null> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  
  if (!token.startsWith('fsg_')) {
    return null; // Not a Fire SaaS Geo API token
  }

  try {
    const hashedToken = hashToken(token);
    
    const apiToken = await db.query.apiTokens.findFirst({
      where: and(
        eq(apiTokens.token, hashedToken),
        eq(apiTokens.isActive, true)
      ),
    });

    if (!apiToken) {
      return null;
    }

    // Check if token is expired
    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      return null;
    }

    // Update last used timestamp
    await db.update(apiTokens)
      .set({ lastUsed: new Date() })
      .where(eq(apiTokens.id, apiToken.id));

    return {
      userId: apiToken.userId,
      tokenId: apiToken.id,
      scopes: Array.isArray(apiToken.scopes) ? apiToken.scopes as string[] : [],
    };

  } catch (error) {
    console.error('API token validation error:', error);
    return null;
  }
}

// Check if token has required scope
export function hasScope(tokenPayload: ApiTokenPayload, requiredScope: string): boolean {
  return tokenPayload.scopes.includes(requiredScope);
}

// Middleware for API routes that require token authentication
export async function requireApiToken(
  request: NextRequest, 
  requiredScope?: string
): Promise<ApiTokenPayload> {
  const tokenPayload = await validateApiToken(request);
  
  if (!tokenPayload) {
    throw new Error('Invalid or missing API token');
  }

  if (requiredScope && !hasScope(tokenPayload, requiredScope)) {
    throw new Error(`Insufficient permissions. Required scope: ${requiredScope}`);
  }

  return tokenPayload;
}
