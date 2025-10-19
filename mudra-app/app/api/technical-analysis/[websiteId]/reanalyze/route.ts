import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { saveAnalysisResults } from '@/lib/services/technical-analysis.service'
import { extractEnhancedGEOData } from '@/lib/scrapers/enhanced-geo-scraper'

const prisma = new PrismaClient()

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  try {
    const { websiteId } = await params

    if (!websiteId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Website ID is required' 
        },
        { status: 400 }
      )
    }

    console.log(`= Starting re-analysis for website: ${websiteId}`)

    // Get the website record to extract the URL
    const website = await prisma.website.findUnique({
      where: { id: websiteId }
    })

    if (!website) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Website not found' 
        },
        { status: 404 }
      )
    }

    console.log(`=
 Re-analyzing website: ${website.url}`)

    // Run fresh analysis using the enhanced GEO scraper
    const scraperResults = await extractEnhancedGEOData(website.url)
    
    // Save new analysis results (creates new record, doesn't overwrite)
    const analysis = await saveAnalysisResults(website.id, scraperResults)

    console.log(` Re-analysis completed for ${website.url} - New score: ${analysis.overallScore}`)

    return NextResponse.json({
      success: true,
      data: {
        analysisId: analysis.id,
        websiteId: website.id,
        sourceUrl: analysis.sourceUrl,
        timestamp: analysis.timestamp,
        scores: {
          overall: analysis.overallScore,
          contentAuthority: analysis.contentAuthority,
          technicalAccessibility: analysis.technicalAccessibility,
          structuredData: analysis.structuredData,
          entityRecognition: analysis.entityRecognition,
          faqOptimization: analysis.faqOptimization,
          contentFreshness: analysis.contentFreshness
        },
        status: 'completed'
      }
    })

  } catch (error) {
    console.error('L Re-analysis failed:', error)
    
    if (error instanceof Error && error.message.includes('FIRECRAWL_API_KEY')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Configuration error: Missing API key' 
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to re-analyze website',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}