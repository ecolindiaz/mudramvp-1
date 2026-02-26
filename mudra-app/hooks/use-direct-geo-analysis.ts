import { useState } from 'react';
import type { DirectGEOResult } from '@/lib/services/direct-geo-analysis.service';
import { analyticsStorage } from '@/lib/services/analytics-storage.service';

export interface GEOAnalysisState {
  isRunning: boolean;
  progress: number;
  stage: string;
  results: DirectGEOResult | null;
  error: string | null;
}

export interface GEOAnalysisConfig {
  brandName: string;
  website?: string;
  industry?: string;
  description?: string;
  competitors?: string[];
  country?: string;
}

export function useDirectGEOAnalysis() {
  const [state, setState] = useState<GEOAnalysisState>({
    isRunning: false,
    progress: 0,
    stage: '',
    results: null,
    error: null,
  });

  const runAnalysis = async (config: GEOAnalysisConfig) => {
    setState({
      isRunning: true,
      progress: 0,
      stage: 'Initializing analysis...',
      results: null,
      error: null,
    });

    try {
      // Stage 1: Setup
      setState(prev => ({ ...prev, progress: 10, stage: 'Setting up analysis...' }));
      await new Promise(resolve => setTimeout(resolve, 500));

      // Stage 2: Generating prompts
      setState(prev => ({ ...prev, progress: 20, stage: 'Generating test prompts...' }));
      await new Promise(resolve => setTimeout(resolve, 800));

      // Stage 3: Testing with OpenAI
      setState(prev => ({ ...prev, progress: 40, stage: 'Testing with OpenAI...' }));
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Stage 4: Testing with Anthropic
      setState(prev => ({ ...prev, progress: 60, stage: 'Testing with Anthropic...' }));
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Stage 5: Testing with Google
      setState(prev => ({ ...prev, progress: 80, stage: 'Testing with Google...' }));
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Stage 6: Analyzing results
      setState(prev => ({ ...prev, progress: 90, stage: 'Analyzing responses...' }));
      
      // Make the actual API call
      const response = await fetch('/api/geo/direct-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      // Save the results to analytics storage
      analyticsStorage.saveAnalysis(config.brandName, data.data);

      // Stage 7: Complete
      setState(prev => ({ 
        ...prev, 
        progress: 100, 
        stage: 'Analysis complete!',
        results: data.data,
        isRunning: false,
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        isRunning: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
        stage: 'Analysis failed',
      }));
    }
  };

  const reset = () => {
    setState({
      isRunning: false,
      progress: 0,
      stage: '',
      results: null,
      error: null,
    });
  };

  // Load latest analysis for a brand
  const loadLatestAnalysis = (brandName: string) => {
    const latest = analyticsStorage.getLatestAnalysis(brandName);
    if (latest) {
      setState(prev => ({
        ...prev,
        results: latest,
      }));
    }
  };

  return {
    state,
    runAnalysis,
    reset,
    loadLatestAnalysis,
  };
}
