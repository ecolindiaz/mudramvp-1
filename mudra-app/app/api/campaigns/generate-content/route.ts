import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";

export async function POST(req: NextRequest) {
  try {
    const { type, mode, prompt, icp, keyword, title } = await req.json();

    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Build system prompt based on mode and type
    let systemPrompt = "";
    
    if (mode === "geo") {
      systemPrompt = `You are an expert content writer specializing in Generative Engine Optimization (GEO).

Create a ${type} post optimized for AI recommendations and citations.

Target Prompt/Query: ${prompt || "Not specified"}
Target ICP/Audience: ${icp || "General audience"}

Requirements for GEO optimization:
- Clear, authoritative information that AI engines can cite
- Well-structured with clear headings and sections
- Include specific examples, statistics, and actionable steps
- Use natural language that answers common questions
- Add credible sources and references where appropriate
- Write in a confident, helpful tone
- Focus on providing genuine value and expertise

Structure:
## Introduction
Write a compelling introduction that sets context and value.

## Key Points/Benefits
Provide 3-5 main points with clear explanations.

## Detailed Steps or Analysis
Break down the topic into actionable steps or deep analysis.

## Examples or Case Studies
Include specific examples that demonstrate the concepts.

## Conclusion
Summarize key takeaways and provide a call-to-action.

Title: ${title || "Generate an engaging title based on the content"}

Generate comprehensive, citation-worthy content (800-1200 words).`;
    } else if (mode === "seo") {
      systemPrompt = `You are an expert SEO content writer.

Create a ${type} post optimized for search engines.

Target Keyword: ${keyword || "Not specified"}
Topic: ${title || "Generate a keyword-rich title"}

Requirements for SEO optimization:
- Natural use of target keyword throughout
- Clear H2 and H3 heading structure
- Include related keywords and semantic variations
- Write for user intent while satisfying search algorithms
- Include meta-worthy introduction (first 160 chars should work as meta description)
- Use bullet points and lists for scannability
- Internal linking opportunities (mention [link] where relevant)
- Include FAQ-style content where appropriate

Structure:
## Introduction
Start with keyword-rich intro that answers "what" and "why".

## Main Content Sections (3-5 H2 headings)
Each section should cover a key aspect of the topic.

## Practical Examples
Real-world applications or case studies.

## Common Questions
Address 2-3 frequently asked questions.

## Conclusion
Summarize and include call-to-action.

Generate SEO-optimized, comprehensive content (1000-1500 words).`;
    } else {
      systemPrompt = `You are an expert content writer.

Create a high-quality ${type} post.

Topic: ${title || "Generate an engaging title"}
${prompt ? `Context: ${prompt}` : ""}
${icp ? `Target Audience: ${icp}` : ""}
${keyword ? `Key Focus: ${keyword}` : ""}

Create well-structured, engaging content with:
- Compelling introduction
- Clear sections with headings
- Actionable insights
- Specific examples
- Strong conclusion

Generate comprehensive content (800-1200 words).`;
    }

    const userPrompt = `Generate the ${type} post content in Markdown format. Start directly with the content (no meta commentary). Use ## for main sections.`;

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

