import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const brandProfileId = request.nextUrl.searchParams.get('brandProfileId')
    if (!brandProfileId) {
      return NextResponse.json({ success: false, error: 'brandProfileId required' }, { status: 400 })
    }

    // Get all enabled agent schedules for this brand
    const deployedAgents = await prisma.agentSchedule.findMany({
      where: {
        brandProfileId: parseInt(brandProfileId),
        isEnabled: true,
      },
      select: {
        id: true,
        agentType: true,
        cronExpression: true,
        lastRunAt: true,
        nextRunAt: true,
        createdAt: true,
        updatedAt: true,
        config: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ success: true, data: deployedAgents })
  } catch (error) {
    console.error('[GET /api/agents/deployed] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch deployed agents' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { brandProfileId, agentType, cronExpression, config } = body

    if (!brandProfileId || !agentType) {
      return NextResponse.json(
        { success: false, error: 'brandProfileId and agentType required' },
        { status: 400 }
      )
    }

    // Create or update agent schedule
    const deployed = await prisma.agentSchedule.upsert({
      where: {
        brandProfileId_agentType: {
          brandProfileId: parseInt(brandProfileId),
          agentType,
        },
      },
      create: {
        brandProfileId: parseInt(brandProfileId),
        agentType,
        isEnabled: true,
        cronExpression: cronExpression || '0 9 * * *', // Default: Daily at 9am
        config: config || {},
      },
      update: {
        isEnabled: true,
        cronExpression: cronExpression || undefined,
        config: config || undefined,
      },
    })

    return NextResponse.json({ success: true, data: deployed })
  } catch (error) {
    console.error('[POST /api/agents/deployed] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to deploy agent' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const brandProfileId = request.nextUrl.searchParams.get('brandProfileId')
    const agentType = request.nextUrl.searchParams.get('agentType')

    if (!brandProfileId || !agentType) {
      return NextResponse.json(
        { success: false, error: 'brandProfileId and agentType required' },
        { status: 400 }
      )
    }

    // Mark agent as disabled (soft delete)
    await prisma.agentSchedule.update({
      where: {
        brandProfileId_agentType: {
          brandProfileId: parseInt(brandProfileId),
          agentType,
        },
      },
      data: {
        isEnabled: false,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/agents/deployed] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to undeploy agent' },
      { status: 500 }
    )
  }
}
