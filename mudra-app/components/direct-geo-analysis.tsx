'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface DirectGEOResult {
  brandName: string;
  overallScore: number;
  analyses: ProviderAnalysis[];
  competitorComparison: CompetitorAnalysis[];
  recommendations: string[];
  timestamp: Date;
}

interface ProviderAnalysis {
  provider: string;
  promptTests: PromptTest[];
  brandVisibilityScore: number;
  averagePosition: number;
  mentionRate: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

interface PromptTest {
  prompt: string;
  response: string;
  brandMentioned: boolean;
  brandPosition?: number;
  competitors: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
}

interface CompetitorAnalysis {
  name: string;
  mentionCount: number;
  averagePosition: number;
  shareOfVoice: number;
}

export default function DirectGEOAnalysis() {
  const [formData, setFormData] = useState({
    brandName: '',
    website: '',
    industry: '',
    description: '',
    competitors: '',
  });
  const [results, setResults] = useState<DirectGEOResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/geo/direct-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          competitors: formData.competitors.split(',').map(c => c.trim()).filter(Boolean),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setResults({
        ...data.data,
        timestamp: data.data?.timestamp ? new Date(data.data.timestamp) : new Date(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-800';
      case 'negative': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 60) return 'text-green-600';
    if (score >= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Direct GEO Analysis
        </h1>
        <p className="text-gray-600">
          Test your brand's visibility across AI models without website scraping.
          This directly prompts OpenAI, Anthropic, and Google models to see how they rank your brand.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Input Form */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Configuration</CardTitle>
              <CardDescription>
                Enter your brand details for GEO testing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Brand Name *
                  </label>
                  <Input
                    value={formData.brandName}
                    onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                    placeholder="e.g., YourCompany"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Website (optional)
                  </label>
                  <Input
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://yourcompany.com"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Industry
                  </label>
                  <Input
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    placeholder="e.g., SaaS, E-commerce, Technology"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Description
                  </label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of what your company does..."
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Competitors (comma-separated)
                  </label>
                  <Textarea
                    value={formData.competitors}
                    onChange={(e) => setFormData({ ...formData, competitors: e.target.value })}
                    placeholder="Competitor1, Competitor2, Competitor3"
                    rows={2}
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    'Run Analysis'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-2">
          {error && (
            <Card className="mb-6 border-red-200">
              <CardContent className="pt-6">
                <div className="flex items-center text-red-600">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  <span>{error}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {results && (
            <div className="space-y-6">
              {/* Overall Score */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {results.brandName} GEO Analysis
                    <span className={`text-2xl font-bold ${getScoreColor(results.overallScore)}`}>
                      {results.overallScore}/100
                    </span>
                  </CardTitle>
                </CardHeader>
              </Card>

              {/* Provider Results */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {results.analyses.map((analysis) => (
                  <Card key={analysis.provider}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{analysis.provider}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Visibility Score</span>
                          <span className={`font-bold ${getScoreColor(analysis.brandVisibilityScore)}`}>
                            {analysis.brandVisibilityScore}/100
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Mention Rate</span>
                          <span className="font-medium">
                            {Math.round(analysis.mentionRate * 100)}%
                          </span>
                        </div>

                        {analysis.averagePosition > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Avg Position</span>
                            <span className="font-medium">#{Math.round(analysis.averagePosition)}</span>
                          </div>
                        )}

                        <Badge className={getSentimentColor(analysis.sentiment)}>
                          {analysis.sentiment}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Detailed Results */}
              <Card>
                <CardHeader>
                  <CardTitle>Prompt Test Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {results.analyses.map((analysis) => (
                      <div key={analysis.provider}>
                        <h4 className="font-semibold text-lg mb-3">{analysis.provider}</h4>
                        <div className="space-y-3">
                          {analysis.promptTests.map((test, idx) => (
                            <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                              <div className="flex items-start justify-between mb-2">
                                <h5 className="font-medium text-sm text-gray-900">
                                  "{test.prompt}"
                                </h5>
                                <div className="flex items-center gap-2">
                                  {test.brandMentioned ? (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <AlertCircle className="w-4 h-4 text-red-600" />
                                  )}
                                  {test.brandPosition && (
                                    <Badge variant="outline">#{test.brandPosition}</Badge>
                                  )}
                                </div>
                              </div>
                              
                              <p className="text-sm text-gray-600 mb-2 line-clamp-3">
                                {test.response}
                              </p>
                              
                              {test.competitors.length > 0 && (
                                <div className="text-xs text-gray-500">
                                  Competitors mentioned: {test.competitors.join(', ')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {results.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start">
                        <CheckCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
