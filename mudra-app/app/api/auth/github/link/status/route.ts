import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Get GitHub account linking status
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        githubId: true,
        githubUsername: true,
        githubLinkedAt: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      linked: !!user.githubId,
      githubUsername: user.githubUsername,
      linkedAt: user.githubLinkedAt,
    })
  } catch (error) {
    console.error('[GitHub Link Status] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get link status' },
      { status: 500 }
    )
  }
}

/**
 * Unlink GitHub account
 */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await prisma.user.update({
      where: { email: session.user.email },
      data: {
        githubId: null,
        githubUsername: null,
        githubLinkedAt: null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[GitHub Unlink] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to unlink GitHub account' },
      { status: 500 }
    )
  }
}
