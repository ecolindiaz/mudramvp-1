import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getDashboardMetrics, getAnalysisFromDatabase } from '@/lib/services/analysis-database.service';

export async function GET(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }

    const userId = session.user.email;
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') as '7d' | '30d' | '90d' || '30d';
    const includeAnalyses = searchParams.get('includeAnalyses') === 'true';

    console.log(`📊 Fetching dashboard data for user: ${userId}, timeframe: ${timeframe}`);

    // Get dashboard metrics
    const metrics = await getDashboardMetrics(userId, timeframe);

    // Optionally include recent analyses
    let analyses = [];
    if (includeAnalyses) {
      analyses = await getAnalysisFromDatabase(userId, undefined, 5);
    }

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        analyses: includeAnalyses ? analyses : undefined
      }
    });

  } catch (error) {
    console.error('❌ Error fetching dashboard data:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: errorMessage, 
          code: 'FETCH_FAILED' 
        } 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }

    const userId = session.user.email;
    const body = await request.json();
    const { websiteId, limit = 10 } = body;

    console.log(`📊 Fetching specific analyses for user: ${userId}`);

    // Get specific analyses
    const analyses = await getAnalysisFromDatabase(userId, websiteId, limit);

    return NextResponse.json({
      success: true,
      data: analyses
    });

  } catch (error) {
    console.error('❌ Error fetching analyses:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: errorMessage, 
          code: 'FETCH_FAILED' 
        } 
      },
      { status: 500 }
    );
  }
}
