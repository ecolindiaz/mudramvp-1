/**
 * API endpoint for unified analysis
 * Handles both onboarding and dashboard analysis requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { runUnifiedAnalysis } from '@/lib/services/unified-analysis.service';
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth';
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis';

// Extended timeout for unified analysis - runs GEO + Technical analysis in parallel
// GEO: 4 providers × multiple prompts (30-60s)
// Technical: page discovery + scraping + DOM extraction (40-80s)
export const maxDuration = 540; // 9 minutes - allows full 50-prompt analysis

export async function POST(request: NextRequest) {
  // Apply rate limiting (analysis is expensive)
  const rateLimited = await applyRateLimitAsync(request, 'analysis');
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    console.log('[Unified Analysis API] Received request body:', {
      brandProfileId: body.brandProfileId,
      brandName: body.brandName,
      website: body.website ? '✓' : '✗',
      skipCooldown: body.skipCooldown,
      generateReport: body.generateReport,
    });
    
    // Require authentication and verify brand profile access
    const authResult = await requireAuthWithBrandAccess(body.brandProfileId);
    if (!authResult.success) {
      console.error('[Unified Analysis API] Auth failed for brandProfileId:', body.brandProfileId);
      return authResult.response;
    }
    console.log('[Unified Analysis API] Auth successful, user brandProfileId:', authResult.brandProfileId);
    const {
      brandProfileId,
      brandName,
      website,
      description,
      industry,
      competitors,
      skipCooldown = false, // Dashboard enforces 24-hour cooldown by default
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
      const errorMessage = result.error || 'Analysis failed with unknown error';
      const errorCode = result.errorCode || 'ANALYSIS_UNKNOWN_ERROR';
      
      console.error('[Unified Analysis API] Analysis failed:', {
        error: errorMessage,
        code: errorCode,
        geoAnalysisId: result.geoAnalysisId,
        technicalAnalysisId: result.technicalAnalysisId,
      });
      
      return NextResponse.json(
        {
          success: false,
          error: {
            message: errorMessage,
            code: errorCode,
          },
          details: {
            geoAnalysisId: result.geoAnalysisId,
            technicalAnalysisId: result.technicalAnalysisId,
            scores: result.scores,
          }
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Unified Analysis API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[Unified Analysis API] Stack:', errorStack);
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}
