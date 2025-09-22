export interface NlrSectionFinding {
  title: string;
  importance?: 'high' | 'medium' | 'low';
}

export interface NlrSummaryJson {
  week_start_utc: string;
  sections: {
    whats_changed: { label: string; importance: 'high' | 'medium' | 'low' }[];
    highlights: string[];
    ai_visibility: {
      score_change: { direction: 'up' | 'down' | 'flat' | null; relative: number | null; absolute: number | null };
      notes: string[];
    };
    technical_structure: {
      overall_change: { direction: 'up' | 'down' | 'flat' | null; relative: number | null; absolute: number | null };
      key_findings: NlrSectionFinding[];
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


