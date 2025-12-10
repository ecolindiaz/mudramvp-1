import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { 
  analyzeOpportunity,
  analyzeNewOpportunities,
} from '@/lib/services/conversation-radar.service';

/**
 * POST /api/conversation-radar/analyze
 * 
 * Analyze opportunities with the Conversation Radar LLM agent
 * 
 * Body (for single opportunity):
 * - opportunityId: number
 * 
 * Body (for batch analysis):
 * - brandProfileId: number
 * - limit: number (default: 10)
 * - minRelevanceScore: number (default: 0)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { opportunityId, brandProfileId, limit = 10, minRelevanceScore = 0 } = body;
    
    // Single opportunity analysis
    if (opportunityId) {
      console.log(`[Conversation Radar] Analyzing single opportunity ${opportunityId}`);
      
      const analysis = await analyzeOpportunity(opportunityId);
      
      return NextResponse.json({
        success: true,
        data: {
          opportunityId,
          analysis,
        },
      });
    }
    
    // Batch analysis
    if (brandProfileId) {
      console.log(`[Conversation Radar] Batch analyzing opportunities for brand ${brandProfileId}`);
      
      const result = await analyzeNewOpportunities(brandProfileId, {
        limit,
        minRelevanceScore,
      });
      
      return NextResponse.json({
        success: true,
        data: result,
        message: `Analyzed ${result.analyzed} opportunities${result.errors > 0 ? `, ${result.errors} errors` : ''}`,
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Either opportunityId or brandProfileId is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[POST /api/conversation-radar/analyze] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to analyze opportunities' },
      { status: 500 }
    );
  }
}

