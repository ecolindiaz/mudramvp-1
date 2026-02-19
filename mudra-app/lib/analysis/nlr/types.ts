export interface EvidenceRef {
  sourceType: string; // e.g., "technical_analysis", "ai_visibility", "task"
  refTable?: string | null;
  refId?: string | null;
  url?: string | null;
  label?: string | null;
  metadata?: unknown;
}

export interface Delta<T> {
  current: T | null;
  previous: T | null;
  absolute?: number | null; // for numeric deltas
  relative?: number | null; // percent change, e.g., 0.12 = +12%
  direction?: "up" | "down" | "flat";
  notable?: boolean; // did it cross a threshold worth mentioning
}

export interface AiVisibilitySummary {
  score?: Delta<number>;
  averagePosition?: Delta<number>;
  topImprovedQueries?: Array<{ query: string; delta: number; evidence?: EvidenceRef[] }>;
  topDeclinedQueries?: Array<{ query: string; delta: number; evidence?: EvidenceRef[] }>;
  notes?: string[];
}

export interface TechnicalStructureSummary {
  overallScore?: Delta<number>;
  contentAuthority?: Delta<number>;
  technicalAccessibility?: Delta<number>;
  structuredData?: Delta<number>;
  entityRecognition?: Delta<number>;
  faqOptimization?: Delta<number>;
  contentFreshness?: Delta<number>;
  keyFindings?: Array<{
    title: string;
    importance?: "high" | "medium" | "low";
    evidence?: EvidenceRef[];
  }>;
  pageDeltas?: Array<{
    url: string;
    current: number;
    previous: number | null;
    delta: number | null;
  }>;
}

export interface TasksSummary {
  openedThisWeek?: number;
  completedThisWeek?: number;
  verificationPassRate?: Delta<number>; // 0..1
  topImpactTasks?: Array<{
    id: string;
    title: string;
    status: "open" | "done" | "verified" | "dismissed";
    evidence?: EvidenceRef[];
  }>;
}

export interface ExternalFootprintSummary {
  mentions?: Delta<number>; // number of brand mentions externally
  backlinks?: Delta<number>;
  socials?: {
    twitterFollowers?: Delta<number>;
    linkedinFollowers?: Delta<number>;
  };
  notableCoverage?: Array<{
    source: string; // domain or platform
    title: string;
    url?: string;
    evidence?: EvidenceRef[];
  }>;
}

export interface AIReferralTrafficSummary {
  totalVisits: Delta<number>;
  byProvider: Array<{
    provider: string; // ChatGPT, Perplexity, Claude, Gemini
    visits: number;
  }>;
  weeklyBoost: number; // absolute change vs last week
}

export interface AgentDeploymentsSummary {
  deployments: Array<{
    agentName: string;
    whatChanged: string;
    executionCount: number;
    evidence?: EvidenceRef[];
  }>;
  totalExecutions: number;
}

export interface OpportunitiesSummary {
  activeCount: number;
  newThisWeek: number;
  engagedThisWeek: number;
  dismissedThisWeek: number;
  topNew: Array<{
    id: number;
    postTitle: string | null;
    platform: string;
    relevanceScore: number | null;
    subreddit: string | null;
  }>;
}

export interface NlrInput {
  companyId: string;
  weekStartUtc: string; // ISO string for stability in prompts
  aiVisibility: AiVisibilitySummary | null;
  technical: TechnicalStructureSummary | null;
  tasks: TasksSummary | null;
  opportunities: OpportunitiesSummary | null;
  external: ExternalFootprintSummary | null;
  aiReferralTraffic: AIReferralTrafficSummary | null;
  agentDeployments: AgentDeploymentsSummary | null;
  // Ranked or pre-filtered developments across sections for fast prompting
  whatsChanged?: Array<{
    section: "visibility" | "technical" | "tasks" | "external" | "traffic" | "agents";
    label: string; // e.g., "AI Visibility score +8%"
    importance?: "high" | "medium" | "low";
    evidence?: EvidenceRef[];
  }>;
}


