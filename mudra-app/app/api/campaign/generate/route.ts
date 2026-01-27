import { NextRequest, NextResponse } from "next/server"
import { OpenAI } from "openai" // Or Anthropic, etc.
import fs from "fs"
import path from "path"
import { requireAuth } from "@/lib/auth/require-auth";
import { applyRateLimit } from "@/lib/auth/rate-limiter";
import { getBrandProfileByUserId } from "@/lib/prisma-brand-profile";

// Helper to call LLM with a prompt
async function callLLM(prompt: string, context: any) {
  // Example: OpenAI completion
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [{ role: "system", content: prompt }, { role: "user", content: JSON.stringify(context) }],
    max_tokens: 512,
  })
  return response.choices[0].message.content
}

// Helper to load and filter growth strategies from JSONL
function getRelevantGrowthStrategies(channel: string): any[] {
  const filePath = path.join(process.cwd(), "llm", "dataset", "output", "growth_chunks.jsonl")
  if (!fs.existsSync(filePath)) return []
  const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean)
  const strategies = lines.map(line => {
    try {
      return JSON.parse(line)
    } catch {
      return null
    }
  }).filter(Boolean)
  // Filter strategies by channel (case-insensitive substring match)
  return strategies.filter(s =>
    s.channel && typeof s.channel === "string" &&
    s.channel.toLowerCase().includes(channel.toLowerCase())
  )
}

export async function POST(req: NextRequest) {  // Apply rate limiting (AI generation is expensive)
  const rateLimited = applyRateLimit(req, 'aiGeneration');
  if (rateLimited) return rateLimited;

  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult.response;
  }

  // Get user's brand profile
  const brandProfile = await getBrandProfileByUserId(authResult.user.id);
  if (!brandProfile) {
    return NextResponse.json(
      { success: false, error: { message: "Brand profile not found", code: "BRAND_PROFILE_NOT_FOUND" } },
      { status: 400 }
    );
  }
  const { company, description, industry, audience, features, competitors, website, stage, resources } = await req.json()

  // Step 1: Summarize startup context
  const contextSummary = await callLLM(
    "Summarize this startup’s core value, target audience, and market differentiators.",
    { company, description, industry, audience, features, competitors, website }
  )

  // Step 2: Recommend growth channels
  const channelsRaw = await callLLM(
    "Given this startup profile, recommend high-leverage growth channels appropriate for a small team. Respond ONLY with a JSON array of channel names, e.g. [\"SEO\", \"Content Marketing\", \"Paid Ads\"]",
    { contextSummary, stage, industry, resources }
  )
  let channels: string[] = []
  try {
    if (typeof channelsRaw === "string") {
      channels = JSON.parse(channelsRaw)
    }
  } catch (e) {
    // fallback: try to extract array from text
    if (typeof channelsRaw === "string") {
      const match = channelsRaw.match(/\[(.*?)\]/)
      if (match) {
        try {
          channels = JSON.parse(match[0])
        } catch {
          channels = []
        }
      } else {
        channels = []
      }
    }
  }

  // Step 3: Generate campaign ideas per channel, using RAG
  const campaigns = []
  for (const channel of channels) {
    // Retrieve relevant strategies for this channel
    const relevantStrategies = getRelevantGrowthStrategies(channel)
    // Pass strategies as extra context to LLM
    const ideasRaw = await callLLM(
      `For the ${channel} channel, generate 3 campaign ideas tailored to this startup’s audience and industry. Use these real-world strategies for inspiration: ${JSON.stringify(relevantStrategies)}. Respond ONLY with a JSON array of idea objects, e.g. [{"title":"Idea 1","description":"..."}]`,
      { contextSummary, channel, relevantStrategies }
    )
    let ideas
    try {
      ideas = JSON.parse(typeof ideasRaw === "string" ? ideasRaw : "[]")
    } catch (e) {
      // fallback: try to extract array from text
      const match = typeof ideasRaw === "string" ? ideasRaw.match(/\[(.*?)\]/) : null
      if (match) {
        try {
          ideas = JSON.parse(match[0])
        } catch {
          ideas = []
        }
      } else {
        ideas = []
      }
    }
    // Step 4: Score each campaign idea
    for (const idea of ideas) {
      const scoresRaw = await callLLM(
        "Score this campaign from 1–10 on impact, cost, and complexity. Return as JSON.",
        { idea }
      )
      let scores
      try {
        scores = JSON.parse(typeof scoresRaw === "string" ? scoresRaw : "{}")
      } catch (e) {
        scores = {}
      }
      campaigns.push({
        channel,
        ...idea,
        ...scores
      })
    }
  }

  // Step 5: Return structured campaign plan
  return NextResponse.json({ campaigns })
}