/**
 * Vercel Cron Route - Primary Daily Analysis
 * 
 * Triggered by Vercel Cron (configured in vercel.json)
 * Protected by CRON_SECRET to prevent unauthorized execution
 * 
 * Schedule: Daily at 2:00 AM UTC (only runs for brands with cronEnabled=true)
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeWeeklyAnalysis } from '@/lib/services/cron.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 800; // Vercel Pro max: reduce timeout risk for long multi-brand runs

/**
 * POST /api/cron/weekly-analysis
 * 
 * Executes primary daily analysis for all eligible brand profiles
 * Protected by CRON_SECRET header
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret (Vercel automatically adds this header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error('❌ [CRON API] Unauthorized: Invalid or missing CRON_SECRET');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔐 [CRON API] Authorized request received');

    // Execute primary daily analysis
    const result = await executeWeeklyAnalysis({
      onlyMissingToday: false,
      runContentOptimizer: true,
    });

    // Return execution summary
    return NextResponse.json({
      success: true,
      data: {
        timestamp: result.timestamp,
        processed: result.brandProfilesProcessed,
        successful: result.successful,
        failed: result.failed,
        errors: result.errors,
        deltas: result.deltas, // ✅ NEW: Include delta analysis
      },
    });

  } catch (error) {
    console.error('❌ [CRON API] Fatal error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Cron job failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/weekly-analysis
 * 
 * Manual trigger endpoint (for testing)
 * Requires CRON_SECRET in Authorization header
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Execute primary daily analysis
    const result = await executeWeeklyAnalysis({
      onlyMissingToday: false,
      runContentOptimizer: true,
    });

    return NextResponse.json({
      success: true,
      message: 'Manual cron execution completed',
      data: {
        timestamp: result.timestamp,
        processed: result.brandProfilesProcessed,
        successful: result.successful,
        failed: result.failed,
        errors: result.errors,
        deltas: result.deltas, // ✅ NEW: Include delta analysis
      },
    });

  } catch (error) {
    console.error('❌ [CRON API] Manual execution error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Cron job failed',
      },
      { status: 500 }
    );
  }
}
