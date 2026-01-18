'use client';

/**
 * Scrape Job Trigger
 * 
 * Button/form to trigger a new site-wide scrape job with progress indicator.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Play, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Globe,
  FileSearch,
  Timer,
  Zap
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface ScrapeJobProgress {
  status: 'pending' | 'checking_policies' | 'discovering_sitemap' | 'scraping' | 'scoring' | 'aggregating' | 'completed' | 'failed';
  progress: number;
  pagesDiscovered: number;
  pagesScraped: number;
  pagesScored: number;
  currentPage?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

interface ScrapeJobTriggerProps {
  brandProfileId: number;
  websiteUrl: string;
  onJobComplete?: () => void;
  onJobStart?: (jobId: string) => void;
}

const STATUS_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  pending: { label: 'Starting...', icon: <Timer className="h-4 w-4 animate-pulse" /> },
  checking_policies: { label: 'Checking Policy Files', icon: <FileSearch className="h-4 w-4 animate-pulse" /> },
  discovering_sitemap: { label: 'Discovering Sitemap', icon: <Globe className="h-4 w-4 animate-pulse" /> },
  scraping: { label: 'Scraping Pages', icon: <Zap className="h-4 w-4 animate-pulse" /> },
  scoring: { label: 'Scoring Pages', icon: <Loader2 className="h-4 w-4 animate-spin" /> },
  aggregating: { label: 'Computing Site Score', icon: <Loader2 className="h-4 w-4 animate-spin" /> },
  completed: { label: 'Completed', icon: <CheckCircle2 className="h-4 w-4 text-green-600" /> },
  failed: { label: 'Failed', icon: <XCircle className="h-4 w-4 text-red-600" /> },
};

export function ScrapeJobTrigger({
  brandProfileId,
  websiteUrl,
  onJobComplete,
  onJobStart,
}: ScrapeJobTriggerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ScrapeJobProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxPages, setMaxPages] = useState<number>(100);
  const [skipCache, setSkipCache] = useState(false);

  // Poll for job status
  const pollStatus = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/site-scrape/status?jobId=${id}`);
      const data = await res.json();
      
      if (data.success) {
        setProgress(data.data);
        
        if (data.data.status === 'completed') {
          setIsLoading(false);
          onJobComplete?.();
        } else if (data.data.status === 'failed') {
          setIsLoading(false);
          setError(data.data.error || 'Job failed');
        } else {
          // Continue polling
          setTimeout(() => pollStatus(id), 2000);
        }
      } else {
        setError(data.error?.message || 'Failed to get status');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Failed to poll job status');
      setIsLoading(false);
    }
  }, [onJobComplete]);

  // Start scrape job
  const handleStartScrape = async () => {
    setIsLoading(true);
    setError(null);
    setProgress(null);
    
    try {
      const res = await fetch('/api/site-scrape/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId,
          websiteUrl,
          maxPages,
          skipCache,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setJobId(data.data.jobId);
        onJobStart?.(data.data.jobId);
        pollStatus(data.data.jobId);
      } else {
        setError(data.error?.message || 'Failed to start scrape');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Failed to start scrape job');
      setIsLoading(false);
    }
  };

  // Reset state
  const handleReset = () => {
    setJobId(null);
    setProgress(null);
    setError(null);
    setIsLoading(false);
  };

  const isRunning = isLoading && progress && !['completed', 'failed'].includes(progress.status);
  const isCompleted = progress?.status === 'completed';
  const isFailed = progress?.status === 'failed';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Site-Wide Technical Scan
        </CardTitle>
        <CardDescription>
          Analyze all pages on {websiteUrl} for Answer Engine Optimization
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Display */}
        {progress && (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {STATUS_LABELS[progress.status]?.icon}
                <span className="font-medium">
                  {STATUS_LABELS[progress.status]?.label}
                </span>
              </div>
              <Badge variant={isCompleted ? 'default' : isFailed ? 'destructive' : 'secondary'}>
                {progress.progress}%
              </Badge>
            </div>
            
            <Progress value={progress.progress} className="h-2" />
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="font-bold text-lg">{progress.pagesDiscovered}</div>
                <div className="text-muted-foreground">Discovered</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-lg">{progress.pagesScraped}</div>
                <div className="text-muted-foreground">Scraped</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-lg">{progress.pagesScored}</div>
                <div className="text-muted-foreground">Scored</div>
              </div>
            </div>
            
            {progress.currentPage && isRunning && (
              <div className="text-xs text-muted-foreground truncate">
                Processing: {progress.currentPage}
              </div>
            )}
            
            {isCompleted && progress.completedAt && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Completed at {new Date(progress.completedAt).toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
            <XCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Advanced Options */}
        {!isRunning && !isCompleted && (
          <Accordion type="single" collapsible>
            <AccordionItem value="advanced" className="border-none">
              <AccordionTrigger className="py-2 text-sm">
                Advanced Options
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="maxPages">Max Pages to Scan</Label>
                  <Input
                    id="maxPages"
                    type="number"
                    min={1}
                    max={500}
                    value={maxPages}
                    onChange={(e) => setMaxPages(parseInt(e.target.value) || 100)}
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    Limit the number of pages to scan (1-500)
                  </p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="skipCache">Skip Cache</Label>
                    <p className="text-xs text-muted-foreground">
                      Force re-scrape all pages
                    </p>
                  </div>
                  <Switch
                    id="skipCache"
                    checked={skipCache}
                    onCheckedChange={setSkipCache}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {!isRunning && !isCompleted && (
            <Button 
              onClick={handleStartScrape}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {isLoading ? 'Starting...' : 'Start Scan'}
            </Button>
          )}
          
          {isCompleted && (
            <>
              <Button 
                onClick={handleReset}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                New Scan
              </Button>
            </>
          )}
          
          {isFailed && (
            <Button 
              onClick={handleReset}
              variant="outline"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
        </div>

        {/* Info */}
        {!progress && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>This will:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li>Check for robots.txt, sitemap.xml, and llms.txt</li>
              <li>Discover all pages from the sitemap</li>
              <li>Scrape and analyze each page's HTML</li>
              <li>Score pages using Five-Dimension AEO scoring</li>
              <li>Compute an overall Technical Structure Score</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ScrapeJobTrigger;
