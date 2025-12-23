/**
 * Technical Findings Details Component
 * 
 * Displays per-page technical analysis breakdown
 * Shows what's missing/OK for each check
 */

"use client"

import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, XCircle, AlertCircle, FileText, Code, Search, Database, HelpCircle } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface PageFindings {
  url: string;
  score: number;
  metadata: {
    score: number;
    total: 25;
    checks: {
      title: { passed: boolean; value?: string };
      description: { passed: boolean; value?: string };
      ogTags: { passed: boolean; missing?: string[] };
      twitterCard: { passed: boolean; missing?: string[] };
      canonical: { passed: boolean; value?: string };
    };
  };
  headings: {
    score: number;
    total: 20;
    checks: {
      h1Present: { passed: boolean; count: number };
      hierarchy: { passed: boolean; issues?: string[] };
      descriptive: { passed: boolean; h2Count: number; h3Count: number };
    };
  };
  semantic: {
    score: number;
    total: 15;
    checks: {
      semanticTags: { passed: boolean; found: string[] };
      imageAlt: { passed: boolean; total: number; withAlt: number };
      ariaLabels: { passed: boolean; count: number };
    };
  };
  schema: {
    score: number;
    total: 25;
    checks: {
      jsonLdPresent: { passed: boolean; count: number };
      orgWebsiteSchema: { passed: boolean; types: string[] };
      faqSchema: { passed: boolean; count: number };
    };
  };
  faq: {
    score: number;
    total: 15;
    count: number;
    items: Array<{ question: string; answer: string }>;
  };
}

interface TechnicalFindingsProps {
  brandProfileId: number;
  findings: PageFindings[];
}

function ScoreBadge({ score, total }: { score: number; total: number }) {
  const percentage = (score / total) * 100;
  const color = percentage >= 80 ? "bg-green-500/10 text-green-500 border-green-500/20" :
                percentage >= 50 ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                "bg-red-500/10 text-red-500 border-red-500/20";
  
  return (
    <Badge variant="outline" className={color}>
      {score}/{total}
    </Badge>
  );
}

function CheckItem({ 
  label, 
  passed, 
  details 
}: { 
  label: string; 
  passed: boolean; 
  details?: React.ReactNode 
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5">
        {passed ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${passed ? 'text-white/80' : 'text-white/60'}`}>
          {label}
        </p>
        {details && (
          <div className="mt-1 text-xs text-white/40">
            {details}
          </div>
        )}
      </div>
    </div>
  );
}

function PageAccordionItem({ page }: { page: PageFindings }) {
  const overallPercentage = (page.score / 100) * 100;
  
  return (
    <AccordionItem value={page.url} className="border-white/[0.08]">
      <AccordionTrigger className="hover:no-underline hover:bg-white/5 px-4 rounded-lg transition-colors">
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <FileText className="h-4 w-4 text-white/60 shrink-0" />
            <span className="text-sm text-white truncate">{page.url}</span>
          </div>
          <Badge 
            variant="outline" 
            className={`ml-3 shrink-0 ${
              overallPercentage >= 80 ? 'bg-green-500/10 text-green-500 border-green-500/20' :
              overallPercentage >= 50 ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
              'bg-red-500/10 text-red-500 border-red-500/20'
            }`}
          >
            {page.score}/100
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pt-4 pb-6">
        <div className="space-y-6">
          {/* Metadata Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-blue-400" />
                <h4 className="text-sm font-medium text-white">Metadata</h4>
              </div>
              <ScoreBadge score={page.metadata.score} total={page.metadata.total} />
            </div>
            <div className="pl-6 space-y-1">
              <CheckItem 
                label="Title tag" 
                passed={page.metadata.checks.title.passed}
                details={page.metadata.checks.title.value}
              />
              <CheckItem 
                label="Meta description" 
                passed={page.metadata.checks.description.passed}
                details={page.metadata.checks.description.value}
              />
              <CheckItem 
                label="Open Graph tags" 
                passed={page.metadata.checks.ogTags.passed}
                details={!page.metadata.checks.ogTags.passed && page.metadata.checks.ogTags.missing ? 
                  `Missing: ${page.metadata.checks.ogTags.missing.join(', ')}` : undefined
                }
              />
              <CheckItem 
                label="Twitter Card" 
                passed={page.metadata.checks.twitterCard.passed}
                details={!page.metadata.checks.twitterCard.passed && page.metadata.checks.twitterCard.missing ? 
                  `Missing: ${page.metadata.checks.twitterCard.missing.join(', ')}` : undefined
                }
              />
              <CheckItem 
                label="Canonical URL" 
                passed={page.metadata.checks.canonical.passed}
                details={page.metadata.checks.canonical.value}
              />
            </div>
          </div>

          <Separator className="border-white/[0.08]" />

          {/* Headings Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-purple-400" />
                <h4 className="text-sm font-medium text-white">Headings Structure</h4>
              </div>
              <ScoreBadge score={page.headings.score} total={page.headings.total} />
            </div>
            <div className="pl-6 space-y-1">
              <CheckItem 
                label="H1 tag present" 
                passed={page.headings.checks.h1Present.passed}
                details={`Found ${page.headings.checks.h1Present.count} H1 tag(s)`}
              />
              <CheckItem 
                label="Proper heading hierarchy" 
                passed={page.headings.checks.hierarchy.passed}
                details={page.headings.checks.hierarchy.issues?.join(', ')}
              />
              <CheckItem 
                label="Descriptive subheadings" 
                passed={page.headings.checks.descriptive.passed}
                details={`${page.headings.checks.descriptive.h2Count} H2s, ${page.headings.checks.descriptive.h3Count} H3s`}
              />
            </div>
          </div>

          <Separator className="border-white/[0.08]" />

          {/* Semantic HTML Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-400" />
                <h4 className="text-sm font-medium text-white">Semantic HTML</h4>
              </div>
              <ScoreBadge score={page.semantic.score} total={page.semantic.total} />
            </div>
            <div className="pl-6 space-y-1">
              <CheckItem 
                label="Semantic HTML5 tags" 
                passed={page.semantic.checks.semanticTags.passed}
                details={page.semantic.checks.semanticTags.found.length > 0 ? 
                  `Found: ${page.semantic.checks.semanticTags.found.join(', ')}` : 
                  'No semantic tags found'
                }
              />
              <CheckItem 
                label="Image alt attributes" 
                passed={page.semantic.checks.imageAlt.passed}
                details={`${page.semantic.checks.imageAlt.withAlt}/${page.semantic.checks.imageAlt.total} images have alt text`}
              />
              <CheckItem 
                label="ARIA labels for accessibility" 
                passed={page.semantic.checks.ariaLabels.passed}
                details={`Found ${page.semantic.checks.ariaLabels.count} ARIA labels`}
              />
            </div>
          </div>

          <Separator className="border-white/[0.08]" />

          {/* Schema/JSON-LD Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-orange-400" />
                <h4 className="text-sm font-medium text-white">Structured Data</h4>
              </div>
              <ScoreBadge score={page.schema.score} total={page.schema.total} />
            </div>
            <div className="pl-6 space-y-1">
              <CheckItem 
                label="Valid JSON-LD present" 
                passed={page.schema.checks.jsonLdPresent.passed}
                details={`Found ${page.schema.checks.jsonLdPresent.count} JSON-LD block(s)`}
              />
              <CheckItem 
                label="Organization/Website schema" 
                passed={page.schema.checks.orgWebsiteSchema.passed}
                details={page.schema.checks.orgWebsiteSchema.types.length > 0 ? 
                  `Types: ${page.schema.checks.orgWebsiteSchema.types.join(', ')}` : 
                  'No org/website schema found'
                }
              />
              <CheckItem 
                label="FAQ schema markup" 
                passed={page.schema.checks.faqSchema.passed}
                details={`Found ${page.schema.checks.faqSchema.count} FAQ schema(s)`}
              />
            </div>
          </div>

          <Separator className="border-white/[0.08]" />

          {/* FAQ Content Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-cyan-400" />
                <h4 className="text-sm font-medium text-white">FAQ Content</h4>
              </div>
              <ScoreBadge score={page.faq.score} total={page.faq.total} />
            </div>
            <div className="pl-6">
              {page.faq.count > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-white/60">
                    Found {page.faq.count} FAQ item(s)
                  </p>
                  {page.faq.items.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="text-xs text-white/40 border-l-2 border-white/10 pl-3 py-1">
                      <p className="font-medium text-white/60">{item.question}</p>
                      <p className="mt-1 line-clamp-2">{item.answer}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/40">No FAQs found</p>
              )}
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function TechnicalFindingsDetails({ brandProfileId, findings }: TechnicalFindingsProps) {
  const averageScore = findings.length > 0
    ? findings.reduce((sum, page) => sum + page.score, 0) / findings.length
    : 0;

  return (
    <Card className="bg-white/5 border-white/[0.08]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white">Technical Findings</CardTitle>
            <CardDescription className="text-white/60">
              Per-page breakdown of technical optimization
            </CardDescription>
          </div>
          <Badge 
            variant="outline" 
            className={`${
              averageScore >= 80 ? 'bg-green-500/10 text-green-500 border-green-500/20' :
              averageScore >= 50 ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
              'bg-red-500/10 text-red-500 border-red-500/20'
            }`}
          >
            Avg: {averageScore.toFixed(0)}/100
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {findings.length > 0 ? (
          <Accordion type="single" collapsible className="w-full space-y-2">
            {findings.map((page, idx) => (
              <PageAccordionItem key={idx} page={page} />
            ))}
          </Accordion>
        ) : (
          <div className="text-center py-12 text-white/40">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No technical analysis data available</p>
            <p className="text-sm mt-1">Run an analysis to see detailed findings</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
