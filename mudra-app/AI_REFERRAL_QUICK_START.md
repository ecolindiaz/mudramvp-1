# AI Referral Tracking - Quick Start ✅

## Status: PRODUCTION READY 🚀

All test/mock data has been removed. The system is now ready for real tracking via GitHub agent.

---

## ✅ What Just Happened

**Cleanup Complete:**
- ✅ Deleted 5 test visits
- ✅ Deleted 1 test analytics record
- ✅ Reset tracking status to `not_connected`
- ✅ Preserved your Site ID: `site_1_63c512fbca5a827a`

**System Status:**
- ✅ GitHub agent is fully functional
- ✅ Tracking script generator is ready
- ✅ API endpoints are operational
- ✅ Database schema is up-to-date
- ✅ Privacy features enabled (SHA256 hashing)

---

## 🚀 Next Steps (5 Minutes to Live Tracking)

### Step 1: Connect GitHub (2 min)
1. Go to **http://localhost:3000/dashboard/integrations**
2. Click **"Install"** on GitHub card
3. Authorize Mudra GitHub App
4. Grant access to your website repository

**Already installed?** Click "Sync Existing Installation" instead.

### Step 2: Auto-Install Tracking (2 min)
1. Go to **http://localhost:3000/dashboard**
2. Find **"AI Referral Traffic"** card
3. Click **"Auto-Install with Agent"** button
4. Wait for agent to create PR (~30 seconds)

### Step 3: Merge PR (1 min)
1. Click PR link in success toast
2. Review changes in GitHub
3. Click **"Merge pull request"**
4. **Tracking is now LIVE! 🎉**

---

## 🧪 How to Test

### After merging the PR:

**Option 1: Visit from AI Assistant**
1. Ask ChatGPT: "Visit [your-website-url]"
2. Check Dashboard → AI Referral Traffic
3. You should see 1 visit from ChatGPT

**Option 2: Simulate Visit via API**
```bash
curl -X POST http://localhost:3000/api/analytics/track \
  -H "Content-Type: application/json" \
  -d '{
    "siteId": "site_1_63c512fbca5a827a",
    "referrer": "https://chatgpt.com/",
    "aiProvider": "chatgpt",
    "path": "/",
    "userAgent": "Mozilla/5.0",
    "sessionId": "test_session_123"
  }'
```

**Check Analytics:**
```bash
curl http://localhost:3000/api/analytics/ai-referral?brandProfileId=1
```

---

## 📊 What You'll See in Dashboard

Once tracking is live, the **AI Referral Traffic** card will show:

### Real-Time Metrics:
- **Total Visits** - All AI-driven traffic
- **Platform Breakdown:**
  - 🤖 ChatGPT visits
  - 🧠 Claude visits
  - 🔎 Perplexity visits
  - ✨ Gemini visits
- **Top Pages** - Most visited URLs
- **Growth Rate** - % change from last period
- **Status Badge:**
  - 🔴 Not Connected
  - 🟡 Pending (PR created, not merged)
  - 🟢 Connected (tracking live)

---

## 🔧 Agent Features

### Automatic Framework Detection:
- ✅ Next.js (App Router & Pages Router)
- ✅ React (CRA, Vite)
- ✅ Vue.js (2 & 3)
- ✅ Angular
- ✅ Svelte
- ✅ Static HTML

### Smart File Selection:
- **Next.js App Router:** `app/layout.tsx`
- **Next.js Pages:** `pages/_document.tsx` or `pages/_app.tsx`
- **React/Vue:** `public/index.html`
- **Static HTML:** `index.html`

### PR Quality:
- ✅ Detailed commit message
- ✅ Comprehensive PR description
- ✅ Framework detection details
- ✅ Installation instructions
- ✅ Privacy & performance notes

---

## 🛡️ Privacy & Security

**Built-In Privacy Protection:**
- ✅ IP addresses are SHA256 hashed before storage
- ✅ No personal data collection (no cookies, no localStorage)
- ✅ GDPR compliant
- ✅ User can opt-out anytime

**Performance:**
- ✅ Async loading (zero blocking)
- ✅ ~2KB script size
- ✅ Uses `sendBeacon` (reliable, non-blocking)
- ✅ No external dependencies

---

## 📁 Key Files Reference

### Agent Implementation:
- `app/api/agents/execute/route.ts` - Agent execution logic
  - Lines 505-775: `installTracking()` function
- `lib/services/tracking-script-generator.service.ts` - Script generation
- `lib/services/framework-detector.service.ts` - Framework detection
- `lib/services/tracking-script-injector.service.ts` - Code injection

### API Endpoints:
- `/api/analytics/script` - Generate tracking script
- `/api/analytics/track` - Record visit
- `/api/analytics/ai-referral` - Get analytics data
- `/api/agents/deploy` - Deploy agent
- `/api/agents/execute` - Execute agent action

### Frontend:
- `components/dashboard/overview-metrics.tsx` - Dashboard card (lines 168-248)
- `public/tracker.js` - Client-side tracking script

### Database:
- `prisma/schema.prisma` - Database models
  - `AIReferralVisit` - Individual visits
  - `AIReferralAnalytics` - Daily aggregates
  - `BrandProfile` - Tracking config

---

## 🚨 Troubleshooting

### Agent says "Could not detect framework"
**Fix:** Ensure standard project structure or use manual installation

### "No repositories found"
**Fix:** Grant repository access in GitHub App settings

### PR creation failed
**Fix:** Check GitHub App has write permissions

### Tracking not working after merge
**Fix:** 
1. Verify script loads (check browser Network tab for `tracker.js`)
2. Visit from AI assistant
3. Status updates to "connected" on first visit

---

## 📚 Full Documentation

For complete details, see:
- **AI_REFERRAL_PRODUCTION_GUIDE.md** - Comprehensive setup guide
- **AI_REFERRAL_IMPLEMENTATION_COMPLETE.md** - Technical architecture
- **GITHUB_AGENT_AUTO_INSTALL_STATUS.md** - Agent functionality

---

## ✨ You're All Set!

**Current Status:**
- ✅ System cleaned and ready
- ✅ Site ID: `site_1_63c512fbca5a827a`
- ✅ Agent ready to deploy
- ⏳ Waiting for you to click "Auto-Install"

**Expected Timeline:**
- 2 min: Connect GitHub
- 2 min: Auto-install via agent
- 1 min: Merge PR
- **→ LIVE tracking in 5 minutes!** 🎉

---

**Need Help?**  
Check the full guides in the `mudra-app/` directory or review agent logs:
```bash
docker logs mudra-app-dev | grep "\[Agent\]"
```

**Ready to Go?**  
👉 http://localhost:3000/dashboard
