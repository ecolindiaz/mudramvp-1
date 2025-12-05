import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface DeployedAgent {
  id: number;
  agentType: string;
  agentName: string;
  status: string;
  githubRepoName?: string;
  githubBranch: string;
  lastExecutedAt?: Date;
}

interface GitHubIntegration {
  connected: boolean;
  githubUsername?: string;
  avatarUrl?: string;
}

export function useAgentOperations() {
  const [isLoading, setIsLoading] = useState(false);
  const [agents, setAgents] = useState<DeployedAgent[]>([]);
  const [githubIntegration, setGithubIntegration] = useState<GitHubIntegration>({
    connected: false,
  });

  // Fetch deployed agents
  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch('/api/agents/deploy');
      if (!response.ok) throw new Error('Failed to fetch agents');
      
      const data = await response.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to load agents');
    }
  }, []);

  // Check GitHub connection status
  const checkGitHubConnection = useCallback(async () => {
    try {
      const response = await fetch('/api/integrations/github');
      if (!response.ok) throw new Error('Failed to check GitHub');
      
      const data = await response.json();
      setGithubIntegration({
        connected: data.connected,
        githubUsername: data.integration?.githubUsername,
        avatarUrl: data.integration?.avatarUrl,
      });
    } catch (error) {
      console.error('Error checking GitHub:', error);
    }
  }, []);

  // Deploy a new agent
  const deployAgent = useCallback(async (
    agentName: string,
    agentDescription: string,
    githubRepoName?: string,
    githubBranch: string = 'main'
  ) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/agents/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: 'aeo-geo-optimizer',
          agentName,
          agentDescription,
          githubRepoName,
          githubBranch,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Deployment failed');
      }

      const data = await response.json();
      toast.success(`${agentName} deployed successfully!`);
      
      // Refresh agents list
      await fetchAgents();
      
      return data.agent;
    } catch (error: any) {
      console.error('Error deploying agent:', error);
      toast.error(error.message || 'Failed to deploy agent');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [fetchAgents]);

  // Execute agent action (analyze, optimize, create_pr)
  const executeAgent = useCallback(async (
    deployedAgentId: number,
    action: 'analyze' | 'optimize' | 'create_pr'
  ) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/agents/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deployedAgentId,
          action,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Execution failed');
      }

      const data = await response.json();
      
      const actionLabels = {
        analyze: 'Analysis',
        optimize: 'Optimization',
        create_pr: 'PR creation',
      };
      
      toast.success(`${actionLabels[action]} started successfully!`);
      
      // Refresh agents list
      await fetchAgents();
      
      return data.task;
    } catch (error: any) {
      console.error(`Error executing ${action}:`, error);
      toast.error(error.message || `Failed to ${action}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [fetchAgents]);

  // Connect GitHub
  const connectGitHub = useCallback(() => {
    // Use GitHub App installation flow for repository selection
    const appName = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'mudra-content-optimizer';
    window.location.href = `https://github.com/apps/${appName}/installations/new`;
  }, []);

  // Disconnect GitHub
  const disconnectGitHub = useCallback(async () => {
    try {
      const response = await fetch('/api/integrations/github', {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to disconnect');
      
      toast.success('GitHub disconnected successfully');
      setGithubIntegration({ connected: false });
    } catch (error) {
      console.error('Error disconnecting GitHub:', error);
      toast.error('Failed to disconnect GitHub');
    }
  }, []);

  return {
    agents,
    isLoading,
    githubIntegration,
    fetchAgents,
    checkGitHubConnection,
    deployAgent,
    executeAgent,
    connectGitHub,
    disconnectGitHub,
  };
}
