"use client";

import { useState, useEffect } from "react";
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
  Zap,
  FileText,
  Brain,
  Search,
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
  { id: "scrape", label: "Scraping citations (Firecrawl v2)", icon: Globe },
  { id: "analyze", label: "Analyzing content gaps", icon: Brain },
  { id: "research", label: "Live web research", icon: Search },
  { id: "generate", label: "Generating AI-optimized content", icon: Sparkles },
  { id: "complete", label: "Complete!", icon: CheckCircle2 },
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

export function AIOptimizedGenerator({
  trackedPrompts,
  onComplete,
}: AIOptimizedGeneratorProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1=Select Prompt, 2=Select Sources, 3=Generating
  const [selectedPrompt, setSelectedPrompt] = useState<TrackedPrompt | null>(
    null
  );
  const [availableSources, setAvailableSources] = useState<CitationSource[]>(
    []
  );
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set()
  );

  const {
    isGenerating,
    progress,
    currentStep,
    result,
    error,
    startGeneration,
    reset,
  } = useAIContentGeneration();

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
      setSelectedPrompt(null);
      setAvailableSources([]);
      setSelectedSources(new Set());
      reset();
    }
  };

  const handlePromptSelect = (prompt: TrackedPrompt) => {
    setSelectedPrompt(prompt);
    setStep(2);
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

    setStep(3);

    const sources = availableSources.filter((s) =>
      selectedSources.has(s.domain)
    );
    await startGeneration(selectedPrompt.text, sources);
  };

  const getStepStatus = (stepIndex: number) => {
    if (error) return "error";
    if (currentStep > stepIndex) return "complete";
    if (currentStep === stepIndex && isGenerating) return "active";
    return "pending";
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-9 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 border-0 gap-2"
        >
          <Zap className="size-4" />
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
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center size-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30">
                <Sparkles className="size-4 text-violet-400" />
              </div>
              <h2 className="text-xl font-semibold text-white tracking-tight">
                AI-Optimized Content
              </h2>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              {step === 1
                ? "Select a tracked prompt to optimize for"
                : step === 2
                  ? "Choose citation sources to analyze"
                  : "Generating AI-optimized content..."}
            </p>
          </div>

          {/* Progress bar */}
          {step > 1 && !isGenerating && !result && (
            <div className="mb-6">
              <div className="relative h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "absolute left-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-[width] duration-300 ease-out",
                    step === 2 ? "w-1/2" : "w-full"
                  )}
                />
              </div>
            </div>
          )}

          {/* Step 1: Select Tracked Prompt */}
          {step === 1 && (
            <div className="rounded-xl border border-white/[0.08] bg-[#1a1a1a] overflow-hidden shadow-sm">
              <ScrollArea className="h-[400px]">
                {trackedPrompts.length > 0 ? (
                  trackedPrompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      onClick={() => handlePromptSelect(prompt)}
                      className="px-6 py-4 flex items-center justify-between gap-4 border-b border-white/[0.06] last:border-b-0 transition-all duration-200 cursor-pointer group hover:bg-white/[0.03]"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-5 mb-1 text-white/90 group-hover:text-white transition-colors">
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
                  ))
                ) : (
                  <div className="px-6 py-12 text-center text-sm text-white/50">
                    No tracked prompts found. Add prompts first.
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          {/* Step 2: Select Citation Sources */}
          {step === 2 && !isGenerating && (
            <div className="space-y-4">
              {/* Back button & selected prompt */}
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStep(1);
                    setSelectedPrompt(null);
                  }}
                  className="h-8 px-3 text-white/70 hover:text-white hover:bg-white/5"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <div className="h-4 w-px bg-white/20" />
                <p className="text-sm text-white/70 truncate flex-1">
                  {selectedPrompt?.text}
                </p>
              </div>

              {/* Info banner */}
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
                <div className="flex gap-3">
                  <Brain className="size-5 text-violet-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-white/90 font-medium mb-1">
                      AI-Powered Content Pipeline
                    </p>
                    <p className="text-white/60 text-xs leading-relaxed">
                      We&apos;ll scrape these sources, analyze content gaps,
                      perform live web research, and generate a 1,200-1,600 word
                      GEO-optimized article using GPT-5.1.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sources list */}
              <div className="rounded-xl border border-white/[0.08] bg-[#1a1a1a] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
                      Citation Sources
                    </span>
                    <span className="text-xs text-white/50">
                      {selectedSources.size} selected (min 2)
                    </span>
                  </div>
                </div>
                <ScrollArea className="h-[240px]">
                  {availableSources.map((source) => {
                    const isSelected = selectedSources.has(source.domain);
                    return (
                      <div
                        key={source.domain}
                        onClick={() => toggleSource(source.domain)}
                        className={cn(
                          "px-4 py-3 flex items-center gap-3 border-b border-white/[0.06] last:border-b-0 transition-all duration-200 cursor-pointer",
                          isSelected
                            ? "bg-violet-500/5"
                            : "hover:bg-white/[0.02]"
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          className="border-white/30 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                        />
                        <Globe className="size-4 text-white/40 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white/90 truncate">
                            {source.title || source.domain}
                          </p>
                          <p className="text-xs text-white/50 truncate">
                            {source.url || `https://${source.domain}`}
                          </p>
                        </div>
                        <a
                          href={source.url || `https://${source.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded hover:bg-white/10 transition-colors"
                        >
                          <ExternalLink className="size-3.5 text-white/40 hover:text-white/70" />
                        </a>
                      </div>
                    );
                  })}
                </ScrollArea>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-white/50">
                  Select at least 2 sources to proceed
                </p>
                <Button
                  onClick={handleStartGeneration}
                  disabled={selectedSources.size < 2}
                  className="h-9 px-5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/25 border-0 disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                >
                  <Sparkles className="size-4" />
                  Generate Content
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Generation Progress */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center mb-4">
                  <div
                    className={cn(
                      "flex items-center justify-center size-12 rounded-xl border transition-all duration-300",
                      result
                        ? "bg-emerald-500/20 border-emerald-500/30"
                        : error
                          ? "bg-red-500/20 border-red-500/30"
                          : "bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border-violet-500/30"
                    )}
                  >
                    {result ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    ) : error ? (
                      <span className="text-red-400 text-xl">✕</span>
                    ) : (
                      <Loader2 className="h-6 w-6 text-violet-400 animate-spin" />
                    )}
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  {result
                    ? "Content Generated!"
                    : error
                      ? "Generation Failed"
                      : "Generating Content"}
                </h3>
                <p className="text-sm text-white/60">
                  {result
                    ? `${result.metadata.wordCount} words • Redirecting to editor...`
                    : error
                      ? error
                      : "This may take 2-3 minutes..."}
                </p>
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
                            ? "border-violet-500/30 bg-violet-500/5 ring-1 ring-violet-500/30"
                            : status === "error"
                              ? "border-red-500/30 bg-red-500/5"
                              : "border-white/[0.06] bg-transparent"
                      )}
                    >
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                        {status === "complete" ? (
                          <CheckCircle2 className="size-4 text-emerald-400" />
                        ) : status === "active" ? (
                          <Loader2 className="size-4 text-violet-400 animate-spin" />
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
                    </div>
                  );
                })}
              </div>

              {/* Result metadata */}
              {result && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {result.metadata.wordCount}
                      </p>
                      <p className="text-xs text-white/50">Words</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {result.metadata.sourcesScraped}
                      </p>
                      <p className="text-xs text-white/50">Sources Scraped</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {result.metadata.researchQueriesRun}
                      </p>
                      <p className="text-xs text-white/50">Research Queries</p>
                    </div>
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
      </DialogContent>
    </Dialog>
  );
}

