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
    // Fallback system prompt - optimized for speed with 20 prompts
    return `You generate natural-language search queries to test a brand's visibility in generative engines.
Generate exactly 20 high-quality queries in 4 sections:
1) Organic (12 queries) - Generic discovery queries
2) Competitor (3 queries) - Queries comparing to competitors  
3) How-to Guides (3 queries) - Actionable task queries
4) Brand-Specific (2 queries) - Direct brand queries

Focus on the MOST IMPACTFUL queries that best represent how users search.

Output format:
Organic
1. [query]
2. [query]
...

Competitor
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

Generate 20 high-quality queries now (focusing on the most impactful prompts).`;

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Faster, cheaper model for prompt generation
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
      max_tokens: 1500, // Reduced for 20 prompts instead of 50
    });

    const text = response.choices[0]?.message?.content || '';
    return parseGeneratedPrompts(text);
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
 */
function generateFallbackPrompts(brandInfo: BrandInfo): GeneratedPrompts {
  const { companyName, industry, competitors } = brandInfo;
  
  return {
    organic: [
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
    ],
    competitor: competitors.slice(0, 3).map(comp => `${comp} vs alternatives`),
    howToGuides: [
      `How to choose the right ${industry} tool`,
      `Setting up ${industry} workflow for beginners`,
      `${industry} best practices for startups`,
    ],
    brandSpecific: [
      `What is ${companyName}?`,
      `${companyName} reviews and pricing`,
    ],
  };
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
