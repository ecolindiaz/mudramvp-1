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
  const [simulatedProgress, setSimulatedProgress] = useState(0);

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
    setSimulatedProgress(0);
    
    console.log("🔴 [useAnalysisPipeline] State set to 'running', calling API...")
    
    // Simulate progress updates while analysis runs
    const progressInterval = setInterval(() => {
      setSimulatedProgress(prev => {
        if (prev >= 90) return prev; // Cap at 90% until completion
        return prev + Math.random() * 10;
      });
    }, 1500);
    
    // Update stage indicators progressively
    setTimeout(() => {
      setPipelineState(prev => ({
        ...prev,
        progress: { ...prev.progress, geoAnalysis: 'completed' as const }
      }));
    }, 5000);
    
    setTimeout(() => {
      setPipelineState(prev => ({
        ...prev,
        progress: { ...prev.progress, trafficMetrics: 'completed' as const }
      }));
    }, 10000);
    
    setTimeout(() => {
      setPipelineState(prev => ({
        ...prev,
        progress: { ...prev.progress, technicalStructure: 'completed' as const }
      }));
    }, 15000)

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

      clearInterval(progressInterval);
      
      const result = await response.json();
      console.log("🔴 [useAnalysisPipeline] API result:", result)

      if (result.success) {
        console.log("🔴 [useAnalysisPipeline] Pipeline completed successfully!")
        setSimulatedProgress(100);
        setPipelineState({
          state: 'completed',
          progress: {
            geoAnalysis: 'completed',
            trafficMetrics: 'completed',
            technicalStructure: 'completed',
            report: 'completed',
          },
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
        clearInterval(progressInterval);
        setSimulatedProgress(0);
        setPipelineState({
          state: 'error',
          progress: result.progress,
          error: result.error || 'Pipeline failed',
        });
      }

      return result;
    } catch (error) {
      clearInterval(progressInterval);
      setSimulatedProgress(0);
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
    setSimulatedProgress(0);
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
    simulatedProgress,
    runPipeline,
    reset,
  };
}
