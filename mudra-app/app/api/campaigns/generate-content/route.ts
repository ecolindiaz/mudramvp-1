import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import { getCombinedSystemPrompt } from "@/lib/prompts/load-system-prompts";
import { requireAuth } from "@/lib/auth/require-auth";
import { applyRateLimitAsync } from "@/lib/auth/rate-limiter-redis";

export async function POST(req: NextRequest) {
  // Apply rate limiting (AI generation is expensive)
  const rateLimited = await applyRateLimitAsync(req, 'aiGeneration');
  if (rateLimited) return rateLimited;

  try {
    // Require authentication
    const authResult = await requireAuth();
    if (!authResult.success) {
      return authResult.response;
    }

    const { type, mode, prompt, icp, keyword, title } = await req.json();

    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Build system prompt using the combined system prompts
    const systemPrompt = getCombinedSystemPrompt(mode, type, prompt, icp, keyword, title);

    // Format type labels
    const formatLabels: Record<string, string> = {
      blog: "blog post",
      listicle: "listicle",
      howto: "how-to guide",
      guide: "comprehensive guide",
    }
    const formatLabel = formatLabels[type] || "blog post"
    
    const userPrompt = `Generate the ${formatLabel} content in Markdown format. Start directly with the content (no meta commentary). Use ## for main sections.`;

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 3000,
      temperature: 0.7,
    });

    const content = response.choices[0].message.content || "";

    // Extract title if present in content
    let generatedTitle = title;
    let body = content;

    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      generatedTitle = titleMatch[1];
      body = content.replace(/^#\s+.+$/m, "").trim();
    }

    return NextResponse.json({
      success: true,
      title: generatedTitle || `Generated ${type} Post`,
      body: body,
      metadata: {
        type,
        mode,
        wordCount: body.split(/\s+/).length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Content generation error:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Failed to generate content" 
      },
      { status: 500 }
    );
  }
}

