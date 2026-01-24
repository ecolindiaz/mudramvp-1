import { useState, useCallback, useRef, useEffect } from "react";

interface Source {
  url: string;
  title?: string;
  domain?: string;
}

interface SourceReference {
  title: string;
  url: string;
  type: "primary" | "research";
}

interface GenerationResult {
  campaignId: string;
  content: string;
  metadata: {
    title: string;
    wordCount: number;
    sections: string[];
    author: {
      name: string;
      title: string;
    };
    sourcesScraped: number;
    researchQueriesRun: number;
    sources: SourceReference[];
  };
}

interface UseAIContentGenerationReturn {
  isGenerating: boolean;
  progress: string[];
  currentStep: number;
  result: GenerationResult | null;
  error: string | null;
  startGeneration: (trackedPrompt: string, sources: Source[]) => Promise<void>;
  reset: () => void;
}

const PROGRESS_STEPS = [
  "Starting AI content workflow...",
  "Validating sources",
  "Finding citations",
  "Analyzing content gaps",
  "Running live web research",
  "Generating draft",
  "Finalizing article",
  "Ready in editor",
];

// Simulated delays for progress steps (in ms)
const SIMULATED_STEP_DELAYS = [2000, 4000, 6000, 8000, 10000, 12000, 14000];

export function useAIContentGeneration(): UseAIContentGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const progressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressCleanupRef = useRef<(() => void) | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const reset = useCallback(() => {
    setIsGenerating(false);
    setProgress([]);
    setCurrentStep(0);
    setResult(null);
    setError(null);
    if (progressCleanupRef.current) {
      progressCleanupRef.current();
      progressCleanupRef.current = null;
    }
    if (progressTimeoutRef.current) {
      clearTimeout(progressTimeoutRef.current);
      progressTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Simulate progress steps while waiting for API
  const simulateProgress = useCallback(() => {
    let stepIndex = 0;
    let cancelled = false;

    const scheduleNext = () => {
      if (cancelled || stepIndex >= PROGRESS_STEPS.length - 1) {
        return;
      }

      const delay = SIMULATED_STEP_DELAYS[stepIndex] ?? 3000;

      progressTimeoutRef.current = setTimeout(() => {
        if (cancelled) return;
        stepIndex += 1;
        setCurrentStep(stepIndex);
        setProgress((prev) => [...prev, PROGRESS_STEPS[stepIndex]]);
        scheduleNext();
      }, delay);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
        progressTimeoutRef.current = null;
      }
    };
  }, []);

  const startGeneration = useCallback(
    async (trackedPrompt: string, sources: Source[]) => {
      reset();
      setIsGenerating(true);
      setProgress([PROGRESS_STEPS[0]]);
      setCurrentStep(0);

      // Start progress simulation
      const stopSimulatedProgress = simulateProgress();
      progressCleanupRef.current = stopSimulatedProgress;

      // Create abort controller for the request
      abortControllerRef.current = new AbortController();

      try {
        // Make the API call (synchronous - waits for result)
        const response = await fetch("/api/content-lab/generate-optimized", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackedPrompt,
            sources: sources.map((s) => ({
              url: s.url || `https://${s.domain}`,
              title: s.title || s.domain,
            })),
          }),
          signal: abortControllerRef.current.signal,
        });

        const data = await response.json();

        // Stop progress simulation
        if (progressCleanupRef.current) {
          progressCleanupRef.current();
          progressCleanupRef.current = null;
        }

        if (!data.success) {
          setError(data.error || "Failed to generate content");
          setIsGenerating(false);
          return;
        }

        // Success! Set final step and result
        setCurrentStep(PROGRESS_STEPS.length - 1);
        setProgress([...PROGRESS_STEPS]);
        setResult(data.result);
        setIsGenerating(false);
      } catch (err: any) {
        // Stop progress simulation
        if (progressCleanupRef.current) {
          progressCleanupRef.current();
          progressCleanupRef.current = null;
        }

        if (err.name === "AbortError") {
          // Request was cancelled, don't set error
          return;
        }

        setError(err.message || "Failed to generate content");
        setIsGenerating(false);
      }
    },
    [reset, simulateProgress]
  );

  return {
    isGenerating,
    progress,
    currentStep,
    result,
    error,
    startGeneration,
    reset,
  };
}
