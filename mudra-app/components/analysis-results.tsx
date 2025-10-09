/**
 * Analysis Results Display Components
 * Shows AI Visibility, Traffic Metrics, Technical Analysis, and Reports
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Activity, Code, FileText, TrendingUp, TrendingDown, CheckCircle, AlertCircle, Lightbulb } from "lucide-react";

// AI Visibility Metrics Card
export function GeoMetricsCard({ data }: { data: any }) {
  if (!data) {
    return (
      <Card className="bg-dark-grey border-white/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-white/60" />
            <CardTitle className="text-white">AI Visibility</CardTitle>
          </div>
          <CardDescription className="text-white/60">No analysis data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { overallScore, analyses, recommendations } = data;

  return (
    <Card className="bg-dark-grey border-white/10">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-white/60" />
          <CardTitle className="text-white">AI Visibility</CardTitle>
        </div>
        <CardDescription className="text-white/60">
          {new Date(data.timestamp).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-4">
          <div className="text-5xl font-bold text-white mb-2">{overallScore.toFixed(1)}</div>
          <div className="text-white/60 text-sm">Overall Visibility Score</div>
        </div>

        {analyses && analyses.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-white/80">Provider Coverage</div>
            <div className="grid grid-cols-2 gap-2">
              {analyses.map((analysis: any, idx: number) => (
                <div key={idx} className="bg-white/5 rounded-lg p-3">
                  <div className="text-xs text-white/60">{analysis.provider || `Provider ${idx + 1}`}</div>
                  <div className="text-sm font-medium text-white">
                    {analysis.promptTests?.length || 0} tests
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Traffic Metrics Card
export function TrafficMetricsCard({ data }: { data: any }) {
  if (!data) {
    return (
      <Card className="bg-dark-grey border-white/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-white/60" />
            <CardTitle className="text-white">Traffic Metrics</CardTitle>
          </div>
          <CardDescription className="text-white/60">No traffic data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const {
    monthlyVisitors,
    pageViews,
    organicTrafficShare,
    weekOverWeekGrowth,
    monthOverMonthGrowth,
  } = data;

  return (
    <Card className="bg-dark-grey border-white/10">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-white/60" />
          <CardTitle className="text-white">Traffic Metrics</CardTitle>
        </div>
        <CardDescription className="text-white/60">
          {new Date(data.createdAt).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-2xl font-bold text-white">{monthlyVisitors.toLocaleString()}</div>
            <div className="text-xs text-white/60">Monthly Visitors</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-white">{pageViews.toLocaleString()}</div>
            <div className="text-xs text-white/60">Page Views</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-xs text-white/60 mb-1">Organic Traffic Share</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/10 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${organicTrafficShare}%` }}
                />
              </div>
              <div className="text-sm font-medium text-white">{organicTrafficShare}%</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-xs text-white/60 mb-1">Week over Week</div>
              <div className="flex items-center gap-1">
                {weekOverWeekGrowth >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                )}
                <div className={`text-sm font-medium ${weekOverWeekGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {weekOverWeekGrowth >= 0 ? '+' : ''}{weekOverWeekGrowth}%
                </div>
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-xs text-white/60 mb-1">Month over Month</div>
              <div className="flex items-center gap-1">
                {monthOverMonthGrowth >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                )}
                <div className={`text-sm font-medium ${monthOverMonthGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {monthOverMonthGrowth >= 0 ? '+' : ''}{monthOverMonthGrowth}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Technical Structure Card
export function TechStructureCard({ data }: { data: any }) {
  if (!data) {
    return (
      <Card className="bg-dark-grey border-white/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-white/60" />
            <CardTitle className="text-white">Technical Structure</CardTitle>
          </div>
          <CardDescription className="text-white/60">No technical analysis available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const {
    overallScore,
    seoScore,
    performanceScore,
    accessibilityScore,
    metadata,
    recommendations,
  } = data;

  const criticalIssues = metadata?.criticalIssues || [];
  const warnings = metadata?.warnings || [];
  const totalRecommendations = Array.isArray(recommendations) ? recommendations.length : 0;

  return (
    <Card className="bg-dark-grey border-white/10">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Code className="w-5 h-5 text-white/60" />
          <CardTitle className="text-white">Technical Structure</CardTitle>
        </div>
        <CardDescription className="text-white/60">
          {data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'Recent analysis'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-4">
          <div className="text-5xl font-bold text-white mb-2">{overallScore?.toFixed(0) ?? 0}</div>
          <div className="text-white/60 text-sm">Overall Health Score</div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-white">{seoScore?.toFixed(0) ?? 0}</div>
            <div className="text-xs text-white/60 mt-1">SEO</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-white">{performanceScore?.toFixed(0) ?? 0}</div>
            <div className="text-xs text-white/60 mt-1">Performance</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-white">{accessibilityScore?.toFixed(0) ?? 0}</div>
            <div className="text-xs text-white/60 mt-1">Accessibility</div>
          </div>
        </div>

        {criticalIssues.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <div className="text-sm font-medium text-white/80">Critical Issues</div>
            </div>
            <div className="text-xs text-red-400">{criticalIssues.length} issues found</div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <div className="text-sm font-medium text-white/80">Warnings</div>
            </div>
            <div className="text-xs text-yellow-400">{warnings.length} warnings found</div>
          </div>
        )}

        {totalRecommendations > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-blue-400" />
              <div className="text-sm font-medium text-white/80">Recommendations</div>
            </div>
            <div className="text-xs text-blue-400">{totalRecommendations} recommendations available</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Natural Language Report Card
export function ReportCard({ data }: { data: any }) {
  if (!data) {
    return (
      <Card className="bg-dark-grey border-white/10 col-span-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-white/60" />
            <CardTitle className="text-white">Analysis Report</CardTitle>
          </div>
          <CardDescription className="text-white/60">No report generated yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { title, summary, sections, insights, recommendations } = data;

  return (
    <Card className="bg-dark-grey border-white/10 col-span-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-white/60" />
          <CardTitle className="text-white">{title}</CardTitle>
        </div>
        <CardDescription className="text-white/60">
          Generated {new Date(data.generatedAt).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="prose prose-invert max-w-none">
          <p className="text-white/80">{summary}</p>
        </div>

        {sections && sections.length > 0 && (
          <div className="space-y-4">
            {sections.map((section: any, idx: number) => (
              <div key={idx} className="border-l-2 border-white/20 pl-4">
                <h3 className="text-lg font-semibold text-white mb-2">{section.title}</h3>
                <p className="text-sm text-white/70">{section.content}</p>
              </div>
            ))}
          </div>
        )}

        {insights && insights.length > 0 && (
          <div className="bg-white/5 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Key Insights
            </h4>
            <ul className="space-y-2">
              {insights.map((insight: string, idx: number) => (
                <li key={idx} className="text-sm text-white/70">• {insight}</li>
              ))}
            </ul>
          </div>
        )}

        {recommendations && recommendations.length > 0 && (
          <div className="bg-white/5 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-white mb-3">Recommended Actions</h4>
            <ul className="space-y-2">
              {recommendations.map((rec: string, idx: number) => (
                <li key={idx} className="text-sm text-white/70">• {rec}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
