import { NextRequest, NextResponse } from 'next/server'
import { extractEnhancedGEOData } from '@/lib/scrapers/enhanced-geo-scraper'
import { generateAITasks } from '@/lib/services/ai-task-generation.service'

export async function POST(req: NextRequest) {
  try {
    const { url, companyContext } = await req.json()
    
    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL is required'
      }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(url)
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Invalid URL format'
      }, { status: 400 })
    }

    console.log(`🔍 Starting AI task generation for: ${url}`)
    
    // Step 1: Run GEO analysis
    console.log('Step 1: Running Enhanced GEO Analysis...')
    const geoResults = await extractEnhancedGEOData(url)
    
    console.log('Step 2: Generating AI tasks based on analysis...')
    // Step 2: Generate AI tasks based on analysis
    const tasks = await generateAITasks(geoResults, companyContext)
    
    console.log(`✅ Generated ${tasks.length} AI tasks successfully`)
    
    return NextResponse.json({
      success: true,
      data: {
        geoResults: {
          url: geoResults.url,
          timestamp: geoResults.timestamp,
          geoScore: geoResults.geoScore,
          // Include key analysis points for context
          structuredDataCount: geoResults.structuredData.jsonLd.length,
          hasOrganizationSchema: !!geoResults.structuredData.organizationSchema,
          hasFAQSchema: geoResults.structuredData.faqSchemas.length > 0,
          entitiesFound: {
            organizations: geoResults.entityRecognition.organizations.length,
            people: geoResults.entityRecognition.people.length,
            technologies: geoResults.entityRecognition.technologies.length
          }
        },
        tasks
      }
    })
  } catch (error) {
    console.error('❌ Failed to generate AI tasks:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate AI tasks'
    }, { status: 500 })
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}