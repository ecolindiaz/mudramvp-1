import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { 
  getOpportunitiesForFrontend, 
  getOpportunityForFrontend,
  updateOpportunityStatus 
} from '@/lib/services/conversation-radar.service';

/**
 * GET /api/conversation-radar/opportunities
 * 
 * Returns conversation opportunities for a brand or a single opportunity
 * 
 * Query params (for listing):
 * - brandProfileId: required (unless opportunityId is provided)
 * - status: 'new' | 'reviewed' | 'engaged' | 'dismissed' | 'all' (default: 'new')
 * - mode: 'cited' | 'proactive' (optional)
 * - platform: 'reddit' (optional)
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 * 
 * Query params (for single opportunity):
 * - opportunityId: number (returns single opportunity with full details)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Allow dev mode bypass for testing
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && !session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const opportunityId = searchParams.get('opportunityId');
    
    // Single opportunity fetch
    if (opportunityId) {
      const opportunity = await getOpportunityForFrontend(parseInt(opportunityId));
      
      if (!opportunity) {
        return NextResponse.json(
          { success: false, error: 'Opportunity not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        data: opportunity,
      });
    }
    
    // List opportunities
    const brandProfileId = searchParams.get('brandProfileId');
    const status = searchParams.get('status') || 'new';
    const mode = searchParams.get('mode') as 'cited' | 'proactive' | null;
    const platform = searchParams.get('platform') as 'reddit' | null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const includeAll = searchParams.get('includeAll') === 'true'; // For "All opportunities" view
    
    if (!brandProfileId) {
      return NextResponse.json(
        { success: false, error: 'brandProfileId is required' },
        { status: 400 }
      );
    }
    
    const opportunities = await getOpportunitiesForFrontend(parseInt(brandProfileId), {
      status,
      mode: mode || undefined,
      platform: platform || undefined,
      limit,
      offset,
      includeAll, // If true, shows all relevance scores (for "All opportunities" view)
    });
    
    return NextResponse.json({
      success: true,
      data: opportunities,
      meta: {
        count: opportunities.length,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('[GET /api/conversation-radar/opportunities] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch opportunities' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/conversation-radar/opportunities
 * 
 * Update an opportunity's status
 * 
 * Body:
 * - opportunityId: number (required)
 * - status: 'new' | 'reviewed' | 'engaged' | 'dismissed' (required)
 * - dismissReason: string (optional, for dismissed status)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Allow dev mode bypass for testing
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && !session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { opportunityId, status, dismissReason } = body;
    
    if (!opportunityId || !status) {
      return NextResponse.json(
        { success: false, error: 'opportunityId and status are required' },
        { status: 400 }
      );
    }
    
    const validStatuses = ['new', 'reviewed', 'engaged', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }
    
    const updated = await updateOpportunityStatus(
      opportunityId,
      status as 'new' | 'reviewed' | 'engaged' | 'dismissed',
      dismissReason
    );
    
    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('[PATCH /api/conversation-radar/opportunities] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update opportunity' },
      { status: 500 }
    );
  }
}

