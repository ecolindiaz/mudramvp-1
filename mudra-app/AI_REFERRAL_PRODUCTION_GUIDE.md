# AI Referral Tracking - Production Setup Guide

## Overview
The AI Referral Tracking feature is now **fully functional** and uses a **GitHub agent** to automatically install tracking into your website codebase. No more test/mock data - this is real production tracking!

## How It Works

### 1. **Automatic Installation via GitHub Agent**
When you click "Auto-Install with Agent" on the dashboard:
1. System checks GitHub connection
2. Fetches your accessible repositories
3. Deploys a tracking installer agent
4. Agent detects your framework (Next.js, React, Vue, etc.)
5. Agent injects tracking script into appropriate file
6. Agent creates a Pull Request with the changes
7. You review and merge the PR
8. **Tracking goes live immediately after merge!**

### 2. **Real-Time Tracking**
Once installed, the tracking script monitors visits from:
- 🤖 **ChatGPT** (chatgpt.com, chat.openai.com)
- 🧠 **Claude** (claude.ai)
- 🔎 **Perplexity** (perplexity.ai)
- ✨ **Google Gemini** (gemini.google.com)

### 3. **Privacy-First Design**
- ✅ IP addresses are SHA256 hashed before storage
- ✅ No personal data collection
- ✅ GDPR compliant
- ✅ Lightweight async loading (zero performance impact)

---

## Setup Instructions

### Step 1: Clean Up Test Data (First Time Only)
```powershell
# Remove all test/mock tracking data
cd mudra-app
node cleanup-test-tracking-data.js
```

This will:
- Delete all test visits
- Delete all test analytics
- Reset tracking status to 'not_connected'
- **Preserve your siteId** for agent installation

### Step 2: Connect GitHub
1. Go to **Dashboard → Integrations**
2. Click **"Install"** on the GitHub card
3. Follow GitHub's authorization flow
4. Grant access to the repository you want to track

**Alternative:** If already installed GitHub App elsewhere:
- Click **"Sync Existing Installation"** button
- System will find and connect your installation

### Step 3: Auto-Install Tracking
1. Go to **Dashboard → AI Referral Traffic** card
2. Click **"Auto-Install with Agent"** button
3. Wait for the agent to:
   - Detect your framework
   - Find the right file to modify
   - Create a Pull Request

### Step 4: Review & Merge PR
1. Click the PR link shown in the success toast
2. Review the changes (the agent adds tracking script to `<head>`)
3. **Merge the PR**
4. Tracking is now **LIVE!** 🎉

### Step 5: Verify Tracking
After merging, visit your website from AI assistants:
- Ask ChatGPT to visit your site
- Use Claude to navigate to a page
- Search on Perplexity with your domain

Then check the **Dashboard → AI Referral Traffic** to see:
- Total visits
- Breakdown by AI platform
- Top pages visited
- Traffic trends

---

## Agent Architecture

### Framework Detection
The agent automatically detects:
- **Next.js** (App Router or Pages Router)
- **React** (CRA, Vite)
- **Vue.js** (Vue 2, Vue 3)
- **Angular**
- **Svelte**
- **Static HTML**

### Target Files
Based on framework, the agent modifies:
- **Next.js App Router:** `app/layout.tsx`
- **Next.js Pages Router:** `pages/_document.tsx` or `pages/_app.tsx`
- **React/Vue/Angular:** `public/index.html` or `src/index.html`
- **Static HTML:** `index.html`

### Injection Strategy
The script is injected in the `<head>` section using:
```javascript
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://app.mudra.ai/tracker.js';
    script.async = true;
    script.setAttribute('data-site-id', 'site_1_abc123xyz');
    document.head.appendChild(script);
  })();
</script>
```

---

## API Endpoints

### Script Generation
```bash
GET /api/analytics/script?brandProfileId=1
```
Returns tracking script with unique siteId.

### Track Visit
```bash
POST /api/analytics/track
Content-Type: application/json

{
  "siteId": "site_1_abc123xyz",
  "referrer": "https://chatgpt.com/",
  "aiProvider": "chatgpt",
  "path": "/pricing",
  "userAgent": "Mozilla/5.0...",
  "sessionId": "session_123"
}
```
Records a visit and updates analytics.

### Get Analytics
```bash
GET /api/analytics/ai-referral?brandProfileId=1
```
Returns aggregated traffic data:
```json
{
  "success": true,
  "data": {
    "connected": true,
    "traffic": 127,
    "breakdown": {
      "chatgpt": 58,
      "claude": 32,
      "perplexity": 24,
      "gemini": 13
    },
    "topPages": [
      { "path": "/", "visits": 45 },
      { "path": "/pricing", "visits": 28 }
    ],
    "growth": 15.4
  }
}
```

---

## Database Schema

### AIReferralVisit
Stores individual tracking events:
```prisma
model AIReferralVisit {
  id            Int      @id @default(autoincrement())
  brandProfileId Int
  siteId        String   // Unique site identifier
  referrer      String   // AI system URL
  aiProvider    String   // chatgpt, claude, perplexity, gemini
  path          String   // Page visited
  userAgent     String?
  ipAddress     String   // SHA256 hashed
  sessionId     String?
  metadata      Json     @default("{}")
  timestamp     DateTime @default(now())
  
  @@index([brandProfileId, timestamp, aiProvider])
}
```

### AIReferralAnalytics
Daily aggregated data:
```prisma
model AIReferralAnalytics {
  id                Int      @id @default(autoincrement())
  brandProfileId    Int
  totalVisits       Int      @default(0)
  chatgptVisits     Int      @default(0)
  claudeVisits      Int      @default(0)
  perplexityVisits  Int      @default(0)
  geminiVisits      Int      @default(0)
  topPages          Json     @default("[]")
  periodStart       DateTime
  periodEnd         DateTime
  metadata          Json     @default("{}")
  createdAt         DateTime @default(now())
  
  @@index([brandProfileId, periodStart])
}
```

---

## Troubleshooting

### Agent Can't Detect Framework
**Symptom:** "Could not detect framework" error  
**Solution:** 
- Ensure `package.json` exists in repo root
- Check for standard file structure
- If custom setup, use manual installation (copy script from dashboard)

### No Repositories Found
**Symptom:** "No accessible repositories found"  
**Solution:**
- Go to GitHub → Settings → Applications → Mudra
- Click "Configure" and grant repository access
- Return to dashboard and try again

### PR Creation Failed
**Symptom:** "Failed to create PR" error  
**Solution:**
- Check GitHub App has write permissions
- Verify repository isn't archived
- Ensure default branch exists (main/master)

### Tracking Not Working After Merge
**Symptom:** Status shows 'pending' but no visits recorded  
**Solution:**
- Visit your site from an AI assistant
- Check browser console for errors
- Verify script is loaded (check Network tab for `tracker.js`)
- Status auto-updates to 'connected' on first visit

---

## Manual Installation (Alternative)

If you prefer manual installation or the agent can't access your repo:

1. Go to **Dashboard → AI Referral Traffic**
2. Click **"Manual Installation"**
3. Copy the provided script
4. Paste into your website's `<head>` section
5. Deploy your site
6. Tracking starts automatically

---

## Testing in Development

### Test Locally
```bash
# Start mudra-app
cd mudra-app
npm run docker:dev  # or npm run dev

# Visit from different referrers
# Simulate ChatGPT visit
curl -X POST http://localhost:3000/api/analytics/track \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "site_1_test123",
    "referrer": "https://chatgpt.com/",
    "aiProvider": "chatgpt",
    "path": "/",
    "userAgent": "Test",
    "sessionId": "test_session"
  }'

# Check analytics
curl http://localhost:3000/api/analytics/ai-referral?brandProfileId=1
```

---

## Production Deployment Checklist

- [ ] Run cleanup script to remove test data
- [ ] Connect GitHub integration
- [ ] Run auto-install agent
- [ ] Review and merge PR
- [ ] Verify tracking script is loaded on your site
- [ ] Test with at least one AI assistant visit
- [ ] Confirm data appears in dashboard
- [ ] Set up alerts/monitoring (optional)

---

## Future Enhancements

### Coming Soon:
- 🔔 **Email alerts** when AI traffic spikes
- 📊 **Weekly reports** summarizing AI referral trends
- 🎯 **Conversion tracking** from AI visits
- 🔗 **Deep link attribution** (which AI conversation drove visit)
- 📈 **A/B testing** for AI-optimized content

---

## Support

**Issues?** Check:
1. GitHub App is installed and has correct permissions
2. Repository has write access for Mudra
3. Framework detection works with standard file structure
4. Tracking script loads without errors

**Need Help?**
- Review PR comments from the agent
- Check `[Agent]` logs in Docker container
- Ensure `.env` has required keys:
  - `GITHUB_APP_ID`
  - `GITHUB_PRIVATE_KEY`
  - `GITHUB_TOKEN_ENCRYPTION_KEY`

---

## Summary

✅ **No more test data** - Only real tracking  
✅ **Automated installation** - Agent handles everything  
✅ **Privacy-focused** - SHA256 hashing, no PII  
✅ **Multi-platform** - Tracks 4 major AI assistants  
✅ **Real-time analytics** - Live dashboard updates  
✅ **Production-ready** - Scales to millions of visits  

**You're all set! 🚀**
