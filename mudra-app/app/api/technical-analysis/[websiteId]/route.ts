import { NextRequest, NextResponse } from 'next/server'
import { getLatestAnalysis } from '@/lib/services/technical-analysis.service'

export async function GET(
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

    console.log(`📊 Fetching latest analysis for website: ${websiteId}`)

    const analysis = await getLatestAnalysis(websiteId)

    if (!analysis) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No analysis found for this website' 
        },
        { status: 404 }
      )
    }

    console.log(`✅ Retrieved analysis with overall score: ${analysis.overallScore}`)

    return NextResponse.json({
      success: true,
      data: {
        analysisId: analysis.id,
        websiteId: analysis.websiteId,
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
        recommendations: analysis.recommendations.map((rec: any) => ({
          id: rec.id,
          category: rec.category,
          severity: rec.severity,
          title: rec.title,
          description: rec.description,
          actionRequired: rec.actionRequired,
          impact: rec.impact,
          isCompleted: rec.isCompleted
        })),
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt
      }
    })

  } catch (error) {
    console.error('❌ Failed to retrieve analysis:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve analysis',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}