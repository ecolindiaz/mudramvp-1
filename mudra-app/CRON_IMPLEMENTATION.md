# Cron Job Implementation - Complete Setup Guide

## ✅ Implementation Status

### Fully Implemented:
1. **✅ Cron Service** - `lib/services/cron.service.ts`
2. **✅ Vercel Cron Configuration** - `vercel.json`
3. **✅ API Endpoint** - `/api/cron/weekly-analysis`
4. **✅ Database Schema** - `CronExecutionLog` model
5. **✅ Admin Dashboard** - `/api/admin/cron-status`
6. **✅ Intent Weights** - Integrated into `visibility-scoring.service.ts`
7. **✅ Delta Tracking** - Already working in `overview-metrics.tsx`

## Installation Steps

### 1. Install Dependencies
```bash
cd mudra-app
npm install
```

This installs:
- `node-cron` - Cron job scheduler
- `@types/node-cron` - TypeScript types

### 2. Push Database Schema
```bash
npx prisma db push
```

This creates the `CronExecutionLog` table for audit trail.

### 3. Environment Variables

Add to `.env.local`:
```bash
# Cron Job Configuration
ENABLE_CRON_JOBS=false              # Set to 'true' for local/self-hosted cron
CRON_SECRET=your_secure_random_key  # Required for Vercel Cron (generate with: openssl rand -hex 32)
```

**For Vercel Deployment:**
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add `CRON_SECRET` with a secure random value
3. Vercel automatically handles scheduling based on `vercel.json`

**For Self-Hosted/Local Development:**
Set `ENABLE_CRON_JOBS=true` to run cron jobs locally.

## How It Works

### Vercel Deployment (Recommended)
1. **Vercel Cron** automatically triggers `/api/cron/weekly-analysis` every Sunday at 2:00 AM UTC
2. Vercel sends `Authorization: Bearer {CRON_SECRET}` header
3. API validates secret and executes `executeWeeklyAnalysis()`
4. Results are logged to `CronExecutionLog` table

### Self-Hosted Deployment
1. Import and call `initializeCronJobs()` in your app startup (e.g., `app/layout.tsx` or `instrumentation.ts`)
2. Node-cron scheduler runs in-process
3. Executes at the same schedule: Sundays 2:00 AM UTC

## Cron Schedule

**Current Schedule:** `0 2 * * 0` (Every Sunday at 2:00 AM UTC)

```
┌───────────── minute (0 - 59)
│ ┌─────────── hour (0 - 23)
│ │ ┌───────── day of month (1 - 31)
│ │ │ ┌─────── month (1 - 12)
│ │ │ │ ┌───── day of week (0 - 6, 0 = Sunday)
│ │ │ │ │
0 2 * * 0
```

**To change the schedule**, edit `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-analysis",
      "schedule": "0 2 * * 0"  // Change this
    }
  ]
}
```

Common schedules:
- Daily: `0 2 * * *` (Every day at 2 AM)
- Weekly Monday: `0 2 * * 1` (Every Monday at 2 AM)
- Bi-weekly: `0 2 */14 * *` (Every 14 days at 2 AM)
- Monthly: `0 2 1 * *` (1st of each month at 2 AM)

## Testing

### Manual Trigger (via curl)
```bash
# Set your CRON_SECRET
$env:CRON_SECRET="your_secret_here"

# Trigger cron job
curl -X POST http://localhost:3000/api/cron/weekly-analysis `
  -H "Authorization: Bearer $env:CRON_SECRET" `
  -H "Content-Type: application/json"
```

### View Cron Status
```bash
# Requires authentication
curl http://localhost:3000/api/admin/cron-status
```

### Check Execution Logs (Database)
```bash
npx prisma studio
# Navigate to CronExecutionLog table
```

Or via SQL:
```sql
SELECT * FROM "cron_execution_logs" ORDER BY "executedAt" DESC LIMIT 10;
```

## What the Cron Job Does

1. **Fetches all active brand profiles** that have been analyzed at least once
2. **Runs unified analysis** for each profile:
   - DirectGEO API tests (AI visibility)
   - Technical structure analysis (SEO health)
   - Stores results in database
3. **Bypasses cooldown** - Weekly runs ignore the 5-minute cooldown
4. **Skips NLR generation** - Natural language reports not generated for automated runs
5. **Adds 30-second delay** between profiles to prevent API rate limiting
6. **Logs execution** - Stores success/failure counts and errors in database

## Execution Flow

```
Vercel Cron Trigger
      ↓
/api/cron/weekly-analysis (Validates CRON_SECRET)
      ↓
executeWeeklyAnalysis() (lib/services/cron.service.ts)
      ↓
Fetch all BrandProfiles with analysisRuns
      ↓
For each profile:
  ├─ runUnifiedAnalysis()
  │   ├─ runGeoAnalysisCore() (DirectGEO API)
  │   └─ runTechnicalAnalysisCore() (Firecrawl)
  ├─ Wait 30 seconds
  └─ Next profile
      ↓
Store execution log in CronExecutionLog
```

## Monitoring & Alerts

### View Recent Executions
```typescript
// In your admin dashboard
const response = await fetch('/api/admin/cron-status');
const { data } = await response.json();

console.log('Last execution:', data.stats.lastExecution);
console.log('Success rate:', data.stats.totalSuccessful / data.stats.totalExecutions);
```

### Email Alerts (Future Enhancement)
Add to `executeWeeklyAnalysis()` in `cron.service.ts`:
```typescript
// After execution completes
if (log.failed > 0) {
  // Send alert email to admins
  await sendEmail({
    to: 'admin@mudra.com',
    subject: `Cron Job Alert: ${log.failed} failures`,
    body: `Errors: ${log.errors.join(', ')}`
  });
}
```

## Intent Weight Scoring

**Now integrated** into `visibility-scoring.service.ts`:

```typescript
const INTENT_WEIGHTS = {
  'Organic': 0.50,           // 50%
  'Competitor': 0.20,        // 20%
  'How-to Guides': 0.20,     // 20%
  'Brand-Specific': 0.10,    // 10%
}
```

**Weighted score calculation:**
1. Groups prompts by category
2. Calculates score for each category
3. Applies weights: `weightedScore = Σ(categoryScore × weight)`
4. Returns `weightedScore` field in `AggregateVisibilityScore`

**Access weighted score:**
```typescript
const { aggregate } = calculateAllScores(tests);
console.log('Weighted score:', aggregate.weightedScore);
console.log('Category breakdown:', aggregate.categoryBreakdown);
```

## Delta Tracking

**Already implemented** in `components/dashboard/overview-metrics.tsx`:

```typescript
// Fetches previous run's score
const previous = historyResult.data[1];
setAiVisibilityPrevious(previous.overallScore || 0);

// Display delta
const delta = currentScore - previousScore;
const deltaPercent = ((delta / previousScore) * 100).toFixed(1);
```

**What's tracked:**
- AI Visibility Score delta
- Technical Score delta
- Average Position delta
- Organic Traffic delta
- AI Referral delta

**Display format:**
```tsx
<div className="flex items-center gap-2">
  <span className="text-2xl font-bold">{currentScore}</span>
  {delta !== 0 && (
    <Badge variant={delta > 0 ? 'success' : 'destructive'}>
      {delta > 0 ? '+' : ''}{delta} ({deltaPercent}%)
    </Badge>
  )}
</div>
```

## Troubleshooting

### Cron not running on Vercel
1. Check `vercel.json` is committed to git
2. Verify `CRON_SECRET` is set in Vercel environment variables
3. Check Vercel logs: Dashboard → Deployments → View Logs
4. Ensure route is deployed: `https://your-app.vercel.app/api/cron/weekly-analysis`

### "Unauthorized" error
- Verify `CRON_SECRET` matches between `.env.local` and Vercel
- Check Authorization header format: `Bearer {secret}`

### Analysis failures
- Check DirectGEO API key is valid
- Verify Firecrawl API key is valid
- Review error logs in `CronExecutionLog` table
- Check brand profiles have valid `companyWebsite` URLs

### Database connection errors
- Verify `DATABASE_URL` uses Supabase pooler endpoint (port 6543)
- Check Prisma singleton pattern (import from `@/lib/prisma`)
- Ensure connection pool not exhausted

## Production Checklist

- [ ] `CRON_SECRET` set in Vercel environment variables
- [ ] `vercel.json` committed and deployed
- [ ] Database schema pushed (`npx prisma db push`)
- [ ] Test manual trigger works locally
- [ ] Monitor first automated execution
- [ ] Set up alerts for failures (optional)
- [ ] Document cron schedule in team wiki

## Files Modified

1. ✅ `lib/services/cron.service.ts` - Cron execution logic
2. ✅ `app/api/cron/weekly-analysis/route.ts` - API endpoint
3. ✅ `app/api/admin/cron-status/route.ts` - Admin monitoring
4. ✅ `vercel.json` - Vercel Cron configuration
5. ✅ `prisma/schema.prisma` - CronExecutionLog model
6. ✅ `package.json` - node-cron dependency
7. ✅ `lib/services/visibility-scoring.service.ts` - Intent weights

## Next Steps

1. **Deploy to Vercel** and verify cron runs
2. **Monitor execution logs** for first few weeks
3. **Optimize timing** if needed (avoid peak hours)
4. **Add email alerts** for failures
5. **Create admin dashboard** to view cron status in UI
6. **Consider multi-region** execution for global coverage

---

**Status:** ✅ **Cron job implementation complete and ready for deployment!**
