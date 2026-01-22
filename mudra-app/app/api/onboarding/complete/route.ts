import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { initializeDashboardAnalytics, triggerPostOnboardingAnalysis } from '@/lib/services/onboarding-analytics.service'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const onboardingData = await request.json()

    console.log(`🎯 Processing onboarding completion for user: ${session.user.id}`)

    // Validate required fields
    const requiredFields = ['companyName', 'companyWebsite', 'companyIndustry', 'services']
    const missingFields = requiredFields.filter(field => !onboardingData[field])
    
    if (missingFields.length > 0) {
      return NextResponse.json({ 
        error: 'Missing required fields', 
        missingFields 
      }, { status: 400 })
    }

    // Initialize dashboard analytics
    const analyticsResult = await initializeDashboardAnalytics(
      session.user.id,
      {
        ...onboardingData,
        userInfo: {
          name: session.user.name || 'User',
          role: onboardingData.userRole || 'Admin',
          avatar: session.user.image
        }
      }
    )

    console.log(`✅ Analytics initialized:`, analyticsResult)

    // Trigger post-onboarding analysis
    const analysisResult = await triggerPostOnboardingAnalysis(
      session.user.id,
      analyticsResult.brandProfileId
    )

    console.log(`✅ Post-onboarding analysis triggered:`, analysisResult)

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully',
      data: {
        brandProfileId: analyticsResult.brandProfileId,
        initialAnalysisId: analyticsResult.initialAnalysisId,
        postOnboardingAnalysisId: analysisResult.analysisId,
        estimatedCompletion: analysisResult.estimatedCompletion,
        baselineMetrics: analyticsResult.baselineMetrics,
        redirectTo: '/dashboard' // Where to redirect after completion
      }
    })

  } catch (error) {
    console.error('❌ Error completing onboarding:', error)
    return NextResponse.json(
      { 
        error: 'Failed to complete onboarding',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check onboarding status
    const { getOnboardingStatus } = await import('@/lib/services/onboarding-analytics.service')
    const status = await getOnboardingStatus(session.user.id)

    return NextResponse.json({
      success: true,
      data: status
    })

  } catch (error) {
    console.error('❌ Error getting onboarding status:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get onboarding status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
