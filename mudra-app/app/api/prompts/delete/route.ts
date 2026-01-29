import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import { applyRateLimit } from '@/lib/auth/rate-limiter-redis'

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimited = applyRateLimit(request, 'standard');
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json()
    const { promptId, brandProfileId } = body

    console.log(`🗑️ Delete request: promptId=${promptId}, brandProfileId=${brandProfileId}`)

    if (!promptId || !brandProfileId) {
      return NextResponse.json(
        { success: false, error: { message: 'Missing promptId or brandProfileId' } },
        { status: 400 }
      )
    }

    // Require authentication and verify brand profile access
    const authResult = await requireAuthWithBrandAccess(brandProfileId);
    if (!authResult.success) {
      return authResult.response;
    }

    // First verify the prompt belongs to this brand profile
    const existingPrompt = await prisma.prompt.findUnique({
      where: { id: promptId },
    })

    if (!existingPrompt) {
      return NextResponse.json(
        { success: false, error: { message: 'Prompt not found' } },
        { status: 404 }
      )
    }

    if (existingPrompt.brandProfileId !== brandProfileId) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized: Prompt does not belong to this brand profile' } },
        { status: 403 }
      )
    }

    // Soft delete: set isActive to false instead of actually deleting
    const updatedPrompt = await prisma.prompt.update({
      where: {
        id: promptId,
      },
      data: {
        isActive: false,
      },
    })

    console.log(`✅ Soft deleted prompt ${promptId} for brand profile ${brandProfileId}`)

    return NextResponse.json({
      success: true,
      data: { prompt: updatedPrompt },
    })
  } catch (error) {
    console.error('❌ Error deleting prompt:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to delete prompt',
        },
      },
      { status: 500 }
    )
  }
}
