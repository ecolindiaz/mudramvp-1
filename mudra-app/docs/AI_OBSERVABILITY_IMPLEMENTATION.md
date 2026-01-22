# AI Model Observability Implementation

## Overview

This document describes the basic observability system implemented to track AI model usage, costs, and errors across Mudra's core features.

## Database Schema

New table: `AIModelLog` (mapped to `ai_model_logs`)

```prisma
model AIModelLog {
  id             String   @id @default(cuid())
  createdAt      DateTime @default(now())
  
  // Who
  userId         String?
  brandProfileId Int?
  
  // What
  feature        String   // onboarding, nlr, content-lab, radar, agents, technical-analysis
  endpoint       String?  // API route or function name
  model          String   // gpt-5, gpt-4, gemini-3-pro, etc.
  provider       String   // openai, anthropic, google, etc.
  
  // Result
  status         String   // success, error
  errorMessage   String?
  errorCode      String?
  
  // Performance
  latencyMs      Int?
  tokensIn       Int?
  tokensOut      Int?
  costCents      Int?
  
  // Metadata
  metadata       Json?

  @@index([userId])
  @@index([brandProfileId])
  @@index([feature])
  @@index([model])
  @@index([status])
  @@index([createdAt])
  @@index([feature, createdAt])
  @@map("ai_model_logs")
}
```

## Service API

File: `lib/services/ai-model-logging.service.ts`

### Core Functions

```typescript
// Log a single AI call (fire-and-forget)
logAIModelCall(input: AIModelLogInput): Promise<void>

// Wrapper for automatic logging with timing
withAILogging<T>(context, fn): Promise<T>

// Cost estimation utility
estimateAICost(model: string, tokensIn: number, tokensOut: number): number

// Query aggregated stats
getAIUsageStats(options): Promise<UsageStats>
```

### Features (Enum Values)

| Feature | Description |
|---------|-------------|
| `onboarding` | First website analysis, NLR generation |
| `nlr` | Natural Language Report generation |
| `content-lab` | AI content generation (GPT-5.1) |
| `radar` | Conversation Radar opportunity analysis |
| `agents` | Agent deployments and executions |
| `technical-analysis` | LLM enrichment for technical structure |

## Instrumented Endpoints

### 1. NLR Generation
**File:** `lib/ai/nlr/generate-report.ts`
- **Model (primary):** Gemini 3 Pro
- **Model (fallback):** GPT-4
- **Logged:** Success/error, tokens, latency, cost, companyId

### 2. Content Lab
**File:** `mastra/workflows/steps/generate-content-step.ts`
- **Model:** GPT-5.1
- **Logged:** Success/error, tokens (estimated), latency, cost, trackedPrompt, wordCount

### 3. Conversation Radar
**File:** `mastra/agents/conversation-radar-agent.ts`
- **Model:** GPT-5.1
- **Logged:** Success/error, tokens (estimated), latency, cost, platform, mode, subreddit, relevanceScore

### 4. Technical Analysis
**File:** `lib/analysis/technical/llm.ts`
- **Model:** GPT-5
- **Logged:** Success/error, tokens, latency, cost, templateKey, domain, categoryTag

### 5. Agents Execute
**File:** `app/api/agents/execute/route.ts`
- **Model:** GPT-5.1 (when Mastra enabled)
- **Logged:** Success/error, latency, taskType, agentId, agentName

## Querying Logs

### Get all logs from the last 24 hours
```sql
SELECT * FROM ai_model_logs 
WHERE "createdAt" > NOW() - INTERVAL '24 hours'
ORDER BY "createdAt" DESC;
```

### Cost summary by feature
```sql
SELECT 
  feature,
  COUNT(*) as calls,
  SUM("costCents") / 100.0 as total_cost_usd,
  AVG("latencyMs") as avg_latency_ms,
  SUM("tokensIn") as total_tokens_in,
  SUM("tokensOut") as total_tokens_out
FROM ai_model_logs
GROUP BY feature
ORDER BY total_cost_usd DESC;
```

### Error rate by model
```sql
SELECT 
  model,
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'error') / COUNT(*), 2) as error_rate_pct
FROM ai_model_logs
GROUP BY model
ORDER BY error_rate_pct DESC;
```

### Daily cost trend
```sql
SELECT 
  DATE("createdAt") as date,
  SUM("costCents") / 100.0 as daily_cost_usd,
  COUNT(*) as calls
FROM ai_model_logs
GROUP BY DATE("createdAt")
ORDER BY date DESC
LIMIT 30;
```

## Design Decisions

1. **Async/Fire-and-Forget:** Logging never blocks AI calls. Errors are caught and logged to console.

2. **Estimated Tokens:** Where actual token counts aren't available (Mastra agents), we estimate using character count / 4.

3. **Cost Estimation:** Uses approximate pricing as of late 2025. Actual costs may vary.

4. **Minimal Impact:** All logging is designed to have zero performance impact on AI operations.

## Phase 2 (Future)

- [ ] Admin dashboard page for viewing logs and aggregates
- [ ] Daily cost summary emails
- [ ] Error rate alerts via Slack
- [ ] Onboarding drop-off tracking
- [ ] Per-user usage limits and quotas

## Testing

The logging can be verified by:

1. Running any AI feature (e.g., triggering analysis)
2. Querying the `ai_model_logs` table in Prisma Studio or SQL
3. Using `getAIUsageStats()` function for aggregated data
