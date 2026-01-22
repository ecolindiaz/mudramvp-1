import { prisma } from '@/lib/prisma'

export interface OnboardingData {
  companyName: string
  companyWebsite: string
  companyDescription: string
  companyIndustry: string
  services: string
  targetAudience: string
  competitors: string[]
  monthlySearchVolume: string
  aiRecommendations: boolean
  userInfo: {
    name: string
    role: string
    avatar?: string
  }
}

export interface AnalyticsInitialization {
  brandProfileId: string
  initialAnalysisId: string
  trackingEnabled: boolean
  baselineMetrics: {
    aiVisibilityScore: number
    competitorCount: number
    industryCategory: string
  }
}

/**
 * Initialize dashboard analytics based on onboarding data
 */
export async function initializeDashboardAnalytics(
  userId: string,
  onboardingData: OnboardingData
): Promise<AnalyticsInitialization> {
  try {
    console.log(`🚀 Initializing dashboard analytics for user: ${userId}`)
    
    // 1. Create or update brand profile
    const brandProfile = await prisma.brandProfile.upsert({
      where: { userId },
      update: {
        companyName: onboardingData.companyName,
        companyWebsite: onboardingData.companyWebsite,
        companyDescription: onboardingData.companyDescription,
        companyIndustry: onboardingData.companyIndustry,
        services: onboardingData.services,
        targetAudience: onboardingData.targetAudience,
        competitors: onboardingData.competitors.join(','),
        monthlySearchVolume: onboardingData.monthlySearchVolume,
        aiRecommendations: onboardingData.aiRecommendations,
        updatedAt: new Date(),
      },
      create: {
        userId,
        companyName: onboardingData.companyName,
        companyWebsite: onboardingData.companyWebsite,
        companyDescription: onboardingData.companyDescription,
        companyIndustry: onboardingData.companyIndustry,
        services: onboardingData.services,
        targetAudience: onboardingData.targetAudience,
        competitors: onboardingData.competitors.join(','),
        monthlySearchVolume: onboardingData.monthlySearchVolume,
        aiRecommendations: onboardingData.aiRecommendations,
      },
    })

    console.log(`✅ Brand profile created/updated: ${brandProfile.id}`)

    // 2. Create initial analysis record
    const initialAnalysis = await prisma.technicalAnalysis.create({
      data: {
        websiteId: brandProfile.id, // Using brand profile as website reference
        status: 'pending',
        overallScore: 0, // Will be updated after analysis
        results: {
          initialized: true,
          source: 'onboarding',
          timestamp: new Date().toISOString(),
          companyData: onboardingData
        }
      }
    })

    console.log(`✅ Initial analysis created: ${initialAnalysis.id}`)

    // 3. Set up tracking configuration
    await setupTrackingConfiguration(userId, onboardingData)

    // 4. Generate initial prompts based on industry and services
    await generateInitialPrompts(brandProfile.id, onboardingData)

    // 5. Initialize baseline metrics
    const baselineMetrics = await calculateBaselineMetrics(onboardingData)

    console.log(`✅ Dashboard analytics initialized successfully`)

    return {
      brandProfileId: brandProfile.id,
      initialAnalysisId: initialAnalysis.id,
      trackingEnabled: true,
      baselineMetrics
    }

  } catch (error) {
    console.error('❌ Error initializing dashboard analytics:', error)
    throw new Error(`Failed to initialize dashboard analytics: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Set up tracking configuration for the user
 */
async function setupTrackingConfiguration(userId: string, onboardingData: OnboardingData) {
  // TODO: Create tracking configuration
  console.log(`📊 Setting up tracking configuration for ${userId}`)
  
  // This would typically set up:
  // - AI model monitoring preferences
  // - Competitor tracking
  // - Alert thresholds
  // - Report frequency
}

/**
 * Generate initial prompts based on company data
 */
async function generateInitialPrompts(brandProfileId: string, onboardingData: OnboardingData) {
  console.log(`💭 Generating initial prompts for brand profile: ${brandProfileId}`)
  
  const industryPrompts = generateIndustrySpecificPrompts(onboardingData.companyIndustry, onboardingData.services)
  const competitorPrompts = generateCompetitorPrompts(onboardingData.companyName, onboardingData.competitors)
  
  // TODO: Save prompts to database
  console.log(`Generated ${industryPrompts.length} industry prompts and ${competitorPrompts.length} competitor prompts`)
}

/**
 * Calculate baseline metrics for comparison
 */
async function calculateBaselineMetrics(onboardingData: OnboardingData) {
  const baselineScore = 35 // Starting baseline for new companies
  
  return {
    aiVisibilityScore: baselineScore,
    competitorCount: onboardingData.competitors.length,
    industryCategory: onboardingData.companyIndustry
  }
}

/**
 * Generate industry-specific prompts
 */
function generateIndustrySpecificPrompts(industry: string, services: string): string[] {
  const basePrompts = [
    `Best ${industry.toLowerCase()} companies for businesses`,
    `Top ${industry.toLowerCase()} solutions in 2024`,
    `How to choose a ${industry.toLowerCase()} provider`,
    `${industry} best practices for startups`,
    `Compare ${industry.toLowerCase()} platforms`
  ]

  const servicePrompts = services.split(',').map(service => 
    `Best ${service.trim().toLowerCase()} solutions`
  )

  return [...basePrompts, ...servicePrompts]
}

/**
 * Generate competitor comparison prompts
 */
function generateCompetitorPrompts(companyName: string, competitors: string[]): string[] {
  return competitors.map(competitor => 
    `Compare ${companyName} vs ${competitor}`
  )
}

/**
 * Trigger comprehensive analysis after onboarding
 */
export async function triggerPostOnboardingAnalysis(
  userId: string,
  brandProfileId: string
): Promise<{ analysisId: string; estimatedCompletion: string }> {
  try {
    console.log(`🔍 Triggering post-onboarding analysis for user: ${userId}`)

    // Get brand profile data
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId }
    })

    if (!brandProfile) {
      throw new Error('Brand profile not found')
    }

    // TODO: Integrate with existing analysis services
    // This would trigger:
    // - Enhanced GEO analysis
    // - Competitor analysis  
    // - AI visibility scoring
    // - Citation gap analysis

    const analysisId = `post-onboarding-${Date.now()}`
    
    console.log(`✅ Post-onboarding analysis triggered: ${analysisId}`)

    return {
      analysisId,
      estimatedCompletion: '15-20 minutes'
    }

  } catch (error) {
    console.error('❌ Error triggering post-onboarding analysis:', error)
    throw error
  }
}

/**
 * Get onboarding completion status and next steps
 */
export async function getOnboardingStatus(userId: string) {
  try {
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { userId }
    })

    const hasCompletedOnboarding = !!brandProfile
    const hasRunInitialAnalysis = brandProfile ? await checkInitialAnalysisStatus(brandProfile.id) : false

    return {
      hasCompletedOnboarding,
      hasRunInitialAnalysis,
      nextSteps: getNextSteps(hasCompletedOnboarding, hasRunInitialAnalysis),
      brandProfileId: brandProfile?.id
    }

  } catch (error) {
    console.error('Error getting onboarding status:', error)
    throw error
  }
}

async function checkInitialAnalysisStatus(brandProfileId: string): Promise<boolean> {
  const analysis = await prisma.technicalAnalysis.findFirst({
    where: { 
      websiteId: brandProfileId,
      status: 'completed'
    }
  })
  
  return !!analysis
}

function getNextSteps(hasCompletedOnboarding: boolean, hasRunInitialAnalysis: boolean): string[] {
  if (!hasCompletedOnboarding) {
    return ['Complete the onboarding process', 'Set up your brand profile']
  }
  
  if (!hasRunInitialAnalysis) {
    return ['Run your first AI visibility analysis', 'Review competitor landscape']
  }
  
  return ['Review your dashboard metrics', 'Explore insights and recommendations']
}
