# Fire SaaS Geo - AI Visibility Dashboard Integration Guide

This guide shows you how to integrate Fire SaaS Geo's brand monitoring and AI chat metrics into your own AI visibility dashboard.

## 🚀 Quick Start

Fire SaaS Geo provides multiple integration methods to access AI brand visibility metrics:

### Option 1: REST API Integration (Recommended)
Pull metrics directly from Fire SaaS Geo APIs.

### Option 2: Webhook Integration  
Receive real-time notifications when new analyses complete.

### Option 3: Database Integration
Direct database access for complex queries.

---

## 📊 Available Metrics APIs

### Dashboard Metrics Endpoint
**GET** `/api/dashboard/metrics`

Returns aggregated metrics for dashboard visualization:

```typescript
// Example Response
{
  "timeframe": "30d",
  "summary": {
    "totalAnalyses": 25,
    "totalMessages": 150,
    "totalConversations": 12,
    "totalCreditsUsed": 350,
    "avgVisibilityScore": 67.5
  },
  "visibilityTrend": [
    {
      "date": "2025-08-01T00:00:00Z",
      "companyName": "Acme Corp",
      "visibilityScore": 72,
      "shareOfVoice": 15.5,
      "averagePosition": 3.2,
      "competitorCount": 6
    }
  ],
  "competitorInsights": [
    {
      "name": "Competitor A",
      "appearances": 8,
      "avgVisibilityScore": 85.2
    }
  ],
  "providerPerformance": [
    {
      "name": "OpenAI",
      "totalQueries": 45,
      "avgPosition": 2.8
    }
  ],
  "recentActivity": [...]
}
```

**Query Parameters:**
- `timeframe`: `7d`, `30d`, `90d` (default: `30d`)
- `competitors`: `true`/`false` - Include competitor analysis

### Custom Metrics Endpoint
**POST** `/api/dashboard/metrics`

For advanced filtering and custom metric requests:

```typescript
// Request Body
{
  "startDate": "2025-07-01",
  "endDate": "2025-08-01", 
  "companies": ["acme.com", "example.com"],
  "industries": ["SaaS", "AI"],
  "providers": ["OpenAI", "Anthropic"],
  "metricTypes": ["visibility_trends", "competitor_analysis", "provider_rankings"]
}
```

### Brand Analysis APIs
```typescript
// Get all analyses
GET /api/brand-monitor/analyses

// Get specific analysis  
GET /api/brand-monitor/analyses/[analysisId]

// Create new analysis
POST /api/brand-monitor/analyses

// Delete analysis
DELETE /api/brand-monitor/analyses/[analysisId]
```

### Chat & Usage APIs
```typescript
// Chat interactions
POST /api/chat
GET /api/chat

// Credits/usage
GET /api/credits
```

---

## 🔗 Webhook Integration

### 1. Subscribe to Webhooks
**POST** `/api/webhooks/subscribe`

```typescript
{
  "url": "https://your-dashboard.com/webhooks/firegeo",
  "events": [
    "brand_analysis.completed",
    "chat.message", 
    "credits.low"
  ],
  "secret": "your-webhook-secret"
}
```

### 2. Webhook Event Types

#### Brand Analysis Completed
```typescript
{
  "id": "evt_123",
  "event": "brand_analysis.completed",
  "timestamp": "2025-08-03T10:30:00Z",
  "data": {
    "analysisId": "analysis_456",
    "companyName": "Acme Corp",
    "industry": "SaaS",
    "url": "acme.com",
    "visibilityScore": 72.5,
    "competitorCount": 6,
    "creditsUsed": 10,
    "createdAt": "2025-08-03T10:25:00Z"
  }
}
```

#### Chat Message
```typescript
{
  "id": "evt_124", 
  "event": "chat.message",
  "timestamp": "2025-08-03T10:35:00Z",
  "data": {
    "messageId": "msg_789",
    "conversationId": "conv_123", 
    "role": "assistant",
    "tokenCount": 150,
    "createdAt": "2025-08-03T10:35:00Z"
  }
}
```

#### Credits Low
```typescript
{
  "id": "evt_125",
  "event": "credits.low", 
  "timestamp": "2025-08-03T10:40:00Z",
  "data": {
    "remainingCredits": 8,
    "threshold": 10
  }
}
```

### 3. Webhook Verification
Webhooks include HMAC-SHA256 signatures for security:

```typescript
// Verify webhook signature
import crypto from 'crypto';

function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return signature === `sha256=${expectedSignature}`;
}
```

---

## 💾 Database Integration

For advanced analytics, you can connect directly to the PostgreSQL database:

### Key Tables
```sql
-- Brand analyses with full results
SELECT * FROM brand_analyses WHERE user_id = 'user_123';

-- Chat messages and usage
SELECT * FROM messages m 
JOIN conversations c ON m.conversation_id = c.id 
WHERE c.user_id = 'user_123';

-- User profiles and settings
SELECT * FROM user_profile WHERE user_id = 'user_123';
```

### Sample Analytics Queries
```sql
-- Weekly visibility score trends
SELECT 
  DATE_TRUNC('week', created_at) as week,
  company_name,
  AVG((analysis_data->'competitors'->0->>'visibilityScore')::numeric) as avg_score
FROM brand_analyses 
WHERE user_id = 'user_123'
  AND created_at >= NOW() - INTERVAL '3 months'
GROUP BY week, company_name
ORDER BY week DESC;

-- Top performing competitors
SELECT 
  competitor->>'name' as competitor_name,
  AVG((competitor->>'visibilityScore')::numeric) as avg_score,
  COUNT(*) as appearances
FROM brand_analyses,
  jsonb_array_elements(analysis_data->'competitors') as competitor
WHERE user_id = 'user_123'
  AND (competitor->>'isOwn')::boolean = false
GROUP BY competitor->>'name'
ORDER BY avg_score DESC
LIMIT 10;

-- AI provider performance comparison
SELECT 
  provider_name,
  prompt_text,
  AVG(position) as avg_position
FROM (
  SELECT 
    ranking_key as provider_name,
    prompt_key as prompt_text,
    (ranking_pos + 1) as position
  FROM brand_analyses ba,
    jsonb_each(ba.analysis_data->'providerRankings') as provider(ranking_key, provider_rankings),
    jsonb_each(provider_rankings) as prompt(prompt_key, prompt_rankings),
    jsonb_array_elements(prompt_rankings) WITH ORDINALITY as ranking(item, ranking_pos)
  WHERE ba.user_id = 'user_123'
    AND ranking.item->>'name' ILIKE '%your-brand%'
) rankings
GROUP BY provider_name, prompt_text
ORDER BY avg_position;
```

---

## 🛠️ Implementation Examples

### React Dashboard Component
```typescript
import { useEffect, useState } from 'react';

interface DashboardMetrics {
  summary: {
    totalAnalyses: number;
    avgVisibilityScore: number;
    totalCreditsUsed: number;
  };
  visibilityTrend: Array<{
    date: string;
    visibilityScore: number;
    companyName: string;
  }>;
  competitorInsights: Array<{
    name: string;
    avgVisibilityScore: number;
  }>;
}

function AIVisibilityDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/dashboard/metrics?timeframe=30d&competitors=true', {
        headers: {
          'Authorization': `Bearer ${your_api_token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading metrics...</div>;
  if (!metrics) return <div>Failed to load metrics</div>;

  return (
    <div className="dashboard">
      <div className="metrics-summary">
        <div className="metric-card">
          <h3>Total Analyses</h3>
          <p>{metrics.summary.totalAnalyses}</p>
        </div>
        <div className="metric-card">
          <h3>Avg Visibility Score</h3>
          <p>{metrics.summary.avgVisibilityScore.toFixed(1)}%</p>
        </div>
        <div className="metric-card">
          <h3>Credits Used</h3>
          <p>{metrics.summary.totalCreditsUsed}</p>
        </div>
      </div>

      <div className="visibility-chart">
        <h3>Visibility Trend</h3>
        {/* Render your chart component with metrics.visibilityTrend */}
      </div>

      <div className="competitor-insights">
        <h3>Top Competitors</h3>
        {metrics.competitorInsights.map(competitor => (
          <div key={competitor.name} className="competitor-item">
            <span>{competitor.name}</span>
            <span>{competitor.avgVisibilityScore.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Webhook Handler (Next.js)
```typescript
// pages/api/webhooks/firegeo.ts
import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['x-fire-signature-256'] as string;
  const payload = JSON.stringify(req.body);
  
  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.FIREGEO_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');

  if (signature !== `sha256=${expectedSignature}`) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { event, data } = req.body;

  switch (event) {
    case 'brand_analysis.completed':
      // Store analysis data in your dashboard database
      await storeAnalysisData(data);
      
      // Trigger real-time updates
      await notifyDashboardUsers(data);
      break;

    case 'chat.message':
      // Track chat usage metrics
      await updateChatMetrics(data);
      break;

    case 'credits.low':
      // Send alerts to administrators
      await sendLowCreditsAlert(data);
      break;
  }

  res.status(200).json({ received: true });
}
```

### Python Analytics Script
```python
import requests
import pandas as pd
import matplotlib.pyplot as plt

class FireGeoAnalytics:
    def __init__(self, api_token, base_url):
        self.api_token = api_token
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {api_token}',
            'Content-Type': 'application/json'
        }
    
    def get_metrics(self, timeframe='30d'):
        """Get dashboard metrics"""
        response = requests.get(
            f'{self.base_url}/api/dashboard/metrics',
            params={'timeframe': timeframe, 'competitors': 'true'},
            headers=self.headers
        )
        return response.json()
    
    def get_visibility_trends(self):
        """Get visibility score trends as DataFrame"""
        metrics = self.get_metrics()
        df = pd.DataFrame(metrics['visibilityTrend'])
        df['date'] = pd.to_datetime(df['date'])
        return df
    
    def plot_visibility_trends(self):
        """Plot visibility trends"""
        df = self.get_visibility_trends()
        
        plt.figure(figsize=(12, 6))
        for company in df['companyName'].unique():
            company_data = df[df['companyName'] == company]
            plt.plot(company_data['date'], company_data['visibilityScore'], 
                    marker='o', label=company)
        
        plt.title('AI Visibility Score Trends')
        plt.xlabel('Date')
        plt.ylabel('Visibility Score (%)')
        plt.legend()
        plt.grid(True)
        plt.show()

# Usage
analytics = FireGeoAnalytics('your-api-token', 'https://your-firegeo-instance.com')
analytics.plot_visibility_trends()
```

---

## 🔐 Authentication

### API Token Authentication
Fire SaaS Geo uses session-based authentication. For API access, you'll need to:

1. **Generate API Token**: Add API token functionality to Fire SaaS Geo
2. **Include in Headers**: `Authorization: Bearer YOUR_TOKEN`
3. **Scope Permissions**: Limit token access to specific endpoints

### Setting up API Tokens
```typescript
// Add to Fire SaaS Geo: /api/auth/tokens
POST /api/auth/tokens
{
  "name": "Dashboard Integration",
  "scopes": ["metrics:read", "analyses:read", "webhooks:manage"],
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

---

## 📈 Advanced Use Cases

### 1. Multi-Brand Monitoring Dashboard
Track multiple brands across different industries with comparative analytics.

### 2. Competitive Intelligence Platform  
Monitor competitor visibility trends and market positioning.

### 3. AI Provider Performance Analysis
Compare how different AI providers rank your brand vs competitors.

### 4. Real-time Brand Reputation Monitor
Get instant alerts when visibility scores drop or improve.

### 5. Marketing Campaign Impact Measurement
Correlate marketing activities with AI visibility improvements.

---

## 🚦 Rate Limits & Best Practices

### Rate Limits
- API Calls: 1000 requests/hour per token
- Webhooks: 10 events/second per subscription
- Database: Use connection pooling for direct access

### Best Practices
1. **Cache responses** for frequently accessed data
2. **Use webhooks** for real-time updates instead of polling
3. **Batch requests** when possible
4. **Monitor your usage** to avoid hitting rate limits
5. **Implement exponential backoff** for retries

### Error Handling
```typescript
// Robust API client with retry logic
class FireGeoClient {
  private async makeRequest(url: string, options: RequestInit, retries = 3): Promise<Response> {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        // Rate limited - wait and retry
        const delay = Math.min(1000 * Math.pow(2, 3 - retries), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(url, options, retries - 1);
      }
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.makeRequest(url, options, retries - 1);
      }
      throw error;
    }
  }
}
```

---

## 🔧 Setup Instructions

### 1. Run Database Migration
```bash
cd firegeo
npm run db:push
```

### 2. Set up Webhook Subscriptions
```typescript
// In your dashboard app
const subscription = await fetch('https://your-firegeo.com/api/webhooks/subscribe', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${your_token}`,
  },
  body: JSON.stringify({
    url: 'https://your-dashboard.com/webhooks/firegeo',
    events: ['brand_analysis.completed', 'chat.message'],
    secret: 'your-webhook-secret'
  })
});
```

### 3. Test Integration
```bash
# Test metrics endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-firegeo.com/api/dashboard/metrics?timeframe=7d"

# Test webhook (simulate event)
curl -X POST https://your-dashboard.com/webhooks/firegeo \
  -H "Content-Type: application/json" \
  -H "X-Fire-Signature-256: sha256=..." \
  -d '{"event":"brand_analysis.completed","data":{...}}'
```

---

## 📞 Support

- **API Documentation**: Available at `/api/docs` (when implemented)
- **Webhook Testing**: Use ngrok for local development
- **Database Schema**: Check `/lib/db/schema.ts` for latest structure
- **Rate Limit Monitoring**: Check response headers for current usage

---

This integration approach gives you real-time access to Fire SaaS Geo's AI brand visibility metrics while maintaining a clean separation between your dashboard and the monitoring platform.
