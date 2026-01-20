import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContentOptimizerAgent } from '@/lib/agents/content-optimizer-agent'

export async function POST(req: NextRequest) {
  console.log('[ContentOptimizer API] Request received')
  
  try {
    const session = await getServerSession(authOptions)
    console.log('[ContentOptimizer API] Session:', session?.user?.id ? 'authenticated' : 'not authenticated')
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { brandProfileId, input } = body
    console.log('[ContentOptimizer API] brandProfileId:', brandProfileId, 'input:', JSON.stringify(input))

    if (!brandProfileId) {
      return NextResponse.json(
        { success: false, error: 'brandProfileId is required' },
        { status: 400 }
      )
    }

    // Create agent instance
    console.log('[ContentOptimizer API] Creating agent instance...')
    const agent = new ContentOptimizerAgent({ brandProfileId })

    // Run agent
    console.log('[ContentOptimizer API] Running agent...')
    const result = await agent.run(input || {})
    console.log('[ContentOptimizer API] Agent result success:', result.success)

    if (!result.success) {
      console.error('[ContentOptimizer API] Agent failed:', result.error)
      return NextResponse.json({
        success: false,
        error: result.error || 'Agent execution failed',
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      metrics: result.metrics,
    })
  } catch (error) {
    console.error('[ContentOptimizer API] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('[ContentOptimizer API] Stack:', errorStack)
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}
