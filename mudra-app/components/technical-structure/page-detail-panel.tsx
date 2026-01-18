'use client';

/**
 * Page Detail Panel
 * 
 * Displays detailed breakdown of a single page's score with recommendations.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Code2, 
  Layout, 
  Quote, 
  Accessibility, 
  MessageSquareText,
  ExternalLink,
  AlertTriangle,
  Info,
  CheckCircle2,
  Lightbulb,
  Copy,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DimensionScore {
  score: number;
  maxScore: number;
  normalized: number;
}

interface ScoringIssue {
  dimension: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  element?: string;
}

interface ScoringRecommendation {
  dimension: string;
  priority: 'high' | 'medium' | 'low';
  recommendation: string;
  impact: string;
}

interface PageDetailData {
  pageUrl: string;
  pageType: string | null;
  overallScore: number;
  grade: {
    grade: string;
    label: string;
    color: string;
  };
  dimensions: {
    structuredData: DimensionScore;
    semanticHtml: DimensionScore;
    citability: DimensionScore;
    accessibility: DimensionScore;
    answerEngine: DimensionScore;
  };
  issues: ScoringIssue[];
  recommendations: ScoringRecommendation[];
  metadata: {
    title?: string;
    description?: string;
    canonical?: string;
  };
  schemaTypes: string[];
  hasFaq: boolean;
  scoredAt: string;
}

interface PageDetailPanelProps {
  page: PageDetailData;
  onClose?: () => void;
}

const DIMENSION_CONFIG = {
  structuredData: {
    label: 'Structured Data',
    icon: Code2,
    weight: 25,
    description: 'JSON-LD schema markup and validation',
  },
  semanticHtml: {
    label: 'Semantic HTML',
    icon: Layout,
    weight: 20,
    description: 'Proper use of HTML5 semantic elements and headings',
  },
  citability: {
    label: 'Content Citability',
    icon: Quote,
    weight: 25,
    description: 'Metadata, canonical URLs, and attribution',
  },
  accessibility: {
    label: 'Technical Accessibility',
    icon: Accessibility,
    weight: 15,
    description: 'ARIA labels, meta tags, and internationalization',
  },
  answerEngine: {
    label: 'Answer Engine Readiness',
    icon: MessageSquareText,
    weight: 15,
    description: 'FAQ schema, HowTo markup, and answer formatting',
  },
};

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 75) return 'text-lime-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

function getScoreBg(score: number): string {
  if (score >= 90) return 'bg-green-500';
  if (score >= 75) return 'bg-lime-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

function getSeverityIcon(severity: 'critical' | 'warning' | 'info') {
  switch (severity) {
    case 'critical':
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    case 'info':
      return <Info className="h-4 w-4 text-blue-600" />;
  }
}

function getPriorityColor(priority: 'high' | 'medium' | 'low'): string {
  switch (priority) {
    case 'high': return 'text-red-600 bg-red-50';
    case 'medium': return 'text-yellow-600 bg-yellow-50';
    case 'low': return 'text-blue-600 bg-blue-50';
  }
}

export function PageDetailPanel({ page, onClose }: PageDetailPanelProps) {
  const handleCopyUrl = () => {
    navigator.clipboard.writeText(page.pageUrl);
  };

  return (
    <Card className="h-full overflow-auto">
      <CardHeader className="sticky top-0 bg-card z-10 border-b">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="capitalize">
                {page.pageType || 'other'}
              </Badge>
              <Badge 
                variant={page.grade.grade <= 'B' ? 'default' : 'secondary'}
                className="font-bold"
              >
                Grade {page.grade.grade}
              </Badge>
            </div>
            <CardTitle className="text-lg truncate" title={page.pageUrl}>
              {page.pageUrl}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2"
                onClick={handleCopyUrl}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </Button>
              <a 
                href={page.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                Visit <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Overall Score */}
        <div className="flex items-center gap-4 mt-4 p-4 bg-muted rounded-lg">
          <div className="text-center">
            <div className={`text-4xl font-bold ${getScoreColor(page.overallScore)}`}>
              {page.overallScore}
            </div>
            <div className="text-xs text-muted-foreground">Overall Score</div>
          </div>
          <div className="flex-1">
            <Progress 
              value={page.overallScore} 
              className="h-3"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* Metadata Summary */}
        {page.metadata.title && (
          <div className="space-y-2">
            <h3 className="font-medium text-sm">Page Metadata</h3>
            <div className="bg-muted rounded-lg p-3 space-y-2 text-sm">
              {page.metadata.title && (
                <div>
                  <span className="text-muted-foreground">Title:</span>{' '}
                  <span className="font-medium">{page.metadata.title}</span>
                </div>
              )}
              {page.metadata.description && (
                <div>
                  <span className="text-muted-foreground">Description:</span>{' '}
                  <span>{page.metadata.description}</span>
                </div>
              )}
              {page.metadata.canonical && (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span className="text-muted-foreground">Canonical URL set</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Schema Types */}
        {page.schemaTypes.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium text-sm">Schema Types Detected</h3>
            <div className="flex flex-wrap gap-2">
              {page.schemaTypes.map((type, idx) => (
                <Badge key={idx} variant="secondary" className="font-mono text-xs">
                  {type}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {page.hasFaq && (
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg text-green-700 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            FAQ content detected on this page
          </div>
        )}

        <Separator />

        {/* Dimension Breakdown */}
        <div className="space-y-4">
          <h3 className="font-medium">Score Breakdown by Dimension</h3>
          
          {(Object.entries(DIMENSION_CONFIG) as [keyof typeof DIMENSION_CONFIG, typeof DIMENSION_CONFIG[keyof typeof DIMENSION_CONFIG]][]).map(([key, config]) => {
            const dimension = page.dimensions[key];
            const Icon = config.icon;
            
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{config.label}</span>
                    <span className="text-xs text-muted-foreground">({config.weight}% weight)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${getScoreColor(dimension.normalized)}`}>
                      {dimension.normalized}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({dimension.score}/{dimension.maxScore})
                    </span>
                  </div>
                </div>
                <Progress 
                  value={dimension.normalized} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">{config.description}</p>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Issues */}
        {page.issues.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              Issues ({page.issues.length})
            </h3>
            <div className="space-y-2">
              {page.issues.map((issue, idx) => (
                <div 
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-muted rounded-lg text-sm"
                >
                  {getSeverityIcon(issue.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs capitalize">
                        {issue.dimension}
                      </Badge>
                      <Badge 
                        variant={issue.severity === 'critical' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {issue.severity}
                      </Badge>
                    </div>
                    <p>{issue.message}</p>
                    {issue.element && (
                      <code className="text-xs bg-background px-1 py-0.5 rounded mt-1 block truncate">
                        {issue.element}
                      </code>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {page.recommendations.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-600" />
              Recommendations ({page.recommendations.length})
            </h3>
            <div className="space-y-2">
              {page.recommendations.map((rec, idx) => (
                <div 
                  key={idx}
                  className="p-3 bg-muted rounded-lg text-sm space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {rec.dimension}
                    </Badge>
                    <Badge className={`text-xs ${getPriorityColor(rec.priority)}`}>
                      {rec.priority} priority
                    </Badge>
                  </div>
                  <p className="font-medium">{rec.recommendation}</p>
                  <p className="text-muted-foreground text-xs">
                    Impact: {rec.impact}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {page.issues.length === 0 && page.recommendations.length === 0 && (
          <div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            <div>
              <div className="font-medium">Great job!</div>
              <div className="text-sm">No issues or recommendations for this page.</div>
            </div>
          </div>
        )}

        {/* Scored At */}
        <div className="text-xs text-muted-foreground text-center pt-4 border-t">
          Last scored: {new Date(page.scoredAt).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

export default PageDetailPanel;
