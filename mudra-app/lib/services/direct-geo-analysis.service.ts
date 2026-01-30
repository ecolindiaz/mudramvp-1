import { generateSophisticatedPrompts, profileToBrandInfo, type GeneratedPrompts } from './prompt-generation.service';
import { validateCompetitors, type ValidatedCompetitor } from './competitor-validation.service';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Utility: Sleep function for retry delays
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry helper with exponential backoff for rate limits and transient errors
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries - 1;
      const isRetryable = 
        error.status === 429 || // Rate limit
        error.status === 500 || // Server error
        error.status === 502 || // Bad gateway
        error.status === 503 || // Service unavailable
        error.status === 504 || // Gateway timeout
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('timeout');
      
      if (!isRetryable || isLastAttempt) {
        throw error;
      }
      
      const delay = initialDelay * Math.pow(2, attempt);
      console.warn(`⚠️  Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms due to: ${error.message}`);
      await sleep(delay);
    }
  }
  
  throw new Error('Max retries exceeded');
}

// Types for direct GEO analysis
export interface Citation {
  title?: string;
  url: string;
  snippet?: string;
  position?: number;
}

export interface DirectGEOConfig {
  brandName: string;
  industry?: string;
  description?: string;
  competitors?: string[];
  targetAudience?: string;
  keyProducts?: string[];
  customPrompts?: Array<string | { text: string; category?: string }>; // Support both string[] and objects with categories
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
  validatedCompetitors?: ValidatedCompetitor[]; // AI-validated competitors with confidence scores
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
  promptCategory?: string; // Category for intent weighting
  response: string;
  brandMentioned: boolean;
  brandPosition?: number;
  competitors: string[];
  competitorPositions?: Record<string, number>; // Maps competitor name to their position
  competitorSentiments?: Record<string, 'positive' | 'neutral' | 'negative'>; // Maps competitor name to sentiment
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  citations?: Citation[]; // Inline citations referenced in response
  sources?: Citation[]; // All URLs retrieved during web search
  searchQueries?: string[]; // Queries used for grounding (Gemini)
}

export interface CompetitorAnalysis {
  name: string;
  mentionCount: number;
  averagePosition: number;
  shareOfVoice: number;
}

/**
 * Validate brand mention using regex with word boundaries
 */
function validateBrandMention(text: string, brandName: string): boolean {
  const escapedBrand = brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b${escapedBrand}\\b`, 'i');
  
  const cleanedText = text
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/www\.[^\s]+/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '');
  
  return pattern.test(cleanedText);
}

/**
 * Filter competitors to only include valid company names
 */
function filterValidCompetitors(competitors: string[], brandName: string): string[] {
  if (!competitors || !Array.isArray(competitors)) return [];
  
  const brandLower = brandName.toLowerCase();
  
  return competitors.filter(comp => {
    if (!comp || typeof comp !== 'string') return false;
    
    const compLower = comp.toLowerCase().trim();
    
    if (compLower === brandLower || compLower.includes(brandLower)) return false;
    if (comp.length < 2 || comp.length > 40) return false;
    
    // CRITICAL: Filter out generic category terms that are NOT company names
    const genericTerms = [
      // Career/Job related generic terms
      'networking', 'internships', 'internships and co', 'career fairs', 'career services',
      'job portals', 'online job portals', 'job boards', 'resume builders',
      'professional certifications', 'coding competitions', 'hackathons',
      'coding competitions and hackathons', 'technical blogs', 'portfolios',
      'technical blogs and portfolios', 'alumni networks', 'mentorship',
      'career advising', 'career coaching', 'mock interviews', 'interview prep',
      'company career pages', 'recruitment agencies', 'virtual career summit',
      // Education related
      'online courses', 'bootcamps', 'workshops', 'webinars', 'tutorials',
      'certification programs', 'degree programs', 'moocs', 'scholarships',
      // Tech generic terms
      'open source', 'software solutions', 'cloud services', 'web development',
      'mobile development', 'data science', 'machine learning', 'ai tools',
      // Generic phrases that look like categories
      'industry events', 'meetups', 'conferences', 'summits', 'forums',
      'communities', 'professional organizations', 'associations', 'groups',
      'platforms', 'resources', 'tools', 'services', 'solutions',
    ];
    if (genericTerms.includes(compLower)) return false;
    
    // Filter out generic terms that start with common category indicators
    const categoryStarts = [
      'online ', 'virtual ', 'professional ', 'technical ', 'coding ',
      'career ', 'job ', 'industry ', 'software ', 'tech ', 'digital ',
    ];
    for (const start of categoryStarts) {
      if (compLower.startsWith(start)) {
        // Check if the rest looks like a generic term
        const rest = compLower.slice(start.length);
        const genericRest = [
          'courses', 'events', 'services', 'platforms', 'resources', 'tools',
          'communities', 'networks', 'groups', 'forums', 'boards', 'fairs',
          'certifications', 'workshops', 'bootcamps', 'programs', 'portals',
        ];
        if (genericRest.includes(rest)) return false;
      }
    }
    
    const invalidStarts = [
      'others ', 'other ', 'posts ', 'reach out', 'sign up', 'check out',
      'learn more', 'get started', 'the ', 'a ', 'an ', 'some ', 'many ',
      'leading ', 'top ', 'best ', 'great ', 'amazing ', 'excellent ',
      'consider ', 'explore ', 'visit ', 'contact ', 'try ', 'use ',
      // Sentence starters that indicate this is a phrase, not a company name
      'as ', 'like ', 'such ', 'for ', 'with ', 'and ', 'or ', 'but ',
      'if ', 'when ', 'while ', 'although ', 'because ', 'since ',
      'however ', 'therefore ', 'thus ', 'hence ', 'also ', 'even ',
      'this ', 'that ', 'these ', 'those ', 'it ', 'they ', 'we ', 'you ',
      'i ', 'my ', 'our ', 'your ', 'their ', 'its ', 'his ', 'her ',
    ];
    if (invalidStarts.some(start => compLower.startsWith(start))) return false;

    const actionPatterns = [
      ' share ', ' highlight', ' recommend', ' suggest', ' contact ',
      ' directly', ' their team', ' your ', ' to your ', ' can help',
      ' sign up', ' check out', ' learn more', ' get started',
      ' might ', ' should ', ' could ', ' would ', ' will ',
      // Verb patterns that indicate this is a sentence, not a company name
      ' is ', ' are ', ' was ', ' were ', ' has ', ' have ', ' had ',
      ' does ', ' do ', ' did ', ' can ', ' may ', ' must ',
      ' being ', ' been ', ' having ', ' doing ',
      // Common sentence connectors
      ' that ', ' which ', ' who ', ' whom ', ' whose ', ' where ',
      ' because ', ' since ', ' although ', ' though ', ' while ',
    ];
    if (actionPatterns.some(pattern => compLower.includes(pattern))) return false;

    // Max 3 spaces (4 words) - company names rarely have more
    // Examples that pass: "The Home Depot", "JPMorgan Chase & Co"
    // Examples that fail: "As amazon is the best"
    const spaceCount = (comp.match(/\s/g) || []).length;
    if (spaceCount > 3) return false;
    
    if (/[.!?:]$/.test(comp)) return false;
    
    const knownLowercaseBrands = ['npm', 'github', 'gitlab', 'docker', 'kubernetes', 'redis', 'mongodb'];
    if (comp === compLower && !knownLowercaseBrands.includes(compLower)) {
      if (!/[A-Z]/.test(comp) && comp.length > 5) return false;
    }
    
    return true;
  });
}

/**
 * Generate contextual prompts for GEO testing using sophisticated prompt generation
 * Returns array of objects with text and category for intent weighting
 */
async function generateGEOPrompts(config: DirectGEOConfig): Promise<Array<{ text: string; category?: string }>> {
  // If custom prompts are provided (from database), use them directly
  if (config.customPrompts && config.customPrompts.length > 0) {
    console.log(`✅ Using ${config.customPrompts.length} custom prompts from database`);
    
    // Normalize prompts to objects with text and category
    return config.customPrompts.map(p => 
      typeof p === 'string' ? { text: p } : p
    );
  }
  
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
    
    // Combine all prompt categories with their categories for intent weighting
    const allPrompts = [
      ...generatedPrompts.organic.map(text => ({ text, category: 'Organic' })),
      ...generatedPrompts.competitor.map(text => ({ text, category: 'Competitor' })),
      ...generatedPrompts.howToGuides.map(text => ({ text, category: 'How-to Guides' })),
      ...generatedPrompts.brandSpecific.map(text => ({ text, category: 'Brand-Specific' })),
    ];

    console.log(`✅ Generated ${allPrompts.length} sophisticated prompts with categories`);
    console.log(`   - Organic: ${generatedPrompts.organic.length}`);
    console.log(`   - Competitor: ${generatedPrompts.competitor.length}`);
    console.log(`   - How-to Guides: ${generatedPrompts.howToGuides.length}`);
    console.log(`   - Brand-Specific: ${generatedPrompts.brandSpecific.length}`);
    
    return allPrompts;

  } catch (error) {
    console.error('Failed to generate sophisticated prompts, falling back to basic prompts:', error);
    
    // Fallback to basic prompts without categories
    return generateBasicPrompts(config).map(text => ({ text }));
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
    case 'perplexity':
      return !!apiKeys.perplexity;
    default:
      return false;
  }
}

/**
 * Analyze a single prompt with a provider
 * Exported for use by single-prompt analysis service
 */
export async function analyzePromptWithProvider(
  prompt: string,
  provider: string,
  config: DirectGEOConfig
): Promise<PromptTest> {
  // Route to appropriate provider function
  switch (provider) {
    case 'openai':
      return await analyzeWithOpenAI(prompt, config);
    case 'perplexity':
      return await analyzeWithPerplexity(prompt, config);
    case 'anthropic':
      return await analyzeWithAnthropic(prompt, config);
    case 'google':
      return await analyzeWithGoogle(prompt, config);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Extract competitor positions using regex patterns (more reliable than LLM for structured lists)
 */
function extractCompetitorPositionsWithRegex(text: string, brandName: string): Record<string, number> {
  const positions: Record<string, number> = {};
  
  // Method 1: Standard numbered list "1. Company" or "1. **Company**"
  const numberedListRegex = /^(\d+)\.\s+\*?\*?([^*\n]+?)\*?\*?(?:\s*[-:]|$)/gm;
  let match;
  
  while ((match = numberedListRegex.exec(text)) !== null) {
    const pos = parseInt(match[1]);
    let company = match[2].trim();
    
    // Clean up company name (remove trailing colons, asterisks, markdown)
    company = company.replace(/[:\*]+$/, '').trim();
    company = company.split(/\n/)[0].trim(); // Take only first line
    
    if (company && company.toLowerCase() !== brandName.toLowerCase() && company.length > 2) {
      positions[company] = pos;
    }
  }
  
  // Method 2: "### 1st Place:" or "### 1st:" format
  const headingRankRegex = /###\s*(\d+)(?:st|nd|rd|th)\s+(?:Place)?:?\s*\*?\*?([^*\n]+)/gi;
  
  while ((match = headingRankRegex.exec(text)) !== null) {
    const pos = parseInt(match[1]);
    let company = match[2].trim();
    company = company.replace(/[:\*]+$/, '').trim();
    
    if (company && company.toLowerCase() !== brandName.toLowerCase() && company.length > 2) {
      if (!positions[company]) { // Don't overwrite if already found
        positions[company] = pos;
      }
    }
  }
  
  // Method 3: "1st Place: Company" or "Ranked 1st: Company" inline format
  const inlineRankRegex = /(?:Ranked\s+)?(\d+)(?:st|nd|rd|th)\s+(?:Place)?:?\s+\*?\*?([A-Z][^.\n]{2,40}?)\*?\*?(?=\s|$|\*|\n)/g;
  
  while ((match = inlineRankRegex.exec(text)) !== null) {
    const pos = parseInt(match[1]);
    let company = match[2].trim();
    company = company.replace(/[:\*]+$/, '').trim();
    
    if (company && company.toLowerCase() !== brandName.toLowerCase() && company.length > 2) {
      if (!positions[company]) {
        positions[company] = pos;
      }
    }
  }
  
  // Method 4: Markdown table rows (extract position from row order)
  // This is specifically for Perplexity responses with tables
  // Extract from tables ONLY if we found fewer than 3 numbered positions
  if (Object.keys(positions).length < 3) {
    const lines = text.split('\n');
    let inTable = false;
    let tablePosition = 0;
    
    for (const line of lines) {
      // Detect table separator (|----|----|----|)
      if (line.match(/^\|[\s\-:]+\|/)) {
        inTable = true;
        continue;
      }
      
      // If we're in a table, extract company names from rows
      if (inTable && line.startsWith('|')) {
        // Match: | **Company Name** | ... | ... |
        const rowMatch = line.match(/^\|\s*\*?\*?([^|\*\n]{3,50}?)\*?\*?\s*\|/);
        
        if (rowMatch) {
          let company = rowMatch[1].trim();
          
          // Skip if it looks like a header or separator
          if (company.toLowerCase().includes('accelerator') || 
              company.toLowerCase().includes('funding') ||
              company.toLowerCase().includes('equity') ||
              company.toLowerCase().includes('focus') ||
              company === '') {
            continue;
          }
          
          tablePosition++;
          
          if (company && company.toLowerCase() !== brandName.toLowerCase()) {
            // Only add if not already found via numbered list
            if (!positions[company]) {
              positions[company] = tablePosition;
            }
          }
        }
      } else if (inTable) {
        // Empty line or non-table line means table ended
        inTable = false;
      }
    }
  }
  
  return positions;
}

/**
 * Analyze with OpenAI
 */
async function analyzeWithOpenAI(
  prompt: string,
  config: DirectGEOConfig
): Promise<PromptTest> {
  if (!config.apiKeys.openai) {
    console.error('❌ OpenAI API key is missing in config.apiKeys');
    throw new Error('OpenAI API key required for analysis');
  }

  const apiKey = config.apiKeys.openai;
  const openai = new OpenAI({
    apiKey: apiKey.trim(),
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
    // Get the provider's response
    // Note: OpenAI's web_search tool is not yet in stable API
    // Using GPT-4o for best quality responses
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Using GPT-4o for better quality
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
      max_tokens: 1200,
    });

    const text = response.choices[0]?.message?.content || '';
    
    // Citations not available in standard OpenAI API yet
    // Will be added when web_search tool becomes available in stable API
    const citations: Citation[] | undefined = undefined;

    // Analyze the response for brand mentions and sentiment using AI
    const analysisPrompt = `Analyze this AI-generated response to determine brand visibility:

BRAND NAME: ${config.brandName}
COMPETITORS: ${config.competitors?.join(', ') || 'None specified'}

RESPONSE TEXT:
"${text}"

Extract the following information:

1. **brandMentioned**: Is "${config.brandName}" mentioned anywhere in the response? (true/false)

2. **brandPosition**: What numerical ranking/position is "${config.brandName}" given?
   - Look for patterns like "1st", "2nd", "3rd", "#1", "first place", "ranked 1", etc.
   - Extract ONLY the number (1, 2, 3, etc.)
   - If no explicit position/ranking is found, return null
   - Examples:
     * "### 1st: Y Combinator" → 1
     * "2nd Place: Y Combinator" → 2  
     * "#3: Y Combinator" → 3
     * "Y Combinator is mentioned but no ranking" → null

3. **competitorsMentioned**: Array of OTHER company/brand names mentioned in the response (EXCLUDING "${config.brandName}" itself)
   - Extract ALL proper company names that are competitors, alternatives, or mentioned alongside the brand
   - Include EVERY company name found in rankings, comparisons, lists, or as alternatives (not just top 3-5)
   - Include full company names with proper formatting (e.g., "Techstars", "500 Global", "a16z", "Entrepreneurs First", "Boost VC")
   - Capture ALL companies even if they appear later in long lists (positions 4, 5, 6, 7, etc.)
   - Exclude generic terms like "startups", "companies", "accelerators" unless they are actual brand names
   - Return empty array [] if no competitors are mentioned
   - Examples:
     * From "Top 5 accelerators: 1. Y Combinator, 2. Techstars, 3. 500 Global, 4. Seedcamp, 5. MassChallenge"
       → competitorsMentioned should be: ["Techstars", "500 Global", "Seedcamp", "MassChallenge"]
     * From "Top 7: 1. YC, 2. Techstars, 3. 500 Global, 4. a16z Speedrun, 5. Antler, 6. Entrepreneurs First, 7. Boost VC"
       → competitorsMentioned should be: ["Techstars", "500 Global", "a16z Speedrun", "Antler", "Entrepreneurs First", "Boost VC"]

4. **competitorPositions**: Object mapping competitor names to their positions (if they appear in a ranking)
   - Extract numerical positions for each competitor mentioned
   - Format: { "CompanyName": position_number }
   - Only include competitors that have an explicit position/ranking
   - Examples:
     * "2. Techstars" → { "Techstars": 2 }
     * "3rd: 500 Startups" → { "500 Startups": 3 }
     * From "Top 5: 1. Y Combinator, 2. Techstars, 3. 500 Startups"
       → { "Techstars": 2, "500 Startups": 3 }
   - Return empty object {} if no competitors have positions

5. **competitorSentiments**: Object mapping competitor names to sentiment about them in this specific response
   - Analyze how each competitor is portrayed/discussed in the response text
   - Format: { "CompanyName": "positive" | "neutral" | "negative" }
   - **positive**: Praised, recommended, highlighted positively, described with superlatives ("excellent", "best", "top", "leading", "outstanding")
   - **neutral**: Mentioned factually without strong opinion, listed in rankings without commentary, or described objectively
   - **negative**: Criticized, mentioned negatively, described as inferior or problematic
   - Examples:
     * "Techstars is excellent for mentorship and has strong network" → { "Techstars": "positive" }
     * "500 Global offers $150K for 6% equity" → { "500 Global": "neutral" }
     * "Antler has faced criticism for..." → { "Antler": "negative" }
   - Include ALL competitors from competitorsMentioned array
   - Default to "neutral" if no clear sentiment indicators are present

6. **sentiment**: Overall sentiment toward "${config.brandName}" in this response:
   - "positive" if the response praises, recommends, or ranks highly
   - "neutral" if factual/balanced with no clear opinion
   - "negative" if critical or dismissive

7. **confidence**: How confident are you in this analysis? (0.0 to 1.0)

Return ONLY a valid JSON object with these exact keys:
{
  "brandMentioned": boolean,
  "brandPosition": number or null,
  "competitorsMentioned": string[],
  "competitorPositions": { [key: string]: number },
  "competitorSentiments": { [key: string]: "positive" | "neutral" | "negative" },
  "sentiment": "positive" | "neutral" | "negative",
  "confidence": number,
  "explanation": "brief reasoning"
}`;

    const analysisResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing AI responses for brand visibility. Extract position/ranking numbers carefully for both the brand and competitors. Respond ONLY with valid JSON - no markdown, no code blocks, just the JSON object.',
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" }, // Force JSON output
    });

    const analysisText = analysisResponse.choices[0]?.message?.content || '{}';
    
    // Try to parse JSON, with fallback
    let analysis;
    try {
      // Remove markdown code blocks if present
      const cleanedText = analysisText.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleanedText);
    } catch (parseError) {
      console.warn(`Failed to parse AI analysis, using fallback extraction:`, parseError);
      
      // Fallback: manual regex extraction with smart filtering
      const brandNameLower = config.brandName.toLowerCase();
      const textLower = text.toLowerCase();
      
      // Remove common false positive contexts before checking
      const cleanedTextForBrand = textLower
        // Remove URLs (http://... or https://... or www...)
        .replace(/https?:\/\/[^\s]+/g, '')
        .replace(/www\.[^\s]+/g, '')
        // Remove email addresses
        .replace(/[\w.-]+@[\w.-]+\.\w+/g, '')
        // Remove code blocks (markdown ``` or backticks)
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`]+`/g, '')
        // Remove file paths (contains slashes)
        .replace(/[a-z0-9_-]+\/[a-z0-9_\/-]+/gi, '');
      
      // Use word boundary regex to avoid matching partial words
      const wordBoundaryRegex = new RegExp(`\\b${brandNameLower}\\b`, 'i');
      const brandMentioned = wordBoundaryRegex.test(cleanedTextForBrand);
      
      // Try to extract position with regex
      let brandPosition = null;
      const positionPatterns = [
        new RegExp(`(?:^|\\n)(?:###?\\s*)?([1-9]\\d?)(?:st|nd|rd|th)(?:\\s*[Pp]lace)?:?\\s*\\*?\\*?${config.brandName}`, 'i'),
        new RegExp(`#([1-9]\\d?):\\s*${config.brandName}`, 'i'),
        new RegExp(`(?:ranked?|position)\\s*#?([1-9]\\d?).*${config.brandName}`, 'i'),
      ];
      
      for (const pattern of positionPatterns) {
        const match = text.match(pattern);
        if (match) {
          brandPosition = parseInt(match[1], 10);
          break;
        }
      }
      
      // Heuristic sentiment analysis
      let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
      if (brandMentioned) {
        const positiveWords = ['best', 'top', 'leading', 'premier', 'excellent', 'outstanding', 'highly regarded', 'prestigious', 'renowned'];
        const negativeWords = ['worst', 'poor', 'inadequate', 'failing', 'struggling'];
        
        const contextStart = Math.max(0, textLower.indexOf(brandNameLower) - 100);
        const contextEnd = Math.min(textLower.length, textLower.indexOf(brandNameLower) + brandNameLower.length + 100);
        const context = textLower.substring(contextStart, contextEnd);
        
        const hasPositive = positiveWords.some(word => context.includes(word));
        const hasNegative = negativeWords.some(word => context.includes(word));
        
        if (hasPositive && !hasNegative) sentiment = 'positive';
        else if (hasNegative && !hasPositive) sentiment = 'negative';
        else if (brandPosition && brandPosition <= 3) sentiment = 'positive'; // Top 3 ranking = positive
      }
      
      // Try to extract competitor names (basic heuristic)
      const competitors: string[] = [];
      
      // Pattern 1: Numbered lists with company names (e.g., "2. Techstars")
      const numberedListPattern = /(?:^|\n)\s*(?:[0-9]+[\.\)]|[-•])\s*\*?\*?([A-Z][A-Za-z0-9\s&]+(?:AI|Labs|Inc|LLC|Corp|Ltd)?)\*?\*?(?:\s*[-:]|\n|$)/g;
      let match;
      while ((match = numberedListPattern.exec(text)) !== null) {
        const companyName = match[1].trim();
        if (companyName !== config.brandName && companyName.length > 2 && companyName.length < 50) {
          if (!competitors.includes(companyName)) {
            competitors.push(companyName);
          }
        }
      }
      
      // Pattern 2: Companies mentioned in comparisons (e.g., "including X, Y, and Z")
      const comparisonPattern = /(?:including|such as|like|versus|vs|compared to|alternatives?:?)\s+([A-Z][A-Za-z0-9\s,&]+(?:AI|Labs|Inc|LLC|Corp|Ltd)?)/gi;
      while ((match = comparisonPattern.exec(text)) !== null) {
        const companyList = match[1].split(/,\s*(?:and\s+)?|(?:\s+and\s+)/);
        companyList.forEach(name => {
          const companyName = name.trim().replace(/\.$/, '');
          if (companyName !== config.brandName && companyName.length > 2 && companyName.length < 50) {
            if (!competitors.includes(companyName)) {
              competitors.push(companyName);
            }
          }
        });
      }
      
      // Limit to top 10 competitors
      const finalCompetitors = competitors.slice(0, 10);
      
      analysis = {
        brandMentioned,
        brandPosition,
        competitorsMentioned: finalCompetitors,
        competitorPositions: {}, // Fallback doesn't extract positions
        sentiment,
        confidence: 0.6,
        explanation: 'Fallback regex extraction used',
      };
    }

    // ENHANCEMENT: Use regex extraction to fill in missing positions
    // This is more reliable than LLM for structured numbered lists
    const regexPositions = extractCompetitorPositionsWithRegex(text, config.brandName);
    
    // Merge regex positions with LLM positions (regex takes priority for missing values)
    const mergedPositions = { ...(analysis.competitorPositions || {}) };
    
    // For each competitor mentioned, try to get position from regex if not in LLM result
    (analysis.competitorsMentioned || []).forEach((competitor: string) => {
      // Check if this competitor has a regex-extracted position
      const regexMatch = Object.keys(regexPositions).find(
        regexComp => regexComp.toLowerCase() === competitor.toLowerCase() ||
                     regexComp.includes(competitor) ||
                     competitor.includes(regexComp)
      );
      
      if (regexMatch && !mergedPositions[competitor]) {
        mergedPositions[competitor] = regexPositions[regexMatch];
      }
    });
    
    // Also add any regex-found competitors that LLM might have missed
    Object.entries(regexPositions).forEach(([company, position]) => {
      const alreadyMentioned = (analysis.competitorsMentioned || []).some(
        (comp: string) => comp.toLowerCase() === company.toLowerCase()
      );
      
      if (!alreadyMentioned) {
        analysis.competitorsMentioned = [...(analysis.competitorsMentioned || []), company];
        mergedPositions[company] = position;
      }
    });

    // CRITICAL: Validate brand mention using regex (not just LLM analysis)
    const regexBrandMentioned = validateBrandMention(text, config.brandName);
    
    // CRITICAL: Filter out generic terms that aren't real companies
    const validatedCompetitors = filterValidCompetitors(analysis.competitorsMentioned || [], config.brandName);

    return {
      prompt,
      response: text,
      brandMentioned: regexBrandMentioned,
      brandPosition: analysis.brandPosition,
      competitors: validatedCompetitors,
      competitorPositions: mergedPositions,
      competitorSentiments: analysis.competitorSentiments || {},
      sentiment: analysis.sentiment || 'neutral',
      confidence: analysis.confidence || 0.5,
      citations,
    };
  } catch (error) {
    console.error(`Error analyzing with OpenAI:`, error);
    throw error;
  }
}

/**
 * Analyze with Perplexity
 */
async function analyzeWithPerplexity(
  prompt: string,
  config: DirectGEOConfig
): Promise<PromptTest> {
  if (!config.apiKeys.perplexity) {
    throw new Error('Perplexity API key required for analysis');
  }

  const apiKey = config.apiKeys.perplexity;
  
  console.log('[Perplexity] API Key configured:', apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4));

  // Perplexity uses OpenAI-compatible API
  const perplexity = new OpenAI({
    apiKey: apiKey.trim(),
    baseURL: 'https://api.perplexity.ai',
  });

  try {
    // Get the provider's response to the prompt
    // Perplexity's sonar models are optimized for search and current information
    // Using sonar-pro for enhanced search quality and citations
    // Reference: https://docs.perplexity.ai/guides/model-cards
    console.log('[Perplexity] Testing prompt:', prompt.substring(0, 60) + '...');
    
    const response: any = await perplexity.chat.completions.create({
      model: 'sonar-pro', // Pro model with enhanced search and citations
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    });

    const text = response.choices[0]?.message?.content || '';
    console.log('[Perplexity] Response received:', text.substring(0, 100) + '...');
    
    // Extract citations from Perplexity response
    // Perplexity returns citations in the response object
    const citations: Citation[] = [];
    
    if (response.citations && Array.isArray(response.citations)) {
      response.citations.forEach((url: string, index: number) => {
        citations.push({
          url: url,
          position: index + 1,
        });
      });
      console.log(`[Perplexity] Extracted ${citations.length} citations`);
    }

    // Use OpenAI to analyze the Perplexity response for brand mentions
    if (!config.apiKeys.openai) {
      throw new Error('OpenAI API key required for analyzing Perplexity responses');
    }

    const openai = new OpenAI({
      apiKey: config.apiKeys.openai.trim(),
    });

    // Analyze the response for brand mentions and sentiment using AI
    const analysisPrompt = `Analyze this AI-generated response to determine brand visibility:

BRAND NAME: ${config.brandName}
COMPETITORS: ${config.competitors?.join(', ') || 'None specified'}

RESPONSE TEXT:
"${text}"

Extract the following information:

1. **brandMentioned**: Is "${config.brandName}" mentioned anywhere in the response? (true/false)

2. **brandPosition**: What numerical ranking/position is "${config.brandName}" given?
   - Look for patterns like "1st", "2nd", "3rd", "#1", "first place", "ranked 1", etc.
   - Extract ONLY the number (1, 2, 3, etc.)
   - If no explicit position/ranking is found, return null
   - Examples:
     * "### 1st: Y Combinator" → 1
     * "2nd Place: Y Combinator" → 2  
     * "#3: Y Combinator" → 3
     * "Y Combinator is mentioned but no ranking" → null

3. **competitorsMentioned**: Array of OTHER company/brand names mentioned in the response (EXCLUDING "${config.brandName}" itself)
   - Extract ALL proper company names that are competitors, alternatives, or mentioned alongside the brand
   - Include EVERY company name found in rankings, comparisons, lists, or as alternatives (not just top 3-5)
   - Include full company names with proper formatting (e.g., "Techstars", "500 Global", "a16z", "Entrepreneurs First", "Boost VC")
   - Capture ALL companies even if they appear later in long lists (positions 4, 5, 6, 7, etc.)
   - Exclude generic terms like "startups", "companies", "accelerators" unless they are actual brand names
   - Return empty array [] if no competitors are mentioned
   - Examples:
     * From "Top 5 accelerators: 1. Y Combinator, 2. Techstars, 3. 500 Global, 4. Seedcamp, 5. MassChallenge"
       → competitorsMentioned should be: ["Techstars", "500 Global", "Seedcamp", "MassChallenge"]
     * From "Top 7: 1. YC, 2. Techstars, 3. 500 Global, 4. a16z Speedrun, 5. Antler, 6. Entrepreneurs First, 7. Boost VC"
       → competitorsMentioned should be: ["Techstars", "500 Global", "a16z Speedrun", "Antler", "Entrepreneurs First", "Boost VC"]

4. **competitorPositions**: Object mapping competitor names to their positions (if they appear in a ranking)
   - Extract numerical positions for each competitor mentioned
   - Format: { "CompanyName": position_number }
   - Only include competitors that have an explicit position/ranking
   - Examples:
     * "2. Techstars" → { "Techstars": 2 }
     * "3rd: 500 Startups" → { "500 Startups": 3 }
     * From "Top 5: 1. Y Combinator, 2. Techstars, 3. 500 Startups"
       → { "Techstars": 2, "500 Startups": 3 }
   - Return empty object {} if no competitors have positions

5. **competitorSentiments**: Object mapping competitor names to sentiment about them in this specific response
   - Analyze how each competitor is portrayed/discussed in the response text
   - Format: { "CompanyName": "positive" | "neutral" | "negative" }
   - **positive**: Praised, recommended, highlighted positively, described with superlatives ("excellent", "best", "top", "leading", "outstanding")
   - **neutral**: Mentioned factually without strong opinion, listed in rankings without commentary, or described objectively
   - **negative**: Criticized, mentioned negatively, described as inferior or problematic
   - Examples:
     * "Techstars is excellent for mentorship and has strong network" → { "Techstars": "positive" }
     * "500 Global offers $150K for 6% equity" → { "500 Global": "neutral" }
     * "Antler has faced criticism for..." → { "Antler": "negative" }
   - Include ALL competitors from competitorsMentioned array
   - Default to "neutral" if no clear sentiment indicators are present

6. **sentiment**: Overall sentiment toward "${config.brandName}" in this response:
   - "positive" if the response praises, recommends, or ranks highly
   - "neutral" if factual/balanced with no clear opinion
   - "negative" if critical or dismissive

7. **confidence**: How confident are you in this analysis? (0.0 to 1.0)

Return ONLY a valid JSON object with these exact keys:
{
  "brandMentioned": boolean,
  "brandPosition": number or null,
  "competitorsMentioned": string[],
  "competitorPositions": { [key: string]: number },
  "competitorSentiments": { [key: string]: "positive" | "neutral" | "negative" },
  "sentiment": "positive" | "neutral" | "negative",
  "confidence": number,
  "explanation": "brief reasoning"
}`;

    const analysisResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing AI responses for brand visibility. Extract position/ranking numbers carefully for both the brand and competitors. Respond ONLY with valid JSON - no markdown, no code blocks, just the JSON object.',
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const analysisText = analysisResponse.choices[0]?.message?.content || '{}';
    
    // Parse JSON
    let analysis;
    try {
      const cleanedText = analysisText.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleanedText);
    } catch (parseError) {
      console.warn(`Failed to parse AI analysis, using fallback extraction:`, parseError);
      
      // Fallback: manual regex extraction with smart filtering
      const brandNameLower = config.brandName.toLowerCase();
      const textLower = text.toLowerCase();
      
      // Remove common false positive contexts before checking
      const cleanedText = textLower
        // Remove URLs (http://... or https://... or www...)
        .replace(/https?:\/\/[^\s]+/g, '')
        .replace(/www\.[^\s]+/g, '')
        // Remove email addresses
        .replace(/[\w.-]+@[\w.-]+\.\w+/g, '')
        // Remove code blocks (markdown ``` or backticks)
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`]+`/g, '')
        // Remove file paths (contains slashes)
        .replace(/[a-z0-9_-]+\/[a-z0-9_\/-]+/gi, '');
      
      // Use word boundary regex to avoid matching partial words
      const wordBoundaryRegex = new RegExp(`\\b${brandNameLower}\\b`, 'i');
      const brandMentioned = wordBoundaryRegex.test(cleanedText);
      
      let brandPosition = null;
      const positionPatterns = [
        new RegExp(`(?:^|\\n)(?:###?\\s*)?([1-9]\\d?)(?:st|nd|rd|th)(?:\\s*[Pp]lace)?:?\\s*\\*?\\*?${config.brandName}`, 'i'),
        new RegExp(`#([1-9]\\d?):\\s*${config.brandName}`, 'i'),
        new RegExp(`(?:ranked?|position)\\s*#?([1-9]\\d?).*${config.brandName}`, 'i'),
      ];

      for (const pattern of positionPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          brandPosition = parseInt(match[1], 10);
          break;
        }
      }

      const sentiment: 'positive' | 'neutral' | 'negative' = brandMentioned ? 'neutral' : 'neutral';

      // Try to extract competitor names (basic heuristic)
      const competitors: string[] = [];
      
      // Pattern 1: Numbered lists with company names
      const numberedListPattern = /(?:^|\n)\s*(?:[0-9]+[\.\)]|[-•])\s*\*?\*?([A-Z][A-Za-z0-9\s&]+(?:AI|Labs|Inc|LLC|Corp|Ltd)?)\*?\*?(?:\s*[-:]|\n|$)/g;
      let match;
      while ((match = numberedListPattern.exec(text)) !== null) {
        const companyName = match[1].trim();
        if (companyName !== config.brandName && companyName.length > 2 && companyName.length < 50) {
          if (!competitors.includes(companyName)) {
            competitors.push(companyName);
          }
        }
      }
      
      // Pattern 2: Companies in comparisons
      const comparisonPattern = /(?:including|such as|like|versus|vs|compared to|alternatives?:?)\s+([A-Z][A-Za-z0-9\s,&]+(?:AI|Labs|Inc|LLC|Corp|Ltd)?)/gi;
      while ((match = comparisonPattern.exec(text)) !== null) {
        const companyList = match[1].split(/,\s*(?:and\s+)?|(?:\s+and\s+)/);
        companyList.forEach(name => {
          const companyName = name.trim().replace(/\.$/, '');
          if (companyName !== config.brandName && companyName.length > 2 && companyName.length < 50) {
            if (!competitors.includes(companyName)) {
              competitors.push(companyName);
            }
          }
        });
      }
      
      const finalCompetitors = competitors.slice(0, 10);

      analysis = {
        brandMentioned,
        brandPosition,
        competitorsMentioned: finalCompetitors,
        competitorPositions: {}, // Fallback doesn't extract positions
        sentiment,
        confidence: 0.6,
        explanation: 'Fallback regex extraction used',
      };
    }

    // ENHANCEMENT: Use regex extraction to fill in missing positions (same as OpenAI function)
    const regexPositions = extractCompetitorPositionsWithRegex(text, config.brandName);
    
    // Merge regex positions with LLM positions
    const mergedPositions = { ...(analysis.competitorPositions || {}) };
    
    (analysis.competitorsMentioned || []).forEach((competitor: string) => {
      const regexMatch = Object.keys(regexPositions).find(
        regexComp => regexComp.toLowerCase() === competitor.toLowerCase() ||
                     regexComp.includes(competitor) ||
                     competitor.includes(regexComp)
      );
      
      if (regexMatch && !mergedPositions[competitor]) {
        mergedPositions[competitor] = regexPositions[regexMatch];
      }
    });
    
    // Add regex-found competitors that LLM missed
    Object.entries(regexPositions).forEach(([company, position]) => {
      const alreadyMentioned = (analysis.competitorsMentioned || []).some(
        (comp: string) => comp.toLowerCase() === company.toLowerCase()
      );
      
      if (!alreadyMentioned) {
        analysis.competitorsMentioned = [...(analysis.competitorsMentioned || []), company];
        mergedPositions[company] = position;
      }
    });

    // CRITICAL: Validate brand mention using regex (not just LLM analysis)
    const regexBrandMentioned = validateBrandMention(text, config.brandName);
    
    // CRITICAL: Filter out generic terms that aren't real companies
    const validatedCompetitors = filterValidCompetitors(analysis.competitorsMentioned || [], config.brandName);

    return {
      prompt,
      response: text,
      brandMentioned: regexBrandMentioned,
      brandPosition: analysis.brandPosition,
      competitors: validatedCompetitors,
      competitorPositions: mergedPositions,
      competitorSentiments: analysis.competitorSentiments || {},
      sentiment: analysis.sentiment || 'neutral',
      confidence: analysis.confidence || 0.5,
      citations: citations.length > 0 ? citations : undefined,
    };
  } catch (error: any) {
    console.error(`❌ Error analyzing with Perplexity:`, error.message || error);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
    }
    if (error.code) {
      console.error(`   Error code:`, error.code);
    }
    throw error;
  }
}

/**
 * Analyze with Anthropic (Claude)
 */
async function analyzeWithAnthropic(
  prompt: string,
  config: DirectGEOConfig
): Promise<PromptTest> {
  if (!config.apiKeys.anthropic) {
    throw new Error('Anthropic API key required for analysis');
  }

  const apiKey = config.apiKeys.anthropic;
  const anthropic = new Anthropic({
    apiKey: apiKey.trim(),
  });

  try {
    console.log('[Anthropic] Testing prompt:', prompt.substring(0, 60) + '...');

    const response = await retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      try {
        const res = await anthropic.messages.create(
          {
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 1500,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
            tools: [
              {
                type: 'web_search_20250305',
                name: 'web_search',
                max_uses: 5,
              } as any,
            ],
          },
          {
            signal: controller.signal as any,
          }
        );
        clearTimeout(timeoutId);
        return res;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          const timeoutError = new Error('Request timeout after 60 seconds');
          (timeoutError as any).code = 'ETIMEDOUT';
          throw timeoutError;
        }
        if (err.status) {
          (err as any).status = err.status;
        }
        throw err;
      }
    });

    let text = '';
    const citations: Citation[] = [];
    const sources: Citation[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;
        const textBlock = block as any;
        if (textBlock.citations && Array.isArray(textBlock.citations)) {
          for (const citation of textBlock.citations) {
            if (citation.type === 'web_search_result_location') {
              citations.push({
                url: citation.url || '',
                title: citation.title,
                snippet: citation.cited_text,
                position: citations.length + 1,
              });
            }
          }
        }
      }
      if (block.type === 'web_search_tool_result') {
        const resultBlock = block as any;
        if (resultBlock.content && Array.isArray(resultBlock.content)) {
          for (const result of resultBlock.content) {
            if (result.type === 'web_search_result' && result.url) {
              const existingUrls = sources.map(c => c.url);
              if (!existingUrls.includes(result.url)) {
                sources.push({
                  url: result.url,
                  title: result.title,
                  position: sources.length + 1,
                });
              }
            }
          }
        }
      }
    }

    console.log('[Anthropic] Response received:', text.substring(0, 100) + '...');

    if (!config.apiKeys.openai) {
      throw new Error('OpenAI API key required for analyzing Anthropic responses');
    }

    const openai = new OpenAI({
      apiKey: config.apiKeys.openai.trim(),
    });

    const analysisPrompt = `Analyze this AI-generated response to determine brand visibility:

BRAND NAME: ${config.brandName}
COMPETITORS: ${config.competitors?.join(', ') || 'None specified'}

RESPONSE TEXT:
"${text}"

Extract the following information:

1. **brandMentioned**: Is "${config.brandName}" mentioned anywhere in the response? (true/false)
2. **brandPosition**: What numerical ranking/position is "${config.brandName}" given? Extract ONLY the number (1, 2, 3, etc.) or null if no explicit position
3. **competitorsMentioned**: Array of OTHER company/brand names mentioned (EXCLUDING "${config.brandName}")
4. **competitorPositions**: Object mapping competitor names to their positions { "CompanyName": number }
5. **competitorSentiments**: Object mapping competitor names to sentiment { "CompanyName": "positive" | "neutral" | "negative" }
6. **sentiment**: Overall sentiment toward "${config.brandName}" ("positive" | "neutral" | "negative")
7. **confidence**: How confident are you in this analysis? (0.0 to 1.0)

Return ONLY a valid JSON object with these exact keys:
{
  "brandMentioned": boolean,
  "brandPosition": number or null,
  "competitorsMentioned": string[],
  "competitorPositions": { [key: string]: number },
  "competitorSentiments": { [key: string]: "positive" | "neutral" | "negative" },
  "sentiment": "positive" | "neutral" | "negative",
  "confidence": number
}`;

    const analysisResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing AI responses for brand visibility. Respond ONLY with valid JSON.',
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const analysisText = analysisResponse.choices[0]?.message?.content || '{}';
    let analysis;
    try {
      const cleanedText = analysisText.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleanedText);
    } catch (parseError) {
      console.warn('[Anthropic] Failed to parse analysis');
      analysis = {
        brandMentioned: validateBrandMention(text, config.brandName),
        brandPosition: null,
        competitorsMentioned: [],
        competitorPositions: {},
        competitorSentiments: {},
        sentiment: 'neutral',
        confidence: 0.5,
      };
    }

    const regexPositions = extractCompetitorPositionsWithRegex(text, config.brandName);
    const mergedPositions = { ...(analysis.competitorPositions || {}) };
    
    (analysis.competitorsMentioned || []).forEach((competitor: string) => {
      const regexMatch = Object.keys(regexPositions).find(
        regexComp => regexComp.toLowerCase() === competitor.toLowerCase() ||
                     regexComp.includes(competitor) ||
                     competitor.includes(regexComp)
      );
      
      if (regexMatch && !mergedPositions[competitor]) {
        mergedPositions[competitor] = regexPositions[regexMatch];
      }
    });
    
    Object.entries(regexPositions).forEach(([company, position]) => {
      const alreadyMentioned = (analysis.competitorsMentioned || []).some(
        (comp: string) => comp.toLowerCase() === company.toLowerCase()
      );
      
      if (!alreadyMentioned) {
        analysis.competitorsMentioned = [...(analysis.competitorsMentioned || []), company];
        mergedPositions[company] = position;
      }
    });

    const regexBrandMentioned = validateBrandMention(text, config.brandName);
    const validatedCompetitors = filterValidCompetitors(analysis.competitorsMentioned || [], config.brandName);

    return {
      prompt,
      response: text,
      brandMentioned: regexBrandMentioned,
      brandPosition: analysis.brandPosition,
      competitors: validatedCompetitors,
      competitorPositions: mergedPositions,
      competitorSentiments: analysis.competitorSentiments || {},
      sentiment: analysis.sentiment || 'neutral',
      confidence: analysis.confidence || 0.5,
      citations: citations.length > 0 ? citations : undefined,
      sources: sources.length > 0 ? sources : undefined,
    };
  } catch (error: any) {
    console.error(`❌ [Anthropic] Error:`, error.message || error);
    if (error.status === 405) {
      throw new Error(`Anthropic API error: Method Not Allowed (405). Ensure web_search is enabled.`);
    }
    throw error;
  }
}

/**
 * Analyze with Google (Gemini)
 */
async function analyzeWithGoogle(
  prompt: string,
  config: DirectGEOConfig
): Promise<PromptTest> {
  if (!config.apiKeys.google) {
    throw new Error('Google API key required for analysis');
  }

  const apiKey = config.apiKeys.google;
  const genAI = new GoogleGenerativeAI(apiKey.trim());
  
  try {
    console.log('[Google] Testing prompt:', prompt.substring(0, 60) + '...');
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      tools: [
        {
          googleSearch: {},
        },
      ] as any,
    });

    const result = await retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const res = await model.generateContent(prompt);
        clearTimeout(timeoutId);
        return res;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          const timeoutError = new Error('Request timeout after 60 seconds');
          (timeoutError as any).code = 'ETIMEDOUT';
          throw timeoutError;
        }
        if (err.status || err.statusCode) {
          (err as any).status = err.status || err.statusCode;
        }
        throw err;
      }
    });
    
    const response = result.response;
    const text = response.text();
    
    console.log('[Google] Response received:', text.substring(0, 100) + '...');
    
    const citations: Citation[] = [];
    const groundingMetadata = (response as any).candidates?.[0]?.groundingMetadata;

    if (groundingMetadata?.groundingChunks) {
      groundingMetadata.groundingChunks.forEach((chunk: any, idx: number) => {
        if (chunk.web) {
          citations.push({
            url: chunk.web.uri || '',
            title: chunk.web.title,
            position: idx + 1,
          });
        }
      });
    }

    const searchQueries: string[] = [];
    if (groundingMetadata?.webSearchQueries) {
      searchQueries.push(...groundingMetadata.webSearchQueries);
    }

    if (!config.apiKeys.openai) {
      throw new Error('OpenAI API key required for analyzing Google responses');
    }

    const openai = new OpenAI({
      apiKey: config.apiKeys.openai.trim(),
    });

    const analysisPrompt = `Analyze this AI-generated response to determine brand visibility:

BRAND NAME: ${config.brandName}
COMPETITORS: ${config.competitors?.join(', ') || 'None specified'}

RESPONSE TEXT:
"${text}"

Extract the following information:

1. **brandMentioned**: Is "${config.brandName}" mentioned anywhere in the response? (true/false)
2. **brandPosition**: What numerical ranking/position is "${config.brandName}" given? Extract ONLY the number (1, 2, 3, etc.) or null if no explicit position
3. **competitorsMentioned**: Array of OTHER company/brand names mentioned (EXCLUDING "${config.brandName}")
4. **competitorPositions**: Object mapping competitor names to their positions { "CompanyName": number }
5. **competitorSentiments**: Object mapping competitor names to sentiment { "CompanyName": "positive" | "neutral" | "negative" }
6. **sentiment**: Overall sentiment toward "${config.brandName}" ("positive" | "neutral" | "negative")
7. **confidence**: How confident are you in this analysis? (0.0 to 1.0)

Return ONLY a valid JSON object with these exact keys:
{
  "brandMentioned": boolean,
  "brandPosition": number or null,
  "competitorsMentioned": string[],
  "competitorPositions": { [key: string]: number },
  "competitorSentiments": { [key: string]: "positive" | "neutral" | "negative" },
  "sentiment": "positive" | "neutral" | "negative",
  "confidence": number
}`;

    const analysisResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing AI responses for brand visibility. Respond ONLY with valid JSON.',
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const analysisText = analysisResponse.choices[0]?.message?.content || '{}';
    let analysis;
    try {
      const cleanedText = analysisText.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleanedText);
    } catch (parseError) {
      console.warn('[Google] Failed to parse analysis');
      analysis = {
        brandMentioned: validateBrandMention(text, config.brandName),
        brandPosition: null,
        competitorsMentioned: [],
        competitorPositions: {},
        competitorSentiments: {},
        sentiment: 'neutral',
        confidence: 0.5,
      };
    }

    const regexPositions = extractCompetitorPositionsWithRegex(text, config.brandName);
    const mergedPositions = { ...(analysis.competitorPositions || {}) };
    
    (analysis.competitorsMentioned || []).forEach((competitor: string) => {
      const regexMatch = Object.keys(regexPositions).find(
        regexComp => regexComp.toLowerCase() === competitor.toLowerCase() ||
                     regexComp.includes(competitor) ||
                     competitor.includes(regexComp)
      );
      
      if (regexMatch && !mergedPositions[competitor]) {
        mergedPositions[competitor] = regexPositions[regexMatch];
      }
    });
    
    Object.entries(regexPositions).forEach(([company, position]) => {
      const alreadyMentioned = (analysis.competitorsMentioned || []).some(
        (comp: string) => comp.toLowerCase() === company.toLowerCase()
      );
      
      if (!alreadyMentioned) {
        analysis.competitorsMentioned = [...(analysis.competitorsMentioned || []), company];
        mergedPositions[company] = position;
      }
    });

    const regexBrandMentioned = validateBrandMention(text, config.brandName);
    const validatedCompetitors = filterValidCompetitors(analysis.competitorsMentioned || [], config.brandName);

    return {
      prompt,
      response: text,
      brandMentioned: regexBrandMentioned,
      brandPosition: analysis.brandPosition,
      competitors: validatedCompetitors,
      competitorPositions: mergedPositions,
      competitorSentiments: analysis.competitorSentiments || {},
      sentiment: analysis.sentiment || 'neutral',
      confidence: analysis.confidence || 0.5,
      citations: citations.length > 0 ? citations : undefined,
      searchQueries: searchQueries.length > 0 ? searchQueries : undefined,
    };
  } catch (error: any) {
    console.error(`❌ [Google] Error:`, error.message || error);
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
  
  // Generate test prompts - ALL 50 from PromptGeneration.txt specification
  const prompts = await generateGEOPrompts(config);
  console.log(`Generated ${prompts.length} test prompts`);
  
  // Get available providers - use all configured providers
  const availableProviders: string[] = [];
  if (config.apiKeys.openai) availableProviders.push('openai');
  if (config.apiKeys.anthropic) availableProviders.push('anthropic');
  if (config.apiKeys.google) availableProviders.push('google');
  if (config.apiKeys.perplexity) availableProviders.push('perplexity');
  
  if (availableProviders.length === 0) {
    throw new Error('At least one API key required (OpenAI, Anthropic, Google, or Perplexity)');
  }
  
  console.log(`Testing with ${availableProviders.length} provider(s): ${availableProviders.join(', ')}`);
  console.log(`Distributing ${prompts.length} prompts across providers...`);
  
  const analyses: ProviderAnalysis[] = [];
  
  // Calculate prompts per provider (distribute all 50 prompts evenly)
  const promptsPerProvider = Math.ceil(prompts.length / availableProviders.length);
  console.log(`Each provider will test ~${promptsPerProvider} prompts`);
  
  // Run analysis for each provider with its assigned prompts IN PARALLEL
  const providerAnalysisPromises = availableProviders.map(async (provider, i) => {
    // Get this provider's subset of prompts
    const startIdx = i * promptsPerProvider;
    const endIdx = Math.min(startIdx + promptsPerProvider, prompts.length);
    const providerPrompts = prompts.slice(startIdx, endIdx);
    
    console.log(`\n🔍 Analyzing with ${provider}: testing ${providerPrompts.length} prompts (${startIdx + 1}-${endIdx})...`);
    
    // Test ALL prompts for this provider IN PARALLEL using Promise.all
    const promptTestPromises = providerPrompts.map(async (promptObj) => {
      const promptText = typeof promptObj === 'string' ? promptObj : promptObj.text;
      const promptCategory = typeof promptObj === 'object' ? promptObj.category : undefined;
      
      try {
        const test = await analyzePromptWithProvider(promptText, provider, config);
        // Add category to test result for intent weighting
        const testWithCategory = { ...test, promptCategory };
        console.log(`  ✓ [${provider}] "${promptText.substring(0, 50)}..." - Brand mentioned: ${test.brandMentioned}`);
        return testWithCategory;
      } catch (error) {
        console.error(`  ✗ [${provider}] Failed prompt: ${promptText.substring(0, 50)}...`, error);
        return null;
      }
    });
    
    // Wait for all prompts for this provider to complete
    const promptTestResults = await Promise.all(promptTestPromises);
    
    // Filter out failed tests (null values)
    const promptTests = promptTestResults.filter((test): test is NonNullable<typeof test> => test !== null);
    
    // Calculate metrics for this provider
    const metrics = calculateBrandMetrics(promptTests);
    
    console.log(`  ✅ ${provider} results: ${metrics.visibilityScore.toFixed(1)}/100 score, ${Math.round(metrics.mentionRate * 100)}% mention rate`);
    
    // Map provider names to display names
    const providerDisplayName = (p: string): string => {
      switch (p.toLowerCase()) {
        case 'openai': return 'ChatGPT'
        case 'google': return 'Gemini'
        case 'anthropic': return 'Claude'
        case 'perplexity': return 'Perplexity'
        default: return p.charAt(0).toUpperCase() + p.slice(1)
      }
    }
    
    return {
      provider: providerDisplayName(provider),
      promptTests,
      brandVisibilityScore: metrics.visibilityScore,
      averagePosition: metrics.averagePosition,
      mentionRate: metrics.mentionRate,
      sentiment: metrics.sentiment,
    };
  });
  
  // Wait for all providers to complete (providers also run in parallel!)
  const analysesResults = await Promise.all(providerAnalysisPromises);
  analyses.push(...analysesResults);

  // Collect all AI responses for validation pipeline
  const allResponses = analyses.flatMap(a =>
    a.promptTests.map(t => t.response)
  ).join('\n\n---\n\n');

  // Collect all competitor mentions (raw, before validation)
  const allCompetitorMentions = analyses.flatMap(a =>
    a.promptTests.flatMap(t => t.competitors)
  );

  // Run multi-stage competitor validation pipeline
  console.log('\n🔬 Running AI competitor validation pipeline...');
  let validatedCompetitors: ValidatedCompetitor[] = [];

  try {
    validatedCompetitors = await validateCompetitors(
      allResponses,
      config.brandName,
      allCompetitorMentions
    );

    console.log(`✅ Validated ${validatedCompetitors.length} competitors with AI pipeline`);

    // Update prompt tests to only include validated competitors
    const validatedNameSet = new Set(validatedCompetitors.map(c => c.name.toLowerCase()));

    for (const analysis of analyses) {
      for (const test of analysis.promptTests) {
        // Filter competitors to only validated ones
        test.competitors = test.competitors.filter(c =>
          validatedNameSet.has(c.toLowerCase())
        );
      }
    }
  } catch (error) {
    console.warn('⚠️ Competitor validation pipeline failed, using regex-filtered results:', error);
    // Fall back to existing competitors (already regex-filtered)
  }

  // Recalculate competitor comparison with validated data
  const validatedMentions = analyses.flatMap(a =>
    a.promptTests.flatMap(t => t.competitors)
  );

  // Build competitor stats from validated competitors
  const competitorStats: CompetitorAnalysis[] = validatedCompetitors.map(vc => {
    const mentions = validatedMentions.filter(mention =>
      mention.toLowerCase() === vc.name.toLowerCase()
    ).length;

    return {
      name: vc.name,
      mentionCount: mentions,
      averagePosition: 0, // Could be calculated if we tracked competitor positions
      shareOfVoice: validatedMentions.length > 0 ? mentions / validatedMentions.length : 0,
    };
  }).filter(c => c.mentionCount > 0);

  // Sort by share of voice
  competitorStats.sort((a, b) => b.shareOfVoice - a.shareOfVoice);

  // Calculate overall score
  const overallScore = Math.round(
    analyses.reduce((sum, a) => sum + a.brandVisibilityScore, 0) / analyses.length
  );

  // Generate recommendations
  const recommendations = generateRecommendations(config, analyses);

  console.log(`✅ Analysis complete! Overall score: ${overallScore}/100`);
  console.log(`   Validated competitors: ${validatedCompetitors.length}`);
  console.log(`   High confidence: ${validatedCompetitors.filter(c => c.confidence === 'high').length}`);

  return {
    brandName: config.brandName,
    overallScore,
    analyses,
    competitorComparison: competitorStats,
    validatedCompetitors,
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
    customPrompts?: Array<string | { text: string; category?: string }>;
    apiKeys?: Partial<DirectGEOConfig['apiKeys']>;
  } = {}
): DirectGEOConfig {
  // Get environment object safely (works in Node.js environment)
  const env = ((globalThis as any).process?.env ?? {});
  
  return {
    brandName,
    industry: options.industry || 'technology',
    description: options.description || `${brandName} is a company in the ${options.industry || 'technology'} industry`,
    competitors: options.competitors || [],
    customPrompts: options.customPrompts,
    apiKeys: {
      openai: options.apiKeys?.openai || env.OPENAI_API_KEY,
      anthropic: options.apiKeys?.anthropic || env.ANTHROPIC_API_KEY,
      google: options.apiKeys?.google || env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY,
      perplexity: options.apiKeys?.perplexity || env.PERPLEXITY_API_KEY,
    },
  };
}
