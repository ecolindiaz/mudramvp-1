/**
 * LLMs.txt Agent - Verify Endpoint
 * 
 * GET /api/agents/llms-txt/verify
 * 
 * Verifies that llms.txt is publicly accessible at the user's domain.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyDeployment } from '@/lib/services/llms-txt-deployment.service';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    // Get user's brand profile
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { brandProfiles: true },
    });

    if (!user || !user.brandProfiles?.length) {
      return NextResponse.json(
        { success: false, error: { message: 'No brand profile found' } },
        { status: 404 }
      );
    }

    // Get brandProfileId from query params or use first profile
    const { searchParams } = new URL(req.url);
    const brandProfileIdParam = searchParams.get('brandProfileId');
    const brandProfileId = brandProfileIdParam 
      ? parseInt(brandProfileIdParam, 10) 
      : user.brandProfiles[0].id;

    // Verify user owns this brand profile
    const brandProfile = user.brandProfiles.find(bp => bp.id === brandProfileId);
    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: { message: 'Brand profile not found' } },
        { status: 404 }
      );
    }

    // Verify deployment
    const result = await verifyDeployment(brandProfileId);

    return NextResponse.json({
      success: true,
      data: {
        accessible: result.accessible,
        url: result.url,
        statusCode: result.statusCode,
        error: result.error,
      },
    });
  } catch (error) {
    console.error('[API] llms-txt verify error:', error);
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Failed to verify llms.txt' } },
      { status: 500 }
    );
  }
}
