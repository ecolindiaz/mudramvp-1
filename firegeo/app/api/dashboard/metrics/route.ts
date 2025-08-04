import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { brandAnalyses, messages, conversations } from '@/lib/db/schema';
import { eq, desc, count, avg, sum, and, gte, lte, sql } from 'drizzle-orm';
import { handleApiError, AuthenticationError } from '@/lib/api-errors';
import { validateApiToken, hasScope } from '@/lib/api-auth';

// GET /api/dashboard/metrics - Get aggregated metrics for dashboard
export async function GET(request: NextRequest) {
  try {
    let userId: string;

    // Try API token authentication first
    const apiToken = await validateApiToken(request);
    if (apiToken) {
      if (!hasScope(apiToken, 'metrics:read')) {
        throw new AuthenticationError('Insufficient permissions for metrics access');
      }
      userId = apiToken.userId;
    } else {
      // Fall back to session authentication
      const sessionResponse = await auth.api.getSession({
        headers: request.headers,
      });

      if (!sessionResponse?.user) {
        throw new AuthenticationError('Please log in or provide a valid API token to view metrics');
      }
      userId = sessionResponse.user.id;
    }

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '30d'; // 7d, 30d, 90d
    const includeCompetitors = searchParams.get('competitors') === 'true';
    
    // Calculate date threshold
    const days = timeframe === '7d' ? 7 : timeframe === '90d' ? 90 : 30;
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    // Brand Analysis Metrics
    const brandMetrics = await db
      .select({
        totalAnalyses: count(),
        // Extract visibility score from JSON and calculate average
        avgVisibilityScore: avg(sql`CAST(${brandAnalyses.analysisData}->>'visibilityScore' AS NUMERIC)`),
        totalCreditsUsed: sum(brandAnalyses.creditsUsed),
      })
      .from(brandAnalyses)
      .where(
        and(
          eq(brandAnalyses.userId, userId),
          gte(brandAnalyses.createdAt, dateThreshold)
        )
      );

    // Chat Metrics
    const chatMetrics = await db
      .select({
        totalMessages: count(),
        totalConversations: count(conversations.id),
      })
      .from(messages)
      .leftJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.userId, userId),
          gte(messages.createdAt, dateThreshold)
        )
      );

    // Recent analyses with scores
    const recentAnalyses = await db.query.brandAnalyses.findMany({
      where: and(
        eq(brandAnalyses.userId, userId),
        gte(brandAnalyses.createdAt, dateThreshold)
      ),
      orderBy: desc(brandAnalyses.createdAt),
      limit: 10,
    });

    // Extract visibility scores and competitor data
    const visibilityTrend = recentAnalyses.map(analysis => {
      const data = analysis.analysisData as any;
      const brandData = data?.competitors?.find((c: any) => c.isOwn);
      
      return {
        date: analysis.createdAt,
        companyName: analysis.companyName,
        visibilityScore: brandData?.visibilityScore || 0,
        shareOfVoice: brandData?.shareOfVoice || 0,
        averagePosition: brandData?.averagePosition || 0,
        competitorCount: data?.competitors?.length || 0,
      };
    });

    // Competitor performance (if requested)
    let competitorInsights = null;
    if (includeCompetitors && recentAnalyses.length > 0) {
      const allCompetitors = recentAnalyses
        .flatMap(analysis => {
          const data = analysis.analysisData as any;
          return data?.competitors?.filter((c: any) => !c.isOwn) || [];
        })
        .reduce((acc: any, competitor: any) => {
          const name = competitor.name;
          if (!acc[name]) {
            acc[name] = {
              name,
              appearances: 0,
              avgVisibilityScore: 0,
              scores: [],
            };
          }
          acc[name].appearances++;
          acc[name].scores.push(competitor.visibilityScore || 0);
          acc[name].avgVisibilityScore = acc[name].scores.reduce((a: number, b: number) => a + b, 0) / acc[name].scores.length;
          return acc;
        }, {});

      competitorInsights = Object.values(allCompetitors)
        .sort((a: any, b: any) => b.avgVisibilityScore - a.avgVisibilityScore)
        .slice(0, 5);
    }

    // AI Provider Performance
    const providerPerformance = recentAnalyses.reduce((acc: any, analysis) => {
      const data = analysis.analysisData as any;
      if (data?.providerRankings) {
        Object.entries(data.providerRankings).forEach(([provider, rankings]: [string, any]) => {
          if (!acc[provider]) {
            acc[provider] = { name: provider, totalQueries: 0, avgPosition: 0, positions: [] };
          }
          Object.values(rankings).forEach((ranking: any) => {
            if (Array.isArray(ranking)) {
              const brandPosition = ranking.findIndex((item: any) => 
                item.name?.toLowerCase().includes(analysis.companyName?.toLowerCase() || '')
              );
              if (brandPosition !== -1) {
                acc[provider].positions.push(brandPosition + 1);
                acc[provider].totalQueries++;
              }
            }
          });
        });
      }
      return acc;
    }, {});

    // Calculate average positions
    Object.keys(providerPerformance).forEach(provider => {
      const positions = providerPerformance[provider].positions;
      if (positions.length > 0) {
        providerPerformance[provider].avgPosition = 
          positions.reduce((a: number, b: number) => a + b, 0) / positions.length;
      }
    });

    const metrics = {
      timeframe,
      summary: {
        totalAnalyses: brandMetrics[0]?.totalAnalyses || 0,
        totalMessages: chatMetrics[0]?.totalMessages || 0,
        totalConversations: chatMetrics[0]?.totalConversations || 0,
        totalCreditsUsed: brandMetrics[0]?.totalCreditsUsed || 0,
        avgVisibilityScore: brandMetrics[0]?.avgVisibilityScore || 0,
      },
      visibilityTrend,
      competitorInsights,
      providerPerformance: Object.values(providerPerformance),
      recentActivity: recentAnalyses.slice(0, 5).map(analysis => ({
        id: analysis.id,
        companyName: analysis.companyName,
        industry: analysis.industry,
        date: analysis.createdAt,
        creditsUsed: analysis.creditsUsed,
      })),
    };

    return NextResponse.json(metrics);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/dashboard/metrics - Get custom metrics with filters
export async function POST(request: NextRequest) {
  try {
    let userId: string;

    // Try API token authentication first
    const apiToken = await validateApiToken(request);
    if (apiToken) {
      if (!hasScope(apiToken, 'metrics:read')) {
        throw new AuthenticationError('Insufficient permissions for metrics access');
      }
      userId = apiToken.userId;
    } else {
      // Fall back to session authentication
      const sessionResponse = await auth.api.getSession({
        headers: request.headers,
      });

      if (!sessionResponse?.user) {
        throw new AuthenticationError('Please log in or provide a valid API token to view metrics');
      }
      userId = sessionResponse.user.id;
    }

    const { 
      startDate, 
      endDate, 
      companies, 
      industries, 
      providers,
      metricTypes 
    } = await request.json();

    // Build dynamic query based on filters
    let whereConditions = [eq(brandAnalyses.userId, userId)];
    
    if (startDate) {
      whereConditions.push(gte(brandAnalyses.createdAt, new Date(startDate)));
    }
    
    if (endDate) {
      whereConditions.push(lte(brandAnalyses.createdAt, new Date(endDate)));
    }

    // Add more filter logic here...

    const filteredAnalyses = await db.query.brandAnalyses.findMany({
      where: and(...whereConditions),
      orderBy: desc(brandAnalyses.createdAt),
    });

    // Process specific metric types requested
    const customMetrics: any = {};

    if (metricTypes.includes('visibility_trends')) {
      customMetrics.visibilityTrends = filteredAnalyses.map(analysis => {
        const data = analysis.analysisData as any;
        const brandData = data?.competitors?.find((c: any) => c.isOwn);
        return {
          date: analysis.createdAt,
          score: brandData?.visibilityScore || 0,
          company: analysis.companyName,
        };
      });
    }

    if (metricTypes.includes('competitor_analysis')) {
      // Custom competitor analysis logic
    }

    if (metricTypes.includes('provider_rankings')) {
      // Custom provider ranking analysis
    }

    return NextResponse.json(customMetrics);
  } catch (error) {
    return handleApiError(error);
  }
}
