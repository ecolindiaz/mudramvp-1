import 'server-only';

import { getServiceClient } from '@/lib/db/supabase-server';

export type GeoAnalysisLogStatus = 'firegeo' | 'fallback' | 'error';

export interface GeoAnalysisLogInput {
  brandName: string;
  website?: string;
  industry?: string;
  description?: string;
  competitors?: string[];
  usedFiregeo: boolean;
  status: GeoAnalysisLogStatus;
  firegeoAnalysisId?: string | null;
  overallScore?: number | null;
  durationMs?: number | null;
  requestPayload?: unknown;
  firegeoRaw?: unknown;
  result?: unknown;
  firegeoError?: string | null;
  error?: string | null;
}

function ensureJsonSafe<T>(value: T | undefined | null): T | null {
  if (value === undefined || value === null) return null;
  return value;
}

export async function logGeoAnalysisRun(input: GeoAnalysisLogInput): Promise<void> {
  try {
    const supabase = getServiceClient();
    await supabase.from('geo_analysis_runs').insert({
      brand_name: input.brandName,
      website: input.website ?? null,
      industry: input.industry ?? null,
      description: input.description ?? null,
      competitors: input.competitors ?? [],
      used_firegeo: input.usedFiregeo,
      status: input.status,
      firegeo_analysis_id: input.firegeoAnalysisId ?? null,
      overall_score: input.overallScore ?? null,
      duration_ms: input.durationMs ?? null,
  request_payload: ensureJsonSafe(input.requestPayload),
  firegeo_raw: ensureJsonSafe(input.firegeoRaw),
  result: ensureJsonSafe(input.result),
      firegeo_error: input.firegeoError ?? null,
      error: input.error ?? null,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('logGeoAnalysisRun failed:', error);
  }
}
