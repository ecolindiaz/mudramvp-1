/**
 * POST /api/issues/sync-prs
 * 
 * Syncs PR statuses for all issues with open PRs for a brand profile.
 * This is a fallback mechanism — the primary detection is via GitHub webhooks.
 * 
 * Called from the issues dashboard on page load to catch any missed webhooks.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { syncPrStatuses } from '@/lib/services/github-webhook.service'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      )
    }

    // Get brand profile for user
    const brandProfile = await prisma.brandProfile.findFirst({
      where: { userId: session.user.id },
    })

    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: { message: 'Brand profile not found' } },
        { status: 404 }
      )
    }

    const result = await syncPrStatuses(brandProfile.id)

    console.log(`[PRSync] Sync complete for brand ${brandProfile.id}:`, result)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[PRSync] Error syncing PR statuses:', error)
    return NextResponse.json(
      { success: false, error: { message: 'Failed to sync PR statuses' } },
      { status: 500 }
    )
  }
}
