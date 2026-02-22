"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  FileText,
  Brain,
  Search,
  Tag,
  Target,
  Plus,
  Compass,
  Layers,
  Shield,
  MessagesSquare,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAIContentGeneration } from "@/hooks/use-ai-content-generation";
import { useRouter } from "next/navigation";
import { UnicodeLoader } from "@/components/ui/unicode-loader";

interface TrackedPrompt {
  id: string;
  text: string;
  category: string;
}

interface CitationSource {
  domain: string;
  url?: string;
  title?: string;
  provider?: string;
}

const MAX_SELECTED_SOURCES = 5;

// Model logo mapping
const MODEL_LOGOS: Record<string, { src: string; alt: string }> = {
  openai: { src: '/openai_dark.svg', alt: 'OpenAI' },
  chatgpt: { src: '/openai_dark.svg', alt: 'ChatGPT' },
  claude: { src: '/claude-ai-icon.svg', alt: 'Claude' },
  anthropic: { src: '/claude-ai-icon.svg', alt: 'Anthropic' },
  perplexity: { src: '/perplexity (2).svg', alt: 'Perplexity' },
  gemini: { src: '/gemini (3).svg', alt: 'Gemini' },
  google: { src: '/google-logo.svg', alt: 'Google' },
};

const getModelLogo = (provider: string | undefined) => {
  if (!provider) return null;
  const key = provider.toLowerCase();
  return MODEL_LOGOS[key] || null;
};

export interface GeneratingContent {
  workflowRunId: string;
  title: string;
  promptText: string;
  status: 'generating' | 'completed' | 'failed';
  currentStep: number;
  error?: string;
}

interface AIOptimizedGeneratorProps {
  trackedPrompts: TrackedPrompt[];
  brandProfileId?: number;
  onComplete?: (campaignId: string) => void;
  onGenerationStart?: (content: GeneratingContent) => void;
  onGenerationUpdate?: (content: GeneratingContent) => void;
  activeGeneration?: GeneratingContent | null;
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const WORKFLOW_STEPS = [
  { id: "ingest", label: "Validating sources", icon: FileText },
  { id: "scrape", label: "Finding citations", icon: Globe },
  { id: "analyze", label: "Analyzing content gaps", icon: Brain },
  { id: "research", label: "Live web research", icon: Search },
  { id: "generate", label: "Generating draft", icon: Sparkles },
  { id: "finalize", label: "Finalizing article", icon: FileText },
  { id: "complete", label: "Ready in editor", icon: CheckCircle2 },
];

// Content types
type ContentType = "blog" | "listicle" | "guide" | "howto" | "comparison";

const CONTENT_TYPES: Array<{
  value: ContentType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: "blog",
    label: "Blog Post",
    description: "Long-form content optimized for AI visibility",
    icon: FileText,
  },
  {
    value: "listicle",
    label: "Listicle",
    description: "List-based content format (X Steps to...)",
    icon: Layers,
  },
  {
    value: "guide",
    label: "Comprehensive Guide",
    description: "In-depth comprehensive guides",
    icon: Compass,
  },
  {
    value: "howto",
    label: "How To",
    description: "Step-by-step instructional content",
    icon: Shield,
  },
  {
    value: "comparison",
    label: "Comparison",
    description: "Compare products, tools, or approaches",
    icon: MessagesSquare,
  },
];

// ICP suggestion with icon mapping
interface ICPSuggestion {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Map icons to ICP labels dynamically
const getIconForICP = (index: number): React.ComponentType<{ className?: string }> => {
  const icons = [Users, Target, Brain, Shield, Compass, Layers];
  return icons[index % icons.length];
};

// Truncate long ICP labels for display
const truncateICP = (label: string, maxLength: number = 45): string => {
  if (label.length <= maxLength) return label;
  return label.substring(0, maxLength).trim() + '...';
};

const TOTAL_STEPS = 5;

const STEP_COPY: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Choose a content type for your AI-optimized campaign.",
  2: "Choose a tracked prompt to optimize with GEO-aligned onboarding.",
  3: "Select your target audience for this content.",
  4: "Review the prompt context and pick which citations power the generation.",
  5: "Track the optimized pipeline while we scrape, research, and generate.",
};

const normalizeCategory = (category?: string) =>
  category?.trim().toLowerCase().replace(/\s+/g, "-") || "general";

const SUGGESTED_CATEGORY_KEY = normalizeCategory("Organic");

export function AIOptimizedGenerator({
  trackedPrompts,
  brandProfileId,
  onComplete,
  onGenerationStart,
  onGenerationUpdate,
  activeGeneration,
  externalOpen,
  onOpenChange,
}: AIOptimizedGeneratorProps) {
  const router = useRouter();
  const [internalDialogOpen, setInternalDialogOpen] = useState(false);

  // Use external control if provided, otherwise use internal state
  const dialogOpen = externalOpen !== undefined ? externalOpen : internalDialogOpen;
  const setDialogOpen = onOpenChange || setInternalDialogOpen;
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1); // 1=Content Type, 2=Select prompt, 3=ICP, 4=Select sources, 5=Generating
  const [selectedContentType, setSelectedContentType] =
    useState<ContentType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<TrackedPrompt | null>(
    null
  );
  const [selectedIcp, setSelectedIcp] = useState<string | null>(null);
  const [availableSources, setAvailableSources] = useState<CitationSource[]>(
    []
  );
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set()
  );
  const [isLoadingCitations, setIsLoadingCitations] = useState(false);

  // ICP suggestions from brand profile
  const [icpSuggestions, setIcpSuggestions] = useState<ICPSuggestion[]>([]);
  const [isLoadingICPs, setIsLoadingICPs] = useState(false);

  // Refs to avoid infinite loops in update callback
  const onGenerationUpdateRef = useRef(onGenerationUpdate);
  const prevStepRef = useRef<number>(-1);

  // Keep callback ref updated
  useEffect(() => {
    onGenerationUpdateRef.current = onGenerationUpdate;
  }, [onGenerationUpdate]);

  // Fetch ICPs from brand profile
  useEffect(() => {
    if (!brandProfileId) return;

    const fetchICPs = async () => {
      setIsLoadingICPs(true);
      try {
        const res = await fetch(`/api/brand-profile`);
        const data = await res.json();

        if (data && data.companyICP) {
          // Parse ICPs - could be comma-separated string or JSON array
          let icps: string[] = [];
          try {
            icps = typeof data.companyICP === 'string'
              ? data.companyICP.includes('[')
                ? JSON.parse(data.companyICP)
                : data.companyICP.split(',').map((s: string) => s.trim()).filter(Boolean)
              : Array.isArray(data.companyICP)
                ? data.companyICP
                : [];
          } catch {
            icps = data.companyICP.split(',').map((s: string) => s.trim()).filter(Boolean);
          }

          // Map to ICP suggestions with icons
          const suggestions = icps.map((label, index) => ({
            label,
            icon: getIconForICP(index),
          }));
          setIcpSuggestions(suggestions);
        }
      } catch (error) {
        console.error('Failed to fetch ICPs:', error);
      } finally {
        setIsLoadingICPs(false);
      }
    };

    fetchICPs();
  }, [brandProfileId]);

  const {
    isGenerating,
    currentStep,
    result,
    error,
    startGeneration,
    reset,
    workflowRunId,
    resumedPromptText,
  } = useAIContentGeneration();

  const promptCategories = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; count: number }
    >();

    trackedPrompts.forEach((prompt) => {
      const label = prompt.category?.trim() || "General";
      const key = normalizeCategory(prompt.category);
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { key, label, count: 1 });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.key === SUGGESTED_CATEGORY_KEY) return -1;
      if (b.key === SUGGESTED_CATEGORY_KEY) return 1;
      return a.label.localeCompare(b.label);
    });
  }, [trackedPrompts]);

  const promptsForSelectedCategory = useMemo(() => {
    if (!selectedCategory) return [];

    return trackedPrompts.filter(
      (prompt) => normalizeCategory(prompt.category) === selectedCategory
    );
  }, [trackedPrompts, selectedCategory]);

  const selectedCategoryLabel = selectedCategory
    ? promptCategories.find((category) => category.key === selectedCategory)
        ?.label ?? "General"
    : null;

const categoryIcons = [Compass, Layers, Shield, MessagesSquare, Brain];

  // Load citations when prompt is selected
  useEffect(() => {
    if (!selectedPrompt || !brandProfileId) return;

    const fetchCitations = async () => {
      setIsLoadingCitations(true);
      try {
        const res = await fetch(
          `/api/prompts/citations?brandProfileId=${brandProfileId}&promptText=${encodeURIComponent(selectedPrompt.text)}`
        );
        const data = await res.json();

        if (data.success && data.citations) {
          const citations: CitationSource[] = data.citations.map((c: any) => ({
            domain: c.domain,
            url: c.url,
            title: c.title,
            provider: c.provider,
          }));
          setAvailableSources(citations);
          // Auto-select first 5 sources by default (or all if less than 5)
          const initialSelection = citations.slice(0, MAX_SELECTED_SOURCES).map((c) => c.domain);
          setSelectedSources(new Set(initialSelection));
        } else {
          setAvailableSources([]);
          setSelectedSources(new Set());
        }
      } catch (error) {
        console.error('Failed to fetch citations:', error);
        setAvailableSources([]);
        setSelectedSources(new Set());
      } finally {
        setIsLoadingCitations(false);
      }
    };

    fetchCitations();
  }, [selectedPrompt, brandProfileId]);

  // Handle completion
  useEffect(() => {
    if (result?.campaignId) {
      // Navigate to the campaign after a short delay
      setTimeout(() => {
        router.push(
          `/dashboard/campaigns/${result.campaignId}?type=blog&mode=geo`
        );
        if (onComplete) {
          onComplete(result.campaignId);
        }
      }, 1500);
    }
  }, [result, router, onComplete]);

  // Notify parent when resuming from localStorage
  useEffect(() => {
    if (resumedPromptText && isGenerating && onGenerationUpdateRef.current) {
      onGenerationUpdateRef.current({
        workflowRunId: workflowRunId || '',
        title: `Generating: ${resumedPromptText.substring(0, 50)}...`,
        promptText: resumedPromptText,
        status: 'generating',
        currentStep,
      });
    }
  }, [resumedPromptText, isGenerating, workflowRunId, currentStep]);

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (open) {
      // If there's an active generation (including resumed), show progress view
      if (isGenerating) {
        setStep(5);
        return;
      }
      // Otherwise reset state when opening
      setStep(1);
      setSelectedContentType(null);
      setSelectedCategory(null);
      setSelectedPrompt(null);
      setSelectedIcp(null);
      setAvailableSources([]);
      setSelectedSources(new Set());
      reset();
    }
  };

  const handlePromptSelect = (prompt: TrackedPrompt) => {
    setSelectedPrompt(prompt);
    setStep(3);
  };

  const toggleSource = (domain: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else if (next.size < MAX_SELECTED_SOURCES) {
        // Only add if under the limit
        next.add(domain);
      }
      return next;
    });
  };

  const handleStartGeneration = async () => {
    if (!selectedPrompt || selectedSources.size < 2) return;

    setStep(5);

    const sources = availableSources
      .filter((s) => selectedSources.has(s.domain))
      .map((source) => ({
        ...source,
        url: source.url ?? `https://${source.domain}`,
      }));

    const runId = await startGeneration(selectedPrompt.text, sources, selectedIcp || undefined);

    // Notify parent about generation start
    if (runId && onGenerationStart) {
      onGenerationStart({
        workflowRunId: runId,
        title: `Generating: ${selectedPrompt.text.substring(0, 50)}...`,
        promptText: selectedPrompt.text,
        status: 'generating',
        currentStep: 0,
      });
    }
  };

  // Update parent when generation progress changes (only when step changes to avoid infinite loop)
  useEffect(() => {
    const shouldUpdate = isGenerating && selectedPrompt && currentStep !== prevStepRef.current;

    if (shouldUpdate && onGenerationUpdateRef.current) {
      prevStepRef.current = currentStep;
      onGenerationUpdateRef.current({
        workflowRunId: workflowRunId || '',
        title: result?.metadata?.title || `Generating: ${selectedPrompt.text.substring(0, 50)}...`,
        promptText: selectedPrompt.text,
        status: error ? 'failed' : result ? 'completed' : 'generating',
        currentStep,
        error: error || undefined,
      });
    }

    // Reset prevStepRef when generation stops
    if (!isGenerating) {
      prevStepRef.current = -1;
    }
  }, [currentStep, isGenerating, error, result, selectedPrompt, workflowRunId]);

  const getStepStatus = (stepIndex: number) => {
    if (error) return "error";

    const normalizedStep = Math.min(
      Math.max(currentStep - 1, 0),
      WORKFLOW_STEPS.length - 1
    );
    const isLastStep = stepIndex === WORKFLOW_STEPS.length - 1;

    if (!isGenerating && result && isLastStep) {
      return "complete";
    }

    if (normalizedStep > stepIndex) return "complete";
    if (normalizedStep === stepIndex && isGenerating) return "active";
    return "pending";
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="group h-9 rounded-lg bg-white text-[#0a0a0a] hover:bg-white/90 shadow-sm hover:shadow-md border-0 gap-2"
        >
          <Plus className="size-4 transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:rotate-6" />
          AI-Optimized Content
        </Button>
      </DialogTrigger>
      <DialogContent className="!max-w-2xl sm:!max-w-2xl bg-[#161616] border-0 p-0 !rounded-[12px] overflow-hidden shadow-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Generate AI-Optimized Content</DialogTitle>
        </DialogHeader>

        <div className="bg-[#161616] px-6 pt-6 pb-6">
          {/* Title and Description */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white tracking-tight mb-1">
              AI-Optimized Content
            </h2>
            <p className="text-sm text-white/60 leading-relaxed">
              {STEP_COPY[step]}
            </p>

            {/* Horizontal step indicator */}
            {!isGenerating && (
              <div className="mt-5 flex items-center gap-0">
                {(["Content", "Prompt", "Audience", "Sources", "Generate"] as const).map((label, idx) => {
                  const stepNum = (idx + 1) as 1 | 2 | 3 | 4 | 5;
                  const isActive = step === stepNum;
                  const isCompleted = step > stepNum;
                  return (
                    <div key={label} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center gap-1.5">
                        <div
                          className={cn(
                            "flex items-center justify-center size-7 rounded-full text-xs font-semibold transition-all duration-300",
                            isCompleted
                              ? "bg-white text-[#0a0a0a]"
                              : isActive
                                ? "bg-white/15 text-white ring-1 ring-white/30"
                                : "bg-white/[0.06] text-white/30"
                          )}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="size-3.5" />
                          ) : (
                            stepNum
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-medium tracking-wide transition-colors",
                            isActive ? "text-white/80" : isCompleted ? "text-white/60" : "text-white/25"
                          )}
                        >
                          {label}
                        </span>
                      </div>
                      {idx < 4 && (
                        <div className="flex-1 mx-1.5 mb-5">
                          <div
                            className={cn(
                              "h-px transition-colors duration-300",
                              isCompleted ? "bg-white/30" : "bg-white/[0.06]"
                            )}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}


          </div>

          <div className="space-y-4">
            <div className="space-y-4">
              {/* Step 1: Select Content Type */}
              {step === 1 && (
                <div className="grid grid-cols-2 gap-2.5">
                  {CONTENT_TYPES.map((contentType) => {
                    const Icon = contentType.icon;
                    const isSelected = selectedContentType === contentType.value;
                    const isDisabled = contentType.value !== "blog";
                    return (
                      <div
                        key={contentType.value}
                        onClick={() => {
                          if (!isDisabled) {
                            setSelectedContentType(contentType.value);
                            setTimeout(() => setStep(2), 200);
                          }
                        }}
                        className={cn(
                          "relative rounded-xl bg-[#111111] p-5 flex flex-col gap-3 transition-all duration-200 border",
                          isDisabled
                            ? "opacity-40 cursor-not-allowed border-transparent"
                            : "cursor-pointer group",
                          isSelected
                            ? "bg-white/[0.06] border-transparent"
                            : !isDisabled && "border-transparent hover:bg-white/[0.03]"
                        )}
                      >
                        {isSelected && !isDisabled && (
                          <div className="absolute top-3 right-3">
                            <CheckCircle2 className="size-4 text-white" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "flex items-center justify-center size-10 rounded-lg flex-shrink-0",
                            isDisabled
                              ? "bg-white/[0.03]"
                              : isSelected
                                ? "bg-white/[0.12]"
                                : "bg-white/[0.05]"
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-[18px] w-[18px]",
                              isDisabled
                                ? "text-white/40"
                                : isSelected
                                  ? "text-white"
                                  : "text-white/70"
                            )}
                          />
                        </div>
                        <div>
                          <p
                            className={cn(
                              "text-sm font-semibold leading-5 mb-0.5",
                              isDisabled
                                ? "text-white/50"
                                : isSelected
                                  ? "text-white"
                                  : "text-white/90"
                            )}
                          >
                            {contentType.label}
                          </p>
                          <p
                            className={cn(
                              "text-[11px] leading-relaxed",
                              isDisabled ? "text-white/30" : "text-white/45"
                            )}
                          >
                            {contentType.description}
                          </p>
                        </div>
                        {isDisabled && (
                          <Badge className="absolute top-3 right-3 h-5 text-[9px] px-1.5 rounded-md bg-white/[0.06] text-white/30 border-0">
                            Soon
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Step 2: Select Category & Prompt */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-[#111111] overflow-hidden">
                    {!selectedCategory ? (
                      <div className="divide-y divide-white/[0.03]">
                    {promptCategories.length > 0 ? (
                      promptCategories.map((category, index) => {
                        const Icon = categoryIcons[index % categoryIcons.length];
                        return (
                          <div
                            key={category.key}
                            onClick={() => setSelectedCategory(category.key)}
                            className="px-6 py-4 flex items-center justify-between gap-6 transition-all duration-200 cursor-pointer group hover:bg-white/[0.03]"
                          >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="flex items-center justify-center size-11 rounded-xl bg-white/[0.05] group-hover:bg-white/[0.08] transition-all duration-200 flex-shrink-0">
                                <Icon className="h-5 w-5 text-white/90 group-hover:text-white transition-colors" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold leading-5 text-white group-hover:text-white transition-colors">
                                    {category.label}
                                  </p>
                                  {category.key === SUGGESTED_CATEGORY_KEY && (
                                    <Badge className="h-5 text-[10px] px-2 rounded-full bg-orange-500/15 text-orange-200 border border-orange-500/30">
                                      Suggested
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-white/60">
                                  {category.count} tracked{" "}
                                  {category.count === 1 ? "prompt" : "prompts"}
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white/60 transition-colors" />
                          </div>
                        );
                      })
                    ) : (
                          <div className="px-6 py-12 text-center text-sm text-white/50">
                            No tracked prompts found. Add prompts first.
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="px-6 py-4 flex items-center gap-3 border-b border-white/[0.03] bg-white/[0.02]">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedCategory(null);
                              setSelectedPrompt(null);
                            }}
                            className="h-8 px-3 text-white/70 hover:text-white hover:bg-white/5"
                          >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Back to Categories
                          </Button>
                          <div className="h-4 w-px bg-white/20" />
                          <span className="text-sm font-medium text-white/80 truncate">
                            {selectedCategoryLabel}
                          </span>
                        </div>
                        <ScrollArea className="h-[360px]">
                          {promptsForSelectedCategory.length > 0 ? (
                            promptsForSelectedCategory.map((prompt) => {
                              const isSelected = selectedPrompt?.id === prompt.id;
                              return (
                                <div
                                  key={prompt.id}
                                  onClick={() => handlePromptSelect(prompt)}
                                  className={cn(
                                    "px-6 py-4 flex items-center justify-between gap-4 border-b border-white/[0.03] last:border-b-0 transition-all duration-200 cursor-pointer group",
                                    isSelected
                                      ? "bg-white/[0.05]"
                                      : "hover:bg-white/[0.03]"
                                  )}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p
                                      className={cn(
                                        "text-sm font-medium leading-5 mb-1 transition-colors",
                                        isSelected
                                          ? "text-white"
                                          : "text-white/90 group-hover:text-white"
                                      )}
                                    >
                                      {prompt.text}
                                    </p>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] text-white/50 border-white/10"
                                    >
                                      {prompt.category}
                                    </Badge>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white/60 transition-colors flex-shrink-0" />
                                </div>
                              );
                            })
                          ) : (
                            <div className="px-6 py-12 text-center text-sm text-white/50">
                              No prompts found in this category.
                            </div>
                          )}
                        </ScrollArea>
                      </>
                    )}
                  </div>

                  <div className="flex justify-between pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStep(1);
                        setSelectedCategory(null);
                        setSelectedPrompt(null);
                      }}
                      className="h-9 px-4 rounded-lg border-0 bg-white/[0.06] text-white/80 hover:bg-white/[0.1] hover:text-white"
                    >
                      <ChevronLeft className="size-4 mr-1" />
                      Back
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Select ICP */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-[#111111] overflow-hidden">
                {isLoadingICPs ? (
                  <div className="px-6 py-12 text-center">
                    <UnicodeLoader className="w-6 text-[18px] text-white/40 mx-auto mb-2" animate />
                    <p className="text-sm text-white/50">Loading customer profiles...</p>
                  </div>
                ) : icpSuggestions.length === 0 ? (
                  <div className="px-6 py-12 text-center text-sm text-white/50">
                    No ideal customer profiles defined. Add ICPs in your brand profile settings.
                  </div>
                ) : icpSuggestions.map((icp) => {
                  const isSelected = selectedIcp === icp.label;
                  const Icon = icp.icon;
                      return (
                        <div
                      key={icp.label}
                          onClick={() => {
                        setSelectedIcp(icp.label);
                            setTimeout(() => setStep(4), 200);
                          }}
                          className={cn(
                            "px-6 py-4 flex items-center justify-between gap-6 border-b border-white/[0.03] last:border-b-0 transition-all duration-200 cursor-pointer group",
                            isSelected ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"
                          )}
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div
                              className={cn(
                                "flex items-center justify-center size-11 rounded-xl transition-all duration-200 flex-shrink-0",
                                isSelected
                                  ? "bg-white/[0.1]"
                                  : "bg-white/[0.05] group-hover:bg-white/[0.08]"
                              )}
                            >
                          <Icon
                                className={cn(
                                  "h-5 w-5 transition-colors",
                                  isSelected
                                    ? "text-white"
                                    : "text-white/90 group-hover:text-white"
                                )}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className={cn(
                                  "text-sm font-semibold leading-5 transition-colors",
                                  isSelected
                                    ? "text-white"
                                    : "text-white group-hover:text-white"
                                )}
                                title={icp.label}
                              >
                                {truncateICP(icp.label)}
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="flex-shrink-0">
                              <CheckCircle2 className="size-4 text-white" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStep(2)}
                      className="h-9 px-4 rounded-lg border-0 bg-white/[0.06] text-white/80 hover:bg-white/[0.1] hover:text-white"
                    >
                      <ChevronLeft className="size-4 mr-1" />
                      Back to prompts
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: Select Citation Sources */}
              {step === 4 && !isGenerating && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-[#111111] overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/[0.03]">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-semibold mb-1">
                        {selectedCategoryLabel}
                      </p>
                      <p className="text-sm text-white/90 leading-relaxed">
                        {selectedPrompt?.text}
                      </p>
                    </div>
                    <div className="max-h-[280px] overflow-auto">
                      <table className="w-full table-fixed">
                        <thead>
                          <tr className="text-left text-xs text-white/50 uppercase tracking-wider border-b border-white/[0.03]">
                            <th className="px-3 py-3 w-10">Use</th>
                            <th className="px-3 py-3 w-[35%]">Source</th>
                            <th className="px-3 py-3">Domain</th>
                            <th className="px-3 py-3 w-20">Model</th>
                            <th className="px-3 py-3 text-right w-12"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {isLoadingCitations ? (
                            <tr>
                              <td colSpan={5} className="px-5 py-8 text-center">
                                <UnicodeLoader className="w-5 text-[16px] text-white/40 mx-auto mb-2" animate />
                                <p className="text-sm text-white/50">Loading citations from AI models...</p>
                              </td>
                            </tr>
                          ) : availableSources.length > 0 ? (
                            availableSources.map((source) => {
                              const isSelected = selectedSources.has(source.domain);
                              return (
                                <tr
                                  key={source.domain}
                                  onClick={() => toggleSource(source.domain)}
                                  className={cn(
                                    "border-b border-white/[0.03] text-sm transition-colors cursor-pointer",
                                    isSelected ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                                  )}
                                >
                                  <td className="px-3 py-3 align-middle">
                                    <Checkbox
                                      checked={isSelected}
                                      disabled={!isSelected && selectedSources.size >= MAX_SELECTED_SOURCES}
                                      onClick={(event) => event.stopPropagation()}
                                      onCheckedChange={() =>
                                        toggleSource(source.domain)
                                      }
                                      className="border-white/30 data-[state=checked]:bg-white data-[state=checked]:border-white disabled:opacity-30"
                                    />
                                  </td>
                                  <td className="px-3 py-3 align-middle">
                                    <p className="text-sm font-medium text-white/90 truncate" title={source.title || source.domain}>
                                      {source.title || source.domain}
                                    </p>
                                  </td>
                                  <td className="px-3 py-3 align-middle">
                                    <p className="text-xs text-white/60 truncate" title={source.domain}>
                                      {source.domain}
                                    </p>
                                  </td>
                                  <td className="px-3 py-3 align-middle">
                                    {(() => {
                                      const logo = getModelLogo(source.provider);
                                      return logo ? (
                                        <img
                                          src={logo.src}
                                          alt={logo.alt}
                                          title={logo.alt}
                                          className="h-5 w-5 object-contain opacity-70"
                                        />
                                      ) : (
                                        <span className="text-[10px] text-white/40">{source.provider || 'AI'}</span>
                                      );
                                    })()}
                                  </td>
                                  <td className="px-3 py-3 text-right align-middle">
                                    <a
                                      href={source.url || `https://${source.domain}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center justify-center rounded p-1.5 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                                      title="Open in new tab"
                                    >
                                      <ExternalLink className="size-3.5" />
                                    </a>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td
                                colSpan={5}
                                className="px-5 py-8 text-center text-sm text-white/50"
                              >
                                No citation sources available for this prompt.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Action buttons */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStep(3);
                    setSelectedSources(new Set());
                  }}
                  className="h-9 px-4 rounded-lg border-0 bg-white/[0.06] text-white/80 hover:bg-white/[0.1] hover:text-white"
                >
                  <ChevronLeft className="size-4 mr-1" />
                  Back
                </Button>
                <Button
                  onClick={handleStartGeneration}
                  disabled={selectedSources.size < 2}
                  className="h-9 px-5 rounded-lg bg-white text-[#0a0a0a] hover:bg-white/90 shadow-sm hover:shadow-md border-0 disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                >
                  Generate Content
                  <ChevronRight className="size-4" />
                </Button>
              </div>

                </div>
              )}

              {/* Step 5: Generation Progress */}
              {step === 5 && (
                <div className="space-y-6">
                  {/* Header (minimal while loading) */}
                  <div className="flex flex-col items-center text-center">
                    {result && (
                      <>
                        <h3 className="text-lg font-semibold text-white mb-1">
                          Content Generated!
                        </h3>
                        <p className="text-sm text-white/60">
                          {`${result.metadata.wordCount} words • Redirecting to editor...`}
                        </p>
                      </>
                    )}
                    {error && (
                      <>
                        <h3 className="text-lg font-semibold text-white mb-1">
                          Generation Failed
                        </h3>
                        <p className="text-sm text-white/60">{error}</p>
                      </>
                    )}
                  </div>

                  {/* Progress steps */}
                  <div className="bg-[#111111] rounded-lg p-4 space-y-2.5">
                    {WORKFLOW_STEPS.map((wfStep, idx) => {
                      const status = getStepStatus(idx);
                      const Icon = wfStep.icon;
                      return (
                        <div
                          key={wfStep.id}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200",
                            status === "complete"
                              ? "bg-emerald-500/5"
                              : status === "active"
                                ? "bg-white/[0.05] ring-1 ring-white/10"
                                : status === "error"
                                  ? "bg-red-500/5"
                                  : "bg-transparent"
                          )}
                        >
                          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                            {status === "complete" ? (
                              <CheckCircle2 className="size-4 text-emerald-400" />
                            ) : status === "active" ? (
                              <UnicodeLoader className="w-4 text-[14px] text-white" animate />
                            ) : (
                              <Icon
                                className={cn(
                                  "size-4",
                                  status === "error"
                                    ? "text-red-400"
                                    : "text-white/30"
                                )}
                              />
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-3 flex-1 min-w-0">
                            <span
                              className={cn(
                                "text-sm font-medium",
                                status === "complete"
                                  ? "text-white/90"
                                  : status === "active"
                                    ? "text-white"
                                    : status === "error"
                                      ? "text-red-400"
                                      : "text-white/50"
                              )}
                            >
                              {wfStep.label}
                            </span>
                            {status === "active" && (
                              <div className="h-1.5 w-24 rounded-full bg-white/[0.08] overflow-hidden">
                                <div className="h-full w-1/2 bg-white/50 animate-pulse rounded-full" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Post-generation loading before redirect */}
                  {result && !error && (
                    <div className="rounded-lg bg-white/[0.03] p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <UnicodeLoader className="w-4 text-[14px] text-white" animate />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white">
                            Loading piece of content
                          </p>
                          <p className="text-xs text-white/60">
                            Preparing your editor view...
                          </p>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                        <div className="h-full w-1/3 bg-white/40 animate-pulse rounded-full" />
                      </div>
                    </div>
                  )}

                  {/* Error retry button */}
                  {error && (
                    <div className="flex justify-center">
                      <Button
                        onClick={() => {
                          reset();
                          setStep(2);
                        }}
                        variant="outline"
                        className="border-0 bg-white/[0.06] hover:bg-white/[0.1]"
                      >
                        Try Again
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
