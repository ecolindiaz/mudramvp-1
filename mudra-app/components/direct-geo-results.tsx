'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, ListTodo } from 'lucide-react';
import { useState } from 'react';
import type { DirectGEOResult } from '@/lib/services/direct-geo-analysis.service';

const sentimentClassMap: Record<'positive' | 'neutral' | 'negative', string> = {
  positive: 'bg-green-100 text-green-800',
  neutral: 'bg-gray-100 text-gray-800',
  negative: 'bg-red-100 text-red-800',
};

function getSentimentColor(sentiment: 'positive' | 'neutral' | 'negative') {
  return sentimentClassMap[sentiment] ?? sentimentClassMap.neutral;
}

function getScoreColor(score: number) {
  if (score >= 70) return 'text-green-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

interface DirectGeoResultsProps {
  results: DirectGEOResult;
}

export function DirectGeoResults({ results }: DirectGeoResultsProps) {
  const [isCreatingTasks, setIsCreatingTasks] = useState(false);

  const handleCreateTasks = async () => {
    setIsCreatingTasks(true);
    try {
      const siteId = typeof window !== 'undefined' ? (localStorage.getItem('mudra:siteId') || '') : '';
      
      if (!siteId) {
        alert('No site ID found. Please analyze a website first.');
        return;
      }

      // Convert recommendations to tasks
      const response = await fetch('/api/tasks/create-from-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          recommendations: results.recommendations,
          brandName: results.brandName,
          overallScore: results.overallScore
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create tasks: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Created tasks from recommendations:', result.data.tasks.length);
      
      // Refresh tasks list
      window.dispatchEvent(new CustomEvent('mudra:refresh-tasks'));
      
      alert(`✅ Successfully created ${result.data.tasks.length} tasks from recommendations!`);
      
    } catch (error) {
      console.error('❌ Error creating tasks from recommendations:', error);
      alert(`Failed to create tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreatingTasks(false);
    }
  };

  return (
    <div className="space-y-6">
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
                  <span className="font-medium">{Math.round(analysis.mentionRate * 100)}%</span>
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
                        <h5 className="font-medium text-sm text-gray-900">“{test.prompt}”</h5>
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

                      <p className="text-sm text-gray-600 mb-2 line-clamp-3">{test.response}</p>

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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recommendations</CardTitle>
              <CardDescription>AI-suggested next steps to improve visibility</CardDescription>
            </div>
            <Button 
              onClick={handleCreateTasks}
              disabled={isCreatingTasks || !results.recommendations || results.recommendations.length === 0}
              size="sm"
              className="gap-2"
            >
              <ListTodo className="w-4 h-4" />
              {isCreatingTasks ? 'Creating...' : 'Create Tasks'}
            </Button>
          </div>
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
  );
}
