# Technical Structure Analysis - Quick Start Guide

## 🚀 Getting Started

This guide shows you how to use Mudra's site-wide technical analysis system to scrape, analyze, and score your website for Answer Engine Optimization (AEO).

---

## Prerequisites

1. **Docker running** with mudra-app container
2. **Firecrawl API key** configured in `.env.local`
3. **Brand profile created** in the dashboard

```bash
# Verify Firecrawl API key
grep FIRECRAWL_API_KEY mudra-app/.env.local
```

---

## Step 1: Navigate to Technical Structure Dashboard

1. Open Mudra: `http://localhost:3000/dashboard`
2. Click **"Technical Structure"** in the sidebar
3. You'll see the Technical Structure page

---

## Step 2: Start Your First Scrape

### Option A: Via UI (Dashboard)

1. On the Technical Structure page, click **"Start New Scrape"**
2. Enter your domain (e.g., `https://example.com`)
3. Configure options (optional):
   - Max pages: `50` (default: 100)
   - Concurrency: `3` (default: 3)
   - Delay: `1000ms` (default: 1000)
4. Click **"Start Scraping"**
5. Monitor progress in real-time

### Option B: Via API (Programmatic)

```bash
curl -X POST http://localhost:3000/api/site-scrape/start \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "brandProfileId": 1,
    "domain": "https://example.com",
    "config": {
      "maxPages": 50,
      "concurrency": 3,
      "delayMs": 1000
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "abc-123-def-456",
    "message": "Scraping job started",
    "status": "pending"
  }
}
```

---

## Step 3: Monitor Scraping Progress

### Via UI

The dashboard auto-refreshes every 10 seconds showing:
- Current status (`pending`, `scraping`, `scoring`, `completed`)
- Pages scraped / total pages
- Progress percentage
- Estimated time remaining

### Via API

```bash
curl http://localhost:3000/api/site-scrape/status?jobId=abc-123-def-456
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "abc-123-def-456",
    "domain": "https://example.com",
    "status": "scraping",
    "progress": {
      "totalPages": 50,
      "pagesScraped": 30,
      "pagesScored": 25,
      "pagesFailed": 2,
      "percentComplete": 50
    },
    "timing": {
      "startedAt": "2026-01-21T10:00:00Z",
      "durationMs": 120000
    }
  }
}
```

---

## Step 4: View Site-Wide Scores

Once the job completes, you'll see:

### Overall Site Score

- **Score:** 0-100 (weighted sum of 4 dimensions)
- **Status:** excellent (80+), good (60-79), needs_improvement (40-59), poor (<40)
- **Total pages analyzed**

### Four Dimension Breakdown

1. **Schema / JSON-LD (40 pts)** - JSON-LD presence, validity, relevance, and coverage
2. **Metadata (30 pts)** - Title, description, canonical, Open Graph, Twitter cards
3. **FAQ (20 pts)** - FAQ content quantity and schema coverage
4. **Content (10 pts)** - Word count (300+) and paragraph structure (3+)

### Example Display

```
Overall Technical Structure Score: 78 (Good)

Dimensions:
├─ Schema:    29/40  (missing recommended types)
├─ Metadata:  30/30  (all checks pass)
├─ FAQ:       10/20  (2 FAQs found)
└─ Content:   10/10  (300+ words, 3+ paragraphs)

Total Pages: 50 | Scraped: 50 | Scored: 50
Last Scan: 2026-02-05 10:00 AM
```

---

## Step 5: Drill Into Page-Level Details

### View All Pages

1. Scroll down to the **"Page Scores"** table
2. Sort by:
   - Score (ascending = worst pages first)
   - URL
   - Page type (blog, pricing, features, etc.)
3. Filter by page type to focus on specific areas

### Analyze a Specific Page

1. Click on any page URL in the table
2. View detailed breakdown:
   - HTML snapshot version
   - Score for each dimension
   - **Issues detected** (with severity levels)
   - **Recommendations** (with implementation guidance)
   - Extracted data (metadata, headings, schemas, FAQs)

### Example Page Detail

**Page:** `https://example.com/pricing`

**Score:** 72 (C - Fair)

**Issues:**
- ❌ **Critical:** No JSON-LD Organization schema
- ⚠️ **Major:** Missing FAQ schema (FAQ content detected but not structured)
**Recommendations:**
1. **Add Organization Schema** (Priority: High)
   - Impact: +11 points in Schema coverage (J4)
   - Implementation: Inject JSON-LD in `<head>`

2. **Add FAQ Schema** (Priority: High)
   - Impact: +20 points in FAQ dimension
   - Implementation: Wrap Q&A content in FAQPage schema

3. **Add More Content** (Priority: Medium)
   - Impact: +5 points in Content dimension
   - Implementation: Expand page to 300+ words

---

## Step 6: Export Data (API)

### Get Site-Wide Scores

```bash
curl http://localhost:3000/api/site-scrape/scores?brandProfileId=1&includePages=true
```

### Get Single Page Details

```bash
curl "http://localhost:3000/api/site-scrape/page?brandProfileId=1&pageUrl=https://example.com/pricing"
```

### Get All Issues Across Site

```bash
curl "http://localhost:3000/api/site-scrape/scores?brandProfileId=1&includePages=true" \
  | jq '.data.pages[].issues[]'
```

---

## Step 7: Integrate with Agent Lab

### Automatic Task Generation (Coming Soon)

Each recommendation becomes an agent task:

1. Navigate to **Agent Lab**
2. View **"Technical Structure Recommendations"**
3. Click **"Create Agent"** for any recommendation
4. Agent will:
   - Fetch current page HTML
   - Implement the fix (e.g., add schema)
   - Create GitHub PR
   - Wait for deployment
   - Re-scrape page
   - Report score improvement

### Manual Agent Creation

You can manually create agents using the recommendations:

```typescript
// Example: Add Organization Schema Agent
{
  name: "Add Organization Schema to Homepage",
  goal: "Inject Organization JSON-LD schema to improve AI entity recognition",
  tasks: [
    "Fetch current HTML of homepage",
    "Generate Organization schema using brand profile data",
    "Inject schema into <head> section",
    "Create GitHub PR with changes",
    "Validate schema after deployment"
  ],
  estimatedImpact: "+15 points in Structured Data score"
}
```

---

## Common Use Cases

### 1. Onboarding New Users

```bash
# Run initial site scan during onboarding
POST /api/site-scrape/start
{
  "brandProfileId": 1,
  "domain": "https://newuser.com",
  "config": { "maxPages": 20 }  # Quick scan for onboarding
}

# Get results for onboarding report
GET /api/site-scrape/scores?brandProfileId=1&includePages=false

# Show top 3 critical issues
GET /api/site-scrape/scores?brandProfileId=1&includePages=true
  | jq '.data.pages[].issues[] | select(.severity == "critical") | .title'
```

### 2. Weekly Monitoring

```bash
# Set up weekly cron job
0 9 * * 1 curl -X POST http://localhost:3000/api/site-scrape/start \
  -H "Content-Type: application/json" \
  -d '{"brandProfileId": 1, "domain": "https://mysite.com"}'

# Email report with score trends
GET /api/site-scrape/scores?brandProfileId=1
  | jq '.data.site.overall.score'
```

### 3. Before/After Agent Comparison

```bash
# Before agent implementation
GET /api/site-scrape/page?brandProfileId=1&pageUrl=https://example.com/pricing
  | jq '.data.score.overall'  # e.g., 72

# Agent implements FAQ schema...

# After agent implementation (re-scrape)
POST /api/site-scrape/start { ... }

# Compare new score
GET /api/site-scrape/page?brandProfileId=1&pageUrl=https://example.com/pricing
  | jq '.data.score.overall'  # e.g., 87 (+15 points!)
```

### 4. Competitor Analysis (Future)

```bash
# Scrape competitor site (requires their permission or public data)
POST /api/site-scrape/start
{
  "brandProfileId": 1,
  "domain": "https://competitor.com",
  "config": { "maxPages": 50 }
}

# Compare scores
GET /api/site-scrape/scores?brandProfileId=1
GET /api/site-scrape/scores?brandProfileId=2  # competitor profile
```

---

## Database Queries for Analysis

### Check Latest Scrape Job

```sql
SELECT id, domain, status, pages_scraped, pages_scored, total_pages, 
       started_at, completed_at, duration_ms
FROM scrape_jobs
WHERE brand_profile_id = 1
ORDER BY created_at DESC
LIMIT 1;
```

### Find Lowest-Scoring Pages

```sql
SELECT page_url, overall_score, 
       structured_data_score, 
       answer_engine_score
FROM page_scores
WHERE brand_profile_id = 1
ORDER BY overall_score ASC
LIMIT 10;
```

### Find Pages Missing Critical Schemas

```sql
SELECT ps.page_url, 
       psnap.structured_data_json
FROM page_scores ps
JOIN page_snapshots psnap ON ps.page_snapshot_id = psnap.id
WHERE ps.brand_profile_id = 1
  AND ps.structured_data_score < 50
  AND psnap.is_current = true;
```

### Track Score Improvements Over Time

```sql
SELECT page_url, version, scraped_at, 
       (SELECT overall_score 
        FROM page_scores 
        WHERE page_snapshot_id = ps.id) as score
FROM page_snapshots ps
WHERE brand_profile_id = 1 
  AND page_url = 'https://example.com/pricing'
ORDER BY version DESC;
```

---

## Troubleshooting

### Issue: Job Stuck in "Pending"

**Causes:**
- Firecrawl API key missing or invalid
- Network connectivity issues
- Docker container not running

**Fix:**
```bash
# Check API key
grep FIRECRAWL_API_KEY mudra-app/.env.local

# Restart Docker container
docker restart mudra-app-dev

# Check logs
docker logs mudra-app-dev --tail 50
```

### Issue: Low Scores on All Pages

**Causes:**
- Website lacks structured data (no JSON-LD)
- Poor semantic HTML structure
- Missing meta tags

**Fix:**
1. Review issues array in lowest-scoring pages
2. Prioritize "critical" and "major" issues
3. Focus on high-impact fixes (e.g., add Organization schema)

### Issue: Scraping Fails for Some Pages

**Causes:**
- 404 errors (pages removed but still in sitemap)
- JavaScript-heavy pages (Firecrawl may timeout)
- Protected pages (login required)

**Fix:**
```sql
-- Check failed pages
SELECT page_url, scrape_error
FROM sitemap_pages
WHERE brand_profile_id = 1 AND scrape_status = 'failed';

-- Retry specific pages manually
POST /api/site-scrape/start
{
  "brandProfileId": 1,
  "domain": "https://example.com/specific-page",
  "config": { "timeout": 60000 }  # Increase timeout
}
```

### Issue: Too Many Pages Discovered

**Causes:**
- Large sitemap (1000+ pages)
- Includes paginated blog posts

**Fix:**
```bash
# Use maxPages limit
POST /api/site-scrape/start
{
  "brandProfileId": 1,
  "domain": "https://example.com",
  "config": { 
    "maxPages": 50  # Only scrape first 50 pages
  }
}

# Or filter by page type (future feature)
# Only scrape main, pricing, features pages
```

---

## Best Practices

### 1. Start Small
- First scrape: 10-20 pages
- Verify results look correct
- Then expand to full site (100+ pages)

### 2. Prioritize High-Value Pages
- Main page (`/`)
- Pricing (`/pricing`)
- Features (`/features`)
- Top blog posts

### 3. Schedule Regular Scans
- Weekly: Monitor score trends
- After deployments: Verify improvements
- Monthly: Full site audit

### 4. Focus on Quick Wins
- Add Organization + WebSite schema to homepage (+11 points via J4 coverage)
- Add FAQ content + FAQPage schema (+20 points FAQ dimension)
- Fix meta tags: title + description (+16 points)
- Add canonical URLs (+6 points)

### 5. Track Before/After
- Always run scan before agent implements changes
- Re-scan after deployment
- Document score improvements in NLR

---

## What's Next?

✅ **You've learned:**
- How to start a site-wide scrape
- How to interpret scores and grades
- How to find and prioritize issues
- How to export data via API

🚀 **Next steps:**
1. Run your first scrape on a test domain
2. Review the issues and recommendations
3. Create your first agent to fix a critical issue
4. Monitor score improvements over time
5. Integrate recommendations into Agent Lab

📚 **Further Reading:**
- [Complete Implementation Guide](./SITE_WIDE_TECHNICAL_ANALYSIS.md)
- [Four-Dimension Scoring Details](./TECHNICAL_STRUCTURE_SCORING_SYSTEM.md)
- [Agent Lab Integration](./AGENT_LAB_INTEGRATION.md)

---

## Support

**Documentation:** `docs/mudra-app/SITE_WIDE_TECHNICAL_ANALYSIS.md`

**API Reference:**
- `POST /api/site-scrape/start` - Start scraping
- `GET /api/site-scrape/status?jobId=xxx` - Job status
- `GET /api/site-scrape/scores?brandProfileId=xxx` - Get scores
- `GET /api/site-scrape/page?brandProfileId=xxx&pageUrl=xxx` - Page details

**Database Tables:**
- `scrape_jobs` - Job tracking
- `sitemap_pages` - Discovered pages
- `page_snapshots` - HTML snapshots
- `page_scores` - Per-page scores
- `site_structure_scores` - Site-wide scores

**Code Locations:**
- Services: `lib/services/site-scraping-orchestrator.service.ts`
- API Routes: `app/api/site-scrape/`
- Components: `components/technical-structure/`
- Dashboard: `app/dashboard/technical/page.tsx`
