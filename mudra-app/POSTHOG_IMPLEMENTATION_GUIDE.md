# PostHog Analytics - Full Implementation Guide

## 🎯 Overview

PostHog is now fully integrated into Mudra for comprehensive product analytics:

- ✅ **Server-side tracking** - AI agent operations (via Mastra)
- ✅ **Client-side tracking** - User events, page views, sessions
- ✅ **Custom events** - Analysis runs, campaigns, integrations
- ✅ **User identification** - Automatic user tracking on login
- ✅ **Page view tracking** - Automatic across all routes
- ✅ **Feature flags** - Ready for A/B testing (optional)

## 📋 Setup Instructions

### 1. Configure Environment Variables

Add to your `.env.local` file:

```bash
# PostHog Analytics
POSTHOG_API_KEY="phc_your_api_key_here"  # Server-side (already working for Mastra)
NEXT_PUBLIC_POSTHOG_KEY="phc_your_api_key_here"  # Client-side (new)
NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"  # Or EU: https://eu.i.posthog.com
```

**Note:** Use the SAME key for both `POSTHOG_API_KEY` and `NEXT_PUBLIC_POSTHOG_KEY` to unify server and client events.

### 2. Vercel Deployment

Add the same environment variables in Vercel dashboard:

1. Go to your project → Settings → Environment Variables
2. Add:
   - `POSTHOG_API_KEY` (Already added ✅)
   - `NEXT_PUBLIC_POSTHOG_KEY` (Add this - same value as above)
   - `NEXT_PUBLIC_POSTHOG_HOST` (Optional, defaults to US cloud)

3. Redeploy: `git push origin main`

### 3. Get Your PostHog API Key

If you don't have a PostHog account yet:

1. Go to [posthog.com](https://posthog.com/)
2. Sign up for free (generous free tier: 1M events/month)
3. Create a new project
4. Copy your **Project API Key** from Settings → Project → API Keys
5. The key starts with `phc_`

## 📊 What's Being Tracked

### Automatic Tracking

- **Page views** - Every route change
- **User sessions** - Login/logout state
- **Click events** - Buttons, links in key areas (/dashboard, /analysis, /campaigns)
- **Form submissions** - Contact forms, settings changes
- **AI agent operations** - Via Mastra (gap analysis, content generation, etc.)

### Custom Events (Already Implemented)

| Event | Trigger | Properties |
|-------|---------|------------|
| `analysis_started` | User clicks "Run Analysis" | `brand_profile_id`, `analysis_type` |
| `analysis_completed` | Analysis finishes successfully | `duration_ms`, `geo_score`, `technical_score` |
| `analysis_failed` | Analysis encounters error | `error_message` |
| `campaign_created` | New campaign created | `campaign_id`, `campaign_type` |
| `content_generated` | AI generates content | `ai_model`, `word_count` |
| `content_published` | Content published to platform | `platform`, `content_type` |
| `ai_referral_detected` | AI referral tracked | `referral_source`, `search_query` |
| `github_integration_connected` | GitHub connected | `repo_count` |
| `site_scrape_started` | Site scraping initiated | `domain`, `max_pages` |
| `site_scrape_completed` | Scraping finished | `pages_scraped`, `duration_ms` |
| `onboarding_step_completed` | Onboarding progress | `step_number`, `step_name` |

## 🔧 Usage Examples

### Track Custom Events

```tsx
import { trackEvent } from '@/lib/analytics/posthog-events'

// In any component or API route
trackEvent.campaignCreated(campaignId, 'blog_post', 'linkedin')
trackEvent.contentGenerated(campaignId, 'article', 'gpt-4', 1500)
trackEvent.aiReferralDetected(brandProfileId, 'ChatGPT', 'Best GEO tools')
```

### Set User Properties

```tsx
import { setBrandProperties } from '@/lib/analytics/posthog-events'

// Update when brand profile loads
setBrandProperties(brandProfile.id, {
  brandName: brandProfile.companyName,
  websiteUrl: brandProfile.websiteUrl,
  industry: brandProfile.industry,
  plan: 'free', // or 'premium'
})
```

### Use PostHog Hook (Advanced)

```tsx
import { usePostHog } from '@/lib/analytics/use-posthog'

function MyComponent() {
  const posthog = usePostHog()
  
  const handleSpecialAction = () => {
    posthog?.capture('special_action', {
      custom_property: 'value',
    })
  }
}
```

### Check Feature Flags

```tsx
import { useFeatureFlagEnabled } from 'posthog-js/react'

function ExperimentalFeature() {
  const isEnabled = useFeatureFlagEnabled('new-dashboard')
  
  if (!isEnabled) return null
  return <NewDashboard />
}
```

## 📈 PostHog Dashboard

### Insights to Create

1. **Analysis Funnel**
   - Steps: Dashboard Page View → Analysis Started → Analysis Completed
   - Shows conversion rate and drop-off points

2. **Feature Adoption**
   - Events: Campaign Created, Content Generated, GitHub Connected
   - Tracks which features users actually use

3. **AI Referral Performance**
   - Event: ai_referral_detected
   - Group by: referral_source
   - Shows which AI platforms drive traffic

4. **User Retention**
   - Weekly active users
   - Retention cohorts by signup date

5. **Error Tracking**
   - Event: analysis_failed, *_failed
   - Alerts on spike in failures

### Recommended Dashboards

Create these in PostHog:

1. **Product Overview**
   - Daily/Weekly active users
   - Page views trend
   - Top pages
   - Session duration

2. **Analysis Performance**
   - Analyses started vs completed
   - Average analysis duration
   - Failure rate by type
   - Cooldown violations

3. **Campaign Performance**
   - Campaigns created
   - Content generated
   - Publishing rate
   - AI models used

4. **User Engagement**
   - Feature usage breakdown
   - Integration adoption
   - Power users (analysis frequency)

## 🔍 Debugging

### Check if PostHog is Working

Open browser console and type:
```javascript
posthog.debug()
```

You should see PostHog logs with each event.

### Verify Events in PostHog

1. Go to PostHog → Activity
2. Filter by your user email
3. See real-time events streaming in

### Common Issues

**Events not appearing:**
- Check `NEXT_PUBLIC_POSTHOG_KEY` is set (must start with `phc_`)
- Verify domain is allowed in PostHog project settings
- Check browser console for errors
- Ensure adblockers aren't blocking PostHog

**Server events working but not client events:**
- Client needs `NEXT_PUBLIC_` prefix
- Rebuild: `npm run build` or redeploy

**User not identified:**
- Check NextAuth session is active
- Verify user.id exists in session
- Look for "User identified" log in console (dev mode)

## 🎨 Advanced Features

### Session Recordings

Session recordings are enabled by default. To disable (saves costs):

```bash
NEXT_PUBLIC_POSTHOG_DISABLE_RECORDINGS="true"
```

### Privacy Compliance

PostHog respects:
- Do Not Track (DNT) browser setting
- GDPR-compliant (EU hosting available)
- User can opt-out via `posthog.opt_out_capturing()`

### Self-Hosted PostHog

If using self-hosted instance:

```bash
NEXT_PUBLIC_POSTHOG_HOST="https://your-posthog-instance.com"
```

## 📝 Files Created/Modified

### New Files
- ✅ `lib/providers/posthog-provider.tsx` - Client provider
- ✅ `lib/analytics/posthog-events.ts` - Event tracking utilities
- ✅ `lib/analytics/use-posthog.ts` - React hook
- ✅ `components/analytics/page-view-tracker.tsx` - Page view tracking

### Modified Files
- ✅ `app/layout.tsx` - Added PostHogProvider and PageViewTracker
- ✅ `app/dashboard/page.tsx` - Added analysis tracking
- ✅ `.env.example` - Added PostHog variables
- ✅ `package.json` - Added `posthog-js` dependency

### Existing (Already Working)
- ✅ `mastra/index.ts` - Server-side AI tracing (already configured)

## 🚀 Next Steps

1. **Add tracking to remaining features:**
   - Campaigns page (campaign creation)
   - Agent Lab (agent deployment)
   - Settings (settings changes)
   - Tracking setup (script installation)

2. **Create PostHog dashboards:**
   - User engagement metrics
   - Feature adoption rates
   - Analysis performance

3. **Set up alerts:**
   - Spike in analysis failures
   - Drop in daily active users
   - Error rate threshold

4. **A/B testing with feature flags:**
   - Test new dashboard layouts
   - Experiment with onboarding flows
   - Try different pricing CTAs

## 📞 Support

- PostHog Docs: https://posthog.com/docs
- PostHog Community: https://posthog.com/questions
- Slack: https://posthog.com/slack

---

**Implementation Status:** ✅ Complete (Phase 2 & 3 done)

PostHog is now tracking both server-side AI operations and client-side user behavior. Configure the environment variables in Vercel to start seeing production data.
