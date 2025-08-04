import { NextRequest, NextResponse } from 'next/server'

// AI Visibility calculation prompts
const AI_VISIBILITY_PROMPTS = [
  "What are the best startup accelerators in the world?",
  "How can I get funding for my early-stage startup and where can I apply?",
  "What startup accelerator has backed Airbnb, Dropbox, and Stripe?",
  "Which startup programs help you build and scale fast?",
  "Best startup incubators for SaaS founders?",
  "What accelerator gives you funding and mentorship in Silicon Valley?",
  "How do I increase my startup's chances of getting VC funding and who are the top vcs in here?",
  "Which accelerators have the best global founder community?",
  "What are the most successful startup accelerators for tech companies?",
  "Which incubators offer the best post-program support and alumni network?"
]

interface AIVisibilityResult {
  prompt: string
  response: string
  mentioned: boolean
  position: number | null
  weight: number
}

interface AIVisibilityScore {
  totalScore: number
  maxPossibleScore: number
  percentage: number
  mentionCount: number
  averagePosition: number
  results: AIVisibilityResult[]
}

// Scoring weights based on mention position
const POSITION_WEIGHTS = {
  1: 10,
  2: 8,
  3: 6,
  4: 4,
  5: 3,
  6: 2,
  7: 1.5,
  8: 1,
  9: 0.5,
  10: 0.3
} as const

async function queryOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || ''
  } catch (error) {
    console.error('Error querying OpenAI:', error)
    throw error
  }
}

function analyzeMention(response: string, companyName: string): { mentioned: boolean; position: number | null } {
  if (!response || !companyName) {
    return { mentioned: false, position: null }
  }

  // Convert to lowercase for case-insensitive search
  const lowerResponse = response.toLowerCase()
  const lowerCompanyName = companyName.toLowerCase()

  // Check if company is mentioned
  const mentioned = lowerResponse.includes(lowerCompanyName)
  
  if (!mentioned) {
    return { mentioned: false, position: null }
  }

  // Find position by splitting into sentences and looking for first mention
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0)
  
  for (let i = 0; i < sentences.length; i++) {
    if (sentences[i].toLowerCase().includes(lowerCompanyName)) {
      return { mentioned: true, position: i + 1 }
    }
  }

  // Fallback: if mentioned but position unclear, assume middle position
  return { mentioned: true, position: Math.ceil(sentences.length / 2) }
}

function calculateWeight(position: number | null): number {
  if (position === null) return 0
  
  // Use predefined weights or calculate based on position
  if (position <= 10) {
    return POSITION_WEIGHTS[position as keyof typeof POSITION_WEIGHTS] || 0.1
  }
  
  // For positions beyond 10, use diminishing returns
  return Math.max(0.1, 1 / position)
}

export async function POST(request: NextRequest) {
  try {
    const { companyName } = await request.json()

    if (!companyName) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      )
    }

    console.log(`Calculating AI Visibility score for: ${companyName}`)

    const results: AIVisibilityResult[] = []
    let totalScore = 0
    let maxPossibleScore = 0
    let mentionCount = 0
    let totalPosition = 0

    // Query each prompt and analyze responses
    for (const prompt of AI_VISIBILITY_PROMPTS) {
      try {
        console.log(`Querying: "${prompt}"`)
        
        const response = await queryOpenAI(prompt)
        const analysis = analyzeMention(response, companyName)
        const weight = calculateWeight(analysis.position)

        const result: AIVisibilityResult = {
          prompt,
          response,
          mentioned: analysis.mentioned,
          position: analysis.position,
          weight
        }

        results.push(result)

        if (analysis.mentioned) {
          totalScore += weight
          mentionCount += 1
          if (analysis.position) {
            totalPosition += analysis.position
          }
        }

        // Max possible score assumes first position (weight 10) for each prompt
        maxPossibleScore += 10

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        console.error(`Error processing prompt: "${prompt}"`, error)
        // Continue with other prompts even if one fails
        results.push({
          prompt,
          response: 'Error: Could not get response',
          mentioned: false,
          position: null,
          weight: 0
        })
        maxPossibleScore += 10
      }
    }

    const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0
    const averagePosition = mentionCount > 0 ? totalPosition / mentionCount : 0

    const aiVisibilityScore: AIVisibilityScore = {
      totalScore,
      maxPossibleScore,
      percentage: Math.round(percentage * 100) / 100, // Round to 2 decimal places
      mentionCount,
      averagePosition: Math.round(averagePosition * 100) / 100,
      results
    }

    console.log(`AI Visibility calculation complete:`, {
      percentage: aiVisibilityScore.percentage,
      mentionCount,
      averagePosition: aiVisibilityScore.averagePosition
    })

    return NextResponse.json(aiVisibilityScore)

  } catch (error) {
    console.error('Error calculating AI Visibility score:', error)
    return NextResponse.json(
      { error: 'Failed to calculate AI Visibility score' },
      { status: 500 }
    )
  }
}