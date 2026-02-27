import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'

const deletePromptSchema = z.object({
  promptId: z.number().int().positive(),
  brandProfileId: z.number().int().positive(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const parsed = deletePromptSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid input', details: parsed.error.errors } },
        { status: 400 }
      )
    }

    const { promptId, brandProfileId } = parsed.data

    // Authenticate and verify the user owns this brandProfileId
    const authResult = await requireAuthWithBrandAccess(brandProfileId)
    if (!authResult.success) {
      return authResult.response
    }

    // Verify the prompt exists and belongs to the user's brand profile
    const existingPrompt = await prisma.prompt.findUnique({
      where: { id: promptId },
    })

    if (!existingPrompt) {
      return NextResponse.json(
        { success: false, error: { message: 'Prompt not found' } },
        { status: 404 }
      )
    }

    if (existingPrompt.brandProfileId !== authResult.brandProfileId) {
      return NextResponse.json(
        { success: false, error: { message: 'Access denied' } },
        { status: 403 }
      )
    }

    // Soft delete: set isActive to false instead of actually deleting
    const updatedPrompt = await prisma.prompt.update({
      where: { id: promptId },
      data: { isActive: false },
    })

    console.log(`✅ Soft deleted prompt ${promptId} for brand profile ${brandProfileId}`)

    return NextResponse.json({
      success: true,
      data: { prompt: updatedPrompt },
    })
  } catch (error) {
    console.error('❌ Error deleting prompt:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Failed to delete prompt' } },
      { status: 500 }
    )
  }
}
