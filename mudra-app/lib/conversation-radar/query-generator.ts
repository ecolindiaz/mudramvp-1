/**
 * Search Query Generator for Conversation Radar Mode 2 (Proactive Radar)
 * 
 * SMART APPROACH: Search relevant subreddits with tracked prompts
 * 
 * KEY INSIGHT: Reddit's global search returns many irrelevant results.
 * Searching within specific relevant subreddits is MUCH more accurate!
 * 
 * Strategy:
 * 1. Analyze tracked prompt to detect topic/domain
 * 2. Map topic to relevant subreddits (e.g., "data labeling" → r/MachineLearning)
 * 3. Search within those subreddits with the core query
 * 4. This gives 60-70% relevance vs 20-30% for global search
 */

export interface BrandContext {
  companyName: string;
  companyDescription?: string | null;
  companyICP?: string | null;
  companyIndustry?: string | null;
  competitors: string[];
  trackedPrompts: string[];
}

export interface TrackedPromptQuery {
  originalPrompt: string;     // The original tracked prompt
  searchQuery: string;        // Cleaned/optimized query for search
  subreddits: string[];       // Relevant subreddits to search in
  searchUrls: string[];       // Pre-built search URLs
  reason: string;             // Why this query matters
}

export interface GeneratedQueries {
  // Primary: Subreddit-specific searches based on tracked prompts
  trackedPromptQueries: TrackedPromptQuery[];
  
  // Secondary: Competitor mention searches (optional, lower priority)
  competitorQueries: string[];
}

// ============================================================================
// TOPIC-TO-SUBREDDIT MAPPING
// Comprehensive mapping for various industries and use cases
// ============================================================================

interface TopicMapping {
  keywords: string[];           // Keywords to match (uses word boundaries for short terms)
  subreddits: string[];         // Subreddits to search, ordered by relevance
  priority: number;             // Higher = more specific = checked first
}

const TOPIC_MAPPINGS: TopicMapping[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // AI/ML (High specificity)
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['machine learning', 'deep learning', 'neural network'],
    subreddits: ['MachineLearning', 'learnmachinelearning', 'MLQuestions', 'deeplearning'],
    priority: 90,
  },
  {
    keywords: ['data labeling', 'data annotation', 'labeling tool', 'annotation tool'],
    subreddits: ['MachineLearning', 'datascience', 'datasets', 'MLQuestions'],
    priority: 90,
  },
  {
    keywords: ['llm', 'large language model', 'chatgpt', 'gpt-4', 'gpt4', 'claude', 'gemini'],
    subreddits: ['LocalLLaMA', 'ChatGPT', 'OpenAI', 'MachineLearning'],
    priority: 85,
  },
  {
    keywords: ['computer vision', 'image recognition', 'object detection'],
    subreddits: ['computervision', 'MachineLearning', 'learnmachinelearning'],
    priority: 85,
  },
  {
    keywords: ['nlp', 'natural language', 'text processing', 'sentiment analysis'],
    subreddits: ['LanguageTechnology', 'MachineLearning', 'datascience', 'LocalLLaMA'],
    priority: 85,
  },
  {
    keywords: ['artificial intelligence'],
    subreddits: ['artificial', 'MachineLearning', 'singularity', 'ChatGPT'],
    priority: 70,
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // DevTools / Developer Experience
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['devtools', 'developer tool', 'dev tool', 'developer experience', 'dx'],
    subreddits: ['programming', 'webdev', 'devops', 'SideProject'],
    priority: 85,
  },
  {
    keywords: ['api', 'sdk', 'developer api', 'rest api', 'graphql'],
    subreddits: ['programming', 'webdev', 'node', 'reactjs'],
    priority: 80,
  },
  {
    keywords: ['ci/cd', 'cicd', 'continuous integration', 'deployment', 'devops'],
    subreddits: ['devops', 'kubernetes', 'docker', 'programming'],
    priority: 85,
  },
  {
    keywords: ['monitoring', 'observability', 'logging', 'apm'],
    subreddits: ['devops', 'sysadmin', 'programming', 'kubernetes'],
    priority: 80,
  },
  {
    keywords: ['testing', 'test automation', 'qa', 'quality assurance'],
    subreddits: ['QualityAssurance', 'softwaretesting', 'programming', 'devops'],
    priority: 80,
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Fintech / Finance
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['fintech', 'financial technology', 'neobank', 'digital banking'],
    subreddits: ['fintech', 'Banking', 'FinancialPlanning', 'personalfinance'],
    priority: 85,
  },
  {
    keywords: ['payment', 'payments', 'payment processing', 'stripe', 'paypal'],
    subreddits: ['fintech', 'ecommerce', 'Entrepreneur', 'smallbusiness'],
    priority: 80,
  },
  {
    keywords: ['trading', 'stock', 'investment', 'portfolio'],
    subreddits: ['algotrading', 'investing', 'stocks', 'wallstreetbets'],
    priority: 80,
  },
  {
    keywords: ['crypto', 'cryptocurrency', 'blockchain', 'web3', 'defi'],
    subreddits: ['CryptoCurrency', 'ethereum', 'defi', 'web3'],
    priority: 85,
  },
  {
    keywords: ['accounting', 'bookkeeping', 'invoicing', 'expense'],
    subreddits: ['Accounting', 'smallbusiness', 'Bookkeeping', 'Entrepreneur'],
    priority: 80,
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // B2B / Enterprise
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['b2b', 'enterprise', 'enterprise software'],
    subreddits: ['sales', 'SaaS', 'startups', 'Entrepreneur'],
    priority: 75,
  },
  {
    keywords: ['crm', 'customer relationship', 'salesforce', 'hubspot'],
    subreddits: ['sales', 'salesforce', 'SaaS', 'smallbusiness'],
    priority: 85,
  },
  {
    keywords: ['erp', 'enterprise resource planning'],
    subreddits: ['ERP', 'sysadmin', 'smallbusiness', 'Entrepreneur'],
    priority: 85,
  },
  {
    keywords: ['procurement', 'vendor management', 'supplier'],
    subreddits: ['supplychain', 'smallbusiness', 'Entrepreneur', 'business'],
    priority: 80,
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Logistics / Supply Chain
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['logistics', 'supply chain', 'shipping', 'freight'],
    subreddits: ['supplychain', 'logistics', 'Truckers', 'ecommerce'],
    priority: 85,
  },
  {
    keywords: ['warehouse', 'inventory', 'fulfillment', 'wms'],
    subreddits: ['supplychain', 'ecommerce', 'smallbusiness', 'FulfillmentByAmazon'],
    priority: 85,
  },
  {
    keywords: ['fleet', 'delivery', 'last mile', 'route optimization'],
    subreddits: ['logistics', 'Truckers', 'deliverydrivers', 'supplychain'],
    priority: 80,
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Marketing / SEO / Growth
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['seo', 'search engine optimization', 'serp', 'ranking'],
    subreddits: ['SEO', 'bigseo', 'marketing', 'DigitalMarketing'],
    priority: 85,
  },
  {
    keywords: ['geo', 'generative engine optimization', 'ai visibility', 'ai search'],
    subreddits: ['SEO', 'marketing', 'startups', 'artificial'],
    priority: 90,
  },
  {
    keywords: ['content marketing', 'blog', 'copywriting', 'content strategy'],
    subreddits: ['content_marketing', 'copywriting', 'Blogging', 'marketing'],
    priority: 80,
  },
  {
    keywords: ['social media', 'social marketing', 'instagram', 'tiktok', 'linkedin'],
    subreddits: ['socialmedia', 'marketing', 'Instagram', 'DigitalMarketing'],
    priority: 80,
  },
  {
    keywords: ['email marketing', 'newsletter', 'email automation'],
    subreddits: ['Emailmarketing', 'marketing', 'Entrepreneur', 'SaaS'],
    priority: 80,
  },
  {
    keywords: ['advertising', 'ads', 'ppc', 'google ads', 'facebook ads'],
    subreddits: ['PPC', 'marketing', 'DigitalMarketing', 'advertising'],
    priority: 80,
  },
  {
    keywords: ['growth', 'growth hacking', 'user acquisition', 'conversion'],
    subreddits: ['startups', 'GrowthHacking', 'marketing', 'Entrepreneur'],
    priority: 75,
  },
  {
    keywords: ['brand', 'branding', 'brand strategy', 'positioning'],
    subreddits: ['marketing', 'branding', 'Entrepreneur', 'smallbusiness'],
    priority: 75,
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // SaaS / Software
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['saas', 'software as a service', 'subscription software'],
    subreddits: ['SaaS', 'startups', 'Entrepreneur', 'SideProject'],
    priority: 80,
  },
  {
    keywords: ['startup', 'founder', 'bootstrapped', 'indie hacker'],
    subreddits: ['startups', 'Entrepreneur', 'SideProject', 'indiehackers'],
    priority: 75,
  },
  {
    keywords: ['no-code', 'nocode', 'low-code', 'lowcode'],
    subreddits: ['nocode', 'webflow', 'Entrepreneur', 'SideProject'],
    priority: 85,
  },
  {
    keywords: ['project management', 'task management', 'collaboration'],
    subreddits: ['productivity', 'projectmanagement', 'SaaS', 'startups'],
    priority: 80,
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // E-commerce / Retail
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['ecommerce', 'e-commerce', 'online store', 'shopify'],
    subreddits: ['ecommerce', 'shopify', 'dropshipping', 'Entrepreneur'],
    priority: 85,
  },
  {
    keywords: ['dropshipping', 'print on demand', 'pod'],
    subreddits: ['dropshipping', 'ecommerce', 'Entrepreneur', 'shopify'],
    priority: 85,
  },
  {
    keywords: ['amazon', 'fba', 'amazon seller'],
    subreddits: ['FulfillmentByAmazon', 'AmazonSeller', 'ecommerce', 'Entrepreneur'],
    priority: 85,
  },
  {
    keywords: ['retail', 'pos', 'point of sale'],
    subreddits: ['smallbusiness', 'retailtech', 'ecommerce', 'Entrepreneur'],
    priority: 80,
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // HR / Recruiting / People
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['hr', 'human resources', 'hris', 'people ops'],
    subreddits: ['humanresources', 'recruiting', 'smallbusiness', 'Entrepreneur'],
    priority: 85,
  },
  {
    keywords: ['recruiting', 'hiring', 'ats', 'talent acquisition'],
    subreddits: ['recruiting', 'recruitinghell', 'humanresources', 'jobs'],
    priority: 85,
  },
  {
    keywords: ['payroll', 'benefits', 'compensation'],
    subreddits: ['humanresources', 'smallbusiness', 'Accounting', 'Entrepreneur'],
    priority: 80,
  },
  {
    keywords: ['remote work', 'remote team', 'distributed team'],
    subreddits: ['remotework', 'digitalnomad', 'startups', 'Entrepreneur'],
    priority: 75,
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Healthcare / Medical
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['healthcare', 'health tech', 'healthtech', 'medical'],
    subreddits: ['healthIT', 'medicine', 'healthcare', 'DigitalHealth'],
    priority: 85,
  },
  {
    keywords: ['telemedicine', 'telehealth', 'virtual care'],
    subreddits: ['healthIT', 'medicine', 'healthcare', 'DigitalHealth'],
    priority: 85,
  },
  {
    keywords: ['ehr', 'emr', 'electronic health record', 'patient'],
    subreddits: ['healthIT', 'medicine', 'healthcare', 'DigitalHealth'],
    priority: 85,
  },
  {
    keywords: ['mental health', 'therapy', 'wellness'],
    subreddits: ['mentalhealth', 'therapy', 'selfimprovement', 'healthcare'],
    priority: 80,
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Education / EdTech
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['edtech', 'education technology', 'e-learning', 'elearning'],
    subreddits: ['edtech', 'Teachers', 'OnlineEducation', 'learnprogramming'],
    priority: 85,
  },
  {
    keywords: ['lms', 'learning management', 'online course', 'course creator'],
    subreddits: ['edtech', 'OnlineEducation', 'Teachers', 'Entrepreneur'],
    priority: 85,
  },
  {
    keywords: ['tutoring', 'coaching', 'training'],
    subreddits: ['Tutoring', 'Teachers', 'OnlineEducation', 'Entrepreneur'],
    priority: 75,
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Real Estate / PropTech
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['real estate', 'proptech', 'property management'],
    subreddits: ['realestateinvesting', 'RealEstate', 'PropertyManagement', 'Landlord'],
    priority: 85,
  },
  {
    keywords: ['rental', 'tenant', 'landlord', 'lease'],
    subreddits: ['Landlord', 'PropertyManagement', 'realestateinvesting', 'RealEstate'],
    priority: 80,
  },
  {
    keywords: ['mortgage', 'home buying', 'real estate agent'],
    subreddits: ['RealEstate', 'FirstTimeHomeBuyer', 'realestateinvesting', 'personalfinance'],
    priority: 80,
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Security / Cybersecurity
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['cybersecurity', 'security', 'infosec', 'information security'],
    subreddits: ['cybersecurity', 'netsec', 'AskNetsec', 'sysadmin'],
    priority: 85,
  },
  {
    keywords: ['authentication', 'identity', 'sso', 'oauth'],
    subreddits: ['cybersecurity', 'programming', 'devops', 'sysadmin'],
    priority: 80,
  },
  {
    keywords: ['compliance', 'gdpr', 'hipaa', 'soc2'],
    subreddits: ['cybersecurity', 'sysadmin', 'legaladvice', 'smallbusiness'],
    priority: 80,
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Data / Analytics
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['data science', 'data scientist', 'data analysis'],
    subreddits: ['datascience', 'dataengineering', 'analytics', 'MachineLearning'],
    priority: 85,
  },
  {
    keywords: ['business intelligence', 'bi', 'dashboard', 'reporting'],
    subreddits: ['BusinessIntelligence', 'analytics', 'datascience', 'PowerBI'],
    priority: 85,
  },
  {
    keywords: ['data engineering', 'etl', 'data pipeline', 'data warehouse'],
    subreddits: ['dataengineering', 'datascience', 'Database', 'programming'],
    priority: 85,
  },
  {
    keywords: ['database', 'sql', 'postgresql', 'mysql', 'mongodb'],
    subreddits: ['Database', 'SQL', 'PostgreSQL', 'dataengineering'],
    priority: 80,
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Productivity / Collaboration
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['productivity', 'time management', 'workflow'],
    subreddits: ['productivity', 'getdisciplined', 'Entrepreneur', 'SaaS'],
    priority: 70,
  },
  {
    keywords: ['note', 'notes', 'note-taking', 'notion', 'obsidian'],
    subreddits: ['productivity', 'Notion', 'ObsidianMD', 'PKMS'],
    priority: 80,
  },
  {
    keywords: ['documentation', 'knowledge base', 'wiki'],
    subreddits: ['programming', 'devops', 'SaaS', 'productivity'],
    priority: 75,
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Communication / Messaging
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['communication', 'messaging', 'chat', 'slack', 'teams'],
    subreddits: ['sysadmin', 'Slack', 'startups', 'Entrepreneur'],
    priority: 75,
  },
  {
    keywords: ['video conferencing', 'video call', 'zoom', 'webinar'],
    subreddits: ['remotework', 'Zoom', 'startups', 'smallbusiness'],
    priority: 75,
  },
  {
    keywords: ['customer support', 'help desk', 'ticketing', 'zendesk'],
    subreddits: ['CustomerSuccess', 'sysadmin', 'SaaS', 'smallbusiness'],
    priority: 80,
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Legal / Compliance
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['legal', 'legal tech', 'contract', 'contract management'],
    subreddits: ['legaladvice', 'law', 'smallbusiness', 'Entrepreneur'],
    priority: 80,
  },
  {
    keywords: ['esignature', 'e-signature', 'docusign'],
    subreddits: ['smallbusiness', 'Entrepreneur', 'legaladvice', 'RealEstate'],
    priority: 80,
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Design / Creative
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['design', 'ui', 'ux', 'user interface', 'user experience'],
    subreddits: ['userexperience', 'UI_Design', 'webdev', 'design'],
    priority: 80,
  },
  {
    keywords: ['graphic design', 'illustration', 'canva', 'figma'],
    subreddits: ['graphic_design', 'design', 'Figma', 'webdev'],
    priority: 80,
  },
  {
    keywords: ['video editing', 'video production', 'animation'],
    subreddits: ['VideoEditing', 'Filmmakers', 'AfterEffects', 'youtube'],
    priority: 80,
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // Generic fallbacks (lower priority)
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['software', 'application', 'app'],
    subreddits: ['SaaS', 'startups', 'programming', 'technology'],
    priority: 50,
  },
  {
    keywords: ['tool', 'platform', 'solution'],
    subreddits: ['SaaS', 'startups', 'Entrepreneur', 'technology'],
    priority: 40,
  },
  {
    keywords: ['pricing', 'cost', 'budget', 'affordable'],
    subreddits: ['Entrepreneur', 'smallbusiness', 'startups', 'SaaS'],
    priority: 40,
  },
  {
    keywords: ['alternative', 'competitor', 'vs', 'comparison'],
    subreddits: ['SaaS', 'startups', 'Entrepreneur', 'technology'],
    priority: 45,
  },
  {
    keywords: ['best', 'top', 'recommend', 'suggestion'],
    subreddits: ['Entrepreneur', 'smallbusiness', 'startups', 'technology'],
    priority: 30,
  },
];

// Default subreddits if no topic is detected
const DEFAULT_SUBREDDITS = ['technology', 'Entrepreneur', 'startups', 'SaaS', 'business'];

/**
 * Generate search queries with smart subreddit targeting
 * This is the key to getting ACCURATE results!
 */
export function generateSearchQueries(brandContext: BrandContext): GeneratedQueries {
  const trackedPromptQueries: TrackedPromptQuery[] = [];
  const competitorQueries: string[] = [];
  
  // 1. PRIMARY: For each tracked prompt, find relevant subreddits and create targeted searches
  for (const prompt of brandContext.trackedPrompts) {
    const searchQuery = cleanPromptForSearch(prompt);
    if (!searchQuery || searchQuery.length < 5) continue;
    
    // Detect topics in the prompt and find relevant subreddits
    // Also use brand context for additional hints
    const subreddits = detectRelevantSubreddits(prompt, brandContext);
    
    // Build search URLs for each subreddit
    // Use 'year' in search (Reddit doesn't have 3-month option)
    // The service will filter to 90 days (3 months) max
    const searchUrls = subreddits.map(sub => 
      buildSubredditSearchUrl(sub, searchQuery, { sort: 'relevance', timeframe: 'year' })
    );
    
    trackedPromptQueries.push({
      originalPrompt: prompt,
      searchQuery,
      subreddits,
      searchUrls,
      reason: `Searching r/${subreddits.slice(0, 2).join(', r/')} for: "${searchQuery}"`,
    });
  }
  
  // 2. SECONDARY: Add competitor-based queries (lower priority)
  for (const competitor of brandContext.competitors.slice(0, 3)) {
    const clean = competitor.trim();
    if (clean.length > 0) {
      competitorQueries.push(`${clean} alternative`);
      competitorQueries.push(`${clean} vs`);
    }
  }
  
  console.log(`[Query Generator] Generated ${trackedPromptQueries.length} tracked prompt queries`);
  for (const q of trackedPromptQueries.slice(0, 3)) {
    console.log(`  📍 "${q.searchQuery}" → r/${q.subreddits.slice(0, 3).join(', r/')}`);
  }
  
  return { 
    trackedPromptQueries, 
    competitorQueries: competitorQueries.slice(0, 4),
  };
}

/**
 * Detect relevant subreddits based on keywords in the prompt
 * Uses word boundary matching for short keywords to avoid false positives
 * Prioritizes more specific matches over generic ones
 */
function detectRelevantSubreddits(prompt: string, brandContext?: BrandContext): string[] {
  const promptLower = prompt.toLowerCase();
  
  // Also include brand context for better matching
  const contextText = brandContext 
    ? `${promptLower} ${brandContext.companyDescription || ''} ${brandContext.companyIndustry || ''} ${brandContext.companyICP || ''}`.toLowerCase()
    : promptLower;
  
  // Track matches with their priority
  const matches: Array<{ subreddits: string[]; priority: number }> = [];
  
  // Sort mappings by priority (highest first)
  const sortedMappings = [...TOPIC_MAPPINGS].sort((a, b) => b.priority - a.priority);
  
  for (const mapping of sortedMappings) {
    for (const keyword of mapping.keywords) {
      if (matchesKeyword(contextText, keyword)) {
        matches.push({
          subreddits: mapping.subreddits,
          priority: mapping.priority,
    });
        break; // Only match each mapping once
      }
    }
  }
  
  // If no matches, use defaults
  if (matches.length === 0) {
    return DEFAULT_SUBREDDITS.slice(0, 4);
  }
  
  // Merge subreddits, prioritizing those from higher-priority matches
  // Use a Map to track the best priority for each subreddit
  const subredditPriority = new Map<string, number>();
  
  for (const match of matches) {
    for (let i = 0; i < match.subreddits.length; i++) {
      const sub = match.subreddits[i];
      // Earlier position in array = more relevant, so add position penalty
      const effectivePriority = match.priority - (i * 2);
      const currentPriority = subredditPriority.get(sub) || 0;
      if (effectivePriority > currentPriority) {
        subredditPriority.set(sub, effectivePriority);
      }
    }
  }
  
  // Sort by priority and return top 4
  const sortedSubreddits = Array.from(subredditPriority.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([sub]) => sub);
  
  return sortedSubreddits.slice(0, 4);
}

/**
 * Smart keyword matching with word boundaries for short terms
 * Prevents false positives like "api" matching "capital"
 */
function matchesKeyword(text: string, keyword: string): boolean {
  // For short keywords (3 chars or less), use word boundary matching
  if (keyword.length <= 3) {
    const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i');
    return regex.test(text);
  }
  
  // For longer keywords, simple includes is fine
  return text.includes(keyword.toLowerCase());
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a search URL for a specific subreddit
 */
function buildSubredditSearchUrl(
  subreddit: string,
  query: string,
  options: { sort?: string; timeframe?: string } = {}
): string {
  const { sort = 'relevance', timeframe = 'year' } = options;
  const encodedQuery = encodeURIComponent(query);
  return `https://www.reddit.com/r/${subreddit}/search?q=${encodedQuery}&restrict_sr=1&sort=${sort}&t=${timeframe}`;
}

/**
 * Clean a tracked prompt for Reddit search
 * 
 * Reddit search tips:
 * - Quotes force exact phrase matching
 * - Shorter queries often work better
 * - Remove special characters
 */
function cleanPromptForSearch(prompt: string): string {
  let cleaned = prompt
    // Remove question marks and common punctuation
    .replace(/[?!.,;:'"]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
  
  // If the prompt is very long, extract the key part
  // Most tracked prompts are questions like "What is the best X for Y"
  if (cleaned.length > 80) {
    // Try to find the core of the question
    const patterns = [
      /best (.+?) for (.+)/i,
      /how to (.+)/i,
      /what (?:is|are) (.+)/i,
      /recommend (.+)/i,
      /looking for (.+)/i,
    ];
    
    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        // Use the matched part, keeping context
        cleaned = match[0].slice(0, 80);
        break;
      }
    }
    
    // If still too long, just truncate
    if (cleaned.length > 80) {
      cleaned = cleaned.slice(0, 80);
    }
  }
  
  return cleaned;
}

/**
 * Build a competitor search URL (global search for competitor mentions)
 */
export function buildCompetitorSearchUrl(
  query: string,
  options: {
    sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments';
    timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  } = {}
): string {
  const { sort = 'relevance', timeframe = 'month' } = options;
  const encodedQuery = encodeURIComponent(query);
  
  return `https://www.reddit.com/search?q=${encodedQuery}&sort=${sort}&t=${timeframe}`;
}
