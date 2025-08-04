interface DashboardMetrics {
  timeframe: string;
  summary: {
    totalAnalyses: number;
    totalMessages: number;
    totalConversations: number;
    totalCreditsUsed: number;
    avgVisibilityScore: number;
  };
  visibilityTrend: Array<{
    date: string;
    companyName: string;
    visibilityScore: number;
    shareOfVoice: number;
    averagePosition: number;
    competitorCount: number;
  }>;
  competitorInsights: Array<{
    name: string;
    appearances: number;
    avgVisibilityScore: number;
  }>;
  providerPerformance: Array<{
    name: string;
    totalQueries: number;
    avgPosition: number;
  }>;
  recentActivity: any[];
}

interface CustomMetricsRequest {
  startDate?: string;
  endDate?: string;
  companies?: string[];
  industries?: string[];
  providers?: string[];
  metricTypes?: string[];
  website?: string;
  companyName?: string;
  competitors?: string[];
}

interface BrandContext {
  website?: string;
  companyName?: string;
  competitors?: string[];
}

export class FiregeoClient {
  private baseUrl: string;
  private apiToken: string;

  constructor() {
    this.baseUrl = process.env.FIREGEO_API_URL || 'http://localhost:8000';
    this.apiToken = process.env.FIREGEO_API_TOKEN || '';
  }

  private async makeRequest(
    endpoint: string, 
    options: RequestInit = {},
    retries = 3
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const requestOptions: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiToken}`,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, requestOptions);
      
      if (response.status === 429 && retries > 0) {
        // Rate limited - wait and retry
        const delay = Math.min(1000 * Math.pow(2, 3 - retries), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(endpoint, options, retries - 1);
      }
      
      if (!response.ok) {
        throw new Error(`Firegeo API error: ${response.status} ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.makeRequest(endpoint, options, retries - 1);
      }
      throw error;
    }
  }

  async getDashboardMetrics(
    timeframe: '7d' | '30d' | '90d' = '30d',
    includeCompetitors = true,
    brandContext?: BrandContext
  ): Promise<DashboardMetrics> {
    const params = new URLSearchParams({
      timeframe,
      competitors: includeCompetitors.toString(),
    });

    // Add brand context parameters if provided
    if (brandContext?.website) {
      params.append('website', brandContext.website);
    }
    if (brandContext?.companyName) {
      params.append('company', brandContext.companyName);
    }
    if (brandContext?.competitors && brandContext.competitors.length > 0) {
      params.append('competitor_list', brandContext.competitors.join(','));
    }

    const response = await this.makeRequest(`/api/dashboard/metrics?${params}`);
    return response.json();
  }

  async getCustomMetrics(request: CustomMetricsRequest): Promise<DashboardMetrics> {
    const response = await this.makeRequest('/api/dashboard/metrics', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response.json();
  }

  async getBrandAnalyses(analysisId?: string) {
    const endpoint = analysisId 
      ? `/api/brand-monitor/analyses/${analysisId}`
      : '/api/brand-monitor/analyses';
    
    const response = await this.makeRequest(endpoint);
    return response.json();
  }

  async createBrandAnalysis(data: any) {
    const response = await this.makeRequest('/api/brand-monitor/analyses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async getCreditsUsage() {
    const response = await this.makeRequest('/api/credits');
    return response.json();
  }

  async getChatHistory() {
    const response = await this.makeRequest('/api/chat');
    return response.json();
  }

  // Mock data for development when Firegeo is not running
  getMockDashboardMetrics(): DashboardMetrics {
    return {
      timeframe: "30d",
      summary: {
        totalAnalyses: 25,
        totalMessages: 150,
        totalConversations: 12,
        totalCreditsUsed: 350,
        avgVisibilityScore: 67.5
      },
      visibilityTrend: [
        {
          date: "2025-08-01T00:00:00Z",
          companyName: "Mudra AI",
          visibilityScore: 72,
          shareOfVoice: 15.5,
          averagePosition: 3.2,
          competitorCount: 6
        },
        {
          date: "2025-07-28T00:00:00Z", 
          companyName: "Mudra AI",
          visibilityScore: 68,
          shareOfVoice: 14.2,
          averagePosition: 3.8,
          competitorCount: 6
        },
        {
          date: "2025-07-25T00:00:00Z",
          companyName: "Mudra AI", 
          visibilityScore: 75,
          shareOfVoice: 16.1,
          averagePosition: 2.9,
          competitorCount: 6
        }
      ],
      competitorInsights: [
        {
          name: "Competitor A",
          appearances: 8,
          avgVisibilityScore: 85.2
        },
        {
          name: "Competitor B", 
          appearances: 6,
          avgVisibilityScore: 78.5
        },
        {
          name: "Competitor C",
          appearances: 4,
          avgVisibilityScore: 71.3
        }
      ],
      providerPerformance: [
        {
          name: "OpenAI",
          totalQueries: 45,
          avgPosition: 2.8
        },
        {
          name: "Anthropic",
          totalQueries: 32,
          avgPosition: 3.1
        },
        {
          name: "Google",
          totalQueries: 28,
          avgPosition: 3.5
        }
      ],
      recentActivity: []
    };
  }
}

export const firegeoClient = new FiregeoClient();
