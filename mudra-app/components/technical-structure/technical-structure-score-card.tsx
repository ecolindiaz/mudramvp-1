'use client';

/**
 * Technical Structure Score Card
 * 
 * Displays the site-wide technical structure score with five dimensions.
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  Code2, 
  Quote, 
  Globe, 
  MessageCircleQuestion,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  CheckCircle2,
  Info
} from 'lucide-react';

interface DimensionScore {
  score: number;
  grade: {
    grade: string;
    label: string;
    color: string;
  };
}

interface SiteScore {
  domain: string;
  overall: {
    score: number;
    grade: string;
    label: string;
  };
  dimensions: {
    structuredData: DimensionScore;
    semanticHtml: DimensionScore;
    citability: DimensionScore;
    accessibility: DimensionScore;
    answerEngine: DimensionScore;
  };
  stats: {
    totalPages: number;
    pagesScraped: number;
    pagesScored: number;
    pagesWithIssues: number;
  };
  topIssues: Array<{
    code: string;
    title: string;
    dimension: string;
    severity: string;
    affectedPages: number;
    percentage: number;
  }>;
  comparison?: {
    previousScore: number;
    change: number;
    improved: boolean;
  } | null;
  computedAt: string;
}

interface TechnicalStructureScoreCardProps {
  siteScore: SiteScore;
  showDetails?: boolean;
}

const dimensionConfig = {
  structuredData: {
    icon: Database,
    name: 'Structured Data',
    description: 'JSON-LD and Schema.org coverage',
    weight: '25%',
  },
  semanticHtml: {
    icon: Code2,
    name: 'Semantic HTML',
    description: 'Proper use of HTML5 elements',
    weight: '20%',
  },
  citability: {
    icon: Quote,
    name: 'Content Citability',
    description: 'How easily AI can cite this content',
    weight: '25%',
  },
  accessibility: {
    icon: Globe,
    name: 'Technical Accessibility',
    description: 'Meta tags, OG, and technical signals',
    weight: '15%',
  },
  answerEngine: {
    icon: MessageCircleQuestion,
    name: 'Answer Engine Ready',
    description: 'FAQ, HowTo, and direct answers',
    weight: '15%',
  },
};

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-500';
  if (score >= 75) return 'text-lime-500';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
}

function getProgressColor(score: number): string {
  if (score >= 90) return 'bg-green-500';
  if (score >= 75) return 'bg-lime-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

function getGradeBadgeVariant(grade: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (grade === 'A' || grade === 'B') return 'default';
  if (grade === 'C') return 'secondary';
  return 'destructive';
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'critical':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'major':
      return <AlertCircle className="h-4 w-4 text-orange-500" />;
    case 'minor':
      return <Info className="h-4 w-4 text-yellow-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
}

export function TechnicalStructureScoreCard({ 
  siteScore, 
  showDetails = true 
}: TechnicalStructureScoreCardProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Technical Structure Score</CardTitle>
            <CardDescription className="mt-1">
              {siteScore.domain} • {siteScore.stats.pagesScored} pages analyzed
            </CardDescription>
          </div>
          
          {/* Overall Score */}
          <div className="text-center">
            <div className={`text-4xl font-bold ${getScoreColor(siteScore.overall.score)}`}>
              {siteScore.overall.score}
            </div>
            <Badge variant={getGradeBadgeVariant(siteScore.overall.grade)} className="mt-1">
              {siteScore.overall.grade} - {siteScore.overall.label}
            </Badge>
            
            {/* Score change indicator */}
            {siteScore.comparison && (
              <div className="flex items-center justify-center gap-1 mt-2 text-sm">
                {siteScore.comparison.improved ? (
                  <>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-green-500">+{siteScore.comparison.change}</span>
                  </>
                ) : siteScore.comparison.change < 0 ? (
                  <>
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <span className="text-red-500">{siteScore.comparison.change}</span>
                  </>
                ) : (
                  <>
                    <Minus className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-500">No change</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Dimension Scores */}
        <div className="grid gap-4">
          {Object.entries(dimensionConfig).map(([key, config]) => {
            const dimension = siteScore.dimensions[key as keyof typeof siteScore.dimensions];
            const Icon = config.icon;
            
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{config.name}</span>
                    <span className="text-xs text-muted-foreground">({config.weight})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${getScoreColor(dimension.score)}`}>
                      {dimension.score}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {dimension.grade.grade}
                    </Badge>
                  </div>
                </div>
                <div className="relative">
                  <Progress 
                    value={dimension.score} 
                    className="h-2"
                  />
                  <div 
                    className={`absolute top-0 left-0 h-2 rounded-full ${getProgressColor(dimension.score)}`}
                    style={{ width: `${dimension.score}%` }}
                  />
                </div>
                {showDetails && (
                  <p className="text-xs text-muted-foreground">{config.description}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold">{siteScore.stats.totalPages}</div>
            <div className="text-xs text-muted-foreground">Total Pages</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{siteScore.stats.pagesScored}</div>
            <div className="text-xs text-muted-foreground">Analyzed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">
              {siteScore.stats.pagesScored - siteScore.stats.pagesWithIssues}
            </div>
            <div className="text-xs text-muted-foreground">Passing</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-500">
              {siteScore.stats.pagesWithIssues}
            </div>
            <div className="text-xs text-muted-foreground">With Issues</div>
          </div>
        </div>

        {/* Top Issues */}
        {showDetails && siteScore.topIssues.length > 0 && (
          <div className="pt-4 border-t">
            <h4 className="font-semibold text-sm mb-3">Top Issues to Address</h4>
            <div className="space-y-2">
              {siteScore.topIssues.slice(0, 5).map((issue, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    {getSeverityIcon(issue.severity)}
                    <span className="text-sm">{issue.title}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {issue.affectedPages} pages ({issue.percentage}%)
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Last updated */}
        <div className="text-xs text-muted-foreground text-right pt-2">
          Last analyzed: {new Date(siteScore.computedAt).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

export default TechnicalStructureScoreCard;
