"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { IconCheck, IconX } from "@tabler/icons-react"
import type { EnhancedGEOResult } from "@/lib/scrapers/enhanced-geo-scraper"
import type { ScoreResult, ScrapeSnapshot } from "@/lib/analysis/technical/types"

interface GeoResultsDisplayProps {
  result: EnhancedGEOResult
  onClose?: () => void
}

export function GeoResultsDisplay({ result, onClose }: GeoResultsDisplayProps) {
  const getScoreStatus = (score: number) => {
    if (score >= 80) return "Excellent"
    if (score >= 60) return "Good" 
    if (score >= 40) return "Needs Work"
    return "Poor"
  }

  // Technical Structure Score (rule-based)
  const [techScore, setTechScore] = useState<ScoreResult | null>(null)
  const [techLoading, setTechLoading] = useState(false)
  const [techError, setTechError] = useState<string | null>(null)

  function buildSnapshotForScore(r: EnhancedGEOResult): ScrapeSnapshot {
    const origin = (() => { try { return new URL(r.url).origin } catch { return r.url } })()
    return {
      url: r.url,
      crawledAt: new Date(r.timestamp).toISOString(),
      metadata: {
        title: r.technicalAccessibility?.metaTags?.title,
        description: r.technicalAccessibility?.metaTags?.description,
        language: undefined,
        favicon: undefined,
      },
      htmlStructure: {
        headings: r.contentStructure?.headingsHierarchy || { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] },
        htmlLength: undefined,
        rawHtmlLength: undefined,
        hasProperStructure: r.technicalAccessibility?.accessibility?.headingStructureValid,
      },
      schema: {
        all: r.structuredData?.jsonLd || [],
        faqSchema: r.structuredData?.faqSchemas || [],
        summary: {
          jsonLdCount: (r.structuredData?.jsonLd || []).length,
          microdataCount: (r.structuredData?.microdata || []).length,
          rdfaCount: (r.structuredData?.rdfa || []).length || 0,
          faqSchemaCount: (r.structuredData?.faqSchemas || []).length,
        },
      },
      faqs: {
        fromSchema: [],
        fromDom: [],
        merged: [],
        summary: {
          totalUnique: Number(r.faqOptimization?.questionAnswerPairs || 0),
          schemaCount: (r.structuredData?.faqSchemas || []).length,
          domCount: 0,
          llmCount: 0,
        },
      },
      txtFiles: {
        robots: { url: `${origin}/robots.txt`, exists: false },
        llms: { url: `${origin}/llms.txt`, exists: false },
        llmsFull: { url: `${origin}/llms-full.txt`, exists: false },
        summary: { hasRobotsTxt: false, hasLlmsTxt: false, hasLlmsFullTxt: false, totalFound: 0 },
      },
      synthesizedJsonLd: [],
    }
  }

  useEffect(() => {
    let mounted = true
    async function run() {
      try {
        setTechLoading(true)
        setTechError(null)
        const snapshot = buildSnapshotForScore(result)
        const res = await fetch("/api/technical-analysis/score", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ snapshot }),
        })
        const json = await res.json()
        if (!mounted) return
        if (!res.ok || !json?.success) {
          setTechError(json?.error?.message || "Failed to fetch score")
          setTechScore(null)
          return
        }
        setTechScore(json.data as ScoreResult)
      } catch (e: any) {
        if (!mounted) return
        setTechError(e?.message || "Unexpected error")
        setTechScore(null)
      } finally {
        if (mounted) setTechLoading(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [result])

  const categoryTotals = useMemo(() => {
    const base = { SEO: { score: 0, max: 0 }, GEO: { score: 0, max: 0 }, Content: { score: 0, max: 0 } }
    if (!techScore) return base
    for (const c of techScore.components) {
      ;(base as any)[c.category].score += c.score
      ;(base as any)[c.category].max += c.max
    }
    return base
  }, [techScore])

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card space-y-5 md:space-y-6 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
      {/* Overview Card */}
      <Card className="@container/card bg-white/[0.02] border-white/10 rounded-2xl" data-slot="card">
        <CardHeader className="pb-3">
          <CardDescription className="text-white/70">GEO Analysis Results</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-white">
            {result.geoScore.overall}/100
          </CardTitle>
          <CardAction>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="outline">
                <IconCheck className="size-4" />
                {getScoreStatus(result.geoScore.overall)}
              </Badge>
              {onClose && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onClose}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Close
                  <IconX className="ml-1 size-3" />
                </Button>
              )}
            </div>
          </CardAction>
        </CardHeader>
        
        <div className="px-6"><Separator className="border-white/10" /></div>
        
        <CardContent className="pt-3">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Website</span>
              <span className="font-medium truncate ml-2">{result.url}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Analyzed</span>
              <span className="font-medium">{new Date(result.timestamp).toLocaleDateString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score Breakdown */}
      <Card className="@container/card bg-white/[0.02] border-white/10 rounded-2xl" data-slot="card">
        <CardHeader className="pb-3">
          <CardDescription className="text-white/70">Score Breakdown</CardDescription>
          <CardTitle className="text-2xl font-semibold @[250px]/card:text-3xl text-white">
            Category Performance
          </CardTitle>
        </CardHeader>
        <div className="px-6"><Separator className="border-white/10" /></div>
        
        <CardContent className="pt-3">
          <div className="space-y-2.5">
            {[
              { label: "Content Authority", score: result.geoScore.contentAuthority },
              { label: "Technical Accessibility", score: result.geoScore.technicalAccessibility },
              { label: "Structured Data", score: result.geoScore.structuredData },
              { label: "Entity Recognition", score: result.geoScore.entityRecognition },
              { label: "FAQ Optimization", score: result.geoScore.faqOptimization },
              { label: "Content Freshness", score: result.geoScore.contentFreshness },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2">
                <span className="text-sm font-medium text-white">{item.label}</span>
                <div className="flex items-center gap-3">
                  <Progress value={item.score} className="w-24 h-2" />
                  <span className="text-sm font-semibold tabular-nums w-8 text-right text-white/90">
                    {item.score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Technical Structure Score */}
      <Card className="@container/card bg-white/[0.02] border-white/10 rounded-2xl" data-slot="card">
        <CardHeader className="pb-3">
          <CardDescription className="text-white/70">Technical Structure Score</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-white">
            {techLoading ? "…" : (techScore?.total ?? "—")}
          </CardTitle>
        </CardHeader>
        <div className="px-6"><Separator className="border-white/10" /></div>
        <CardContent className="pt-3">
          {techError ? (
            <div className="text-sm text-red-400">{techError}</div>
          ) : (
            <div className="space-y-3">
              {["SEO","GEO","Content"].map((cat) => {
                const t = (categoryTotals as any)[cat];
                const pct = t.max > 0 ? Math.round((t.score / t.max) * 100) : 0;
                return (
                  <div key={cat} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{cat}</span>
                    <div className="flex items-center gap-3">
                      <Progress value={pct} className="w-32 h-2" />
                      <span className="text-sm font-semibold tabular-nums w-10 text-right text-white/90">{pct}%</span>
                    </div>
                  </div>
                )
              })}
              <div className="mt-3 space-y-2">
                {techScore?.components.map((c) => (
                  <div key={c.key} className="flex items-center justify-between text-sm">
                    <span className="text-white/90 truncate pr-2">{c.label}</span>
                    <div className="flex items-center gap-3">
                      <Progress value={Math.round((c.score / c.max) * 100)} className="w-24 h-2" />
                      <span className="tabular-nums text-white/80 w-[72px] text-right">{c.score}/{c.max}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Findings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
        {/* Structured Data */}
        <Card className="@container/card" data-slot="card">
          <CardHeader>
            <CardDescription>Structured Data</CardDescription>
            <CardTitle className="text-xl font-semibold">
              {result.structuredData.jsonLd.length + result.structuredData.schemaTypes.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">JSON-LD Scripts</span>
                <span className="font-medium">{result.structuredData.jsonLd.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Schema Types</span>
                <span className="font-medium">{result.structuredData.schemaTypes.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Organization Schema</span>
                <Badge variant="outline" className="h-5 text-xs">
                  {result.structuredData.organizationSchema ? "Present" : "Missing"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Entity Recognition */}
        <Card className="@container/card" data-slot="card">
          <CardHeader>
            <CardDescription>Entity Recognition</CardDescription>
            <CardTitle className="text-xl font-semibold">
              {result.entityRecognition.organizations.length + result.entityRecognition.people.length + result.entityRecognition.technologies.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Organizations</span>
                <span className="font-medium">{result.entityRecognition.organizations.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">People</span>
                <span className="font-medium">{result.entityRecognition.people.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Technologies</span>
                <span className="font-medium">{result.entityRecognition.technologies.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ Optimization */}
        <Card className="@container/card" data-slot="card">
          <CardHeader>
            <CardDescription>FAQ Optimization</CardDescription>
            <CardTitle className="text-xl font-semibold">
              {result.faqOptimization.questionAnswerPairs}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">FAQ Sections</span>
                <span className="font-medium">{result.faqOptimization.faqSections.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Q&A Pairs</span>
                <span className="font-medium">{result.faqOptimization.questionAnswerPairs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">FAQ Schema</span>
                <Badge variant="outline" className="h-5 text-xs">
                  {result.faqOptimization.faqStructuredData ? "Present" : "Missing"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Freshness */}
        <Card className="@container/card" data-slot="card">
          <CardHeader>
            <CardDescription>Content Freshness</CardDescription>
            <CardTitle className="text-xl font-semibold">
              {result.contentFreshness.freshnessSignals.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Publish Date</span>
                <Badge variant="outline" className="h-5 text-xs">
                  {result.contentFreshness.publishDate ? "Found" : "Missing"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Modified</span>
                <Badge variant="outline" className="h-5 text-xs">
                  {result.contentFreshness.lastModified ? "Found" : "Missing"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Freshness Signals</span>
                <span className="font-medium">{result.contentFreshness.freshnessSignals.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 