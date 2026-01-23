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
  workflowRunId: string | null;
  resumedPromptText: string | null;
  startGeneration: (trackedPrompt: string, sources: Source[], icp?: string) => Promise<string | null>;
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

const SIMULATED_STEP_DELAYS = [7000, 12000, 14000, 14000, 12000, 10000];

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 180; // 6 minutes max
const STORAGE_KEY = 'mudra_generating_content';

interface StoredGeneration {
  workflowRunId: string;
  promptText: string;
  startedAt: number;
}

// Helper to safely access localStorage
const getStoredGeneration = (): StoredGeneration | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as StoredGeneration;
    // Expire after 10 minutes
    if (Date.now() - parsed.startedAt > 10 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const setStoredGeneration = (data: StoredGeneration | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
};

export function useAIContentGeneration(): UseAIContentGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workflowRunId, setWorkflowRunId] = useState<string | null>(null);
  const [resumedPromptText, setResumedPromptText] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressCleanupRef = useRef<(() => void) | null>(null);
  const pollCountRef = useRef(0);
  const hasResumedRef = useRef(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }
    };
  }, []);

  // Resume polling on mount if there's a stored generation
  useEffect(() => {
    if (hasResumedRef.current) return;

    const stored = getStoredGeneration();
    if (!stored) return;

    hasResumedRef.current = true;

    // Resume the generation state
    setIsGenerating(true);
    setWorkflowRunId(stored.workflowRunId);
    setResumedPromptText(stored.promptText);
    setProgress(["Resuming generation..."]);
    setCurrentStep(3); // Show middle step since we don't know exact progress

    // Start polling for completion
    pollCountRef.current = 0;
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/content-lab/generate-optimized?workflowRunId=${stored.workflowRunId}`
        );
        const data = await response.json();

        if (data.status === "completed" && data.result) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setStoredGeneration(null);
          setCurrentStep(PROGRESS_STEPS.length - 1);
          setProgress(["Ready in editor"]);
          setResult(data.result);
          setIsGenerating(false);
        } else if (data.status === "failed" || data.status === "unknown") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setStoredGeneration(null);
          // If unknown, the workflow may have completed - don't show error, just reset
          if (data.status === "unknown") {
            setIsGenerating(false);
            setProgress([]);
          } else {
            setError(data.error || "Content generation failed");
            setIsGenerating(false);
          }
        } else {
          pollCountRef.current++;
          if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setStoredGeneration(null);
            setError("Content generation timed out. Please try again.");
            setIsGenerating(false);
          }
        }
      } catch (err) {
        console.error("Resume poll error:", err);
      }
    }, POLL_INTERVAL_MS);
  }, []);

  const reset = useCallback(() => {
    setIsGenerating(false);
    setProgress([]);
    setCurrentStep(0);
    setResult(null);
    setError(null);
    setWorkflowRunId(null);
    setResumedPromptText(null);
    pollCountRef.current = 0;
    setStoredGeneration(null); // Clear localStorage
    if (progressCleanupRef.current) {
      progressCleanupRef.current();
      progressCleanupRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (progressTimeoutRef.current) {
      clearTimeout(progressTimeoutRef.current);
      progressTimeoutRef.current = null;
    }
  }, []);

  const simulateProgress = useCallback(() => {
    let stepIndex = 0;

    const scheduleNext = () => {
      if (stepIndex >= PROGRESS_STEPS.length - 2) {
        return;
      }

      const delay =
        SIMULATED_STEP_DELAYS[
          Math.min(stepIndex, SIMULATED_STEP_DELAYS.length - 1)
        ] ?? 10000;

      progressTimeoutRef.current = setTimeout(() => {
        stepIndex += 1;
        setCurrentStep(stepIndex);
        setProgress((prev) => [...prev, PROGRESS_STEPS[stepIndex]]);
        scheduleNext();
      }, delay);
    };

    scheduleNext();

    return () => {
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
        progressTimeoutRef.current = null;
      }
    };
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
          if (progressCleanupRef.current) {
            progressCleanupRef.current();
            progressCleanupRef.current = null;
          }

          setStoredGeneration(null); // Clear localStorage on success
          setCurrentStep(PROGRESS_STEPS.length - 1);
          setProgress((prev) => [
            ...prev,
            "Ready in editor",
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
          if (progressCleanupRef.current) {
            progressCleanupRef.current();
            progressCleanupRef.current = null;
          }

          setStoredGeneration(null); // Clear localStorage on failure
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
          if (progressCleanupRef.current) {
            progressCleanupRef.current();
            progressCleanupRef.current = null;
          }
          setStoredGeneration(null); // Clear localStorage on timeout
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
    async (trackedPrompt: string, sources: Source[], icp?: string): Promise<string | null> => {
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
            icp,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          setError(data.error || "Failed to start content generation");
          setIsGenerating(false);
          return null;
        }

        const workflowRunId = data.workflowRunId;
        setWorkflowRunId(workflowRunId);

        // Save to localStorage for resume on refresh
        setStoredGeneration({
          workflowRunId,
          promptText: trackedPrompt,
          startedAt: Date.now(),
        });

        // Start progress simulation
        const stopSimulatedProgress = simulateProgress();
        progressCleanupRef.current = stopSimulatedProgress;

        // Start polling for completion
        pollCountRef.current = 0;
        pollIntervalRef.current = setInterval(async () => {
          const isDone = await pollForStatus(workflowRunId);
          if (isDone) {
            if (progressCleanupRef.current) {
              progressCleanupRef.current();
              progressCleanupRef.current = null;
            }
          }
        }, POLL_INTERVAL_MS);

        return workflowRunId;
      } catch (err: any) {
        if (progressCleanupRef.current) {
          progressCleanupRef.current();
          progressCleanupRef.current = null;
        }
        setError(err.message || "Failed to start content generation");
        setIsGenerating(false);
        return null;
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
    workflowRunId,
    resumedPromptText,
    startGeneration,
    reset,
  };
}

