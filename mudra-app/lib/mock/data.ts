// WHAT: Mock data for Mudra platform during frontend development
// WHY: Need realistic data structures to build UI before backend is ready
// HOW: Exports typed mock data for all platform features
// IMPACT: Enables full frontend development with realistic data


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