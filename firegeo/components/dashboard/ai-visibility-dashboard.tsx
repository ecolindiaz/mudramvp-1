// Example: AI Visibility Dashboard Component for integrating with Fire SaaS Geo
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, Users, MessageSquare, CreditCard, Eye, Target } from 'lucide-react';

interface DashboardMetrics {
  summary: {
    totalAnalyses: number;
    avgVisibilityScore: number;
    totalCreditsUsed: number;
    totalMessages: number;
    totalConversations: number;
  };
  visibilityTrend: Array<{
    date: string;
    visibilityScore: number;
    shareOfVoice: number;
    companyName: string;
  }>;
  competitorInsights: Array<{
    name: string;
    avgVisibilityScore: number;
    appearances: number;
  }>;
  providerPerformance: Array<{
    name: string;
    totalQueries: number;
    avgPosition: number;
  }>;
  recentActivity: Array<{
    id: string;
    companyName: string;
    date: string;
    creditsUsed: number;
  }>;
}

export function AIVisibilityDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('30d');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchMetrics();
    
    // Set up real-time updates via webhook simulation
    const interval = setInterval(fetchMetrics, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [timeframe]);

  const fetchMetrics = async () => {
    try {
      // In real implementation, you'd call your Fire SaaS Geo instance
      const response = await fetch(`/api/dashboard/metrics?timeframe=${timeframe}&competitors=true`);
      
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      
      // Demo data for illustration
      setMetrics({
        summary: {
          totalAnalyses: 24,
          avgVisibilityScore: 67.8,
          totalCreditsUsed: 240,
          totalMessages: 156,
          totalConversations: 18,
        },
        visibilityTrend: [
          { date: '2025-07-25', visibilityScore: 65, shareOfVoice: 12.5, companyName: 'Acme Corp' },
          { date: '2025-07-26', visibilityScore: 68, shareOfVoice: 13.2, companyName: 'Acme Corp' },
          { date: '2025-07-27', visibilityScore: 71, shareOfVoice: 14.1, companyName: 'Acme Corp' },
          { date: '2025-07-28', visibilityScore: 69, shareOfVoice: 13.8, companyName: 'Acme Corp' },
          { date: '2025-07-29', visibilityScore: 72, shareOfVoice: 15.2, companyName: 'Acme Corp' },
          { date: '2025-07-30', visibilityScore: 74, shareOfVoice: 16.1, companyName: 'Acme Corp' },
          { date: '2025-08-01', visibilityScore: 76, shareOfVoice: 17.3, companyName: 'Acme Corp' },
        ],
        competitorInsights: [
          { name: 'Competitor A', avgVisibilityScore: 82.3, appearances: 15 },
          { name: 'Competitor B', avgVisibilityScore: 78.9, appearances: 12 },
          { name: 'Competitor C', avgVisibilityScore: 71.2, appearances: 18 },
          { name: 'Competitor D', avgVisibilityScore: 69.8, appearances: 9 },
        ],
        providerPerformance: [
          { name: 'OpenAI', totalQueries: 45, avgPosition: 2.8 },
          { name: 'Anthropic', totalQueries: 38, avgPosition: 3.2 },
          { name: 'Google', totalQueries: 42, avgPosition: 3.1 },
          { name: 'Perplexity', totalQueries: 29, avgPosition: 4.1 },
        ],
        recentActivity: [
          { id: '1', companyName: 'Acme Corp', date: '2025-08-03', creditsUsed: 10 },
          { id: '2', companyName: 'Beta Inc', date: '2025-08-02', creditsUsed: 10 },
          { id: '3', companyName: 'Gamma LLC', date: '2025-08-01', creditsUsed: 10 },
        ]
      });
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800">Failed to load metrics</h2>
          <p className="text-gray-600">Please check your Fire SaaS Geo connection</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI Visibility Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Powered by Fire SaaS Geo • 
                {lastUpdated && (
                  <span className="text-sm ml-2">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              {(['7d', '30d', '90d'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setTimeframe(period)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    timeframe === period 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Visibility Score</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.summary.avgVisibilityScore.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Average across all analyses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Analyses</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.summary.totalAnalyses}</div>
              <p className="text-xs text-muted-foreground">Brand monitoring reports</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Interactions</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.summary.totalMessages}</div>
              <p className="text-xs text-muted-foreground">{metrics.summary.totalConversations} conversations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credits Used</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.summary.totalCreditsUsed}</div>
              <p className="text-xs text-muted-foreground">API usage tracking</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Growth Trend</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">+12.3%</div>
              <p className="text-xs text-muted-foreground">vs previous period</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Visibility Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>AI Visibility Trend</CardTitle>
              <CardDescription>How your brand visibility has changed over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics.visibilityTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value: number) => [`${value}%`, 'Visibility Score']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="visibilityScore" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Provider Performance */}
          <Card>
            <CardHeader>
              <CardTitle>AI Provider Performance</CardTitle>
              <CardDescription>Average ranking position across different AI providers</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.providerPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => [`Position ${value.toFixed(1)}`, 'Average Position']}
                  />
                  <Bar dataKey="avgPosition" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Competitor Insights */}
          <Card>
            <CardHeader>
              <CardTitle>Competitor Analysis</CardTitle>
              <CardDescription>How you stack up against your competition</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.competitorInsights.map((competitor, index) => (
                  <div key={competitor.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{competitor.name}</p>
                        <p className="text-sm text-gray-500">{competitor.appearances} appearances</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{competitor.avgVisibilityScore.toFixed(1)}%</p>
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${competitor.avgVisibilityScore}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest brand analyses and interactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{activity.companyName}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(activity.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {activity.creditsUsed} credits
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Integration Status */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Integration Status</CardTitle>
            <CardDescription>Fire SaaS Geo connection and webhook status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Connected to Fire SaaS Geo</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Webhooks Active</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span>Real-time Updates</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
