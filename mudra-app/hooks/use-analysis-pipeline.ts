/**
 * Custom hook for triggering and monitoring the analysis pipeline
 */

import { useState } from 'react';

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
}

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

  const runPipeline = async (config: AnalysisPipelineConfig) => {
    console.log("🔴 [useAnalysisPipeline] runPipeline called with config:", config)
    
    setPipelineState({
      state: 'running',
      progress: {
        geoAnalysis: 'pending',
        trafficMetrics: 'pending',
        technicalStructure: 'pending',
        report: 'pending',
      },
    });
    
    console.log("🔴 [useAnalysisPipeline] State set to 'running', calling API...")

    try {
      const response = await fetch('/api/analysis/pipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      console.log("🔴 [useAnalysisPipeline] API response status:", response.status)

      if (!response.ok) {
        throw new Error(`Pipeline failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("🔴 [useAnalysisPipeline] API result:", result)

      if (result.success) {
        console.log("🔴 [useAnalysisPipeline] Pipeline completed successfully!")
        setPipelineState({
          state: 'completed',
          progress: result.progress,
          results: {
            geoAnalysisId: result.geoAnalysisId,
            trafficMetricsId: result.trafficMetricsId,
            technicalAnalysisId: result.technicalAnalysisId,
            reportId: result.reportId,
          },
        });

        // Dispatch event to trigger dashboard refresh
        console.log("🔴 [useAnalysisPipeline] Dispatching mudra:website-analyzed event")
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('mudra:website-analyzed', {
            detail: {
              brandProfileId: config.brandProfileId,
              results: result,
            }
          }));
        }
      } else {
        console.error("🔴 [useAnalysisPipeline] Pipeline failed:", result.error)
        setPipelineState({
          state: 'error',
          progress: result.progress,
          error: result.error || 'Pipeline failed',
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      setPipelineState({
        state: 'error',
        progress: {
          geoAnalysis: 'failed',
          trafficMetrics: 'failed',
          technicalStructure: 'failed',
          report: 'failed',
        },
        error: errorMessage,
      });

      throw error;
    }
  };

  const reset = () => {
    setPipelineState({
      state: 'idle',
      progress: {
        geoAnalysis: 'pending',
        trafficMetrics: 'pending',
        technicalStructure: 'pending',
        report: 'pending',
      },
    });
  };

  return {
    ...pipelineState,
    runPipeline,
    reset,
  };
}
