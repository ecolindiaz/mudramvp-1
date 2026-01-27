import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth/require-auth';
import { applyRateLimit } from '@/lib/auth/rate-limiter';

/**
 * POST /api/campaigns/setup-scale-ai
 * Create Scale AI brand profile and generate prompts
 * ADMIN/DEVELOPMENT ONLY - Creates demo brand profile
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimited = applyRateLimit(request, 'standard');
  if (rateLimited) return rateLimited;

  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    console.log('🚀 Setting up Scale AI brand profile...')
    
    // Create or update Scale AI brand profile
    const profile = await prisma.brandProfile.upsert({
      where: { id: 1 },
      update: {
        companyName: 'Scale AI',
        companyDescription: 'Scale AI is the data platform for AI, providing high-quality training data and human feedback for machine learning models. We help companies build, deploy, and improve their AI applications with enterprise-grade data labeling, RLHF, and model evaluation.',
        companyIndustry: 'AI/ML Data Platform',
        companyWebsite: 'https://scale.com',
        companyServices: 'Data labeling, RLHF, Model evaluation, Generative AI data, Computer vision, NLP, LLM fine-tuning',
        companyICP: 'AI/ML engineers, Data scientists, AI product teams at startups and enterprises',
        competitors: 'Labelbox, Snorkel AI, V7, Sama, SuperAnnotate',
        monthlySearchVolume: 'High',
        aiRecommendations: 'Improve technical documentation, Create more use-case content',
        stage: 'Growth',
        resources: 'Enterprise',
      },
      create: {
        companyName: 'Scale AI',
        companyDescription: 'Scale AI is the data platform for AI, providing high-quality training data and human feedback for machine learning models. We help companies build, deploy, and improve their AI applications with enterprise-grade data labeling, RLHF, and model evaluation.',
        companyIndustry: 'AI/ML Data Platform',
        companyWebsite: 'https://scale.com',
        companyServices: 'Data labeling, RLHF, Model evaluation, Generative AI data, Computer vision, NLP, LLM fine-tuning',
        companyICP: 'AI/ML engineers, Data scientists, AI product teams at startups and enterprises',
        competitors: 'Labelbox, Snorkel AI, V7, Sama, SuperAnnotate',
        monthlySearchVolume: 'High',
        aiRecommendations: 'Improve technical documentation, Create more use-case content',
        stage: 'Growth',
        resources: 'Enterprise',
      }
    })
    
    console.log(`✅ Brand profile created/updated: ${profile.companyName} (ID: ${profile.id})`)
    
    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        name: profile.companyName,
        industry: profile.companyIndustry
      },
      message: 'Scale AI profile created successfully. Now generate prompts via /api/campaigns/generate-prompts'
    })
    
  } catch (error: any) {
    console.error('❌ Error setting up Scale AI profile:', error)
    return NextResponse.json(
      { 
        error: 'Failed to setup Scale AI profile',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

