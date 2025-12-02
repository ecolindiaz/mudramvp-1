import { useState, useCallback, useRef, useEffect } from "react";

interface Source {
  url: string;
  title?: string;
  domain?: string;
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
  "Scraping citation sources (Firecrawl v2)",
  "Analyzing content gaps (GPT-5.1)",
  "Conducting live web research",
  "Generating AI-optimized content",
  "Finalizing article",
  "Complete!",
];

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 180; // 6 minutes max

export function useAIContentGeneration(): UseAIContentGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const reset = useCallback(() => {
    setIsGenerating(false);
    setProgress([]);
    setCurrentStep(0);
    setResult(null);
    setError(null);
    pollCountRef.current = 0;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const simulateProgress = useCallback(() => {
    // Simulate progress through steps while waiting for actual completion
    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < PROGRESS_STEPS.length - 2) {
        // Stop before "Complete!"
        stepIndex++;
        setCurrentStep(stepIndex);
        setProgress((prev) => [...prev, PROGRESS_STEPS[stepIndex]]);
      } else {
        clearInterval(interval);
      }
    }, 8000); // Progress every 8 seconds

    return interval;
  }, []);

  const pollForStatus = useCallback(
    async (workflowRunId: string) => {
      try {
        const response = await fetch(
          `/api/content-lab/generate-optimized?workflowRunId=${workflowRunId}`
        );
        const data = await response.json();

        if (data.status === "completed" && data.result) {
          // Success!
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          setCurrentStep(PROGRESS_STEPS.length - 1);
          setProgress((prev) => [
            ...prev,
            "Complete!",
          ]);
          setResult(data.result);
          setIsGenerating(false);
          return true;
        } else if (data.status === "failed") {
          // Failure
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          setError(data.error || "Content generation failed");
          setIsGenerating(false);
          return true;
        }

        // Still processing
        pollCountRef.current++;
        if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setError("Content generation timed out. Please try again.");
          setIsGenerating(false);
          return true;
        }

        return false;
      } catch (err) {
        console.error("Poll error:", err);
        return false;
      }
    },
    []
  );

  const startGeneration = useCallback(
    async (trackedPrompt: string, sources: Source[]) => {
      reset();
      setIsGenerating(true);
      setProgress([PROGRESS_STEPS[0]]);
      setCurrentStep(0);

      try {
        // Start the workflow
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
        });

        const data = await response.json();

        if (!data.success) {
          setError(data.error || "Failed to start content generation");
          setIsGenerating(false);
          return;
        }

        const workflowRunId = data.workflowRunId;

        // Start progress simulation
        const progressInterval = simulateProgress();

        // Start polling for completion
        pollCountRef.current = 0;
        pollIntervalRef.current = setInterval(async () => {
          const isDone = await pollForStatus(workflowRunId);
          if (isDone) {
            clearInterval(progressInterval);
          }
        }, POLL_INTERVAL_MS);
      } catch (err: any) {
        setError(err.message || "Failed to start content generation");
        setIsGenerating(false);
      }
    },
    [reset, simulateProgress, pollForStatus]
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

