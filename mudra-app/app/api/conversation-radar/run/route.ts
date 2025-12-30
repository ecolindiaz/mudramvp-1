import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import {
  processCitedOpportunities,
  runProactiveSearch,
  analyzeNewOpportunities,
  getLatestAnalysisRun,
} from '@/lib/services/conversation-radar.service';

/**
 * POST /api/conversation-radar/run
 * 
 * Triggers a conversation radar scan
 * 
 * Body:
 * - brandProfileId: number (required)
 * - mode: 'cited' | 'proactive' | 'both' (default: 'proactive' for deploy, 'both' for cron)
 * - analyze: boolean (default: true) - Whether to run LLM analysis on new opportunities
 * - analyzeLimit: number (default: 10) - Max opportunities to analyze
 * - maxCitations: number (default: 2) - Max cited opportunities to process per run
 * 
 * Per scheduled run targets: 1 proactive opportunity + 2 cited opportunities
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Allow dev mode bypass for testing
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && !session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { 
      brandProfileId, 
      mode = 'both',
      analyze = true,
      analyzeLimit = 10,
      maxCitations = 2, // Limit citations to spread over time
    } = body;
    
    if (!brandProfileId) {
      return NextResponse.json(
        { success: false, error: 'brandProfileId is required' },
        { status: 400 }
      );
    }
    
    // Validate brand profile exists (in dev mode, skip user ownership check)
    const brandProfile = await prisma.brandProfile.findFirst({
      where: isDev 
        ? { id: brandProfileId }
        : { id: brandProfileId, userId: session?.user?.id },
    });
    
    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: 'Brand profile not found or access denied' },
        { status: 404 }
      );
    }
    
    const results: {
      cited?: { created: number; skipped: number; errors: number };
      proactive?: { reddit: number; total: number; queries: string[] };
      analysis?: { analyzed: number; errors: number };
    } = {};
    
    // Mode 1: Cited Radar
    if (mode === 'cited' || mode === 'both') {
      // Get latest analysis run
      const latestAnalysis = await getLatestAnalysisRun(brandProfileId);
      
      if (!latestAnalysis) {
        if (mode === 'cited') {
          return NextResponse.json({
            success: false,
            error: 'No AI visibility analysis found. Run an analysis first to discover cited conversations.',
          });
        }
        // For 'both' mode, just skip cited radar
        console.log('[Conversation Radar] No analysis run found, skipping cited radar');
      } else {
        console.log(`[Conversation Radar] Running cited radar with analysis ${latestAnalysis.id} (max: ${maxCitations})`);
        results.cited = await processCitedOpportunities(brandProfileId, latestAnalysis.id, { maxCitations });
      }
    }
    
    // Mode 2: Proactive Radar
    if (mode === 'proactive' || mode === 'both') {
      console.log('[Conversation Radar] Running proactive radar');
      results.proactive = await runProactiveSearch(brandProfileId);
    }
    
    // Analyze new opportunities with LLM
    if (analyze) {
      console.log(`[Conversation Radar] Analyzing up to ${analyzeLimit} new opportunities`);
      results.analysis = await analyzeNewOpportunities(brandProfileId, {
        limit: analyzeLimit,
        minRelevanceScore: 30, // Only analyze opportunities with decent initial score
      });
    }
    
    return NextResponse.json({
      success: true,
      data: results,
      message: buildResultMessage(results),
    });
  } catch (error) {
    console.error('[POST /api/conversation-radar/run] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run conversation radar' },
      { status: 500 }
    );
  }
}

function buildResultMessage(results: any): string {
  const parts: string[] = [];
  
  if (results.cited) {
    parts.push(`Cited: ${results.cited.created} new opportunities`);
  }
  
  if (results.proactive) {
    parts.push(`Proactive: ${results.proactive.reddit} Reddit opportunities`);
  }
  
  if (results.analysis) {
    parts.push(`Analyzed: ${results.analysis.analyzed} opportunities`);
  }
  
  return parts.join(' | ') || 'No opportunities found';
}

/**
 * GET /api/conversation-radar/run
 * 
 * Get the status of conversation radar for a brand
 * Returns counts and last run info
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
    const brandProfileId = searchParams.get('brandProfileId');
    
    if (!brandProfileId) {
      return NextResponse.json(
        { success: false, error: 'brandProfileId is required' },
        { status: 400 }
      );
    }
    
    // Get opportunity counts by status
    const [newCount, reviewedCount, engagedCount, dismissedCount] = await Promise.all([
      prisma.conversationOpportunity.count({
        where: { brandProfileId: parseInt(brandProfileId), status: 'new' },
      }),
      prisma.conversationOpportunity.count({
        where: { brandProfileId: parseInt(brandProfileId), status: 'reviewed' },
      }),
      prisma.conversationOpportunity.count({
        where: { brandProfileId: parseInt(brandProfileId), status: 'engaged' },
      }),
      prisma.conversationOpportunity.count({
        where: { brandProfileId: parseInt(brandProfileId), status: 'dismissed' },
      }),
    ]);
    
    // Get counts by mode
    const [citedCount, proactiveCount] = await Promise.all([
      prisma.conversationOpportunity.count({
        where: { brandProfileId: parseInt(brandProfileId), mode: 'cited' },
      }),
      prisma.conversationOpportunity.count({
        where: { brandProfileId: parseInt(brandProfileId), mode: 'proactive' },
      }),
    ]);
    
    // Get latest opportunity creation time
    const latestOpportunity = await prisma.conversationOpportunity.findFirst({
      where: { brandProfileId: parseInt(brandProfileId) },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    
    // Get unanalyzed count
    const unanalyzedCount = await prisma.conversationOpportunity.count({
      where: { 
        brandProfileId: parseInt(brandProfileId),
        conversationSnapshot: null,
      },
    });
    
    return NextResponse.json({
      success: true,
      data: {
        counts: {
          total: newCount + reviewedCount + engagedCount + dismissedCount,
          new: newCount,
          reviewed: reviewedCount,
          engaged: engagedCount,
          dismissed: dismissedCount,
          unanalyzed: unanalyzedCount,
        },
        byMode: {
          cited: citedCount,
          proactive: proactiveCount,
        },
        lastRun: latestOpportunity?.createdAt || null,
      },
    });
  } catch (error) {
    console.error('[GET /api/conversation-radar/run] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get radar status' },
      { status: 500 }
    );
  }
}

