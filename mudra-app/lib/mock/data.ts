// WHAT: Mock data for Mudra platform during frontend development
// WHY: Need realistic data structures to build UI before backend is ready
// HOW: Exports typed mock data for all platform features
// IMPACT: Enables full frontend development with realistic data

export const mockUser = {
  id: "user_1",
  name: "John Doe",
  email: "john@techstartup.com",
  avatar: "/avatars/user.jpg",
  company: "TechStartup Inc",
  plan: "pro",
  credits: 850,
  createdAt: new Date("2024-01-15"),
};

export const mockDashboardMetrics = {
  aiVisibilityScore: {
    current: 72,
    previous: 45,
    change: 60, // percentage change
    trend: "up" as const,
  },
  crawlerAccessRate: {
    current: 94,
    previous: 89,
    change: 5.6,
    trend: "up" as const,
  },
  technicalScore: {
    current: 85,
    previous: 78,
    change: 9,
    trend: "up" as const,
  },
  contentQualityScore: {
    current: 68,
    previous: 71,
    change: -4.2,
    trend: "down" as const,
  },
  externalFootprint: {
    current: 41,
    previous: 38,
    change: 7.9,
    trend: "up" as const,
  },
};

export const mockAiVisibilityData = {
  overallScore: 72,
  queriesRun: 100,
  mentionCount: 72,
  lastUpdated: new Date("2024-12-01T10:30:00"),
  
  byModel: [
    { model: "ChatGPT", mentions: 82, total: 100, percentage: 82 },
    { model: "Claude", mentions: 78, total: 100, percentage: 78 },
    { model: "Perplexity", mentions: 65, total: 100, percentage: 65 },
    { model: "Google AI", mentions: 63, total: 100, percentage: 63 },
  ],
  
  mentionsByCategory: [
    { category: "Product Features", count: 28 },
    { category: "Company Info", count: 22 },
    { category: "Use Cases", count: 15 },
    { category: "Pricing", count: 7 },
  ],
  
  recentMentions: [
    {
      id: "1",
      model: "ChatGPT",
      query: "What are the best startup analytics tools?",
      mentioned: true,
      context: "TechStartup Inc offers comprehensive analytics...",
      timestamp: new Date("2024-12-01T09:15:00"),
    },
    {
      id: "2",
      model: "Claude",
      query: "Compare business intelligence platforms for startups",
      mentioned: true,
      context: "Among emerging platforms, TechStartup Inc stands out...",
      timestamp: new Date("2024-12-01T08:45:00"),
    },
    {
      id: "3",
      model: "Perplexity",
      query: "Affordable data visualization tools",
      mentioned: false,
      context: null,
      timestamp: new Date("2024-12-01T08:20:00"),
    },
  ],
};

export const mockCrawlerData = {
  overallAccessRate: 94,
  totalBotVisits: 1247,
  uniqueBots: 5,
  lastCrawl: new Date("2024-12-01T11:45:00"),
  
  botActivity: [
    {
      botName: "GPTBot",
      visits: 423,
      lastSeen: new Date("2024-12-01T11:45:00"),
      pagesAccessed: 156,
      avgCrawlTime: 2.3,
      status: "active" as const,
    },
    {
      botName: "ClaudeBot",
      visits: 389,
      lastSeen: new Date("2024-12-01T10:30:00"),
      pagesAccessed: 142,
      avgCrawlTime: 1.9,
      status: "active" as const,
    },
    {
      botName: "PerplexityBot",
      visits: 267,
      lastSeen: new Date("2024-12-01T09:15:00"),
      pagesAccessed: 98,
      avgCrawlTime: 2.1,
      status: "active" as const,
    },
    {
      botName: "Google-Extended",
      visits: 168,
      lastSeen: new Date("2024-11-30T22:00:00"),
      pagesAccessed: 61,
      avgCrawlTime: 1.5,
      status: "inactive" as const,
    },
  ],
  
  crawlTimeline: [
    { date: "2024-11-25", count: 178 },
    { date: "2024-11-26", count: 192 },
    { date: "2024-11-27", count: 165 },
    { date: "2024-11-28", count: 201 },
    { date: "2024-11-29", count: 189 },
    { date: "2024-11-30", count: 176 },
    { date: "2024-12-01", count: 146 },
  ],
  
  blockedAttempts: 73,
  errorRate: 5.5,
};

export const mockTechnicalData = {
  overallScore: 85,
  lastAudit: new Date("2024-12-01T06:00:00"),
  
  scores: {
    schemaMarkup: 92,
    semanticHTML: 88,
    contentStructure: 83,
    accessibility: 78,
    performance: 84,
  },
  
  issues: [
    {
      id: "1",
      severity: "high" as const,
      category: "Schema Markup",
      issue: "Missing Organization schema on homepage",
      impact: "AI models may not properly identify your company",
      fix: "Add Organization schema to homepage",
    },
    {
      id: "2",
      severity: "medium" as const,
      category: "Content Structure",
      issue: "Multiple H1 tags on product page",
      impact: "Confuses content hierarchy for AI parsing",
      fix: "Use only one H1 per page",
    },
    {
      id: "3",
      severity: "low" as const,
      category: "Accessibility",
      issue: "Missing alt text on 12 images",
      impact: "Reduces content understanding for AI",
      fix: "Add descriptive alt text to all images",
    },
  ],
  
  recommendations: [
    "Implement FAQ schema for better Q&A visibility",
    "Add breadcrumb navigation for clearer site structure",
    "Optimize Core Web Vitals for better crawl rates",
    "Create XML sitemap specifically for AI crawlers",
  ],
};

export const mockContentData = {
  overallScore: 68,
  lastAnalysis: new Date("2024-12-01T07:30:00"),
  
  scores: {
    authority: 72,
    relevance: 81,
    uniqueness: 65,
    comprehensiveness: 59,
    citability: 71,
  },
  
  icpQuestions: {
    total: 47,
    answered: 32,
    coverage: 68,
    
    topQuestions: [
      {
        question: "How does your platform compare to Google Analytics?",
        answered: true,
        pageUrl: "/comparison/google-analytics",
        quality: "good" as const,
      },
      {
        question: "What's your pricing for startups?",
        answered: true,
        pageUrl: "/pricing",
        quality: "excellent" as const,
      },
      {
        question: "Do you offer API access?",
        answered: false,
        pageUrl: null,
        quality: null,
      },
      {
        question: "How do you handle data privacy?",
        answered: true,
        pageUrl: "/security",
        quality: "fair" as const,
      },
    ],
  },
  
  competitorComparison: [
    {
      competitor: "Competitor A",
      theirScore: 76,
      yourScore: 68,
      gap: -8,
      strengths: ["Better API documentation", "More case studies"],
      weaknesses: ["Less comprehensive pricing info"],
    },
    {
      competitor: "Competitor B",
      theirScore: 71,
      yourScore: 68,
      gap: -3,
      strengths: ["More technical content"],
      weaknesses: ["Fewer integrations documented"],
    },
  ],
};

export const mockExternalFootprint = {
  overallScore: 41,
  totalMentions: 127,
  uniqueDomains: 43,
  lastUpdated: new Date("2024-12-01T05:00:00"),
  
  mentionsByType: [
    { type: "Forums", count: 45, percentage: 35 },
    { type: "News Sites", count: 28, percentage: 22 },
    { type: "Blogs", count: 23, percentage: 18 },
    { type: "Social Media", count: 19, percentage: 15 },
    { type: "Directories", count: 12, percentage: 10 },
  ],
  
  topSources: [
    {
      domain: "reddit.com",
      mentions: 23,
      authority: "high" as const,
      sentiment: "positive" as const,
      lastMention: new Date("2024-11-30T18:30:00"),
    },
    {
      domain: "techcrunch.com",
      mentions: 8,
      authority: "very-high" as const,
      sentiment: "neutral" as const,
      lastMention: new Date("2024-11-28T14:00:00"),
    },
    {
      domain: "producthunt.com",
      mentions: 15,
      authority: "high" as const,
      sentiment: "positive" as const,
      lastMention: new Date("2024-11-29T09:00:00"),
    },
  ],
  
  opportunities: [
    {
      platform: "Hacker News",
      reason: "High-authority tech community, competitors frequently mentioned",
      difficulty: "medium" as const,
      impact: "high" as const,
    },
    {
      platform: "Stack Overflow",
      reason: "Technical Q&A platform, relevant to your API offerings",
      difficulty: "easy" as const,
      impact: "medium" as const,
    },
    {
      platform: "Dev.to",
      reason: "Developer blog platform, good for technical content",
      difficulty: "easy" as const,
      impact: "medium" as const,
    },
  ],
};

export const mockOverviewMetrics = {
  humansReferredFromLLMs: {
    current: 247,
    previous: 189,
    change: 30.7,
    trend: "up" as const,
    period: "This month",
    status: "Growing",
  },
  weeklyTasksCompleted: {
    current: 8,
    previous: 12,
    change: -33.3,
    trend: "down" as const,
    period: "This week",
    status: "Active",
  },
  thisWeekGoals: {
    current: 5,
    previous: 3,
    change: 66.7,
    trend: "up" as const,
    period: "This week",
    status: "On Track",
  },
  aiVisibilityRank: {
    current: 72,
    previous: 45,
    change: 60,
    trend: "up" as const,
    period: "Overall",
    status: "Improving",
  },
  contentQualityScore: {
    current: 85,
    previous: 78,
    change: 9,
    trend: "up" as const,
    period: "Technical",
    status: "Optimized",
  },
}; 