/**
 * Custom hook for fetching analysis results from the dashboard
 */

import { useState, useEffect } from 'react';

export interface AnalysisResults {
  geoAnalysis: any | null;
  trafficMetrics: any | null;
  technicalAnalysis: any | null;
  report: any | null;
}

export function useAnalysisResults(brandProfileId: number | null) {
  const [results, setResults] = useState<AnalysisResults>({
    geoAnalysis: null,
    trafficMetrics: null,
    technicalAnalysis: null,
    report: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!brandProfileId || brandProfileId === 0) {
      setLoading(false);
      return;
    }

    const fetchResults = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/analysis/results?brandProfileId=${brandProfileId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch analysis results: ${response.statusText}`);
        }

        const data = await response.json();
        setResults(data);
      } catch (err) {
        console.error('[useAnalysisResults] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [brandProfileId]);

  const refresh = async () => {
    if (!brandProfileId || brandProfileId === 0) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/analysis/results?brandProfileId=${brandProfileId}`);
      
      if (response.ok) {
        const data = await response.json();
        setResults(data);
      }
    } catch (err) {
      console.error('[useAnalysisResults] Refresh error:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    ...results,
    loading,
    error,
    refresh,
  };
}
