// 4. LLM Generation
// This API route receives the brand profile, case studies, and constraints, builds the prompt, calls OpenAI, and returns campaign ideas.
// It should be called by the frontend after prompt construction.

import { NextRequest, NextResponse } from "next/server"
import { OpenAI } from "openai"
import { buildLLMPrompt } from "@/lib/llm/build-llm-prompt"

export async function POST(req: NextRequest) {
  // Accepts: { brandProfile, caseStudies, constraints }
  const { brandProfile, caseStudies, constraints } = await req.json()
  const prompt = buildLLMPrompt({ brandProfile, caseStudies, constraints })
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await openai.chat.completions.create({
    model: "gpt-4o", // Use a valid model name
    messages: [{ role: "system", content: prompt }],
    max_tokens: 512,
  })
  return NextResponse.json({ result: response.choices[0].message.content })
}
