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
 * 3. Use LLM to transform the prompt into Reddit-optimized search keywords
 * 4. Search within those subreddits with the optimized query
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
  {
    keywords: ['web search', 'search api', 'search engine'],
    subreddits: ['SaaS', 'LocalLLaMA', 'AI_Agents', 'programming'],
    priority: 85,
  },
  {
    keywords: ['ai agent', 'ai agents', 'agentic', 'agent framework'],
    subreddits: ['AI_Agents', 'LocalLLaMA', 'ChatGPT', 'MachineLearning'],
    priority: 85,
  },
  {
    keywords: ['web scraping', 'web crawling', 'scraper', 'scraping'],
    subreddits: ['webscraping', 'programming', 'webdev', 'SaaS'],
    priority: 85,
  },
  {
    keywords: ['rag', 'retrieval augmented', 'vector database', 'embeddings'],
    subreddits: ['LocalLLaMA', 'MachineLearning', 'Rag', 'AI_Agents'],
    priority: 85,
  },
  {
    keywords: ['rlhf', 'human feedback', 'training data', 'fine-tuning', 'fine tuning', 'finetuning'],
    subreddits: ['MachineLearning', 'LocalLLaMA', 'MLQuestions', 'datascience'],
    priority: 90,
  },
  {
    keywords: ['gpu', 'inference', 'model hosting', 'model deployment', 'model serving'],
    subreddits: ['LocalLLaMA', 'MachineLearning', 'MLQuestions', 'devops'],
    priority: 85,
  },
  {
    keywords: ['serverless', 'autoscaling', 'auto-scaling', 'cloud infrastructure'],
    subreddits: ['devops', 'kubernetes', 'aws', 'programming'],
    priority: 85,
  },
  {
    keywords: ['sandbox', 'sandboxing', 'code execution', 'untrusted code', 'isolated environment'],
    subreddits: ['devops', 'programming', 'cybersecurity', 'sysadmin'],
    priority: 85,
  },
  {
    keywords: ['containerized', 'container', 'docker', 'kubernetes'],
    subreddits: ['devops', 'kubernetes', 'docker', 'sysadmin'],
    priority: 85,
  },
  {
    keywords: ['batch processing', 'batch ml', 'batch workload', 'cron job', 'job queue'],
    subreddits: ['devops', 'dataengineering', 'MachineLearning', 'programming'],
    priority: 80,
  },
  {
    keywords: ['evaluation', 'evaluate', 'benchmark', 'eval', 'red-teaming', 'red teaming'],
    subreddits: ['MachineLearning', 'LocalLLaMA', 'MLQuestions', 'datascience'],
    priority: 85,
  },
  {
    keywords: ['foundation model', 'open-source model', 'open source model', 'llama', 'mistral', 'stable diffusion'],
    subreddits: ['LocalLLaMA', 'MachineLearning', 'StableDiffusion', 'OpenAI'],
    priority: 85,
  },
  {
    keywords: ['image generation', 'text to image', 'diffusion model', 'generative ai'],
    subreddits: ['StableDiffusion', 'LocalLLaMA', 'MachineLearning', 'artificial'],
    priority: 85,
  },
  {
    keywords: ['web indexing', 'crawl', 'index', 'research assistant', 'research tool'],
    subreddits: ['webscraping', 'programming', 'SaaS', 'datascience'],
    priority: 80,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Personal Finance / Freelance / Remittances
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['freelancer', 'freelance', 'remote worker', 'digital nomad', 'nomad'],
    subreddits: ['digitalnomad', 'remotework', 'freelance', 'personalfinance'],
    priority: 85,
  },
  {
    keywords: ['usd', 'currency', 'foreign exchange', 'forex', 'exchange rate'],
    subreddits: ['personalfinance', 'digitalnomad', 'fintech', 'Entrepreneur'],
    priority: 80,
  },
  {
    keywords: ['visa card', 'international card', 'global account', 'multi-currency', 'multicurrency'],
    subreddits: ['digitalnomad', 'personalfinance', 'fintech', 'creditcards'],
    priority: 85,
  },
  {
    keywords: ['remittance', 'send money', 'money transfer', 'withdraw', 'cash out'],
    subreddits: ['personalfinance', 'digitalnomad', 'fintech', 'Entrepreneur'],
    priority: 80,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Voice AI / Call Center / Logistics
  // ─────────────────────────────────────────────────────────────────────────
  {
    keywords: ['voice ai', 'voice agent', 'voice bot', 'call center', 'ivr', 'conversational ai'],
    subreddits: ['artificial', 'SaaS', 'CustomerSuccess', 'smallbusiness'],
    priority: 85,
  },
  {
    keywords: ['last-mile', 'delivery verification', 'failed delivery', 'address verification'],
    subreddits: ['logistics', 'supplychain', 'ecommerce', 'smallbusiness'],
    priority: 85,
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

// ============================================================================
// SPANISH TOPIC-TO-SUBREDDIT MAPPING
// Mix of Spanish-language subreddits + English subreddits (LATAM devs are bilingual)
// ============================================================================

const SPANISH_TOPIC_MAPPINGS: TopicMapping[] = [
  {
    keywords: ['inteligencia artificial', 'aprendizaje automático', 'redes neuronales', 'aprendizaje profundo'],
    subreddits: ['artificial', 'MachineLearning', 'LocalLLaMA', 'programacion'],
    priority: 90,
  },
  {
    keywords: ['llm', 'chatgpt', 'modelo de lenguaje', 'modelo de lenguaje grande'],
    subreddits: ['artificial', 'ChatGPT', 'LocalLLaMA', 'programacion'],
    priority: 85,
  },
  {
    keywords: ['programación', 'desarrollo', 'código', 'software', 'devops', 'desarrollador'],
    subreddits: ['programacion', 'devsarg', 'chileIT', 'programming'],
    priority: 80,
  },
  {
    keywords: ['nube', 'cloud', 'multi-cloud', 'aws', 'infraestructura', 'kubernetes'],
    subreddits: ['devops', 'sysadmin', 'kubernetes', 'programacion'],
    priority: 85,
  },
  {
    keywords: ['fintech', 'banca digital', 'pagos digitales', 'pagos', 'banco digital'],
    subreddits: ['merval', 'fintech', 'personalfinance', 'programacion'],
    priority: 85,
  },
  {
    keywords: ['saas', 'startup', 'emprendimiento', 'emprender'],
    subreddits: ['startups', 'Entrepreneur', 'SaaS', 'programacion'],
    priority: 75,
  },
  {
    keywords: ['comercio electrónico', 'tienda online', 'ecommerce', 'e-commerce', 'tienda virtual'],
    subreddits: ['ecommerce', 'shopify', 'Entrepreneur', 'programacion'],
    priority: 85,
  },
  {
    keywords: ['seo', 'marketing digital', 'posicionamiento', 'marketing'],
    subreddits: ['SEO', 'marketing', 'bigseo', 'programacion'],
    priority: 80,
  },
  {
    keywords: ['ciencia de datos', 'análisis de datos', 'datos', 'big data'],
    subreddits: ['datascience', 'dataengineering', 'programacion', 'MachineLearning'],
    priority: 85,
  },
  {
    keywords: ['ciberseguridad', 'seguridad informática', 'seguridad', 'infosec'],
    subreddits: ['cybersecurity', 'netsec', 'programacion', 'sysadmin'],
    priority: 85,
  },
  {
    keywords: ['automatización', 'automatizar', 'workflow', 'flujo de trabajo'],
    subreddits: ['programacion', 'devops', 'SaaS', 'startups'],
    priority: 75,
  },
  {
    keywords: ['freelancer', 'cobrar en dólares', 'cobro en usd', 'pagos internacionales', 'cuenta en dólares', 'cuenta global', 'nómada digital', 'remesas'],
    subreddits: ['merval', 'fintech', 'remotework', 'digitalnomad'],
    priority: 90,
  },
  {
    keywords: ['tarjeta internacional', 'tarjeta visa', 'transferencia internacional', 'tipo de cambio'],
    subreddits: ['merval', 'fintech', 'personalfinance', 'digitalnomad'],
    priority: 85,
  },
  {
    keywords: ['invertir', 'inversión', 'acciones', 'etf', 'bolsa', 'portafolio'],
    subreddits: ['merval', 'investing', 'stocks', 'personalfinance'],
    priority: 85,
  },
  {
    keywords: ['búsqueda', 'motor de búsqueda', 'búsqueda web', 'búsqueda semántica'],
    subreddits: ['programacion', 'SaaS', 'LocalLLaMA', 'AI_Agents'],
    priority: 85,
  },
  {
    keywords: ['gpu', 'inferencia', 'desplegar modelo', 'despliegue', 'servir modelos'],
    subreddits: ['LocalLLaMA', 'MachineLearning', 'devops', 'programacion'],
    priority: 85,
  },
  {
    keywords: ['serverless', 'escalamiento', 'escalar', 'contenedor', 'contenedores'],
    subreddits: ['devops', 'kubernetes', 'programacion', 'sysadmin'],
    priority: 85,
  },
  {
    keywords: ['sueldo', 'cobrar', 'remesa', 'enviar dinero', 'mandar dinero', 'moneda local', 'retiro', 'retirar'],
    subreddits: ['merval', 'digitalnomad', 'fintech', 'remotework'],
    priority: 90,
  },
  {
    keywords: ['factura', 'facturas', 'pagar servicios', 'gestionar finanzas', 'finanzas personales', 'multi-moneda'],
    subreddits: ['merval', 'personalfinance', 'fintech', 'Entrepreneur'],
    priority: 85,
  },
  {
    keywords: ['agente de voz', 'voz ia', 'call center', 'soporte postventa', 'centro de llamadas'],
    subreddits: ['artificial', 'SaaS', 'programacion', 'Entrepreneur'],
    priority: 85,
  },
  {
    keywords: ['logística', 'entrega', 'entregas fallidas', 'última milla', 'verificación de dirección', 'delivery'],
    subreddits: ['logistics', 'supplychain', 'ecommerce', 'programacion'],
    priority: 85,
  },
  {
    keywords: ['indexar', 'rastrear', 'scraping', 'crawling', 'research automatizado', 'buscar contenidos'],
    subreddits: ['webscraping', 'programacion', 'SaaS', 'datascience'],
    priority: 85,
  },
  {
    keywords: ['evaluación', 'evaluar', 'benchmark', 'modelo fundacional', 'modelo base'],
    subreddits: ['MachineLearning', 'LocalLLaMA', 'programacion', 'datascience'],
    priority: 85,
  },
  // Generic fallbacks
  {
    keywords: ['herramienta', 'plataforma', 'solución', 'alternativa'],
    subreddits: ['programacion', 'technology', 'startups', 'Entrepreneur'],
    priority: 40,
  },
];

const SPANISH_DEFAULT_SUBREDDITS = ['programacion', 'technology', 'espanol', 'Entrepreneur', 'startups'];

/**
 * Generate search queries with smart subreddit targeting
 * This is the key to getting ACCURATE results!
 */
export async function generateSearchQueries(brandContext: BrandContext, language: 'en' | 'es' = 'en'): Promise<GeneratedQueries> {
  const trackedPromptQueries: TrackedPromptQuery[] = [];
  const competitorQueries: string[] = [];

  // Extract clean company names from competitors (which may be URLs like "https://snorkel.ai")
  const cleanCompetitorNames = brandContext.competitors.flatMap(c => extractCompanyNames(c));

  // ALL brand/competitor names for context
  const allBrandNames = [brandContext.companyName, ...cleanCompetitorNames]
    .filter(Boolean)
    .map(n => n!.trim())
    .filter(n => n.length > 0);

  // LLM-optimize search queries in a single batch call.
  // Transforms AI-prompt-style text into Reddit-optimized keyword queries.
  // e.g. "Scale AI Evaluations product" → "model evaluation tools LLM benchmarking"
  const llmQueries = await optimizeQueriesWithLLM(
    brandContext.trackedPrompts,
    brandContext,
    language,
  );

  // 1. PRIMARY: For each tracked prompt, find relevant subreddits and create targeted searches
  for (let i = 0; i < brandContext.trackedPrompts.length; i++) {
    const prompt = brandContext.trackedPrompts[i];

    // Use LLM-optimized query if available, fall back to rule-based cleaning
    const searchQuery = llmQueries[i] || cleanPromptForSearch(prompt, allBrandNames);
    if (!searchQuery || searchQuery.length < 5) continue;

    // Detect topics in the prompt and find relevant subreddits
    const subreddits = language === 'es'
      ? detectSpanishSubreddits(prompt)
      : detectRelevantSubreddits(prompt);

    // Build search URLs for each subreddit
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
  const bestCompetitorNames = brandContext.competitors.slice(0, 3).map(c => {
    const names = extractCompanyNames(c);
    return names.reduce((a, b) => (b.length > a.length ? b : a), '');
  }).filter(n => n.length > 0);

  for (const name of bestCompetitorNames) {
    const quotedName = name.includes(' ') ? `"${name}"` : name;
    competitorQueries.push(`${quotedName} alternative`);
    competitorQueries.push(`${quotedName} vs`);
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
 * Use LLM to transform tracked prompts into Reddit-optimized search queries.
 *
 * This is the KEY quality improvement: an LLM understands that
 * "Scale AI Evaluations product" should become "model evaluation benchmarking LLM"
 * while simple stop-word removal produces "evaluations product" (too generic).
 *
 * Processes ALL prompts in a single API call for efficiency.
 * Falls back to empty array (rule-based cleaning) on any error.
 */
async function optimizeQueriesWithLLM(
  prompts: string[],
  brandContext: BrandContext,
  language: 'en' | 'es',
): Promise<string[]> {
  if (prompts.length === 0) return [];

  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('[Query Generator] No OPENAI_API_KEY, falling back to rule-based cleaning');
      return [];
    }

    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = `You transform tracked prompts into Reddit search queries.

RULES:
- Output 3-6 keyword terms per query, optimized for Reddit's search engine
- Remove brand/company names — they add noise in subreddit-specific search
- Focus on the TOPIC and INTENT, not the specific brand
- Use terms people actually use on Reddit (informal, practical)
- Keep technical terms (RLHF, LLM, RAG, etc.) — they are high-signal on Reddit
- For ${language === 'es' ? 'Spanish' : 'English'} queries, use ${language === 'es' ? 'Spanish' : 'English'} terms
- Do NOT include generic words like "best", "top", "tool", "platform" unless they add real signal

BRAND CONTEXT (for understanding what the prompts are about):
- Company: ${brandContext.companyName}
- What they do: ${brandContext.companyDescription || 'N/A'}
- Industry: ${brandContext.companyIndustry || 'N/A'}

EXAMPLES:
- "Scale AI Evaluations product" → "model evaluation benchmarking LLM testing"
- "Snorkel AI alternatives for enterprise data labeling" → "data labeling annotation enterprise training data"
- "Best cloud GPU providers for LLM inference" → "GPU inference hosting LLM deployment"
- "Vercel vs Netlify for Next.js deployment" → "nextjs deployment hosting serverless"
- "¿Cómo cobrar como freelancer en Latinoamérica?" → "cobrar freelancer latinoamerica pagos"

FORMAT:
Return one line per prompt. Each line = the optimized query (just keywords, no quotes, no numbering).
Return EXACTLY ${prompts.length} lines.`;

    const userPrompt = prompts.map((p, i) => `${i + 1}. ${p}`).join('\n');

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: Math.max(500, prompts.length * 30),
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const text = response.choices?.[0]?.message?.content?.trim();
    if (!text) return [];

    // Preserve positional alignment: keep blank lines as empty strings so
    // validated[i] always corresponds to prompts[i] at the call site.
    const lines = text.split('\n')
      .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim().toLowerCase());

    // Validate: each line should be 3-10 words, no brand names
    const brandLower = brandContext.companyName?.toLowerCase() || '';
    const validated = lines.map((line) => {
      if (!line) return ''; // blank line from LLM — keep as empty to preserve alignment
      const words = line.split(/\s+/);
      if (words.length < 2 || words.length > 12) return ''; // Too short or too long
      if (brandLower && line.includes(brandLower)) return ''; // Still has brand name
      return line;
    });

    console.log(`[Query Generator] LLM optimized ${validated.filter(Boolean).length}/${prompts.length} queries`);

    return validated;
  } catch (error) {
    console.warn('[Query Generator] LLM optimization failed, using rule-based fallback:', (error as Error).message);
    return [];
  }
}

/**
 * Detect relevant subreddits based on keywords in the prompt
 * Uses word boundary matching for short keywords to avoid false positives
 * Prioritizes more specific matches over generic ones
 */
function detectRelevantSubreddits(prompt: string): string[] {
  const promptLower = prompt.toLowerCase();
  const contextText = promptLower;
  
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
 * Detect relevant subreddits for Spanish prompts
 * Same logic as detectRelevantSubreddits but uses SPANISH_TOPIC_MAPPINGS
 */
function detectSpanishSubreddits(prompt: string): string[] {
  const promptLower = prompt.toLowerCase();
  const contextText = promptLower;

  const matches: Array<{ subreddits: string[]; priority: number }> = [];

  const sortedMappings = [...SPANISH_TOPIC_MAPPINGS].sort((a, b) => b.priority - a.priority);

  for (const mapping of sortedMappings) {
    for (const keyword of mapping.keywords) {
      if (matchesKeyword(contextText, keyword)) {
        matches.push({
          subreddits: mapping.subreddits,
          priority: mapping.priority,
        });
        break;
      }
    }
  }

  if (matches.length === 0) {
    return SPANISH_DEFAULT_SUBREDDITS.slice(0, 4);
  }

  const subredditPriority = new Map<string, number>();

  for (const match of matches) {
    for (let i = 0; i < match.subreddits.length; i++) {
      const sub = match.subreddits[i];
      const effectivePriority = match.priority - (i * 2);
      const currentPriority = subredditPriority.get(sub) || 0;
      if (effectivePriority > currentPriority) {
        subredditPriority.set(sub, effectivePriority);
      }
    }
  }

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
 * Extract clean company name(s) from a competitor string.
 * Handles both plain names ("Labelbox") and URLs ("https://snorkel.ai").
 *
 * For .ai domains, also produces the "Name AI" variant since those companies
 * typically brand themselves that way (e.g., snorkel.ai → "Snorkel AI").
 */
function extractCompanyNames(competitor: string): string[] {
  const trimmed = competitor.trim();
  if (!trimmed) return [];

  // URL or domain-like string
  if (trimmed.startsWith('http') || /^[a-z0-9-]+\.[a-z]{2,}$/i.test(trimmed)) {
    try {
      const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      const parts = hostname.split('.');
      const baseName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      const names = [baseName]; // e.g., "Snorkel", "Labelbox"
      // .ai domains typically brand as "X AI"
      if (parts.length >= 2 && parts[1] === 'ai') {
        names.push(`${baseName} AI`); // e.g., "Snorkel AI"
      }
      return names;
    } catch {
      return [trimmed];
    }
  }

  return [trimmed];
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
 * Reddit search works best with 3-8 keyword queries.
 * Long natural-language prompts (13-18 words) return poor results.
 *
 * Strategy:
 * 1. Strip punctuation and normalize
 * 2. Remove stop words (filler that adds no search signal)
 * 3. Keep max 8 key terms — enough context without noise
 */
/**
 * Clean a tracked prompt for Reddit search.
 *
 * Strategy:
 * 1. STRIP brand/competitor names — within subreddit search, these add noise
 *    ("scale" matches "scaling", "snorkel" matches snorkeling posts).
 *    Brand names are used for SCORING, not search.
 * 2. Remove stop words and cap at 8 keyword terms
 * 3. The remaining topic keywords drive the subreddit-specific search
 *
 * @param prompt     The raw tracked prompt text
 * @param knownNames Brand/competitor names to strip from the search query
 */
function cleanPromptForSearch(prompt: string, knownNames: string[] = []): string {
  let remaining = prompt;

  // Step 1: Strip brand/competitor names (they contaminate subreddit-specific search)
  // Sort by length descending so "Scale AI Platform" is stripped before "Scale AI"
  const sortedNames = [...knownNames].sort((a, b) => b.length - a.length);
  for (const name of sortedNames) {
    const regex = new RegExp(escapeRegex(name), 'gi');
    remaining = remaining.replace(regex, ' ').trim();
  }
  // Also strip single-word competitor names (e.g., "Labelbox", "Cohere")
  // that weren't in knownNames (which only contains multi-word names)
  // We'll pass allNames separately for this
  // (handled via the allCompetitorNames parameter below)

  // Step 2: Clean remaining text
  const cleaned = remaining
    .replace(/[?!.,;:'"¿¡()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Stop words to remove — these add no signal in Reddit search
  const stopWords = new Set([
    // English
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'what', 'which',
    'who', 'whom', 'this', 'that', 'these', 'those', 'how', 'why', 'when',
    'where', 'not', 'its', 'our', 'my', 'your', 'their', 'it',
    'need', 'want', 'find', 'get', 'use', 'using', 'just', 'also',
    'without', 'about', 'into', 'like', 'looking', 'there', 'been',
    'than', 'then', 'some', 'any', 'all', 'most', 'other', 'more',
    // Spanish
    'los', 'las', 'del', 'una', 'uno', 'unos', 'unas', 'que', 'con',
    'por', 'para', 'como', 'más', 'mas', 'sus', 'son', 'ser', 'está',
    'esta', 'este', 'estos', 'estas', 'eso', 'esos', 'ese', 'esa',
    'hay', 'sobre', 'entre', 'cuando', 'desde', 'donde', 'sin',
    'también', 'tambien', 'muy', 'todo', 'todos', 'toda', 'todas',
    'otro', 'otra', 'otros', 'otras', 'cada', 'puede', 'pueden',
    'qué', 'cómo', 'dónde', 'quién', 'quien', 'cuál', 'cual',
    'hacer', 'tiene', 'tienen', 'sido', 'bien', 'solo', 'sólo',
    'pero', 'porque', 'algo', 'después', 'antes', 'ahora',
    'necesito', 'quiero', 'buscar', 'busco',
  ]);

  const keyTerms = cleaned
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= 2 && !stopWords.has(w));

  // Keep max 8 terms — sweet spot for Reddit search
  const MAX_TERMS = 8;
  if (keyTerms.length <= MAX_TERMS) {
    return keyTerms.join(' ');
  }

  return keyTerms.slice(0, MAX_TERMS).join(' ');
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
