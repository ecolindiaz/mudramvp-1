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
      active_count?: number;
      new_this_week?: number;
      engaged_this_week?: number;
    };
    ai_visibility: {
      score_change: NlrScoreChange;
      notes: string[];
    };
    average_position?: {
      current: number | null;
      previous: number | null;
      direction: 'up' | 'down' | 'flat' | null;
      delta: number | null;
      formatted: string;
    };
    technical_structure: {
      overall_change: NlrScoreChange;
      key_findings: NlrSectionFinding[];
      page_deltas?: Array<{
        url: string;
        current: number;
        previous: number | null;
        delta: number | null;
      }>;
    };
    ai_traffic: {
      total_visits: number;
      weekly_boost: number;
      by_provider: NlrProviderVisits[];
      formatted: string;
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
  brandProfileId: number;
  companyId?: string | null;
  weekStartUtc: string;
  status: 'queued' | 'running' | 'ready' | 'failed';
  model?: string | null;
  summaryMarkdown?: string | null;
  summaryJson?: NlrSummaryJson | null;
  createdAt: string;
  updatedAt: string;
}

export interface NlrCountryOverlay {
  aiVisibility: {
    score: {
      current: number | null;
      previous: number | null;
      absolute: number | null;
      relative: number | null;
      direction: 'up' | 'down' | 'flat';
    };
    averagePosition: {
      current: number | null;
      previous: number | null;
      absolute: number | null;
      relative: number | null;
      direction: 'up' | 'down' | 'flat';
    };
  };
}

export interface NlrLatestResponse {
  success: true;
  data: { report: WeeklyReportDto | null; sections: any[]; countryOverlay?: NlrCountryOverlay | null };
}


