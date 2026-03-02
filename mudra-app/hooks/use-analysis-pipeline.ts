/**
 * Custom hook for triggering and monitoring the analysis pipeline.
 *
 * Runs analysis as TWO sequential HTTP requests (Technical → GEO), each
 * getting its own 300s Vercel budget. Tries SSE streaming first for real-time
 * progress; falls back to regular POST with simulated progress.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProgressPhase =
  | 'prompts' | 'geo' | 'discovery' | 'scraping'
  | 'scoring' | 'report' | 'issues' | 'complete' | 'error';

export interface ProgressEvent {
  phase: ProgressPhase;
  status: 'started' | 'progress' | 'completed' | 'failed';
  message?: string;
  data?: Record<string, any>;
}

export interface AnalysisPipelineProgress {
  geoAnalysis: 'pending' | 'completed' | 'failed';
  trafficMetrics: 'pending' | 'completed' | 'failed';
  technicalStructure: 'pending' | 'completed' | 'failed';
  report: 'pending' | 'completed' | 'failed';
}

export interface AnalysisPipelineState {
  state: 'idle' | 'running' | 'completed' | 'error';
  progress: AnalysisPipelineProgress;
  results?: {
    geoAnalysisId?: string;
    trafficMetricsId?: string;
    technicalAnalysisId?: string;
    reportId?: string;
  };
  error?: string;
}

export interface AnalysisPipelineConfig {
  brandProfileId: number;
  brandName: string;
  website: string;
  description?: string;
  industry?: string;
  competitors?: string[];
  countries?: string[];
}

// ---------------------------------------------------------------------------
// Weighted progress mapping (sequential: Technical 0-45%, GEO 45-100%)
// ---------------------------------------------------------------------------
// Technical track (phase 1): discovery(0-5%) + scraping(5-25%) + scoring(25-45%)
// GEO track      (phase 2): prompts(45-50%) + geo(50-80%)
// Sequential post-analysis : report(80-90%) + issues(90-95%) + complete(95-100%)

interface PhaseWeight { start: number; end: number }

const PHASE_WEIGHTS: Record<string, PhaseWeight> = {
  // Phase 1: Technical
  discovery: { start: 0,  end: 5 },
  scraping:  { start: 5,  end: 25 },
  scoring:   { start: 25, end: 45 },
  // Phase 2: GEO
  prompts:   { start: 45, end: 50 },
  geo:       { start: 50, end: 80 },
  // Post-analysis (runs in GEO phase)
  report:    { start: 80, end: 90 },
  issues:    { start: 90, end: 95 },
  complete:  { start: 95, end: 100 },
};

function computeProgress(completedPhases: Set<string>, activePhase?: { phase: string; fraction?: number }): number {
  let maxProgress = 0;

  for (const phase of completedPhases) {
    const w = PHASE_WEIGHTS[phase];
    if (!w) continue;
    maxProgress = Math.max(maxProgress, w.end);
  }

  if (activePhase) {
    const w = PHASE_WEIGHTS[activePhase.phase];
    if (w) {
      const partial = w.start + (w.end - w.start) * (activePhase.fraction ?? 0.5);
      maxProgress = Math.max(maxProgress, partial);
    }
  }

  return Math.min(Math.round(maxProgress), 100);
}

// Map SSE phase to one of the 6 ordered UI steps (Technical-first order)
const PHASE_TO_STEP_INDEX: Record<string, number> = {
  discovery: 0,
  scraping: 1,
  scoring: 2,
  prompts: 3,
  geo: 4,
  report: 5,
  issues: 5,
  complete: 5,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAnalysisPipeline() {
  const [pipelineState, setPipelineState] = useState<AnalysisPipelineState>({
    state: 'idle',
    progress: {
      geoAnalysis: 'pending',
      trafficMetrics: 'pending',
      technicalStructure: 'pending',
      report: 'pending',
    },
  });
  const [simulatedProgress, setSimulatedProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<ProgressPhase | null>(null);
  const [phaseDetail, setPhaseDetail] = useState<string | null>(null);
  const [currentStepFromSSE, setCurrentStepFromSSE] = useState<number>(-1);
  const timeoutIdsRef = useRef<NodeJS.Timeout[]>([]);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach(id => clearTimeout(id));
      timeoutIdsRef.current = [];
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

  const clearAllTimers = useCallback(() => {
    timeoutIdsRef.current.forEach(id => clearTimeout(id));
    timeoutIdsRef.current = [];
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // -------------------------------------------------------------------
  // Shared SSE reader — reads one SSE stream, updating progress state
  // Returns the `data` from the final 'complete' event, or null on failure.
  // -------------------------------------------------------------------
  const readSSEStream = async (
    response: Response,
    completedPhases: Set<string>,
    progressCap: number,
  ): Promise<any> => {
    if (!response.body) return null;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult: any = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          let event: ProgressEvent;
          try {
            event = JSON.parse(jsonStr);
          } catch {
            continue;
          }

          setCurrentPhase(event.phase);

          const stepIdx = PHASE_TO_STEP_INDEX[event.phase];
          if (stepIdx !== undefined) {
            setCurrentStepFromSSE(prev => Math.max(prev, stepIdx));
          }

          const detail = buildPhaseDetail(event);
          if (detail) setPhaseDetail(detail);

          if (event.status === 'completed') {
            completedPhases.add(event.phase);
          }

          let fraction: number | undefined;
          if (event.phase === 'scraping' && event.status === 'progress' && event.data) {
            fraction = event.data.total > 0 ? event.data.scraped / event.data.total : 0;
          }

          const progress = computeProgress(
            completedPhases,
            event.status !== 'completed' ? { phase: event.phase, fraction } : undefined,
          );
          setSimulatedProgress(Math.min(progress, progressCap));

          // Trickle timer: slowly advance progress during the long-running GEO
          // phase (3-4 min of provider testing) instead of sitting at a fixed value.
          if (event.phase === 'geo' && event.status === 'started') {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = setInterval(() => {
              setSimulatedProgress(prev => {
                if (prev >= 78) return prev; // leave room for actual completion at 80
                const remaining = 78 - prev;
                return Math.min(prev + Math.max(0.1, remaining * 0.03 + Math.random() * 0.1), 78);
              });
            }, 3000);
          } else if (progressIntervalRef.current && (event.phase !== 'geo' || event.status === 'completed' || event.status === 'failed')) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }

          if (event.phase === 'complete' && event.data) {
            finalResult = event.data;
          }

          if (event.phase === 'error') {
            throw new Error(event.message || 'Analysis failed');
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return finalResult;
  };

  // -------------------------------------------------------------------
  // SSE streaming run — two sequential SSE calls
  // -------------------------------------------------------------------
  const runViaSSE = async (
    payload: Record<string, any>,
    config: AnalysisPipelineConfig,
  ): Promise<boolean> => {
    const completedPhases = new Set<string>();

    // --- Phase 1: Technical ---
    console.log('[useAnalysisPipeline] SSE Phase 1: Technical');
    const techResponse = await fetch('/api/analysis/unified/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, phase: 'technical' }),
    });

    if (!techResponse.ok || !techResponse.body) return false;

    const techResult = await readSSEStream(techResponse, completedPhases, 45);

    // Extract technicalAnalysisId for phase 2
    const technicalAnalysisId = techResult?.technicalAnalysisId;

    // Update pipeline state: technical phase done
    if (techResult?.technicalAnalysisId) {
      setPipelineState(prev => ({
        ...prev,
        progress: { ...prev.progress, technicalStructure: 'completed' },
      }));
    }

    // Ensure progress is at 45% before starting phase 2
    setSimulatedProgress(45);

    // Reset Phase 1's completion state so Phase 2 progress tracks correctly.
    // Phase 1 emits a 'complete' event which stays in completedPhases — without
    // clearing it, computeProgress() would immediately return 100% for Phase 2.
    completedPhases.delete('complete');
    // Reset step index to last completed technical step so Phase 2 events
    // (prompts=3, geo=4, report=5) can advance it forward properly.
    setCurrentStepFromSSE(2); // scoring = index 2
    setPhaseDetail(null);

    // --- Phase 2: GEO ---
    console.log('[useAnalysisPipeline] SSE Phase 2: GEO');
    const geoResponse = await fetch('/api/analysis/unified/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, phase: 'geo', technicalAnalysisId }),
    });

    if (!geoResponse.ok || !geoResponse.body) {
      // GEO SSE failed but Technical succeeded — partial success
      if (techResult?.technicalAnalysisId) {
        clearAllTimers();
        setSimulatedProgress(100);
        setCurrentStepFromSSE(5);
        setPipelineState({
          state: 'completed',
          progress: {
            geoAnalysis: 'failed',
            trafficMetrics: 'completed',
            technicalStructure: 'completed',
            report: 'failed',
          },
          results: {
            technicalAnalysisId: techResult.technicalAnalysisId,
          },
        });

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('mudra:website-analyzed', {
            detail: { brandProfileId: config.brandProfileId, results: techResult },
          }));
        }
        return true;
      }
      return false;
    }

    const geoResult = await readSSEStream(geoResponse, completedPhases, 100);

    // Merge results from both phases
    const mergedResult = {
      ...techResult,
      ...geoResult,
      // Ensure technicalAnalysisId from phase 1 is preserved
      technicalAnalysisId: techResult?.technicalAnalysisId || geoResult?.technicalAnalysisId,
    };

    if (!mergedResult.technicalAnalysisId && !mergedResult.geoAnalysisId) return false;

    // Success
    clearAllTimers();
    setSimulatedProgress(100);
    setCurrentStepFromSSE(5);
    setPipelineState({
      state: 'completed',
      progress: {
        geoAnalysis: mergedResult.geoAnalysisId ? 'completed' : 'failed',
        trafficMetrics: 'completed',
        technicalStructure: mergedResult.technicalAnalysisId ? 'completed' : 'failed',
        report: mergedResult.reportId ? 'completed' : 'failed',
      },
      results: {
        geoAnalysisId: mergedResult.geoAnalysisId,
        technicalAnalysisId: mergedResult.technicalAnalysisId,
        reportId: mergedResult.reportId,
      },
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mudra:website-analyzed', {
        detail: { brandProfileId: config.brandProfileId, results: mergedResult },
      }));
    }

    return true;
  };

  // -------------------------------------------------------------------
  // Fallback: regular POST with simulated progress — two sequential calls
  // -------------------------------------------------------------------
  const runViaFetch = async (
    payload: Record<string, any>,
    config: AnalysisPipelineConfig,
  ) => {
    // Start simulated progress for technical phase
    setSimulatedProgress(3 + Math.random() * 5);
    progressIntervalRef.current = setInterval(() => {
      setSimulatedProgress(prev => {
        if (prev >= 42) return prev;
        const speed = prev < 15 ? 4 + Math.random() * 8 : prev < 30 ? 2 + Math.random() * 5 : 0.5 + Math.random() * 2;
        return Math.min(prev + speed, 42);
      });
    }, 1200);

    // Simulated step timers for technical phase
    timeoutIdsRef.current.push(
      setTimeout(() => setPipelineState(prev => ({ ...prev, progress: { ...prev.progress, technicalStructure: 'completed' as const } })), 8000),
    );

    // --- Phase 1: Technical ---
    const techResponse = await fetch('/api/analysis/unified', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, phase: 'technical' }),
    });

    const techText = await techResponse.text();
    let techResult;
    try {
      techResult = JSON.parse(techText);
    } catch {
      throw new Error(`Technical phase failed: ${techResponse.statusText} - Invalid response`);
    }

    if (!techResponse.ok) {
      const errorDetail = techResult?.error?.message || techResult?.error || techResponse.statusText;
      throw new Error(`Technical phase failed (${techResponse.status}): ${errorDetail}`);
    }

    const technicalAnalysisId = techResult.data?.technicalAnalysisId;

    // Bump progress to 45%
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setSimulatedProgress(45);

    // Start simulated progress for GEO phase
    progressIntervalRef.current = setInterval(() => {
      setSimulatedProgress(prev => {
        if (prev >= 90) return prev;
        const speed = prev < 60 ? 2 + Math.random() * 5 : 0.5 + Math.random() * 2;
        return Math.min(prev + speed, 90);
      });
    }, 1200);

    // Simulated step timers for GEO phase
    timeoutIdsRef.current.push(
      setTimeout(() => setPipelineState(prev => ({ ...prev, progress: { ...prev.progress, geoAnalysis: 'completed' as const } })), 10000),
    );
    timeoutIdsRef.current.push(
      setTimeout(() => setPipelineState(prev => ({ ...prev, progress: { ...prev.progress, report: 'completed' as const } })), 15000),
    );

    // --- Phase 2: GEO ---
    const geoResponse = await fetch('/api/analysis/unified', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, phase: 'geo', technicalAnalysisId }),
    });

    const geoText = await geoResponse.text();
    let geoResult;
    try {
      geoResult = JSON.parse(geoText);
    } catch {
      throw new Error(`GEO phase failed: ${geoResponse.statusText} - Invalid response`);
    }

    clearAllTimers();

    // If GEO failed but Technical succeeded, still show partial success
    if (!geoResponse.ok || !geoResult.success) {
      if (techResult.success && technicalAnalysisId) {
        setSimulatedProgress(100);
        setPipelineState({
          state: 'completed',
          progress: {
            geoAnalysis: 'failed',
            trafficMetrics: 'completed',
            technicalStructure: 'completed',
            report: 'failed',
          },
          results: {
            technicalAnalysisId: techResult.data?.technicalAnalysisId,
          },
        });

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('mudra:website-analyzed', {
            detail: { brandProfileId: config.brandProfileId, results: techResult.data },
          }));
        }
        return techResult;
      }

      const errorMessage = geoResult?.error?.message || geoResult?.error || 'GEO phase failed';
      setSimulatedProgress(0);
      setPipelineState({
        state: 'error',
        progress: { geoAnalysis: 'failed', trafficMetrics: 'failed', technicalStructure: 'failed', report: 'failed' },
        error: errorMessage,
      });
      return geoResult;
    }

    // Both succeeded
    setSimulatedProgress(100);
    const mergedData = {
      ...techResult.data,
      ...geoResult.data,
      technicalAnalysisId: techResult.data?.technicalAnalysisId || geoResult.data?.technicalAnalysisId,
    };

    setPipelineState({
      state: 'completed',
      progress: {
        geoAnalysis: mergedData.geoAnalysisId ? 'completed' : 'failed',
        trafficMetrics: 'completed',
        technicalStructure: mergedData.technicalAnalysisId ? 'completed' : 'failed',
        report: mergedData.reportId ? 'completed' : 'failed',
      },
      results: {
        geoAnalysisId: mergedData.geoAnalysisId,
        technicalAnalysisId: mergedData.technicalAnalysisId,
        reportId: mergedData.reportId,
      },
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mudra:website-analyzed', {
        detail: { brandProfileId: config.brandProfileId, results: mergedData },
      }));
    }

    return geoResult;
  };

  // -------------------------------------------------------------------
  // Main entry point
  // -------------------------------------------------------------------
  const runPipeline = async (config: AnalysisPipelineConfig) => {
    console.log("[useAnalysisPipeline] runPipeline called with config:", config);
    clearAllTimers();

    setPipelineState({
      state: 'running',
      progress: { geoAnalysis: 'pending', trafficMetrics: 'pending', technicalStructure: 'pending', report: 'pending' },
    });
    setSimulatedProgress(0);
    setCurrentPhase(null);
    setPhaseDetail(null);
    setCurrentStepFromSSE(-1);

    const payload = {
      brandProfileId: config.brandProfileId,
      brandName: config.brandName,
      website: config.website,
      description: config.description,
      industry: config.industry,
      competitors: config.competitors || [],
      countries: config.countries,
      skipCooldown: true,
      generateReport: true,
    };

    try {
      // Try SSE first
      const sseOk = await runViaSSE(payload, config).catch(() => false);
      if (sseOk) return;

      // Fallback to regular fetch
      console.log("[useAnalysisPipeline] SSE failed, falling back to regular fetch");
      await runViaFetch(payload, config);
    } catch (error) {
      clearAllTimers();
      setSimulatedProgress(0);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setPipelineState({
        state: 'error',
        progress: { geoAnalysis: 'failed', trafficMetrics: 'failed', technicalStructure: 'failed', report: 'failed' },
        error: errorMessage,
      });
      throw error;
    }
  };

  const reset = () => {
    clearAllTimers();
    setSimulatedProgress(0);
    setCurrentPhase(null);
    setPhaseDetail(null);
    setCurrentStepFromSSE(-1);
    setPipelineState({
      state: 'idle',
      progress: { geoAnalysis: 'pending', trafficMetrics: 'pending', technicalStructure: 'pending', report: 'pending' },
    });
  };

  return {
    ...pipelineState,
    simulatedProgress,
    currentPhase,
    phaseDetail,
    currentStepFromSSE,
    runPipeline,
    reset,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPhaseDetail(event: ProgressEvent): string | null {
  const d = event.data;
  switch (event.phase) {
    case 'prompts':
      if (event.status === 'completed' && d?.count) return `${d.count} prompts ready`;
      return null;
    case 'geo':
      if (event.status === 'started') return 'Querying ChatGPT, Gemini, Perplexity, Claude...';
      if (event.status === 'completed' && d?.score != null) return `AI Visibility score: ${Math.round(d.score)}/100`;
      return null;
    case 'discovery':
      if (event.status === 'completed' && d?.pagesFound) return `Found ${d.pagesFound} pages`;
      return null;
    case 'scraping':
      if (event.status === 'progress' && d) return `Scanned ${d.scraped} of ${d.total} pages`;
      if (event.status === 'completed' && d) return `Scanned ${d.success} pages`;
      return null;
    case 'scoring':
      if (event.status === 'completed' && d?.siteScore != null) return `Site score: ${d.siteScore}/100`;
      return null;
    case 'report':
      if (event.status === 'started') return 'Generating report...';
      if (event.status === 'completed') return 'Report ready';
      return null;
    default:
      return null;
  }
}
