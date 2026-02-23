/**
 * Custom hook for triggering and monitoring the analysis pipeline.
 *
 * Tries SSE streaming first (/api/analysis/unified/stream) for real-time
 * progress. Falls back to the regular POST endpoint with simulated progress
 * if SSE fails.
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
// Weighted progress mapping (parallel-aware)
// ---------------------------------------------------------------------------
// GEO track  = 35%:  prompts(5%) + geo(30%)
// Tech track = 35%:  discovery(5%) + scraping(15%) + scoring(15%)
// Sequential = 30%:  report(15%) + issues(10%) + final(5%)

interface PhaseWeight { start: number; end: number; track: 'geo' | 'tech' | 'seq' }

const PHASE_WEIGHTS: Record<string, PhaseWeight> = {
  prompts:   { start: 0,  end: 5,  track: 'geo' },
  geo:       { start: 5,  end: 35, track: 'geo' },
  discovery: { start: 0,  end: 5,  track: 'tech' },
  scraping:  { start: 5,  end: 20, track: 'tech' },
  scoring:   { start: 20, end: 35, track: 'tech' },
  report:    { start: 70, end: 85, track: 'seq' },
  issues:    { start: 85, end: 95, track: 'seq' },
  complete:  { start: 95, end: 100, track: 'seq' },
};

function computeProgress(completedPhases: Set<string>, activePhase?: { phase: string; fraction?: number }): number {
  let geoTrack = 0;
  let techTrack = 0;
  let seqProgress = 0;

  for (const phase of completedPhases) {
    const w = PHASE_WEIGHTS[phase];
    if (!w) continue;
    if (w.track === 'geo') geoTrack = Math.max(geoTrack, w.end);
    else if (w.track === 'tech') techTrack = Math.max(techTrack, w.end);
    else seqProgress = Math.max(seqProgress, w.end);
  }

  // Active (in-progress) phase gets partial credit
  if (activePhase) {
    const w = PHASE_WEIGHTS[activePhase.phase];
    if (w) {
      const partial = w.start + (w.end - w.start) * (activePhase.fraction ?? 0.5);
      if (w.track === 'geo') geoTrack = Math.max(geoTrack, partial);
      else if (w.track === 'tech') techTrack = Math.max(techTrack, partial);
      else seqProgress = Math.max(seqProgress, partial);
    }
  }

  return Math.min(Math.round(geoTrack + techTrack + seqProgress), 100);
}

// Map SSE phase to one of the 6 ordered UI steps
const PHASE_TO_STEP_INDEX: Record<string, number> = {
  prompts: 0,
  geo: 1,
  discovery: 2,
  scraping: 3,
  scoring: 4,
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
  // SSE streaming run
  // -------------------------------------------------------------------
  const runViaSSE = async (
    payload: Record<string, any>,
    config: AnalysisPipelineConfig,
  ): Promise<boolean> => {
    const response = await fetch('/api/analysis/unified/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) return false;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const completedPhases = new Set<string>();
    let finalResult: any = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep incomplete line in buffer

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

          // Update step index from SSE event
          const stepIdx = PHASE_TO_STEP_INDEX[event.phase];
          if (stepIdx !== undefined) {
            setCurrentStepFromSSE(prev => Math.max(prev, stepIdx));
          }

          // Build detail text from event data
          const detail = buildPhaseDetail(event);
          if (detail) setPhaseDetail(detail);

          // Track completed phases for progress calc
          if (event.status === 'completed') {
            completedPhases.add(event.phase);
          }

          // Compute fractional progress for in-progress events
          let fraction: number | undefined;
          if (event.phase === 'scraping' && event.status === 'progress' && event.data) {
            fraction = event.data.total > 0 ? event.data.scraped / event.data.total : 0;
          }

          const progress = computeProgress(
            completedPhases,
            event.status !== 'completed' ? { phase: event.phase, fraction } : undefined,
          );
          setSimulatedProgress(Math.min(progress, 95));

          // Capture final result from the complete event
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

    if (!finalResult) return false;

    // Success
    clearAllTimers();
    setSimulatedProgress(100);
    setCurrentStepFromSSE(5);
    setPipelineState({
      state: 'completed',
      progress: {
        geoAnalysis: finalResult.geoAnalysisId ? 'completed' : 'failed',
        trafficMetrics: 'completed',
        technicalStructure: finalResult.technicalAnalysisId ? 'completed' : 'failed',
        report: finalResult.reportId ? 'completed' : 'failed',
      },
      results: {
        geoAnalysisId: finalResult.geoAnalysisId,
        technicalAnalysisId: finalResult.technicalAnalysisId,
        reportId: finalResult.reportId,
      },
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mudra:website-analyzed', {
        detail: { brandProfileId: config.brandProfileId, results: finalResult },
      }));
    }

    return true;
  };

  // -------------------------------------------------------------------
  // Fallback: regular POST with simulated progress (original behaviour)
  // -------------------------------------------------------------------
  const runViaFetch = async (
    payload: Record<string, any>,
    config: AnalysisPipelineConfig,
  ) => {
    // Start simulated progress
    setSimulatedProgress(3 + Math.random() * 5);
    progressIntervalRef.current = setInterval(() => {
      setSimulatedProgress(prev => {
        if (prev >= 90) return prev;
        const speed = prev < 15 ? 4 + Math.random() * 8 : prev < 50 ? 2 + Math.random() * 5 : 0.5 + Math.random() * 2;
        return Math.min(prev + speed, 90);
      });
    }, 1200);

    // Simulated step timers
    timeoutIdsRef.current.push(
      setTimeout(() => setPipelineState(prev => ({ ...prev, progress: { ...prev.progress, geoAnalysis: 'completed' as const } })), 5000),
    );
    timeoutIdsRef.current.push(
      setTimeout(() => setPipelineState(prev => ({ ...prev, progress: { ...prev.progress, technicalStructure: 'completed' as const } })), 10000),
    );
    timeoutIdsRef.current.push(
      setTimeout(() => setPipelineState(prev => ({ ...prev, progress: { ...prev.progress, report: 'completed' as const } })), 15000),
    );

    const response = await fetch('/api/analysis/unified', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(`Pipeline failed: ${response.statusText} - Invalid response`);
    }

    if (!response.ok) {
      const errorDetail = result?.error?.message || result?.error || result?.message || response.statusText;
      throw new Error(`Pipeline failed (${response.status}): ${errorDetail}`);
    }

    clearAllTimers();

    if (result.success) {
      setSimulatedProgress(100);
      setPipelineState({
        state: 'completed',
        progress: {
          geoAnalysis: result.data?.geoAnalysisId ? 'completed' : 'failed',
          trafficMetrics: 'completed',
          technicalStructure: result.data?.technicalAnalysisId ? 'completed' : 'failed',
          report: result.data?.reportId ? 'completed' : 'failed',
        },
        results: {
          geoAnalysisId: result.data?.geoAnalysisId,
          technicalAnalysisId: result.data?.technicalAnalysisId,
          reportId: result.data?.reportId,
        },
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mudra:website-analyzed', {
          detail: { brandProfileId: config.brandProfileId, results: result.data },
        }));
      }
    } else {
      const errorMessage = typeof result.error === 'object' && result.error?.message
        ? result.error.message
        : result.error || 'Analysis failed';
      clearAllTimers();
      setSimulatedProgress(0);
      setPipelineState({
        state: 'error',
        progress: { geoAnalysis: 'failed', trafficMetrics: 'failed', technicalStructure: 'failed', report: 'failed' },
        error: errorMessage,
      });
    }

    return result;
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
