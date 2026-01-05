/**
 * LLMs.txt Agent - Generate Endpoint
 * 
 * POST /api/agents/llms-txt/generate
 * 
 * Generates llms.txt content for a brand profile.
 * Returns the content without deploying.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateLlmsTxtForBrand } from '@/lib/services/llms-txt-generator.service';
import { z } from 'zod';

const generateSchema = z.object({
  brandProfileId: z.number().optional(),
});

export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => ({}));
    const validation = generateSchema.safeParse(body);

    const brandProfileId = validation.success && validation.data.brandProfileId
      ? validation.data.brandProfileId
      : user.brandProfiles[0].id;

    // Verify user owns this brand profile
    const brandProfile = user.brandProfiles.find(bp => bp.id === brandProfileId);
    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: { message: 'Brand profile not found' } },
        { status: 404 }
      );
    }

    // Generate llms.txt
    const result = await generateLlmsTxtForBrand(brandProfileId);

    return NextResponse.json({
      success: true,
      data: {
        content: result.content,
        sizeBytes: result.sizeBytes,
        wasTrimmed: result.wasTrimmed,
        sections: result.sections,
        generatedAt: result.generatedAt,
        brandName: brandProfile.companyName,
        website: brandProfile.companyWebsite,
      },
    });
  } catch (error) {
    console.error('[API] llms-txt generate error:', error);
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : 'Failed to generate llms.txt' } },
      { status: 500 }
    );
  }
}
