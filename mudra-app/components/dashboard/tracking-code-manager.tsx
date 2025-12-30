/**
 * Tracking Code Manager Component
 * 
 * Displays tracking code and installation instructions
 * Supports both agent-based auto-installation and manual copy/paste
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Check, Code, Activity, Bot, GitBranch, ExternalLink, Loader2, AlertCircle } from 'lucide-react';

interface TrackingCodeData {
  trackingId: string;
  script: string;
  isActive: boolean;
  totalEvents: number;
  totalAIReferrals: number;
  lastEventAt: string | null;
  createdAt: string;
}

interface InstallStatus {
  githubConnected: boolean;
  githubUsername?: string;
  repositories: string[];
  trackingStatus: string;
  trackingSiteId?: string;
}

export default function TrackingCodeManager() {
  const [data, setData] = useState<TrackingCodeData | null>(null);
  const [installStatus, setInstallStatus] = useState<InstallStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installSuccess, setInstallSuccess] = useState<{ prUrl: string; prNumber: number } | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('main');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [codeRes, statusRes] = await Promise.all([
        fetch('/api/tracking/code'),
        fetch('/api/tracking/install')
      ]);

      const codeResult = await codeRes.json();
      const statusResult = await statusRes.json();

      if (codeResult.success) {
        setData(codeResult.data);
      }

      if (statusResult.success) {
        setInstallStatus(statusResult.data);
        if (statusResult.data.repositories?.length > 0) {
          setSelectedRepo(statusResult.data.repositories[0]);
        }
      }
    } catch (err) {
      console.error('[TrackingCodeManager]', err);
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    if (!data?.script) return;

    try {
      await navigator.clipboard.writeText(data.script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  async function installViaAgent() {
    if (!selectedRepo) {
      setInstallError('Please select a repository');
      return;
    }

    try {
      setInstalling(true);
      setInstallError(null);
      setInstallSuccess(null);

      const response = await fetch('/api/tracking/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName: selectedRepo,
          branch: selectedBranch
        })
      });

      const result = await response.json();

      if (result.success) {
        setInstallSuccess({
          prUrl: result.data.prUrl,
          prNumber: result.data.prNumber
        });
      } else {
        setInstallError(result.error?.message || 'Failed to install tracking');
      }
    } catch (err) {
      setInstallError('Failed to connect to installation service');
      console.error('[TrackingCodeManager] Install error:', err);
    } finally {
      setInstalling(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tracking Code</CardTitle>
          <CardDescription>Failed to load tracking code</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Tracking Code
            </CardTitle>
            <CardDescription>Install this code on your website to track AI referral traffic</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={data.isActive ? 'default' : 'secondary'}>
              {data.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <div className="text-2xl font-bold">{data.totalEvents.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Total Events</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{data.totalAIReferrals.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">AI Referrals</div>
          </div>
        </div>

        {/* Installation Options */}
        <Tabs defaultValue="agent" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="agent" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Auto-Install
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Manual
            </TabsTrigger>
          </TabsList>

          {/* Agent Installation Tab */}
          <TabsContent value="agent" className="space-y-4 mt-4">
            {!installStatus?.githubConnected ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Connect your GitHub account to auto-install tracking code.{' '}
                  <a href="/dashboard/integrations" className="underline font-medium">
                    Go to Integrations →
                  </a>
                </AlertDescription>
              </Alert>
            ) : installSuccess ? (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                <Check className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700 dark:text-green-300">
                  Pull request created successfully!{' '}
                  <a 
                    href={installSuccess.prUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline font-medium inline-flex items-center gap-1"
                  >
                    View PR #{installSuccess.prNumber} <ExternalLink className="h-3 w-3" />
                  </a>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GitBranch className="h-4 w-4" />
                    Connected as <span className="font-medium">{installStatus.githubUsername}</span>
                  </div>

                  {/* Repository Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Repository</label>
                    <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a repository" />
                      </SelectTrigger>
                      <SelectContent>
                        {installStatus.repositories.length > 0 ? (
                          installStatus.repositories.map((repo) => (
                            <SelectItem key={repo} value={repo}>
                              {repo}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="" disabled>
                            No repositories found
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Branch Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Branch</label>
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="main">main</SelectItem>
                        <SelectItem value="master">master</SelectItem>
                        <SelectItem value="develop">develop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {installError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{installError}</AlertDescription>
                  </Alert>
                )}

                <Button 
                  onClick={installViaAgent} 
                  disabled={installing || !selectedRepo}
                  className="w-full"
                >
                  {installing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating PR...
                    </>
                  ) : (
                    <>
                      <Bot className="h-4 w-4 mr-2" />
                      Auto-Install with Agent
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  The agent will create a pull request with the tracking code. Just merge to enable tracking.
                </p>
              </>
            )}
          </TabsContent>

          {/* Manual Installation Tab */}
          <TabsContent value="manual" className="space-y-4 mt-4">
            <Alert>
              <Activity className="h-4 w-4" />
              <AlertDescription>
                Copy this code and paste it before the closing <code>&lt;/body&gt;</code> tag on all pages of your website.
              </AlertDescription>
            </Alert>

            {/* Code Snippet */}
            <div className="relative">
              <pre className="p-4 bg-slate-950 text-slate-50 rounded-lg overflow-x-auto text-xs leading-relaxed max-h-48">
                <code>{data.script}</code>
              </pre>
              <Button
                size="sm"
                variant="secondary"
                className="absolute top-2 right-2"
                onClick={copyToClipboard}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Code
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Tracking ID */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Tracking ID: <code className="px-2 py-1 bg-muted rounded">{data.trackingId}</code>
        </div>

        {data.lastEventAt && (
          <div className="text-xs text-muted-foreground">
            Last event: {new Date(data.lastEventAt).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
