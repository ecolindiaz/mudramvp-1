import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface BrandInfo {
  companyName: string;
  companyDescription: string;
  industry: string;
  productsServices: string[];
  idealCustomer: string;
  competitors: string[];
}

export interface GeneratedPrompts {
  organic: string[];
  competitor: string[];
  howToGuides: string[];
  brandSpecific: string[];
}

/**
 * Load the prompt generation system from PromptGeneration.txt
 */
function getPromptGenerationSystem(): string {
  try {
    const promptPath = join(process.cwd(), 'lib', 'Mudra Prompts', 'PromptGeneration.txt');
    return readFileSync(promptPath, 'utf-8');
  } catch (error) {
    console.error('Failed to load PromptGeneration.txt:', error);
    // Fallback system prompt - uses the full 50-prompt specification
    return `You generate natural-language search queries to test a brand's visibility in generative engines.
Generate exactly 50 queries in 4 sections with this distribution:
1) Organic: 30 queries (60%) - Generic discovery queries, include 5 detailed/specific ones
2) Competitor: 8 queries (15%) - Queries comparing to competitors  
3) How-to Guides: 7 queries (15%) - Actionable task queries
4) Brand-Specific: 5 queries (10%) - Direct brand queries

Output format:
Organic
1. [query]
...

Competitor
1. [query]
...

How-to Guides
1. [query]
...

Brand-Specific
1. [query]
...`;
  }
}

/**
 * Generate sophisticated prompts using the Mudra prompt generation system
 */
export async function generateSophisticatedPrompts(brandInfo: BrandInfo): Promise<GeneratedPrompts> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const systemPrompt = getPromptGenerationSystem();
  
  const userPrompt = `INPUTS:
COMPANY_NAME: ${brandInfo.companyName}
COMPANY_DESCRIPTION: ${brandInfo.companyDescription}
INDUSTRY: ${brandInfo.industry}
PRODUCTS_SERVICES: ${brandInfo.productsServices.join(', ')}
IDEAL_CUSTOMER: ${brandInfo.idealCustomer}
COMPETITORS: ${brandInfo.competitors.join(', ')}

Generate 50 queries now, grouped and counted exactly as specified in the system prompt.`;

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log('[PromptGeneration] Generating 50 prompts using PromptGeneration.txt specification...');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Use more capable model for full 50-prompt generation
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 3500, // Increased for 50 prompts (was 1500 for 20)
    });

    const text = response.choices[0]?.message?.content || '';
    console.log('[PromptGeneration] Parsing generated prompts...');
    
    const result = parseGeneratedPrompts(text);
    console.log('[PromptGeneration] Generated:', {
      organic: result.organic.length,
      competitor: result.competitor.length,
      howToGuides: result.howToGuides.length,
      brandSpecific: result.brandSpecific.length,
      total: result.organic.length + result.competitor.length + result.howToGuides.length + result.brandSpecific.length
    });
    
    return result;
  } catch (error) {
    console.error('Failed to generate sophisticated prompts:', error);
    // Fallback to basic prompts
    return generateFallbackPrompts(brandInfo);
  }
}

/**
 * Parse the generated prompts from the AI response
 */
function parseGeneratedPrompts(text: string): GeneratedPrompts {
  const result: GeneratedPrompts = {
    organic: [],
    competitor: [],
    howToGuides: [],
    brandSpecific: [],
  };

  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  let currentSection: keyof GeneratedPrompts | null = null;

  for (const line of lines) {
    // Check for section headers
    if (line.toLowerCase() === 'organic') {
      currentSection = 'organic';
      continue;
    } else if (line.toLowerCase() === 'competitor') {
      currentSection = 'competitor';
      continue;
    } else if (line.toLowerCase() === 'how-to guides') {
      currentSection = 'howToGuides';
      continue;
    } else if (line.toLowerCase() === 'brand-specific') {
      currentSection = 'brandSpecific';
      continue;
    }

    // Parse numbered queries
    if (currentSection && line.match(/^\d+\.\s/)) {
      const query = line.replace(/^\d+\.\s/, '').trim();
      if (query) {
        result[currentSection].push(query);
      }
    }
  }

  return result;
}

/**
 * Generate fallback prompts if the sophisticated system fails
 * Distribution: 30 Organic, 8 Competitor, 7 How-to, 5 Brand-Specific
 */
function generateFallbackPrompts(brandInfo: BrandInfo): GeneratedPrompts {
  const { companyName, industry, competitors, idealCustomer } = brandInfo;
  
  return {
    organic: [
      // 30 Organic queries
      `Best ${industry} tools for small businesses`,
      `Top ${industry} solutions under $100/month`,
      `Affordable ${industry} platforms for startups`,
      `Most popular ${industry} services`,
      `${industry} software comparison`,
      `Free ${industry} tools for beginners`,
      `${industry} software reviews`,
      `Best ${industry} platforms for teams`,
      `${industry} tools for remote work`,
      `Cloud-based ${industry} solutions`,
      `${industry} automation tools`,
      `Enterprise ${industry} software`,
      `${industry} tools for ${idealCustomer}`,
      `Cheap ${industry} alternatives`,
      `No-code ${industry} platforms`,
      `Self-serve ${industry} tools`,
      `${industry} SaaS platforms`,
      `Modern ${industry} solutions`,
      `${industry} tools with API`,
      `Scalable ${industry} software`,
      // 5 detailed queries
      `Best ${industry} providers for enterprise-scale deployment`,
      `Which ${industry} tools integrate with Slack and Microsoft Teams`,
      `Most cost-effective ${industry} solutions for growing businesses`,
      `How to automate ${industry} workflows with modern tools`,
      `${industry} platforms with best customer support`,
      // More general
      `${industry} tools for small teams`,
      `${industry} software for non-technical users`,
      `${industry} platforms with free trials`,
      `${industry} tools for data privacy`,
      `${industry} solutions for compliance`,
    ],
    competitor: [
      // 8 Competitor queries
      ...competitors.slice(0, 5).map(comp => `${comp} alternatives`),
      ...competitors.slice(0, 3).map(comp => `${comp} vs other ${industry} tools`),
    ].slice(0, 8),
    howToGuides: [
      // 7 How-to queries
      `How to choose the right ${industry} tool`,
      `Setting up ${industry} workflow for beginners`,
      `${industry} best practices for startups`,
      `How to improve efficiency with ${industry} tools`,
      `Step-by-step guide to ${industry} automation`,
      `${industry} implementation guide for ${idealCustomer}`,
      `How to integrate ${industry} tools with existing workflows`,
    ],
    brandSpecific: [
      // 5 Brand-Specific queries
      `What is ${companyName}?`,
      `${companyName} reviews and pricing`,
      `Is ${companyName} good for ${idealCustomer}?`,
      `${companyName} vs competitors`,
      `${companyName} features and capabilities`,
    ],
  };
}

// --- Batch generation for AI-assisted prompt creation ---

export interface BatchGeneratedPrompt {
  text: string
  category: 'Organic' | 'Competitor' | 'How-to Guides' | 'Brand-Specific'
}

/**
 * Generate a batch of prompts based on a user description, with auto-assigned categories.
 * Uses JSON response format for reliable parsing.
 */
export async function generateBatchPrompts(
  description: string,
  count: number,
  existingPrompts: string[],
  brandInfo: BrandInfo
): Promise<BatchGeneratedPrompt[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt = `You generate natural-language search queries to test a brand's visibility in generative AI engines.

You will be given:
- A description of what kind of prompts the user wants
- Brand context (company, industry, ICP, competitors)
- A list of existing prompts to avoid duplicating

Generate exactly ${count} unique search queries that a real person would type into ChatGPT, Perplexity, or Google.

Category distribution guidelines:
- Organic (~60%): Generic discovery queries where the brand could naturally appear
- Competitor: Queries comparing or seeking alternatives to competitors
- How-to Guides: Actionable task/how-to queries related to the brand's domain
- Brand-Specific: Direct queries mentioning the brand name

Rules:
- Each query must be a natural search question or phrase (not a keyword)
- Do NOT duplicate or closely paraphrase any existing prompt
- Vary query styles: questions, comparisons, "best of" lists, how-tos, etc.
- Keep queries concise (under 120 characters each)

Return valid JSON in this exact format:
{
  "prompts": [
    { "text": "query text here", "category": "Organic" },
    ...
  ]
}

Categories must be exactly one of: "Organic", "Competitor", "How-to Guides", "Brand-Specific"`;

  const existingList = existingPrompts.length > 0
    ? `\n\nExisting prompts (DO NOT duplicate):\n${existingPrompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
    : '';

  const userPrompt = `Description of desired prompts: ${description}

Brand context:
- Company: ${brandInfo.companyName}
- Industry: ${brandInfo.industry}
- Description: ${brandInfo.companyDescription}
- Products/Services: ${brandInfo.productsServices.join(', ')}
- Ideal Customer: ${brandInfo.idealCustomer}
- Competitors: ${brandInfo.competitors.join(', ')}${existingList}

Generate exactly ${count} prompts now.`;

  console.log(`[BatchGeneration] Generating ${count} prompts with description: "${description}"`);

  const response = await openai.chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_completion_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from AI model');
  }

  let parsed: { prompts: BatchGeneratedPrompt[] };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Failed to parse AI response as JSON');
  }

  if (!Array.isArray(parsed.prompts) || parsed.prompts.length !== count) {
    throw new Error(
      `Expected ${count} prompts but got ${parsed.prompts?.length ?? 0}`
    );
  }

  const validCategories = ['Organic', 'Competitor', 'How-to Guides', 'Brand-Specific'];
  for (const prompt of parsed.prompts) {
    if (!prompt.text || typeof prompt.text !== 'string') {
      throw new Error('Invalid prompt: missing text');
    }
    if (!validCategories.includes(prompt.category)) {
      throw new Error(`Invalid category "${prompt.category}" for prompt "${prompt.text}"`);
    }
  }

  console.log(`[BatchGeneration] Successfully generated ${parsed.prompts.length} prompts`);
  return parsed.prompts;
}

/**
 * Convert brand profile to BrandInfo format
 */
export function profileToBrandInfo(profile: any): BrandInfo {
  // Handle competitors - could be array or comma-separated string
  let competitors: string[] = [];
  if (Array.isArray(profile.competitors)) {
    competitors = profile.competitors;
  } else if (typeof profile.competitors === 'string' && profile.competitors.trim()) {
    competitors = profile.competitors.split(',').map((c: string) => c.trim()).filter((c: string) => c);
  }
  
  return {
    companyName: profile.companyName || 'Unknown Company',
    companyDescription: profile.companyDescription || 'A technology company',
    industry: profile.companyIndustry || 'Technology',
    productsServices: profile.companyServices ? profile.companyServices.split(',').map((s: string) => s.trim()) : ['Software'],
    idealCustomer: profile.companyICP || 'Small to medium businesses',
    competitors: competitors.length > 0 ? competitors : ['Industry competitors'],
  };
}
