import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis';

const deleteAccountSchema = z.object({
  confirmation: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(
      z.literal('DELETE', {
        errorMap: () => ({ message: 'Please type DELETE to confirm' }),
      })
    ),
});

function clearAuthCookies(response: NextResponse) {
  const cookieNames = [
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    '__Host-next-auth.session-token',
    'next-auth.csrf-token',
    '__Host-next-auth.csrf-token',
    'next-auth.callback-url',
    '__Secure-next-auth.callback-url',
  ];

  for (const name of cookieNames) {
    response.cookies.set({
      name,
      value: '',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });
  }

  return response;
}

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
        // Allow plain-text confirmation payloads from clients/proxies that do not send JSON.
        if (rawBody.trim().length > 0) {
          body = { confirmation: rawBody.trim() };
        }
      }
    }

    // Fallbacks in case DELETE request body is stripped by intermediary infrastructure.
    if (typeof body !== 'object' || body === null || !('confirmation' in body)) {
      const queryConfirmation = req.nextUrl.searchParams.get('confirmation');
      const headerConfirmation = req.headers.get('x-delete-confirmation');
      if (queryConfirmation || headerConfirmation) {
        body = { confirmation: queryConfirmation || headerConfirmation };
      }
    }

    const validationResult = deleteAccountSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: { message: validationResult.error.errors[0].message } },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    // If the account is already gone, treat this as an idempotent success.
    if (!user) {
      const response = NextResponse.json({
        success: true,
        message: 'Account already deleted',
      });
      return clearAuthCookies(response);
    }

    // Some user-linked records use nullable/non-cascading relations in schema,
    // so we detach them explicitly before deleting the user.
    await prisma.$transaction(async (tx) => {
      await tx.brandProfile.updateMany({
        where: { userId: user.id },
        data: { userId: null },
      });

      await tx.campaign.updateMany({
        where: { userId: user.id },
        data: { userId: null },
      });

      await tx.auditLog.deleteMany({
        where: { userId: user.id },
      });

      await tx.user.delete({
        where: { id: user.id },
      });
    });

    const response = NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
    });
    return clearAuthCookies(response);
  } catch (error) {
    console.error('[API] Error deleting account:', error);
    return NextResponse.json(
      { error: { message: 'Failed to delete account' } },
      { status: 500 }
    );
  }
}
