import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createWebsiteIfNotExists, saveAnalysisResults } from '@/lib/services/technical-analysis.service'
import { extractEnhancedGEOData } from '@/lib/scrapers/enhanced-geo-scraper'

const TriggerAnalysisSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  websiteUrl: z.string().url("Must be a valid URL")
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const validatedData = TriggerAnalysisSchema.parse(body)
    const { userId, websiteUrl } = validatedData

    console.log(`= Starting technical analysis for ${websiteUrl}`)

    const website = await createWebsiteIfNotExists(userId, websiteUrl)
    
    const scraperResults = await extractEnhancedGEOData(websiteUrl)
    
    const analysis = await saveAnalysisResults(website.id, scraperResults)

    console.log(` Technical analysis completed for ${websiteUrl}`)

    return NextResponse.json({
      success: true,
      data: {
        analysisId: analysis.id,
        websiteId: website.id,
        overallScore: analysis.overallScore,
        status: 'completed'
      }
    })

  } catch (error) {
    console.error('L Technical analysis failed:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid input data',
          details: error.errors 
        },
        { status: 400 }
      )
    }

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
        error: 'Failed to analyze website',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}