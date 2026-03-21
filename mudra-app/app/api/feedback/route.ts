import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'

const submitFeedbackSchema = z.object({
  brandProfileId: z.number().int().positive().optional(),
  targetType: z.enum(['REPORT', 'PROMPT', 'TECHNICAL', 'CAMPAIGN', 'ISSUE', 'OPPORTUNITY', 'AGENT_TASK', 'GENERAL']),
  targetId: z.string().optional(),
  thumb: z.enum(['UP', 'DOWN']).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(5000).optional(),
  pageUrl: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine(
  (data) => data.thumb !== undefined || data.rating !== undefined || data.comment !== undefined,
  { message: 'At least one of thumb, rating, or comment must be provided' }
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = submitFeedbackSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid input', details: parsed.error.errors } },
        { status: 400 }
      )
    }

    const { brandProfileId, targetType, targetId, thumb, rating, comment, pageUrl, metadata } = parsed.data

    const authResult = await requireAuthWithBrandAccess(brandProfileId ?? null)
    if (!authResult.success) {
      return authResult.response
    }

    const feedback = await prisma.userFeedback.create({
      data: {
        brandProfileId: authResult.brandProfileId!,
        userId: authResult.user.id,
        targetType,
        targetId: targetId ?? null,
        thumb: thumb ?? null,
        rating: rating ?? null,
        comment: comment ?? null,
        pageUrl: pageUrl ?? null,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    })

    return NextResponse.json({
      success: true,
      data: { id: feedback.id, targetType: feedback.targetType, thumb: feedback.thumb, rating: feedback.rating },
    })
  } catch (error) {
    console.error('❌ Error submitting feedback:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Failed to submit feedback' } },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const brandProfileId = searchParams.get('brandProfileId')
    const targetType = searchParams.get('targetType')
    const targetId = searchParams.get('targetId')

    const authResult = await requireAuthWithBrandAccess(brandProfileId)
    if (!authResult.success) {
      return authResult.response
    }

    const where: Record<string, unknown> = {
      brandProfileId: authResult.brandProfileId!,
    }
    if (targetType) where.targetType = targetType
    if (targetId) where.targetId = targetId

    const feedbacks = await prisma.userFeedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({
      success: true,
      data: feedbacks,
    })
  } catch (error) {
    console.error('❌ Error fetching feedback:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch feedback' } },
      { status: 500 }
    )
  }
}
