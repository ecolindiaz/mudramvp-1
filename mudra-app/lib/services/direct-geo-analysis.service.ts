import { generateSophisticatedPrompts, profileToBrandInfo, type GeneratedPrompts } from './prompt-generation.service';

// Types for direct GEO analysis
export interface DirectGEOConfig {
  brandName: string;
  industry?: string;
  description?: string;
  competitors?: string[];
  targetAudience?: string;
  keyProducts?: string[];
  apiKeys: {
    openai?: string;
    anthropic?: string;
    google?: string;
    perplexity?: string;
  };
}

export interface DirectGEOResult {
  brandName: string;
  overallScore: number;
  analyses: ProviderAnalysis[];
  competitorComparison: CompetitorAnalysis[];
  recommendations: string[];
  timestamp: Date;
}

export interface ProviderAnalysis {
  provider: string;
  promptTests: PromptTest[];
  brandVisibilityScore: number;
  averagePosition: number;
  mentionRate: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface PromptTest {
  prompt: string;
  response: string;
  brandMentioned: boolean;
  brandPosition?: number;
  competitors: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
}

export interface CompetitorAnalysis {
  name: string;
  mentionCount: number;
  averagePosition: number;
  shareOfVoice: number;
}

/**
 * Generate contextual prompts for GEO testing using sophisticated prompt generation
 */
async function generateGEOPrompts(config: DirectGEOConfig): Promise<string[]> {
  try {
    // Convert config to BrandInfo format
    const brandInfo = {
      companyName: config.brandName,
      companyDescription: config.description || `${config.brandName} is a company in the ${config.industry || 'technology'} industry`,
      industry: config.industry || 'technology',
      productsServices: config.keyProducts || ['software solutions'],
      idealCustomer: config.targetAudience || 'small to medium businesses',
      competitors: config.competitors || [],
    };

    // Generate sophisticated prompts using the Mudra system
    const generatedPrompts = await generateSophisticatedPrompts(brandInfo);
    
    // Combine all prompt categories for testing
    const allPrompts = [
      ...generatedPrompts.organic.slice(0, 8),        // Top 8 organic queries
      ...generatedPrompts.competitor.slice(0, 4),     // Top 4 competitor queries  
      ...generatedPrompts.howToGuides.slice(0, 2),    // Top 2 how-to queries
      ...generatedPrompts.brandSpecific.slice(0, 2),  // Top 2 brand-specific queries
    ];

    console.log(`Generated ${allPrompts.length} sophisticated prompts using Mudra system`);
    return allPrompts;

  } catch (error) {
    console.error('Failed to generate sophisticated prompts, falling back to basic prompts:', error);
    
    // Fallback to basic prompts
    return generateBasicPrompts(config);
  }
}

/**
 * Fallback basic prompt generation
 */
function generateBasicPrompts(config: DirectGEOConfig): string[] {
  const { brandName, industry, keyProducts, competitors } = config;
  
  const basePrompts = [
    // Direct ranking prompts
    `What are the best ${keyProducts?.[0] || `${industry} tools`} in 2024?`,
    `Top 10 ${industry || 'software'} companies ranked by quality`,
    `Most recommended ${keyProducts?.[0] || `${industry} solutions`} for businesses`,
    
    // Comparison prompts
    competitors?.length 
      ? `${brandName} vs ${competitors.slice(0, 2).join(' vs ')} comparison`
      : `How does ${brandName} compare to other ${industry} solutions?`,
    
    // Alternative seeking prompts
    `Best alternatives to ${competitors?.[0] || `popular ${industry} tools`}`,
    `${brandName} competitors and alternatives`,
    
    // Recommendation prompts
    `Is ${brandName} worth it for ${keyProducts?.[0] || `${industry} needs`}?`,
    `${brandName} reviews and recommendations`,
    `Should I choose ${brandName} or other ${industry} options?`,
    
    // Problem-solving prompts
    keyProducts?.[0] 
      ? `Best ${keyProducts[0]} for small businesses`
      : `Top ${industry} solutions for startups`,
  ];

  return basePrompts.filter(Boolean);
}

/**
 * Check if provider API is available
 */
function isProviderAvailable(provider: string, apiKeys: DirectGEOConfig['apiKeys']): boolean {
  switch (provider) {
    case 'openai':
      return !!apiKeys.openai;
    case 'anthropic':
      return !!apiKeys.anthropic;
    case 'google':
      return !!apiKeys.google;
    default:
      return false;
  }
}

/**
 * Analyze a single prompt with a provider
 */
async function analyzePromptWithProvider(
  prompt: string,
  provider: string,
  config: DirectGEOConfig
): Promise<PromptTest> {
  if (!config.apiKeys.openai) {
    throw new Error('OpenAI API key required for analysis');
  }

  // For now, use OpenAI for all analysis to avoid model compatibility issues
  // We can expand to other providers later
  const OpenAI = require('openai').default;
  const openai = new OpenAI({
    apiKey: config.apiKeys.openai,
  });

  // System prompt for consistent ranking behavior
  const systemPrompt = `You are an expert advisor providing rankings and recommendations.

When asked about tools, services, or companies:
1. Provide specific rankings with positions (1st, 2nd, etc.)
2. Be objective and factual
3. Focus on quality, features, and user satisfaction
4. Include brief explanations for rankings
5. If you don't have enough information about a specific company, mention that

Be helpful and comprehensive in your response.`;

  try {
    // Get the provider's response to the prompt
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    const text = response.choices[0]?.message?.content || '';

    // Analyze the response for brand mentions and sentiment
    const analysisPrompt = `Analyze this response about ${config.brandName}:

Response: "${text}"

Extract:
1. Is ${config.brandName} mentioned anywhere? (even in passing)
2. What position/rank does ${config.brandName} have (if any)?
3. Which of these competitors are mentioned: ${config.competitors?.join(', ') || 'None specified'}
4. What's the sentiment towards ${config.brandName}?
5. How confident are you in this analysis?

Provide a brief explanation of your findings.`;

    const analysisResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing text for brand mentions and sentiment. Respond with a JSON object containing: brandMentioned (boolean), brandPosition (number or null), competitorsMentioned (array of strings), sentiment ("positive", "neutral", or "negative"), confidence (number 0-1), explanation (string).',
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const analysisText = analysisResponse.choices[0]?.message?.content || '{}';
    
    // Try to parse JSON, with fallback
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch {
      analysis = {
        brandMentioned: text.toLowerCase().includes(config.brandName.toLowerCase()),
        brandPosition: undefined,
        competitorsMentioned: [],
        sentiment: 'neutral' as const,
        confidence: 0.5,
        explanation: 'Failed to parse analysis',
      };
    }

    return {
      prompt,
      response: text,
      brandMentioned: analysis.brandMentioned || false,
      brandPosition: analysis.brandPosition,
      competitors: analysis.competitorsMentioned || [],
      sentiment: analysis.sentiment || 'neutral',
      confidence: analysis.confidence || 0.5,
    };
  } catch (error) {
    console.error(`Error analyzing with ${provider}:`, error);
    throw error;
  }
}

/**
 * Calculate brand visibility metrics
 */
function calculateBrandMetrics(tests: PromptTest[]): {
  visibilityScore: number;
  averagePosition: number;
  mentionRate: number;
  sentiment: 'positive' | 'neutral' | 'negative';
} {
  const totalTests = tests.length;
  const mentionedTests = tests.filter(t => t.brandMentioned);
  const mentionRate = mentionedTests.length / totalTests;
  
  // Calculate average position (only for tests where brand was mentioned with position)
  const rankedTests = mentionedTests.filter(t => t.brandPosition !== undefined);
  const averagePosition = rankedTests.length > 0 
    ? rankedTests.reduce((sum, t) => sum + (t.brandPosition || 0), 0) / rankedTests.length
    : 0;
  
  // Calculate visibility score (0-100)
  // Based on mention rate and average position
  let visibilityScore = mentionRate * 50; // Base score from mention rate
  if (averagePosition > 0) {
    // Add position bonus (better positions = higher score)
    const positionBonus = Math.max(0, (10 - averagePosition) / 10) * 50;
    visibilityScore += positionBonus;
  }
  
  // Calculate overall sentiment
  const sentimentCounts = {
    positive: tests.filter(t => t.sentiment === 'positive').length,
    neutral: tests.filter(t => t.sentiment === 'neutral').length,
    negative: tests.filter(t => t.sentiment === 'negative').length,
  };
  
  const dominantSentiment = Object.entries(sentimentCounts)
    .sort(([,a], [,b]) => b - a)[0][0] as 'positive' | 'neutral' | 'negative';

  return {
    visibilityScore: Math.round(visibilityScore),
    averagePosition,
    mentionRate,
    sentiment: dominantSentiment,
  };
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(
  config: DirectGEOConfig,
  analyses: ProviderAnalysis[]
): string[] {
  const recommendations: string[] = [];
  const overallMentionRate = analyses.reduce((sum, a) => sum + a.mentionRate, 0) / analyses.length;
  const overallScore = analyses.reduce((sum, a) => sum + a.brandVisibilityScore, 0) / analyses.length;

  if (overallMentionRate < 0.3) {
    recommendations.push(`Increase content marketing and thought leadership to improve AI model awareness of ${config.brandName}`);
  }

  if (overallScore < 40) {
    recommendations.push(`Create more comprehensive documentation and case studies to help AI models better understand your value proposition`);
  }

  const avgPosition = analyses.reduce((sum, a) => sum + a.averagePosition, 0) / analyses.length;
  if (avgPosition > 5) {
    recommendations.push(`Focus on building authority through industry partnerships and customer testimonials to improve ranking positions`);
  }

  // Add competitor-specific recommendations
  const competitorMentions = analyses.flatMap(a => 
    a.promptTests.flatMap(t => t.competitors)
  ).reduce((acc, comp) => {
    acc[comp] = (acc[comp] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topCompetitor = Object.entries(competitorMentions)
    .sort(([,a], [,b]) => b - a)[0]?.[0];

  if (topCompetitor) {
    recommendations.push(`Study ${topCompetitor}'s content strategy and positioning to understand why they appear more frequently in AI responses`);
  }

  if (config.keyProducts?.length) {
    recommendations.push(`Create detailed product comparison pages and feature matrices to help AI models better categorize and recommend ${config.keyProducts.join(' and ')}`);
  }

  return recommendations;
}

/**
 * Main function to run direct GEO analysis
 */
export async function runDirectGEOAnalysis(config: DirectGEOConfig): Promise<DirectGEOResult> {
  console.log(`Starting direct GEO analysis for ${config.brandName}...`);
  
  // Generate test prompts
  const prompts = await generateGEOPrompts(config);
  console.log(`Generated ${prompts.length} test prompts`);
  
  // Get available providers (for now, just use OpenAI to avoid compatibility issues)
  const availableProviders = config.apiKeys.openai ? ['openai'] : [];
  
  if (availableProviders.length === 0) {
    throw new Error('OpenAI API key required for analysis');
  }
  
  console.log(`Testing with providers: ${availableProviders.join(', ')}`);
  
  const analyses: ProviderAnalysis[] = [];
  
  // Run analysis for each provider
  for (const provider of availableProviders) {
    console.log(`Analyzing with ${provider}...`);
    const promptTests: PromptTest[] = [];
    
    // Test each prompt with this provider
    for (const prompt of prompts.slice(0, 6)) { // Limit to 6 prompts to control costs
      try {
        const test = await analyzePromptWithProvider(prompt, provider, config);
        promptTests.push(test);
        console.log(`  ✓ "${prompt.substring(0, 50)}..." - Brand mentioned: ${test.brandMentioned}`);
      } catch (error) {
        console.error(`  ✗ Failed prompt: ${prompt.substring(0, 50)}...`, error);
      }
    }
    
    // Calculate metrics for this provider
    const metrics = calculateBrandMetrics(promptTests);
    
    analyses.push({
      provider: provider.charAt(0).toUpperCase() + provider.slice(1),
      promptTests,
      brandVisibilityScore: metrics.visibilityScore,
      averagePosition: metrics.averagePosition,
      mentionRate: metrics.mentionRate,
      sentiment: metrics.sentiment,
    });
    
    console.log(`  ${provider} results: ${metrics.visibilityScore}/100 score, ${Math.round(metrics.mentionRate * 100)}% mention rate`);
  }
  
  // Calculate competitor comparison
  const allCompetitorMentions = analyses.flatMap(a => 
    a.promptTests.flatMap(t => t.competitors)
  );
  
  const competitorStats = config.competitors?.map(comp => {
    const mentions = allCompetitorMentions.filter(mention => 
      mention.toLowerCase().includes(comp.toLowerCase())
    ).length;
    
    return {
      name: comp,
      mentionCount: mentions,
      averagePosition: 0, // Could be calculated if we tracked competitor positions
      shareOfVoice: mentions / allCompetitorMentions.length,
    };
  }) || [];
  
  // Calculate overall score
  const overallScore = Math.round(
    analyses.reduce((sum, a) => sum + a.brandVisibilityScore, 0) / analyses.length
  );
  
  // Generate recommendations
  const recommendations = generateRecommendations(config, analyses);
  
  console.log(`✅ Analysis complete! Overall score: ${overallScore}/100`);
  
  return {
    brandName: config.brandName,
    overallScore,
    analyses,
    competitorComparison: competitorStats,
    recommendations,
    timestamp: new Date(),
  };
}

/**
 * Create a simplified configuration from minimal inputs
 */
export function createDirectGEOConfig(
  brandName: string,
  website?: string,
  options: {
    industry?: string;
    description?: string;
    competitors?: string[];
    apiKeys?: Partial<DirectGEOConfig['apiKeys']>;
  } = {}
): DirectGEOConfig {
  return {
    brandName,
    industry: options.industry || 'technology',
    description: options.description || `${brandName} is a company in the ${options.industry || 'technology'} industry`,
    competitors: options.competitors || [],
    apiKeys: {
      openai: options.apiKeys?.openai || process.env.OPENAI_API_KEY,
      anthropic: options.apiKeys?.anthropic || process.env.ANTHROPIC_API_KEY,
      google: options.apiKeys?.google || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      perplexity: options.apiKeys?.perplexity || process.env.PERPLEXITY_API_KEY,
    },
  };
}
