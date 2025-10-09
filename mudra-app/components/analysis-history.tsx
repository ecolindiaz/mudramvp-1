"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Calendar,
  BarChart3,
  Eye,
  RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface AnalysisRun {
  id: string
  overallScore: number
  startedAt: string
  completedAt: string
  status: string
  promptsUsed: string[]
}

interface AnalysisHistoryProps {
  brandProfileId: number
  onSelectRun?: (runId: string) => void
}

export function AnalysisHistory({ brandProfileId, onSelectRun }: AnalysisHistoryProps) {
  const [runs, setRuns] = useState<AnalysisRun[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  useEffect(() => {
    if (brandProfileId) {
      loadHistory()
    }
  }, [brandProfileId])

  const loadHistory = async () => {
    try {
      setLoading(true)
      
      const [runsRes, statsRes] = await Promise.all([
        fetch(`/api/analysis/history?brandProfileId=${brandProfileId}`),
        fetch(`/api/analysis/stats?brandProfileId=${brandProfileId}`)
      ])

      const runsData = await runsRes.json()
      const statsData = await statsRes.json()

      if (runsData.success) {
        setRuns(runsData.runs)
      }

      if (statsData.success) {
        setStats(statsData.stats)
      }
    } catch (error) {
      console.error('Error loading analysis history:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="w-4 h-4 text-green-500" />
    if (trend < 0) return <TrendingDown className="w-4 h-4 text-red-500" />
    return <Minus className="w-4 h-4 text-gray-500" />
  }

  const handleSelectRun = (runId: string) => {
    setSelectedRunId(runId)
    if (onSelectRun) {
      onSelectRun(runId)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading analysis history...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Analyses</p>
                  <p className="text-2xl font-bold">{stats.totalRuns}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Average Score</p>
                  <p className="text-2xl font-bold">{stats.averageScore.toFixed(1)}</p>
                </div>
                <Eye className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Score Trend</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">
                      {stats.scoreTrend > 0 ? '+' : ''}{stats.scoreTrend.toFixed(1)}
                    </p>
                    {getTrendIcon(stats.scoreTrend)}
                  </div>
                </div>
                {stats.scoreTrend > 0 ? (
                  <TrendingUp className="w-8 h-8 text-green-500" />
                ) : stats.scoreTrend < 0 ? (
                  <TrendingDown className="w-8 h-8 text-red-500" />
                ) : (
                  <Minus className="w-8 h-8 text-gray-500" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analysis Runs List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Analysis History</CardTitle>
              <CardDescription>
                View past AI visibility analysis runs
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadHistory}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No analysis runs yet. Run your first analysis to see results here.
            </div>
          ) : (
            <div className="space-y-3">
              {runs.map((run, index) => {
                const isSelected = selectedRunId === run.id
                const prevScore = runs[index + 1]?.overallScore
                const scoreDiff = prevScore ? run.overallScore - prevScore : 0

                return (
                  <div
                    key={run.id}
                    className={cn(
                      "flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all",
                      isSelected 
                        ? "bg-primary/10 border-primary" 
                        : "hover:bg-accent/50"
                    )}
                    onClick={() => handleSelectRun(run.id)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex flex-col items-center">
                        <div className="text-3xl font-bold text-primary">
                          {run.overallScore.toFixed(0)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Score
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {format(new Date(run.completedAt), 'MMM dd, yyyy HH:mm')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {run.promptsUsed.length} prompts
                          </Badge>
                          {index === 0 && (
                            <Badge className="text-xs bg-blue-500">Latest</Badge>
                          )}
                        </div>
                      </div>

                      {scoreDiff !== 0 && (
                        <div className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded",
                          scoreDiff > 0 
                            ? "bg-green-500/10 text-green-500"
                            : "bg-red-500/10 text-red-500"
                        )}>
                          {getTrendIcon(scoreDiff)}
                          <span className="text-sm font-medium">
                            {scoreDiff > 0 ? '+' : ''}{scoreDiff.toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
