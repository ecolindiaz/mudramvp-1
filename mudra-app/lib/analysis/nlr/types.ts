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
  // Keep flexible for now since AI Visibility pipeline is evolving
  score?: Delta<number>;
  topImprovedQueries?: Array<{ query: string; delta: number; evidence?: EvidenceRef[] }>;
  topDeclinedQueries?: Array<{ query: string; delta: number; evidence?: EvidenceRef[] }>;
  notes?: string[]; // short bullet points from the pipeline
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

export interface NlrInput {
  companyId: string;
  weekStartUtc: string; // ISO string for stability in prompts
  // Available sections; any can be null if pipeline hasn’t produced data yet
  aiVisibility: AiVisibilitySummary | null;
  technical: TechnicalStructureSummary | null;
  tasks: TasksSummary | null;
  external: ExternalFootprintSummary | null;
  // New sections for full implementation
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


