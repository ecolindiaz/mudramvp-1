import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { 
  getOpportunitiesForFrontend, 
  updateOpportunityStatus 
} from '@/lib/services/conversation-radar.service';

/**
 * GET /api/conversation-radar/opportunities
 * 
 * Returns conversation opportunities for a brand
 * 
 * Query params:
 * - brandProfileId: required
 * - status: 'new' | 'reviewed' | 'engaged' | 'dismissed' | 'all' (default: 'new')
 * - mode: 'cited' | 'proactive' (optional)
 * - platform: 'reddit' | 'linkedin' (optional)
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const brandProfileId = searchParams.get('brandProfileId');
    const status = searchParams.get('status') || 'new';
    const mode = searchParams.get('mode') as 'cited' | 'proactive' | null;
    const platform = searchParams.get('platform') as 'reddit' | 'linkedin' | null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    
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
    if (!session?.user?.id) {
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

