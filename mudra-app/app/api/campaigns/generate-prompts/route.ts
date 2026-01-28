import { NextRequest, NextResponse } from 'next/server'
import { generateAndSaveInitialPrompts } from '@/lib/services/prompt-storage.service'
import { requireAuth, verifyBrandProfileAccess } from '@/lib/auth/require-auth';
import { applyRateLimit } from '@/lib/auth/rate-limiter-redis';
import { getBrandProfileByUserId } from '@/lib/prisma-brand-profile';

/**
 * POST /api/campaigns/generate-prompts
 * Generate and save initial prompts for a brand profile
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting (AI generation is expensive)
  const rateLimited = applyRateLimit(request, 'aiGeneration');
  if (rateLimited) return rateLimited;

  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const { brandProfileId } = await request.json()

    if (!brandProfileId) {
      return NextResponse.json(
        { error: 'brandProfileId is required' },
        { status: 400 }
      )
    }

    const profileId = parseInt(brandProfileId)

    // Verify user owns this brand profile
    const accessCheck = await verifyBrandProfileAccess(authResult.user, profileId);
    if (!accessCheck.allowed) {
      return accessCheck.response || NextResponse.json(
        { success: false, error: { message: "Forbidden", code: "FORBIDDEN" } },
        { status: 403 }
      );
    }
    
    console.log(`🎯 Generating prompts for brand profile ${profileId}...`)
    
    // Generate and save prompts
    const prompts = await generateAndSaveInitialPrompts(profileId)

    console.log(`✅ Successfully generated ${prompts.length} prompts`)

    // Count by category
    const categories = ['Organic', 'Competitor', 'How-to Guides', 'Brand-Specific']
    const breakdown = categories.map(cat => ({
      category: cat,
      count: prompts.filter(p => p.category === cat).length
    }))

    return NextResponse.json({ 
      success: true, 
      prompts: prompts.length,
      breakdown,
      message: `Successfully generated ${prompts.length} prompts`
    })
  } catch (error: any) {
    console.error('Error generating prompts:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate prompts',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

