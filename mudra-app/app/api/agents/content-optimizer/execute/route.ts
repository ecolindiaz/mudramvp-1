import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContentOptimizerAgent } from '@/lib/agents/content-optimizer-agent'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { brandProfileId, input } = body

    if (!brandProfileId) {
      return NextResponse.json(
        { success: false, error: 'brandProfileId is required' },
        { status: 400 }
      )
    }

    // Create agent instance
    const agent = new ContentOptimizerAgent({ brandProfileId })

    // Run agent
    const result = await agent.run(input || {})

    return NextResponse.json({
      success: true,
      data: result.data,
      metrics: result.metrics,
    })
  } catch (error) {
    console.error('[ContentOptimizer] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
