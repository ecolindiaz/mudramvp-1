"use client";

import { useState, useEffect, useMemo } from "react";
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
  Loader2,
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

interface TrackedPrompt {
  id: string;
  text: string;
  category: string;
}

interface CitationSource {
  domain: string;
  url?: string;
  title?: string;
  type?: string;
}

interface AIOptimizedGeneratorProps {
  trackedPrompts: TrackedPrompt[];
  onComplete?: (campaignId: string) => void;
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

// Mock citation sources for demo - in production, these would come from the tracked prompt data
const getMockCitations = (promptId: string): CitationSource[] => [
  { domain: "scale.com", url: "https://scale.com", title: "Scale AI" },
  { domain: "labelbox.com", url: "https://labelbox.com", title: "Labelbox" },
  { domain: "appen.com", url: "https://appen.com", title: "Appen" },
  {
    domain: "aws.amazon.com",
    url: "https://aws.amazon.com/sagemaker/data-labeling/",
    title: "AWS SageMaker",
  },
];

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
  onComplete,
}: AIOptimizedGeneratorProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
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

  // ICP suggestions - should match the normal campaign flow
  const icpSuggestions = [
    { label: "Seed‑stage startup founders", icon: Users },
    { label: "GTM leads at SaaS startups", icon: Target },
    { label: "AI practitioners & researchers", icon: Brain },
    { label: "Developers evaluating AI tools", icon: Shield },
  ];

  const {
    isGenerating,
    currentStep,
    result,
    error,
    startGeneration,
    reset,
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
    if (selectedPrompt) {
      // In production, fetch real citations from tracked prompt data
      const citations = getMockCitations(selectedPrompt.id);
      setAvailableSources(citations);
      // Auto-select all sources by default
      setSelectedSources(new Set(citations.map((c) => c.domain)));
    }
  }, [selectedPrompt]);

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

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (open) {
      // Reset state when opening
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
      } else {
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
    await startGeneration(selectedPrompt.text, sources);
  };

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
      <DialogContent className="!max-w-2xl sm:!max-w-2xl bg-dark-grey border-white/10 p-0 !rounded-[12px] overflow-hidden shadow-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Generate AI-Optimized Content</DialogTitle>
        </DialogHeader>

        <div className="bg-dark-grey px-6 pt-6 pb-6">
          {/* Title and Description */}
          <div className="mb-6">
            <div className="flex items-center justify-between gap-4 mb-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-semibold">
                  Step {step} of {TOTAL_STEPS}
                </p>
                <h2 className="text-xl font-semibold text-white tracking-tight">
                  AI-Optimized Content
                </h2>
              </div>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              {STEP_COPY[step]}
            </p>
            {!isGenerating && (
              <div className="mt-4">
                <div className="relative h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "absolute left-0 top-0 h-1 bg-white/40 rounded-full transition-[width] duration-300 ease-out",
                      step === 1
                        ? "w-1/5"
                        : step === 2
                          ? "w-2/5"
                          : step === 3
                            ? "w-3/5"
                            : step === 4
                              ? "w-4/5"
                              : "w-full"
                    )}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-4">
              {/* Step 1: Select Content Type */}
              {step === 1 && (
                <div className="rounded-xl border border-white/[0.08] bg-[#1a1a1a] overflow-hidden shadow-sm">
                  {CONTENT_TYPES.map((contentType) => {
                    const Icon = contentType.icon;
                    const isSelected = selectedContentType === contentType.value;
                    const isDisabled = contentType.value !== "blog"; // Only allow Blog Post for now
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
                          "px-6 py-4 flex items-center justify-between gap-6 border-b border-white/[0.06] last:border-b-0 transition-all duration-200",
                          isDisabled
                            ? "opacity-50 cursor-not-allowed"
                            : "cursor-pointer group",
                          isSelected
                            ? "bg-white/[0.05]"
                            : !isDisabled && "hover:bg-white/[0.03]"
                        )}
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div
                            className={cn(
                              "flex items-center justify-center size-11 rounded-xl border transition-all duration-200 flex-shrink-0 shadow-sm",
                              isDisabled
                                ? "bg-white/[0.03] border-white/[0.06]"
                                : isSelected
                                  ? "bg-white/[0.1] border-white/30 shadow-white/10"
                                  : "bg-white/[0.05] border-white/[0.08] group-hover:bg-white/[0.08] group-hover:border-white/[0.15] group-hover:shadow"
                            )}
                          >
                            <Icon
                              className={cn(
                                "h-5 w-5 transition-colors",
                                isDisabled
                                  ? "text-white/40"
                                  : isSelected
                                    ? "text-white"
                                    : "text-white/90 group-hover:text-white"
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "text-sm font-semibold leading-5 mb-1 transition-colors",
                                isDisabled
                                  ? "text-white/50"
                                  : isSelected
                                    ? "text-white"
                                    : "text-white group-hover:text-white"
                              )}
                            >
                              {contentType.label}
                            </p>
                            <p
                              className={cn(
                                "text-xs leading-relaxed",
                                isDisabled ? "text-white/40" : "text-white/60"
                              )}
                            >
                              {contentType.description}
                            </p>
                          </div>
                        </div>
                        {isSelected && !isDisabled && (
                          <div className="flex-shrink-0">
                            <div className="w-2 h-2 rounded-full bg-white"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Step 2: Select Category & Prompt */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-white/[0.08] bg-[#1a1a1a] overflow-hidden shadow-sm">
                    {!selectedCategory ? (
                      <div className="divide-y divide-white/[0.06]">
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
                              <div className="flex items-center justify-center size-11 rounded-xl border bg-white/[0.05] border-white/[0.08] group-hover:bg-white/[0.08] group-hover:border-white/[0.15] transition-all duration-200 flex-shrink-0 shadow-sm group-hover:shadow">
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
                        <div className="px-6 py-4 flex items-center gap-3 border-b border-white/[0.06] bg-white/[0.02]">
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
                                    "px-6 py-4 flex items-center justify-between gap-4 border-b border-white/[0.06] last:border-b-0 transition-all duration-200 cursor-pointer group",
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
                        setSelectedContentType(null);
                        setSelectedCategory(null);
                        setSelectedPrompt(null);
                      }}
                      className="h-9 px-4 rounded-lg border-white/[0.08] bg-transparent text-white/80 hover:bg-white/5 hover:text-white"
                    >
                      <ChevronLeft className="size-4 mr-1" />
                      Back to content types
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Select ICP */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-white/[0.08] bg-[#1a1a1a] overflow-hidden shadow-sm">
                {icpSuggestions.map((icp) => {
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
                            "px-6 py-4 flex items-center justify-between gap-6 border-b border-white/[0.06] last:border-b-0 transition-all duration-200 cursor-pointer group",
                            isSelected ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"
                          )}
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div
                              className={cn(
                                "flex items-center justify-center size-11 rounded-xl border transition-all duration-200 flex-shrink-0 shadow-sm",
                                isSelected
                                  ? "bg-white/[0.1] border-white/30 shadow-white/10"
                                  : "bg-white/[0.05] border-white/[0.08] group-hover:bg-white/[0.08] group-hover:border-white/[0.15] group-hover:shadow"
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
                              >
                          {icp.label}
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="flex-shrink-0">
                              <div className="w-2 h-2 rounded-full bg-white"></div>
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
                      className="h-9 px-4 rounded-lg border-white/[0.08] bg-transparent text-white/80 hover:bg-white/5 hover:text-white"
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
                  <div className="rounded-xl border border-white/[0.08] bg-[#1a1a1a] overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/[0.06]">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-semibold mb-1">
                        {selectedCategoryLabel}
                      </p>
                      <p className="text-sm text-white/90 leading-relaxed">
                        {selectedPrompt?.text}
                      </p>
                    </div>
                    <div className="max-h-[280px] overflow-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-xs text-white/50 uppercase tracking-wider border-b border-white/[0.04]">
                        <th className="px-5 py-3 w-12">Use</th>
                        <th className="px-5 py-3">Source</th>
                        <th className="px-5 py-3">URL</th>
                        <th className="px-5 py-3 text-right">Open</th>
                          </tr>
                        </thead>
                        <tbody>
                          {availableSources.length > 0 ? (
                            availableSources.map((source) => {
                              const isSelected = selectedSources.has(source.domain);
                              return (
                                <tr
                                  key={source.domain}
                                  onClick={() => toggleSource(source.domain)}
                                  className={cn(
                                    "border-b border-white/[0.04] text-sm transition-colors cursor-pointer",
                                    isSelected ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                                  )}
                                >
                                  <td className="px-5 py-3 align-middle">
                                    <Checkbox
                                      checked={isSelected}
                                      onClick={(event) => event.stopPropagation()}
                                      onCheckedChange={() =>
                                        toggleSource(source.domain)
                                      }
                                      className="border-white/30 data-[state=checked]:bg-white data-[state=checked]:border-white"
                                    />
                                  </td>
                                  <td className="px-5 py-3 align-middle">
                                    <p className="text-sm font-medium text-white/90">
                                      {source.title || source.domain}
                                    </p>
                                  </td>
                                  <td className="px-5 py-3 align-middle">
                                    <p className="text-xs text-white/60 truncate">
                                      {source.url || `https://${source.domain}`}
                                    </p>
                                  </td>
                                  <td className="px-5 py-3 text-right align-middle">
                                    <a
                                      href={source.url || `https://${source.domain}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center rounded px-2 py-1 text-xs text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                                    >
                                      <ExternalLink className="size-3.5 mr-1" />
                                      Visit
                                    </a>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td
                                colSpan={4}
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
                    setStep(1);
                    setSelectedContentType(null);
                    setSelectedCategory(null);
                    setSelectedPrompt(null);
                    setSelectedIcp(null);
                    setSelectedSources(new Set());
                  }}
                  className="h-9 px-4 rounded-lg border-white/[0.08] bg-transparent text-white/80 hover:bg-white/5 hover:text-white"
                >
                  <ChevronLeft className="size-4 mr-1" />
                  Edit selections
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
              <p className="text-xs text-white/60 pt-1">
                Select at least two citations to keep the draft grounded. {selectedSources.size} selected.
              </p>
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
                  <div className="bg-[#1a1a1a] rounded-lg border border-white/[0.06] p-4 space-y-2.5">
                    {WORKFLOW_STEPS.map((wfStep, idx) => {
                      const status = getStepStatus(idx);
                      const Icon = wfStep.icon;
                      return (
                        <div
                          key={wfStep.id}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border px-4 py-3 transition-all duration-200",
                            status === "complete"
                              ? "border-emerald-500/30 bg-emerald-500/5"
                              : status === "active"
                                ? "border-white/25 bg-white/[0.05] ring-1 ring-white/15"
                                : status === "error"
                                  ? "border-red-500/30 bg-red-500/5"
                                  : "border-white/[0.06] bg-transparent"
                          )}
                        >
                          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                            {status === "complete" ? (
                              <CheckCircle2 className="size-4 text-emerald-400" />
                            ) : status === "active" ? (
                              <Loader2 className="size-4 text-white animate-spin" />
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
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <Loader2 className="size-4 text-white animate-spin" />
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
                        className="border-white/10 hover:bg-white/5"
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

