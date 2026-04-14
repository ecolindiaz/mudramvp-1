import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis';

const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE', {
    errorMap: () => ({ message: 'Please type DELETE to confirm' }),
  }),
});

export async function DELETE(req: NextRequest) {
  try {
    // Rate limit account deletion to prevent abuse
    const rateLimited = await applyRateLimitAsync(req, 'auth');
    if (rateLimited) return rateLimited;

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    let body: unknown = {};
    const rawBody = await req.text();
    if (rawBody.trim().length > 0) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        return NextResponse.json(
          { error: { message: 'Invalid JSON body' } },
          { status: 400 }
        );
      }
    }

    const validationResult = deleteAccountSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: { message: validationResult.error.errors[0].message } },
        { status: 400 }
      );
    }

    // Delete user and all related data (cascading deletes handled by Prisma schema)
    await prisma.user.delete({
      where: { email: session.user.email },
    });

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('[API] Error deleting account:', error);
    return NextResponse.json(
      { error: { message: 'Failed to delete account' } },
      { status: 500 }
    );
  }
}
