export interface NlrSectionFinding {
  title: string;
  importance?: 'high' | 'medium' | 'low';
}

export interface NlrScoreChange {
  previous: number | null;
  current: number | null;
  direction: 'up' | 'down' | 'flat' | null;
  relative: number | null;
  absolute: number | null;
  formatted: string; // "58 → 71 (+22% ↑)"
}

export interface NlrAgentDeployment {
  agent_name: string;
  what_changed: string;
}

export interface NlrProviderVisits {
  provider: string;
  visits: number;
}

export interface NlrSummaryJson {
  week_start_utc: string;
  sections: {
    whats_changed: { label: string; importance: 'high' | 'medium' | 'low' }[];
    highlights: string[];
    agent_lab: {
      deployments: NlrAgentDeployment[];
      total_executions: number;
    };
    opportunities: {
      count: number;
      summary: string | null;
    };
    ai_visibility: {
      score_change: NlrScoreChange;
      notes: string[];
    };
    technical_structure: {
      overall_change: NlrScoreChange;
      key_findings: NlrSectionFinding[];
    };
    ai_traffic: {
      total_visits: number;
      weekly_boost: number;
      by_provider: NlrProviderVisits[];
      formatted: string; // "143 visits from AI sources (+30 vs. last week) — ChatGPT (64) · Perplexity (51) · Claude (28)"
    };
    tasks: {
      opened_this_week: number | null;
      completed_this_week: number | null;
      verification_rate_change: { direction: 'up' | 'down' | 'flat' | null; relative: number | null; absolute: number | null };
      top_open: { id: string; title: string }[];
    };
    risks_next_steps: string[];
  };
}

export interface WeeklyReportDto {
  id: string;
  companyId: string;
  weekStartUtc: string;
  status: 'queued' | 'running' | 'ready' | 'failed';
  model?: string | null;
  summaryMarkdown?: string | null;
  summaryJson?: NlrSummaryJson | null;
  createdAt: string;
  updatedAt: string;
}

export interface NlrLatestResponse {
  success: true;
  data: { report: WeeklyReportDto | null; sections: any[] };
}


