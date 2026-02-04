# PostHog Quick Reference

## 🔑 Environment Variables

```bash
# .env.local
POSTHOG_API_KEY="phc_xxx"                    # Server-side (Mastra AI tracking)
NEXT_PUBLIC_POSTHOG_KEY="phc_xxx"           # Client-side (User events)
NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
```

**Note:** Use the SAME key for both variables.

## 📊 Quick Track Examples

```tsx
import { trackEvent } from '@/lib/analytics/posthog-events'

// Analysis
trackEvent.analysisStarted(brandProfileId, 'unified')
trackEvent.analysisCompleted(brandProfileId, 'unified', 45000, { geo_score: 85 })
trackEvent.analysisFailed(brandProfileId, 'unified', 'API timeout')

// Campaigns
trackEvent.campaignCreated(campaignId, 'blog_post', 'linkedin')
trackEvent.contentGenerated(campaignId, 'article', 'gpt-4', 1500)
trackEvent.contentPublished(campaignId, 'github', 'markdown')

// AI Referrals
trackEvent.aiReferralDetected(brandProfileId, 'ChatGPT', 'Best GEO tools')

// Integrations
trackEvent.githubIntegrationConnected(brandProfileId, 5)
trackEvent.trackingScriptInstalled(brandProfileId, 'https://example.com')

// Site Scraping
trackEvent.siteScrapeStarted(brandProfileId, 'example.com', 100)
trackEvent.siteScrapeCompleted(brandProfileId, 'example.com', 87, 120000)

// Onboarding
trackEvent.onboardingStepCompleted(3, 'Connect GitHub')
trackEvent.onboardingCompleted(5, 300000)

// Agents
trackEvent.agentDeployed(agentId, 'gap-analysis', brandProfileId)
trackEvent.agentExecuted(agentId, 'content-generator', 8000, 'success')

// Generic
trackEvent.featureUsed('export_csv', { rows: 150 })
trackEvent.settingsChanged('email_notifications', true)
trackEvent.dataExported('analysis_results', 'pdf', 50)
```

## 🎯 Set User Properties

```tsx
import { setBrandProperties, setUserProperties } from '@/lib/analytics/posthog-events'

// Brand properties
setBrandProperties(brandProfile.id, {
  brandName: 'Acme Inc',
  websiteUrl: 'https://acme.com',
  industry: 'SaaS',
  plan: 'premium',
})

// Custom user properties
setUserProperties({
  role: 'admin',
  team_size: 5,
  features_enabled: ['campaigns', 'agents'],
})
```

## 🪝 Use PostHog Hook

```tsx
import { usePostHog } from '@/lib/analytics/use-posthog'

function MyComponent() {
  const posthog = usePostHog()
  
  const handleClick = () => {
    posthog?.capture('custom_event', { prop: 'value' })
  }
}
```

## 🚩 Feature Flags

```tsx
import { useFeatureFlagEnabled } from 'posthog-js/react'

function ExperimentalFeature() {
  const isEnabled = useFeatureFlagEnabled('new-dashboard')
  
  if (!isEnabled) return <OldFeature />
  return <NewFeature />
}
```

## 🐛 Debug

```javascript
// Browser console
posthog.debug()
```

## 📁 Files Added

- `lib/providers/posthog-provider.tsx`
- `lib/analytics/posthog-events.ts`
- `lib/analytics/use-posthog.ts`
- `components/analytics/page-view-tracker.tsx`
- `POSTHOG_IMPLEMENTATION_GUIDE.md`

## ✅ What's Tracked

✅ Page views (automatic)  
✅ User sessions (automatic)  
✅ Clicks on key pages (automatic)  
✅ Analysis runs (dashboard)  
✅ AI agent operations (Mastra)  
✅ User/brand identification  

## 🔧 Vercel Setup

1. Project Settings → Environment Variables
2. Add: `NEXT_PUBLIC_POSTHOG_KEY` (same as POSTHOG_API_KEY)
3. Redeploy

## 📈 PostHog Dashboard URLs

- Events: https://app.posthog.com/events
- Insights: https://app.posthog.com/insights
- Session Recordings: https://app.posthog.com/recordings
- Feature Flags: https://app.posthog.com/feature_flags
