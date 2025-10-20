// 4. LLM Generation
// This API route receives the brand profile, case studies, and constraints, builds the prompt, calls OpenAI, and returns campaign ideas.
// It should be called by the frontend after prompt construction.

import { NextRequest, NextResponse } from "next/server"
import { OpenAI } from "openai"
import { buildLLMPrompt, fetchRelevantCaseStudies } from "@/lib/llm/build-llm-prompt"

export async function POST(req: NextRequest) {
  try {
    // Accepts: { brandProfile, caseStudies, constraints, campaignObjective }
    const { brandProfile, caseStudies: providedCaseStudies, constraints, campaignObjective } = await req.json()
    
    // If no case studies provided, fetch them using RAG
    let caseStudies = providedCaseStudies || []
    if (!caseStudies || caseStudies.length === 0) {
      try {
        // Build query from brand profile for better RAG retrieval
        const query = `${brandProfile?.companyDescription || ''} ${brandProfile?.companyIndustry || ''} ${brandProfile?.companyServices || ''} ${campaignObjective || ''}`.trim()
        if (query) {
          caseStudies = await fetchRelevantCaseStudies(query, 10)
        }
      } catch (error) {
        console.warn('Failed to fetch case studies, continuing without them:', error)
        caseStudies = []
      }
    }
    
    // Build the prompt with all context
    const prompt = buildLLMPrompt({ 
      brandProfile, 
      caseStudies, 
      constraints, 
      campaignObjective 
    })
    
    // Call OpenAI with increased token limit for better campaign generation
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: prompt }],
      max_tokens: 2048, // Increased for detailed campaign strategies
      temperature: 0.7, // Balance between creativity and consistency
    })
    
    return NextResponse.json({ 
      result: response.choices[0].message.content,
      caseStudiesUsed: caseStudies.length 
    })
  } catch (error: any) {
    console.error('Campaign generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate campaigns' },
      { status: 500 }
    )
  }
}
