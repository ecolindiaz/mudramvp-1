// LLM Tweet Generation API Route
// Receives brand profile and tweet examples, builds the prompt, calls OpenAI, and returns tweets

import { NextRequest, NextResponse } from "next/server"
import { OpenAI } from "openai"
import { buildLLMTwitterPrompt } from "@/lib/llm/build-llm-twitter-prompts"

export async function POST(req: NextRequest) {
  // Accepts: { brandProfile, tweetExamples, campaignObjective }
  const { brandProfile, tweetExamples, campaignObjective } = await req.json()
  const prompt = buildLLMTwitterPrompt({ brandProfile, tweetExamples, campaignObjective })
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await openai.chat.completions.create({
    model: "gpt-4o", // Use a valid model name
    messages: [{ role: "system", content: prompt }],
    max_tokens: 256,
  })
  return NextResponse.json({ result: response.choices[0].message.content })
}
