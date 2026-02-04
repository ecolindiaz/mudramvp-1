"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Loader2
} from 'lucide-react'

interface SiteScore {
  overallScore: number;
  grade: { grade: string; label: string; color: string };
  dimensions: {
    structuredData: number;
    semanticHtml: number;
    citability: number;
    accessibility: number;
    answerEngine: number;
  };
  totalPages: number;
  avgIssuesPerPage: number;
  lastScrapedAt: string;
}

interface PageScore {
  pageUrl: string;
  pageType: string | null;
  overallScore: number;
  grade: { grade: string; label: string; color: string };
  dimensions: {
    structuredData: number;
    semanticHtml: number;
    citability: number;
    accessibility: number;
    answerEngine: number;
  };
  issueCount: number;
  scoredAt: string;
}

/**
 * Technical Structure Score Card Component
 * Displays overall site score and dimension breakdown
 */
export function TechnicalStructureScoreCard({ siteScore }: { siteScore: SiteScore }) {
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-400'
      case 'B': return 'text-blue-400'
      case 'C': return 'text-yellow-400'
      case 'D': return 'text-orange-400'
      case 'F': return 'text-red-400'
      default: return 'text-white/60'
    }
  }

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white">Technical Structure Score</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center">
            <div className={`text-6xl font-bold ${getGradeColor(siteScore.grade.grade)}`}>
              {siteScore.overallScore}
            </div>
            <div className="text-xl text-white/60 mt-2">{siteScore.grade.label}</div>
          </div>

          <div className="space-y-2 pt-4">
            <DimensionBar label="Structured Data" score={siteScore.dimensions.structuredData} />
            <DimensionBar label="Semantic HTML" score={siteScore.dimensions.semanticHtml} />
            <DimensionBar label="Citability" score={siteScore.dimensions.citability} />
            <DimensionBar label="Accessibility" score={siteScore.dimensions.accessibility} />
            <DimensionBar label="Answer Engine" score={siteScore.dimensions.answerEngine} />
          </div>

          <div className="flex justify-between text-sm text-white/60 pt-4 border-t border-white/10">
            <span>{siteScore.totalPages} pages analyzed</span>
            <span>Avg {siteScore.avgIssuesPerPage.toFixed(1)} issues/page</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DimensionBar({ label, score }: { label: string; score: number }) {
  const getBarColor = (score: number) => {
    if (score >= 90) return 'bg-green-500'
    if (score >= 80) return 'bg-blue-500'
    if (score >= 70) return 'bg-yellow-500'
    if (score >= 60) return 'bg-orange-500'
    return 'bg-red-500'
  }

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-white/80">{label}</span>
        <span className="text-white/60">{score}%</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div 
          className={`h-full ${getBarColor(score)} transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Page Scores Table Component
 * Lists all pages with their scores and allows filtering/sorting
 */
export function PageScoresTable({
  pages,
  total,
  limit,
  offset,
  onPageChange,
  onSortChange,
  onPageTypeFilter,
  onPageClick,
  currentSort,
  currentPageType,
}: {
  pages: PageScore[]
  total: number
  limit: number
  offset: number
  onPageChange: (offset: number) => void
  onSortChange: (sort: 'score_asc' | 'score_desc' | 'url') => void
  onPageTypeFilter: (type: string | undefined) => void
  onPageClick: (url: string) => void
  currentSort: 'score_asc' | 'score_desc' | 'url'
  currentPageType: string | undefined
}) {
  const currentPage = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(total / limit)

  const getGradeBadge = (grade: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'A': 'default',
      'B': 'secondary',
      'C': 'outline',
      'D': 'outline',
      'F': 'destructive',
    }
    return variants[grade] || 'outline'
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={currentSort === 'score_desc' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSortChange('score_desc')}
        >
          Highest Score
        </Button>
        <Button
          variant={currentSort === 'score_asc' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSortChange('score_asc')}
        >
          Lowest Score
        </Button>
        <Button
          variant={currentSort === 'url' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSortChange('url')}
        >
          URL
        </Button>
      </div>

      <div className="rounded-md border border-white/10">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-white/5">
              <TableHead className="text-white/80">Page URL</TableHead>
              <TableHead className="text-white/80">Type</TableHead>
              <TableHead className="text-white/80 text-right">Score</TableHead>
              <TableHead className="text-white/80 text-right">Issues</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.map((page) => (
              <TableRow
                key={page.pageUrl}
                className="border-white/10 hover:bg-white/5 cursor-pointer"
                onClick={() => onPageClick(page.pageUrl)}
              >
                <TableCell className="text-white/80 font-mono text-xs max-w-md truncate">
                  {page.pageUrl}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {page.pageType || 'unknown'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant={getGradeBadge(page.grade.grade)}>
                    {page.overallScore} ({page.grade.grade})
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-white/60">
                  {page.issueCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-white/60">
            Page {currentPage} of {totalPages} ({total} total)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(offset - limit)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(offset + limit)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Page Detail Panel Component
 * Shows detailed breakdown for a selected page
 */
export function PageDetailPanel({
  page,
  onClose,
}: {
  page: any
  onClose: () => void
}) {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white text-lg">Page Details</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-sm text-white/60 mb-1">URL</div>
          <div className="text-white/80 font-mono text-xs break-all">
            {page.pageUrl}
          </div>
        </div>

        <div>
          <div className="text-sm text-white/60 mb-2">Dimension Scores</div>
          <div className="space-y-2">
            {page.dimensions && (
              <>
                <DimensionBar label="Structured Data" score={page.dimensions.structuredData.score} />
                <DimensionBar label="Semantic HTML" score={page.dimensions.semanticHtml.score} />
                <DimensionBar label="Citability" score={page.dimensions.citability.score} />
                <DimensionBar label="Accessibility" score={page.dimensions.accessibility.score} />
                <DimensionBar label="Answer Engine" score={page.dimensions.answerEngine.score} />
              </>
            )}
          </div>
        </div>

        {page.issues && page.issues.length > 0 && (
          <div>
            <div className="text-sm text-white/60 mb-2">Issues ({page.issues.length})</div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {page.issues.map((issue: any, idx: number) => (
                <div key={idx} className="flex gap-2 text-sm p-2 bg-white/5 rounded">
                  <AlertCircle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                  <span className="text-white/80">{issue.message || issue}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {page.recommendations && page.recommendations.length > 0 && (
          <div>
            <div className="text-sm text-white/60 mb-2">Recommendations</div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {page.recommendations.map((rec: any, idx: number) => (
                <div key={idx} className="flex gap-2 text-sm p-2 bg-white/5 rounded">
                  <CheckCircle className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                  <span className="text-white/80">{rec.message || rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Scrape Job Trigger Component
 * Initiates a new scraping job
 */
export function ScrapeJobTrigger({
  brandProfileId,
  websiteUrl,
  onJobComplete,
}: {
  brandProfileId: number
  websiteUrl: string
  onJobComplete: () => void
}) {
  const [isStarting, setIsStarting] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) return

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/site-scrape/status?jobId=${jobId}`)
        const data = await res.json()
        
        if (data.success && data.data) {
          setJobStatus(data.data)
          
          if (data.data.status === 'completed') {
            clearInterval(pollInterval)
            onJobComplete()
            setJobId(null)
          } else if (data.data.status === 'failed') {
            clearInterval(pollInterval)
            setError('Scrape job failed')
            setJobId(null)
          }
        }
      } catch (err) {
        console.error('Failed to poll job status:', err)
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [jobId, onJobComplete])

  const handleStartScrape = async () => {
    setIsStarting(true)
    setError(null)
    
    try {
      const res = await fetch('/api/site-scrape/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId,
          websiteUrl,
        }),
      })
      
      const data = await res.json()
      
      if (data.success && data.data?.jobId) {
        setJobId(data.data.jobId)
      } else {
        setError(data.error?.message || 'Failed to start scrape')
      }
    } catch (err) {
      setError('Failed to start scrape job')
      console.error(err)
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white">Site Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-white/80">
          Analyze your entire website for Answer Engine Optimization opportunities.
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400 flex gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {jobStatus && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded text-sm text-blue-400">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-medium">{jobStatus.status}</span>
            </div>
            {jobStatus.progress && (
              <div className="space-y-1">
                <div className="text-xs text-white/60">
                  {jobStatus.progress.pagesScraped} / {jobStatus.progress.totalPages} pages
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all"
                    style={{ 
                      width: `${(jobStatus.progress.pagesScraped / jobStatus.progress.totalPages) * 100}%` 
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <Button 
          onClick={handleStartScrape}
          disabled={isStarting || !!jobId}
          className="w-full"
        >
          {isStarting || jobId ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {jobId ? 'Scanning...' : 'Starting...'}
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Site Analysis
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
