/**
 * AI Referral Traffic KPI Component
 * 
 * Displays AI-referred traffic metrics with month-over-month delta
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, Bot, Brain, Sparkles, MessageSquare } from 'lucide-react';

interface AIReferralData {
  monthly: {
    current: {
      totalVisits: number;
      chatgptVisits: number;
      perplexityVisits: number;
      geminiVisits: number;
      claudeVisits: number;
      otherAIVisits: number;
      month: string;
    };
    previous: {
      totalVisits: number;
      month: string;
    };
    delta: {
      value: number;
      isPositive: boolean;
      percentage: string;
    };
  };
  stats: {
    total: number;
    byPlatform: Record<string, number>;
  };
}

const AI_PLATFORMS = {
  chatgpt: { name: 'ChatGPT', icon: MessageSquare, color: 'text-emerald-600' },
  perplexity: { name: 'Perplexity', icon: Sparkles, color: 'text-blue-600' },
  gemini: { name: 'Gemini', icon: Brain, color: 'text-purple-600' },
  claude: { name: 'Claude', icon: Bot, color: 'text-orange-600' }
};

export default function AIReferralTrafficKPI() {
  const [data, setData] = useState<AIReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAIReferralData();
  }, []);

  async function fetchAIReferralData() {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/ai-referrals?timeRange=current_month');
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error?.message || 'Failed to load data');
      }
    } catch (err) {
      setError('Failed to fetch AI referral data');
      console.error('[AIReferralTrafficKPI]', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card className="border-0">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-0">
        <CardHeader>
          <CardTitle>AI Referred Traffic</CardTitle>
          <CardDescription>Traffic from AI platforms</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {error || 'No data available'}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { monthly, stats } = data;
  const totalVisits = monthly.current.totalVisits;
  const delta = monthly.delta;

  return (
    <Card className="border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>AI Referred Traffic</CardTitle>
            <CardDescription>Visitors from AI platforms this month</CardDescription>
          </div>
          {delta.value !== 0 && (
            <Badge variant={delta.isPositive ? 'default' : 'destructive'} className="flex items-center gap-1">
              {delta.isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {delta.percentage}% vs last month
            </Badge>
          )}
          {delta.value === 0 && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Minus className="h-3 w-3" />
              No change
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Visits */}
        <div>
          <div className="text-4xl font-bold">{totalVisits.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground mt-1">
            Total AI referrals
          </div>
        </div>

        {/* Platform Breakdown */}
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(AI_PLATFORMS).map(([key, platform]) => {
            const Icon = platform.icon;
            const visits = monthly.current[`${key}Visits` as keyof typeof monthly.current] as number || 0;
            
            return (
              <div
                key={key}
                className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${platform.color}`} />
                  <span className="font-medium text-sm">{platform.name}</span>
                </div>
                <div className="text-2xl font-bold">{visits.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {totalVisits > 0 ? ((visits / totalVisits) * 100).toFixed(1) : 0}% of total
                </div>
              </div>
            );
          })}
        </div>

        {/* Previous Month Comparison */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Previous month</span>
            <span className="font-medium">{monthly.previous.totalVisits.toLocaleString()} visits</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
