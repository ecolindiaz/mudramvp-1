import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthWithBrandAccess } from '@/lib/auth/require-auth'
import { applyRateLimit } from '@/lib/auth/rate-limiter-redis'

interface CitationData {
  domain: string
  count: number
  percentage: number
  urls: string[]
}

/**
 * GET /api/analytics/citations
 * 
 * Aggregates citation data from all GEO analysis results for a brand profile.
 * Extracts and counts domains cited across all AI provider responses.
 * 
 * Query params:
 * - brandProfileId: The brand profile ID to fetch citations for
 * - limit: Maximum number of top citations to return (default: 10)
 * - days: Number of days to look back (default: 30)
 */
export async function GET(request: NextRequest) {
  // Rate limit
  const rateLimited = applyRateLimit(request, 'standard');
  if (rateLimited) return rateLimited;

  try {
    const searchParams = request.nextUrl.searchParams
    const brandProfileIdParam = searchParams.get('brandProfileId')
    const limitParam = searchParams.get('limit')
    const daysParam = searchParams.get('days')

    if (!brandProfileIdParam) {
      return NextResponse.json(
        { success: false, error: { message: 'brandProfileId is required' } },
        { status: 400 }
      )
    }

    const brandProfileId = parseInt(brandProfileIdParam, 10)

    // Verify user has access to this brand profile
    const authResult = await requireAuthWithBrandAccess(brandProfileId);
    if (!authResult.success) {
      return authResult.response;
    }
    const limit = limitParam ? parseInt(limitParam, 10) : 10
    const days = daysParam ? parseInt(daysParam, 10) : 30

    // Calculate date range
    const since = new Date()
    since.setDate(since.getDate() - days)

    // Fetch all GEO analysis results within the date range
    const geoResults = await prisma.geoAnalysisResult.findMany({
      where: {
        brandProfileId,
        createdAt: {
          gte: since
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        analyses: true,
        createdAt: true
      }
    })

    if (geoResults.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          citations: [],
          totalCitations: 0,
          totalAnalyses: 0,
          periodDays: days
        }
      })
    }

    // Aggregate citations from all analyses
    const citationMap = new Map<string, { count: number; urls: Set<string> }>()
    let totalCitationCount = 0

    for (const result of geoResults) {
      const analysesRaw = result.analyses;
      const analyses: any[] = typeof analysesRaw === 'string' 
        ? JSON.parse(analysesRaw) 
        : (Array.isArray(analysesRaw) ? analysesRaw : []);
      
      for (const analysis of analyses) {
        if (!analysis || typeof analysis !== 'object') continue;
        
        const analysisObj = analysis as any;
        const promptTests = Array.isArray(analysisObj.promptTests) ? analysisObj.promptTests : []
        
        for (const test of promptTests) {
          const citations = Array.isArray(test.citations) ? test.citations : []
          
          for (const citation of citations) {
            // Extract domain from URL
            let domain = ''
            let url = ''
            
            if (typeof citation === 'string') {
              url = citation
            } else if (citation.url) {
              url = citation.url
            } else if (citation.link) {
              url = citation.link
            }
            
            if (url) {
              try {
                const urlObj = new URL(url)
                domain = urlObj.hostname.replace(/^www\./, '')
                
                if (domain) {
                  const existing = citationMap.get(domain) || { count: 0, urls: new Set<string>() }
                  existing.count++
                  existing.urls.add(url)
                  citationMap.set(domain, existing)
                  totalCitationCount++
                }
              } catch (error) {
                // Invalid URL, skip
                console.warn('Invalid citation URL:', url)
              }
            }
          }
        }
      }
    }

    // Convert to array and calculate percentages
    const citations: CitationData[] = Array.from(citationMap.entries())
      .map(([domain, data]) => ({
        domain,
        count: data.count,
        percentage: totalCitationCount > 0 
          ? Math.round((data.count / totalCitationCount) * 100) 
          : 0,
        urls: Array.from(data.urls).slice(0, 5) // Include up to 5 sample URLs
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)

    return NextResponse.json({
      success: true,
      data: {
        citations,
        totalCitations: totalCitationCount,
        totalAnalyses: geoResults.length,
        periodDays: days,
        lastUpdated: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error fetching citation analytics:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: 'Failed to fetch citation analytics',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    )
  }
}
