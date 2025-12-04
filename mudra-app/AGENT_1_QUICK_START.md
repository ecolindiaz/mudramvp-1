# Content Optimizer Agent - Quick Integration Guide

## Add to Your Dashboard in 3 Steps

### Step 1: Import the Component
In your dashboard page (e.g., `app/dashboard/page.tsx`):

```tsx
import { ContentOptimizerPanel } from '@/components/agents/content-optimizer-panel'
```

### Step 2: Add to Layout
```tsx
export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const brandProfile = await prisma.brandProfile.findFirst({
    where: { userId: session.user.id }
  })

  return (
    <div className="space-y-6">
      {/* Your existing dashboard content */}
      
      {/* Add the agent panel */}
      <ContentOptimizerPanel brandProfileId={brandProfile.id} />
    </div>
  )
}
```

### Step 3: Test It
1. Navigate to your dashboard
2. Click "Optimize Top 10 Pages"
3. Watch the agent identify low-scoring pages
4. Review the generated optimization PRs

## What Happens When You Click "Optimize"

1. **Identifies Pages** - Finds pages with GEO scores < 70%
2. **Generates Improvements** - Creates schema markup, FAQs, headers
3. **Creates PRs** - Opens GitHub pull requests with code
4. **Tracks Results** - Saves optimization records to database

## Example Output

```json
{
  "optimizedPages": [
    {
      "url": "https://example.com/page1",
      "originalScore": 45,
      "improvements": [
        {
          "type": "schema_markup",
          "description": "Add Organization schema",
          "impact": "high"
        },
        {
          "type": "faq_section",
          "description": "Add FAQ section with schema markup",
          "impact": "high"
        }
      ],
      "prUrl": "https://github.com/user/repo/pull/123"
    }
  ],
  "totalPages": 1,
  "successfulOptimizations": 1
}
```

## Running Tests

```bash
# Run all agent tests
npm test -- lib/agents

# Run specific agent tests
npm test -- lib/agents/content-optimizer-agent.test.ts

# Run with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## API Documentation

### Execute Agent
```typescript
POST /api/agents/content-optimizer/execute

Body:
{
  "brandProfileId": 1,
  "input": {
    "maxPages": 10  // Optional, default 50
  }
}

Response:
{
  "success": true,
  "data": {
    "optimizedPages": [...],
    "totalPages": 10,
    "successfulOptimizations": 8
  },
  "metrics": {
    "tokensUsed": 5000,
    "apiCost": 0.05
  }
}
```

### Get History
```typescript
GET /api/agents/content-optimizer/history?brandProfileId=1

Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "status": "completed",
      "createdAt": "2025-12-03T10:00:00Z",
      "output": {
        "totalPages": 10,
        "successfulOptimizations": 8
      }
    }
  ]
}
```

## Troubleshooting

### "GitHub integration not found"
- User needs to connect GitHub account
- Check `GitHubIntegration` table has record for user
- Verify access token is valid

### "No pages found that need optimization"
- All pages already score above 70%
- Run GEO analysis first to get baseline scores
- Check `GeoAnalysisResult` table has data

### "Deployment not configured"
- Need to deploy an agent first
- Check `DeployedAgent` table
- Ensure `githubRepoName` is set

## Configuration

Customize agent behavior in constructor:

```typescript
const agent = new ContentOptimizerAgent({
  brandProfileId: 1,
  maxRetries: 5,        // Retry failed operations 5 times
  retryDelay: 2000,     // Wait 2s between retries
  timeout: 600000       // 10 minute timeout
})
```

## Monitoring

View agent performance in Prisma Studio:

```bash
npx prisma studio
```

Check tables:
- `AgentExecution` - Execution history
- `ContentOptimization` - Optimization records
- `AgentMemory` - Agent state

## Cost Tracking

Each execution tracks:
- `tokensUsed` - OpenAI tokens consumed
- `apiCost` - Estimated cost in USD
- `executionTime` - Duration in milliseconds

Access via:
```typescript
const history = await agent.getExecutionHistory()
const totalCost = history.reduce((sum, exec) => 
  sum + (exec.metrics?.apiCost || 0), 0
)
```

## Support

Issues? Check:
1. Database migrations applied: `npx prisma db push`
2. Prisma client generated: `npx prisma generate`
3. Environment variables set (DATABASE_URL, etc.)
4. GitHub integration connected
5. GEO analysis completed for brand

Still stuck? Review test files for usage examples:
- `lib/agents/base-agent.test.ts`
- `lib/agents/content-optimizer-agent.test.ts`
