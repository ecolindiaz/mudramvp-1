import { NextRequest, NextResponse } from 'next/server'
import { getActivePrompts } from '@/lib/services/prompt-storage.service'

/**
 * GET /api/campaigns/prompts?brandProfileId={id}
 * Get active prompts for campaign creation
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const brandProfileId = searchParams.get('brandProfileId')

    if (!brandProfileId) {
      return NextResponse.json(
        { error: 'brandProfileId is required' },
        { status: 400 }
      )
    }

    const profileId = parseInt(brandProfileId)
    
    // Get active prompts for the brand profile
    const prompts = await getActivePrompts(profileId)

    // Define the exact order from Tracked Prompts page (first 12)
    const trackedPromptsOrder = [
      "Best data annotation tools for AI research labs in the AI/ML industry",
      "Affordable labeling data services for machine learning projects",
      "Top providers of supervised fine tuning data for AI models",
      "Alternatives to traditional data labeling for AI research labs",
      "How to improve model accuracy with high-quality training data",
      "Effective ways to source supervised fine tuning data for AI models",
      "What are the best practices for data labeling in machine learning?",
      "Recommendations for data quality tools for AI research projects",
      "How to choose a data provider for AI model enhancement",
      "Comparing data annotation services for AI and ML applications",
      "Who are the leading data annotation companies for training AI models?",
      "Which data providers specialize in RLHF datasets for LLMs?"
    ]

    // Sort prompts to match the Tracked Prompts page order
    const sortedPrompts = trackedPromptsOrder
      .map(text => prompts.find(p => p.text === text))
      .filter((prompt): prompt is NonNullable<typeof prompt> => prompt !== undefined)

    // Transform prompts to the format expected by the campaigns page
    const promptOptions = sortedPrompts.map(prompt => ({
      id: prompt.id,
      text: prompt.text,
      category: prompt.category
    }))

    return NextResponse.json({ 
      success: true, 
      prompts: promptOptions,
      count: promptOptions.length
    })
  } catch (error) {
    console.error('Error fetching prompts for campaigns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500 }
    )
  }
}
