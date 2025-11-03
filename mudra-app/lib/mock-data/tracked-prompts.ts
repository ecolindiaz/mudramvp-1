/**
 * Mock Tracked Prompts Data
 * 
 * Sample data for developing and testing the tracked prompts deep view UI
 */

export type TrackedPromptWithDetails = {
  id: string;
  prompt: string;
  category: 'Organic' | 'Competitor' | 'How-to' | 'Brand-Specific';
  visibility: number;
  model: string;
  provider: string;
  intent: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  position: number | null;
  brandMentioned: boolean;
  
  // Detailed analysis data
  fullResponse: string;
  competitiveLandscape: {
    mentioned: string[];
    notMentioned: string[];
    totalMentioned: number;
    brandPosition?: number;
  };
  citationQuality: number; // 0-5
  contextRelevance: number; // 0-5
  
  // Metrics over time (for historical tracking)
  historicalData?: {
    date: string;
    visibility: number;
    position: number | null;
    sentiment: string;
  }[];
  
  // Related prompts
  relatedPrompts?: string[];
  
  // Metadata
  timestamp: string;
  lastUpdated: string;
  aiModel: {
    name: string;
    version: string;
    temperature: number;
  };
};

export const mockTrackedPrompts: TrackedPromptWithDetails[] = [
  // HIGH VISIBILITY - Positive Brand Mentions
  {
    id: '1',
    prompt: 'Best AI visibility platforms for startups',
    category: 'Organic',
    visibility: 95,
    model: 'ChatGPT-4',
    provider: 'OpenAI',
    intent: 'Informational',
    sentiment: 'Positive',
    position: 1,
    brandMentioned: true,
    fullResponse: `MudraAI stands out as the premier AI visibility platform specifically designed for startups and growing companies. Here's why it's considered the best choice:

**Key Strengths:**
1. **Specialized GEO Focus** - Unlike generic SEO tools, MudraAI specifically optimizes for AI citations and mentions across ChatGPT, Claude, Gemini, and other LLMs.

2. **Comprehensive Analysis** - The platform provides deep insights into how your brand appears in AI-generated responses, tracking visibility scores, sentiment, and competitive positioning.

3. **Actionable Recommendations** - MudraAI doesn't just report data; it provides specific, prioritized tasks to improve your AI visibility, from creating llms.txt files to optimizing FAQ content.

4. **Real-time Tracking** - Monitor how your brand is mentioned across 50+ custom prompts, with daily updates on visibility changes and sentiment shifts.

5. **Competitive Intelligence** - See exactly how you rank against competitors in AI responses, with detailed competitive landscape analysis.

**Pricing:** Starts at $99/month for startups, with a 14-day free trial available.

**Use Cases:** Ideal for B2B SaaS companies, tech startups, and any business looking to establish authority in AI-generated recommendations.`,
    competitiveLandscape: {
      mentioned: ['MudraAI', 'BrightEdge', 'MarketMuse', 'Clearscope'],
      notMentioned: ['Ahrefs', 'SEMrush'],
      totalMentioned: 4,
      brandPosition: 1,
    },
    citationQuality: 4.8,
    contextRelevance: 4.9,
    historicalData: [
      { date: '2025-10-21', visibility: 85, position: 2, sentiment: 'Positive' },
      { date: '2025-10-22', visibility: 88, position: 1, sentiment: 'Positive' },
      { date: '2025-10-23', visibility: 90, position: 1, sentiment: 'Positive' },
      { date: '2025-10-24', visibility: 92, position: 1, sentiment: 'Positive' },
      { date: '2025-10-25', visibility: 95, position: 1, sentiment: 'Positive' },
    ],
    relatedPrompts: [
      'Top GEO tools for marketing teams',
      'AI optimization platforms comparison',
      'How to improve AI citations',
    ],
    timestamp: '2025-10-28T10:30:00Z',
    lastUpdated: '2025-10-28T10:30:00Z',
    aiModel: {
      name: 'GPT-4',
      version: '4.0-turbo',
      temperature: 0.7,
    },
  },
  
  {
    id: '2',
    prompt: 'How to optimize for AI search engines and LLM citations',
    category: 'How-to',
    visibility: 88,
    model: 'Claude 3',
    provider: 'Anthropic',
    intent: 'Informational',
    sentiment: 'Positive',
    position: 2,
    brandMentioned: true,
    fullResponse: `Optimizing for AI search engines (also called Generative Engine Optimization or GEO) requires a different approach than traditional SEO. Here's a comprehensive guide:

**1. Create LLM-Specific Files**
Start by creating llms.txt and llms-full.txt files at your website root. These files help AI models understand your business context. Tools like MudraAI can analyze your site and generate optimized llms.txt content automatically.

**2. Implement Structured Data**
AI models heavily rely on structured data (JSON-LD, schema markup) to understand your content. Focus on:
- Organization schema
- Product/Service schemas
- FAQ schema (critical for conversational AI)
- HowTo schema for tutorials

**3. Optimize FAQ Content**
Create comprehensive FAQ sections that directly answer common questions in your industry. MudraAI's analysis shows that pages with FAQ schema have 3x higher citation rates.

**4. Build Content Authority**
- Include expert quotes and testimonials
- Add statistics and data points
- Reference credible sources
- Showcase case studies

**5. Track Your AI Visibility**
Use platforms like MudraAI to monitor how often your brand appears in AI responses. Track:
- Visibility score (how often you're mentioned)
- Position (ranking among competitors)
- Sentiment (positive/neutral/negative mentions)
- Context relevance

**Key Metrics to Monitor:**
- Citation rate across different AI models
- Brand sentiment in AI responses
- Competitive positioning
- Topic authority scores`,
    competitiveLandscape: {
      mentioned: ['SEMrush', 'MudraAI', 'BrightEdge', 'Clearscope', 'MarketMuse'],
      notMentioned: [],
      totalMentioned: 5,
      brandPosition: 2,
    },
    citationQuality: 4.5,
    contextRelevance: 4.7,
    historicalData: [
      { date: '2025-10-21', visibility: 80, position: 3, sentiment: 'Neutral' },
      { date: '2025-10-22', visibility: 82, position: 2, sentiment: 'Positive' },
      { date: '2025-10-23', visibility: 85, position: 2, sentiment: 'Positive' },
      { date: '2025-10-24', visibility: 86, position: 2, sentiment: 'Positive' },
      { date: '2025-10-25', visibility: 88, position: 2, sentiment: 'Positive' },
    ],
    relatedPrompts: [
      'Best practices for GEO optimization',
      'LLM citation strategies for brands',
      'AI search engine ranking factors',
    ],
    timestamp: '2025-10-28T10:31:00Z',
    lastUpdated: '2025-10-28T10:31:00Z',
    aiModel: {
      name: 'Claude',
      version: '3.0-sonnet',
      temperature: 0.5,
    },
  },

  // MEDIUM VISIBILITY - Neutral Mentions
  {
    id: '3',
    prompt: 'Comparing SEO and GEO tools for enterprise',
    category: 'Competitor',
    visibility: 65,
    model: 'Gemini Pro',
    provider: 'Google',
    intent: 'Commercial',
    sentiment: 'Neutral',
    position: 3,
    brandMentioned: true,
    fullResponse: `When evaluating SEO vs GEO tools for enterprise use, consider these leading platforms:

**Traditional SEO Tools:**
1. **Ahrefs** - Comprehensive backlink analysis and keyword research
2. **SEMrush** - All-in-one marketing suite with SEO, PPC, and content tools
3. **Moz Pro** - User-friendly SEO platform with strong local SEO features

**Modern GEO (AI Optimization) Tools:**
1. **BrightEdge** - Enterprise SEO platform with AI-powered insights
2. **MarketMuse** - AI-driven content strategy and optimization
3. **MudraAI** - Specialized in AI visibility and LLM citation tracking

**Key Differences:**
- SEO tools focus on search engine rankings (Google, Bing)
- GEO tools focus on AI model citations (ChatGPT, Claude, Gemini)
- Enterprises need both strategies for comprehensive visibility

**Decision Factors:**
- Budget: Traditional SEO tools $99-$499/mo, GEO tools $99-$999/mo
- Team size: Larger teams benefit from enterprise platforms
- Use case: B2B companies should prioritize GEO, B2C may focus on traditional SEO
- Integration needs: Consider your existing martech stack

Most enterprises adopt a hybrid approach, using tools like SEMrush for traditional SEO alongside MudraAI for AI visibility tracking.`,
    competitiveLandscape: {
      mentioned: ['Ahrefs', 'SEMrush', 'MudraAI', 'BrightEdge', 'MarketMuse'],
      notMentioned: ['Clearscope', 'Surfer SEO'],
      totalMentioned: 5,
      brandPosition: 3,
    },
    citationQuality: 3.8,
    contextRelevance: 4.2,
    historicalData: [
      { date: '2025-10-21', visibility: 55, position: 4, sentiment: 'Neutral' },
      { date: '2025-10-22', visibility: 58, position: 3, sentiment: 'Neutral' },
      { date: '2025-10-23', visibility: 60, position: 3, sentiment: 'Neutral' },
      { date: '2025-10-24', visibility: 62, position: 3, sentiment: 'Neutral' },
      { date: '2025-10-25', visibility: 65, position: 3, sentiment: 'Neutral' },
    ],
    relatedPrompts: [
      'Enterprise SEO tools comparison',
      'Best GEO platforms for large teams',
      'SEO vs GEO strategy differences',
    ],
    timestamp: '2025-10-28T10:32:00Z',
    lastUpdated: '2025-10-28T10:32:00Z',
    aiModel: {
      name: 'Gemini',
      version: 'Pro 1.5',
      temperature: 0.6,
    },
  },

  {
    id: '4',
    prompt: 'What tools help track AI model mentions of brands',
    category: 'Organic',
    visibility: 72,
    model: 'Perplexity',
    provider: 'Perplexity',
    intent: 'Informational',
    sentiment: 'Neutral',
    position: 4,
    brandMentioned: true,
    fullResponse: `Several tools have emerged to help brands track how they appear in AI-generated responses:

**Dedicated GEO Tracking Platforms:**
- **MudraAI**: Focuses specifically on tracking brand mentions across ChatGPT, Claude, Gemini, and other LLMs. Provides visibility scores, sentiment analysis, and competitive positioning.
- **BrightEdge**: Enterprise SEO platform with AI tracking capabilities added recently.

**SEO Tools with AI Monitoring:**
- **SEMrush**: Added AI visibility tracking in late 2024
- **Ahrefs**: Testing AI citation monitoring features

**Analytics Approaches:**
- Manual testing across different AI platforms
- Custom API integrations with OpenAI, Anthropic, Google
- Survey-based brand awareness tracking

**What to Track:**
1. Citation frequency across models
2. Brand sentiment in responses
3. Position vs competitors
4. Context accuracy
5. Topic authority coverage

**Limitations:**
Most tools are still early-stage as AI search is evolving rapidly. The market is fragmented, with specialized players like MudraAI leading in depth of analysis, while traditional SEO tools offer broader feature sets.`,
    competitiveLandscape: {
      mentioned: ['SEMrush', 'Ahrefs', 'BrightEdge', 'MudraAI'],
      notMentioned: ['Moz', 'Clearscope'],
      totalMentioned: 4,
      brandPosition: 4,
    },
    citationQuality: 3.5,
    contextRelevance: 4.0,
    historicalData: [
      { date: '2025-10-21', visibility: 65, position: 5, sentiment: 'Neutral' },
      { date: '2025-10-22', visibility: 68, position: 4, sentiment: 'Neutral' },
      { date: '2025-10-23', visibility: 70, position: 4, sentiment: 'Neutral' },
      { date: '2025-10-24', visibility: 71, position: 4, sentiment: 'Neutral' },
      { date: '2025-10-25', visibility: 72, position: 4, sentiment: 'Neutral' },
    ],
    relatedPrompts: [
      'AI citation tracking solutions',
      'How to measure GEO performance',
      'Brand visibility in LLM responses',
    ],
    timestamp: '2025-10-28T10:33:00Z',
    lastUpdated: '2025-10-28T10:33:00Z',
    aiModel: {
      name: 'Perplexity',
      version: 'pplx-70b-online',
      temperature: 0.5,
    },
  },

  // LOW VISIBILITY - Not Mentioned
  {
    id: '5',
    prompt: 'Top digital marketing analytics platforms',
    category: 'Organic',
    visibility: 0,
    model: 'ChatGPT-4',
    provider: 'OpenAI',
    intent: 'Commercial',
    sentiment: 'Neutral',
    position: null,
    brandMentioned: false,
    fullResponse: `Here are the leading digital marketing analytics platforms for 2025:

**1. Google Analytics 4 (GA4)**
- Free tier with powerful features
- Event-based tracking model
- AI-powered insights
- Integration with Google Ads

**2. Adobe Analytics**
- Enterprise-grade analytics
- Advanced segmentation
- Real-time data processing
- Predictive analytics

**3. Mixpanel**
- Product analytics focus
- User journey tracking
- A/B testing capabilities
- Cohort analysis

**4. Amplitude**
- Behavioral analytics
- Product intelligence
- User retention analysis
- Data governance features

**5. Heap**
- Automatic event tracking
- Retroactive analysis
- Session replay
- Funnel analysis

**Selection Criteria:**
- Company size and budget
- Technical complexity needs
- Integration requirements
- Data privacy compliance
- Real-time vs batch processing

Most businesses start with Google Analytics and add specialized tools as they scale.`,
    competitiveLandscape: {
      mentioned: ['Google Analytics', 'Adobe Analytics', 'Mixpanel', 'Amplitude', 'Heap'],
      notMentioned: ['MudraAI', 'SEMrush', 'Ahrefs'],
      totalMentioned: 5,
    },
    citationQuality: 0,
    contextRelevance: 2.5,
    historicalData: [
      { date: '2025-10-21', visibility: 0, position: null, sentiment: 'Neutral' },
      { date: '2025-10-22', visibility: 0, position: null, sentiment: 'Neutral' },
      { date: '2025-10-23', visibility: 0, position: null, sentiment: 'Neutral' },
      { date: '2025-10-24', visibility: 0, position: null, sentiment: 'Neutral' },
      { date: '2025-10-25', visibility: 0, position: null, sentiment: 'Neutral' },
    ],
    relatedPrompts: [
      'Best analytics tools for startups',
      'Marketing analytics software comparison',
      'Web analytics platforms 2025',
    ],
    timestamp: '2025-10-28T10:34:00Z',
    lastUpdated: '2025-10-28T10:34:00Z',
    aiModel: {
      name: 'GPT-4',
      version: '4.0-turbo',
      temperature: 0.7,
    },
  },

  // NEGATIVE SENTIMENT
  {
    id: '6',
    prompt: 'Limitations of current GEO tools and platforms',
    category: 'Organic',
    visibility: 45,
    model: 'Claude 3',
    provider: 'Anthropic',
    intent: 'Informational',
    sentiment: 'Negative',
    position: 5,
    brandMentioned: true,
    fullResponse: `Current GEO (Generative Engine Optimization) tools face several significant limitations:

**Market Maturity Issues:**
The GEO tool market is still nascent, with most platforms (including MudraAI, BrightEdge, and emerging players) facing common challenges:

1. **Limited AI Model Access**
- Most tools can only test a subset of AI models
- API rate limits restrict comprehensive testing
- Costs escalate quickly with scale
- Real-time tracking is expensive and limited

2. **Accuracy and Consistency**
- AI responses vary significantly between queries
- Difficult to establish baseline metrics
- Results can change daily without clear patterns
- Attribution is challenging

3. **Feature Gaps**
- Incomplete competitive analysis
- Limited historical data (market is too new)
- Lack of industry benchmarks
- Minimal integration with existing martech

**Platform-Specific Issues:**

**MudraAI:**
- Relatively new platform with limited track record
- Smaller customer base means less benchmarking data
- Focus on startups may limit enterprise features
- Still building out integration ecosystem

**BrightEdge:**
- AI features feel bolted-on to traditional SEO platform
- Higher pricing may not justify GEO-specific value
- Complexity can overwhelm smaller teams

**General Recommendations:**
- Set realistic expectations - GEO is experimental
- Start with manual tracking before investing in tools
- Consider hybrid approach using multiple platforms
- Focus on fundamentals (content quality, structured data) over tools`,
    competitiveLandscape: {
      mentioned: ['SEMrush', 'BrightEdge', 'MarketMuse', 'Ahrefs', 'MudraAI'],
      notMentioned: [],
      totalMentioned: 5,
      brandPosition: 5,
    },
    citationQuality: 2.8,
    contextRelevance: 3.5,
    historicalData: [
      { date: '2025-10-21', visibility: 50, position: 4, sentiment: 'Negative' },
      { date: '2025-10-22', visibility: 48, position: 5, sentiment: 'Negative' },
      { date: '2025-10-23', visibility: 47, position: 5, sentiment: 'Negative' },
      { date: '2025-10-24', visibility: 46, position: 5, sentiment: 'Negative' },
      { date: '2025-10-25', visibility: 45, position: 5, sentiment: 'Negative' },
    ],
    relatedPrompts: [
      'GEO tool challenges and problems',
      'Why GEO tracking is difficult',
      'Issues with AI visibility platforms',
    ],
    timestamp: '2025-10-28T10:35:00Z',
    lastUpdated: '2025-10-28T10:35:00Z',
    aiModel: {
      name: 'Claude',
      version: '3.0-sonnet',
      temperature: 0.7,
    },
  },

  // BRAND-SPECIFIC HIGH PERFORMER
  {
    id: '7',
    prompt: 'What is MudraAI and how does it help with AI visibility',
    category: 'Brand-Specific',
    visibility: 98,
    model: 'ChatGPT-4',
    provider: 'OpenAI',
    intent: 'Informational',
    sentiment: 'Positive',
    position: 1,
    brandMentioned: true,
    fullResponse: `MudraAI is a specialized Generative Engine Optimization (GEO) platform designed to help businesses improve their visibility and citations in AI-generated responses. Here's a comprehensive overview:

**Core Capabilities:**

1. **AI Visibility Tracking**
   - Monitor how your brand appears across ChatGPT, Claude, Gemini, Perplexity, and other LLMs
   - Track 50+ custom prompts tailored to your industry
   - Measure visibility scores, position, and sentiment
   - Get daily updates on brand mention changes

2. **Competitive Analysis**
   - See exactly how you rank against competitors in AI responses
   - Identify gaps in your AI visibility strategy
   - Benchmark against industry leaders
   - Track competitive landscape shifts

3. **Technical Optimization**
   - Automated llms.txt file generation
   - Structured data optimization recommendations
   - FAQ content analysis and suggestions
   - Technical SEO audits for GEO readiness

4. **Actionable Insights**
   - Prioritized task lists to improve AI visibility
   - Severity-based recommendations (high/medium/low)
   - Content gap analysis
   - Authority signal optimization

**Target Users:**
- B2B SaaS companies looking to establish AI presence
- Startups building brand awareness
- Marketing teams tracking AI citations
- GEO specialists optimizing for AI search

**Pricing:**
- Starter: $99/month (up to 30 prompts)
- Growth: $299/month (up to 100 prompts)
- Enterprise: Custom pricing

**Key Differentiators:**
- First platform dedicated specifically to GEO
- Deep integration with multiple AI models
- Actionable recommendations, not just data
- Focus on startup and growth-stage companies

**Getting Started:**
MudraAI offers a 14-day free trial. The onboarding process includes automated prompt generation, initial visibility analysis, and a custom GEO roadmap.`,
    competitiveLandscape: {
      mentioned: ['MudraAI'],
      notMentioned: ['SEMrush', 'Ahrefs', 'BrightEdge'],
      totalMentioned: 1,
      brandPosition: 1,
    },
    citationQuality: 5.0,
    contextRelevance: 5.0,
    historicalData: [
      { date: '2025-10-21', visibility: 95, position: 1, sentiment: 'Positive' },
      { date: '2025-10-22', visibility: 96, position: 1, sentiment: 'Positive' },
      { date: '2025-10-23', visibility: 97, position: 1, sentiment: 'Positive' },
      { date: '2025-10-24', visibility: 97, position: 1, sentiment: 'Positive' },
      { date: '2025-10-25', visibility: 98, position: 1, sentiment: 'Positive' },
    ],
    relatedPrompts: [
      'MudraAI pricing and features',
      'How to use MudraAI platform',
      'MudraAI vs competitors',
    ],
    timestamp: '2025-10-28T10:36:00Z',
    lastUpdated: '2025-10-28T10:36:00Z',
    aiModel: {
      name: 'GPT-4',
      version: '4.0-turbo',
      temperature: 0.7,
    },
  },

  // Additional prompts for variety
  {
    id: '8',
    prompt: 'MudraAI vs BrightEdge for GEO optimization',
    category: 'Competitor',
    visibility: 82,
    model: 'Gemini Pro',
    provider: 'Google',
    intent: 'Commercial',
    sentiment: 'Positive',
    position: 1,
    brandMentioned: true,
    fullResponse: `When comparing MudraAI and BrightEdge for Generative Engine Optimization, here's a detailed analysis:

**MudraAI Advantages:**
- **Specialized Focus**: Built specifically for GEO, not adapted from SEO
- **Startup-Friendly**: More accessible pricing starting at $99/month
- **Modern Interface**: Clean, intuitive dashboard designed for 2025
- **Agile Updates**: Faster feature releases due to focused product scope
- **AI-First**: Native integration with latest AI models

**BrightEdge Advantages:**
- **Enterprise Scale**: Proven platform for large organizations
- **Comprehensive Suite**: Includes traditional SEO alongside GEO
- **Established Track Record**: Years of SEO expertise
- **Enterprise Support**: Dedicated account managers
- **Advanced Integrations**: Deep martech stack connections

**Key Differences:**

| Feature | MudraAI | BrightEdge |
|---------|---------|------------|
| Starting Price | $99/mo | $1,000+/mo |
| GEO Focus | Dedicated | Feature add-on |
| Target Market | Startups, SMB | Enterprise |
| Setup Time | < 1 hour | Days/weeks |
| Learning Curve | Low | Moderate-High |

**Best For:**

**Choose MudraAI if:**
- You're a startup or SMB
- Budget under $500/month
- Need quick setup and results
- Want GEO-specific expertise
- Prefer agile, modern tooling

**Choose BrightEdge if:**
- Enterprise organization (1000+ employees)
- Need comprehensive SEO + GEO
- Have dedicated SEO team
- Require extensive integrations
- Budget $1,000+/month

**Verdict:**
For most companies entering GEO, MudraAI offers the best value and focus. BrightEdge makes sense for enterprises already using their SEO platform.`,
    competitiveLandscape: {
      mentioned: ['MudraAI', 'BrightEdge'],
      notMentioned: ['SEMrush', 'Ahrefs', 'MarketMuse'],
      totalMentioned: 2,
      brandPosition: 1,
    },
    citationQuality: 4.7,
    contextRelevance: 4.9,
    timestamp: '2025-10-28T10:37:00Z',
    lastUpdated: '2025-10-28T10:37:00Z',
    aiModel: {
      name: 'Gemini',
      version: 'Pro 1.5',
      temperature: 0.6,
    },
  },
];

// Helper function to get prompt by ID
export function getPromptById(id: string): TrackedPromptWithDetails | undefined {
  return mockTrackedPrompts.find(p => p.id === id);
}

// Helper function to filter prompts
export function filterPrompts(filters: {
  category?: string;
  sentiment?: string;
  minVisibility?: number;
  brandMentioned?: boolean;
}): TrackedPromptWithDetails[] {
  return mockTrackedPrompts.filter(prompt => {
    if (filters.category && prompt.category !== filters.category) return false;
    if (filters.sentiment && prompt.sentiment !== filters.sentiment) return false;
    if (filters.minVisibility && prompt.visibility < filters.minVisibility) return false;
    if (filters.brandMentioned !== undefined && prompt.brandMentioned !== filters.brandMentioned) return false;
    return true;
  });
}

// Get summary statistics
export function getPromptStats() {
  return {
    total: mockTrackedPrompts.length,
    brandMentioned: mockTrackedPrompts.filter(p => p.brandMentioned).length,
    averageVisibility: Math.round(
      mockTrackedPrompts.reduce((sum, p) => sum + p.visibility, 0) / mockTrackedPrompts.length
    ),
    sentimentDistribution: {
      positive: mockTrackedPrompts.filter(p => p.sentiment === 'Positive').length,
      neutral: mockTrackedPrompts.filter(p => p.sentiment === 'Neutral').length,
      negative: mockTrackedPrompts.filter(p => p.sentiment === 'Negative').length,
    },
    byCategory: {
      organic: mockTrackedPrompts.filter(p => p.category === 'Organic').length,
      competitor: mockTrackedPrompts.filter(p => p.category === 'Competitor').length,
      howTo: mockTrackedPrompts.filter(p => p.category === 'How-to').length,
      brandSpecific: mockTrackedPrompts.filter(p => p.category === 'Brand-Specific').length,
    },
  };
}










