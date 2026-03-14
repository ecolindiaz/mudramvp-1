import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContentOptimizerAgent } from '@/lib/agents/content-optimizer-agent'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const brandProfileId = searchParams.get('brandProfileId')

    if (!brandProfileId) {
      return NextResponse.json(
        { success: false, error: 'brandProfileId is required' },
        { status: 400 }
      )
    }

    // Create agent instance
    const agent = new ContentOptimizerAgent({ brandProfileId: parseInt(brandProfileId) })

    // Get execution history
    const history = await agent.getExecutionHistory(20)

    return NextResponse.json({
      success: true,
      data: history,
    })
  } catch (error) {
    console.error('[ContentOptimizer] History Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch optimization history',
      },
      { status: 500 }
    )
  }
}
