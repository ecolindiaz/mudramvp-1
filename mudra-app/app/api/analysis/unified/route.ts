/**
 * API endpoint for unified analysis
 * Handles both onboarding and dashboard analysis requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { runUnifiedAnalysis } from '@/lib/services/unified-analysis.service';
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth';
import { applyRateLimit } from '@/lib/auth/rate-limiter';

export async function POST(request: NextRequest) {
  // Apply rate limiting (analysis is expensive)
  const rateLimited = applyRateLimit(request, 'analysis');
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    
    // Require authentication and verify brand profile access
    const authResult = await requireAuthWithBrandAccess(body.brandProfileId);
    if (!authResult.success) {
      return authResult.response;
    }
    const {
      brandProfileId,
      brandName,
      website,
      description,
      industry,
      competitors,
      skipCooldown = false,
      generateReport = false,
    } = body;

    // Validate required fields
    if (!brandProfileId || !brandName || !website) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required fields: brandProfileId, brandName, and website are required' 
        },
        { status: 400 }
      );
    }

    console.log('[Unified Analysis API] Starting analysis for:', brandName);

    // Run unified analysis
    const result = await runUnifiedAnalysis({
      brandProfileId,
      brandName,
      website,
      description,
      industry,
      competitors: competitors || [],
      skipCooldown,
      generateReport,
    });

    if (result.success) {
      console.log('[Unified Analysis API] Analysis completed successfully');
      return NextResponse.json({
        success: true,
        data: result,
      });
    } else {
      console.error('[Unified Analysis API] Analysis failed:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Analysis failed',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Unified Analysis API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
