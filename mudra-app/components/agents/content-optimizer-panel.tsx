'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'react-hot-toast'
import { Loader2, CheckCircle2, XCircle, ExternalLink, Sparkles } from 'lucide-react'

interface OptimizationResult {
  url: string
  originalScore: number
  improvements: Array<{
    type: string
    description: string
    impact: string
  }>
  prUrl?: string
  error?: string
}

interface ExecutionHistory {
  id: number
  status: string
  createdAt: string
  output?: {
    optimizedPages?: OptimizationResult[]
    totalPages?: number
    successfulOptimizations?: number
  }
}

export function ContentOptimizerPanel({ brandProfileId }: { brandProfileId: number }) {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<OptimizationResult[]>([])
  const [history, setHistory] = useState<ExecutionHistory[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const runOptimization = async (maxPages: number = 10) => {
    setIsRunning(true)
    setResults([])

    try {
      const response = await fetch('/api/agents/content-optimizer/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId,
          input: { maxPages },
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Optimization failed')
      }

      const optimizedPages = data.data?.optimizedPages || []
      setResults(optimizedPages)

      if (optimizedPages.length === 0) {
        toast('All pages are already optimized! 🎉', { icon: '✅' })
      } else {
        const successCount = optimizedPages.filter((p: OptimizationResult) => p.prUrl).length
        toast.success(`Created ${successCount} optimization PRs!`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Optimization failed')
    } finally {
      setIsRunning(false)
    }
  }

  const loadHistory = async () => {
    try {
      const response = await fetch(`/api/agents/content-optimizer/history?brandProfileId=${brandProfileId}`)
      const data = await response.json()
      
      if (data.success) {
        setHistory(data.data || [])
        setShowHistory(true)
      }
    } catch (error) {
      toast.error('Failed to load history')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                Content Optimizer Agent
              </CardTitle>
              <CardDescription className="mt-2">
                Automatically identify low-scoring pages and generate optimization PRs
              </CardDescription>
            </div>
            <Badge variant="secondary">Agent 1</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              onClick={() => runOptimization(10)}
              disabled={isRunning}
              size="lg"
              className="flex-1"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Optimize Top 10 Pages
                </>
              )}
            </Button>
            <Button
              onClick={() => runOptimization(50)}
              disabled={isRunning}
              size="lg"
              variant="outline"
              className="flex-1"
            >
              Optimize Top 50 Pages
            </Button>
          </div>

          <Button
            onClick={loadHistory}
            variant="ghost"
            className="w-full"
          >
            View Execution History
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Optimization Results</CardTitle>
            <CardDescription>
              {results.filter(r => r.prUrl).length} of {results.length} pages optimized successfully
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {result.prUrl ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <span className="font-medium">{result.url}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Original GEO Score: {result.originalScore}%
                      </p>
                    </div>
                    {result.prUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a href={result.prUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-3 w-3" />
                          View PR
                        </a>
                      </Button>
                    )}
                  </div>

                  {result.error && (
                    <p className="text-sm text-red-500">{result.error}</p>
                  )}

                  {result.improvements.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Improvements:</p>
                      <div className="flex flex-wrap gap-2">
                        {result.improvements.map((imp, impIdx) => (
                          <Badge
                            key={impIdx}
                            variant={
                              imp.impact === 'high'
                                ? 'default'
                                : imp.impact === 'medium'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {imp.description}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {showHistory && (
        <Card>
          <CardHeader>
            <CardTitle>Execution History</CardTitle>
            <CardDescription>Past optimization runs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No optimization history yet
                </p>
              ) : (
                history.map((exec) => (
                  <div
                    key={exec.id}
                    className="border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <Badge
                        variant={
                          exec.status === 'completed'
                            ? 'default'
                            : exec.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {exec.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(exec.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {exec.output && (
                      <p className="text-sm">
                        {exec.output.successfulOptimizations} of {exec.output.totalPages} pages optimized
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
