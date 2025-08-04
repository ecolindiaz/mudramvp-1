import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { apiTokens } from '@/lib/db/api-tokens-schema';
import { eq } from 'drizzle-orm';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/api-errors';
import crypto from 'crypto';

// Generate a secure API token
function generateApiToken(): string {
  const prefix = 'fsg_'; // Fire SaaS Geo prefix
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `${prefix}${randomBytes}`;
}

// Hash token for storage
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// POST /api/auth/tokens - Create a new API token
export async function POST(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to create API tokens');
    }

    const { name, scopes, expiresAt } = await request.json();

    if (!name || !scopes || !Array.isArray(scopes)) {
      throw new ValidationError('Invalid token configuration', {
        name: !name ? 'Token name is required' : '',
        scopes: !scopes || !Array.isArray(scopes) ? 'Scopes array is required' : '',
      });
    }

    // Validate scopes
    const validScopes = [
      'metrics:read',
      'analyses:read', 
      'analyses:write',
      'webhooks:manage',
      'chat:read',
      'chat:write'
    ];

    const invalidScopes = scopes.filter(scope => !validScopes.includes(scope));
    if (invalidScopes.length > 0) {
      throw new ValidationError('Invalid scopes', {
        scopes: `Invalid scopes: ${invalidScopes.join(', ')}`
      });
    }

    // Generate token
    const token = generateApiToken();
    const hashedToken = hashToken(token);

    // Store in database
    const [apiToken] = await db.insert(apiTokens).values({
      userId: sessionResponse.user.id,
      name,
      token: hashedToken,
      scopes,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true,
    }).returning({
      id: apiTokens.id,
      name: apiTokens.name,
      scopes: apiTokens.scopes,
      expiresAt: apiTokens.expiresAt,
      createdAt: apiTokens.createdAt,
    });

    // Return the unhashed token (this is the only time it's shown)
    return NextResponse.json({
      ...apiToken,
      token, // Return the actual token
      message: 'API token created successfully. Please store this token securely - it will not be shown again.'
    });

  } catch (error) {
    return handleApiError(error);
  }
}

// GET /api/auth/tokens - List user's API tokens
export async function GET(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to view API tokens');
    }

    const tokens = await db.query.apiTokens.findMany({
      where: eq(apiTokens.userId, sessionResponse.user.id),
      columns: {
        id: true,
        name: true,
        scopes: true,
        lastUsed: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
        // Don't return the actual token
      },
    });

    return NextResponse.json(tokens);

  } catch (error) {
    return handleApiError(error);
  }
}
