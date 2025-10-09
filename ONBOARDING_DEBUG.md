# Onboarding Analysis Trigger - Debug Guide

## Issue
The AI visibility analysis is not triggering when reaching the `/welcome/prompts` page during onboarding.

## Root Cause
The original code had a condition checking `profile.id > 0`, but the profile ID was `0` after saving, preventing the analysis from running.

## Fix Applied
Changed the trigger condition from:
```typescript
if (analysisStarted && profile?.id && profile.id > 0)
```

To:
```typescript
if (analysisStarted && onboardingData.companyName)
```

## Steps to Test

1. **Clear Browser Cache and LocalStorage**
   - Open DevTools (F12)
   - Go to Console tab
   - Run: `localStorage.clear()`
   - Hard refresh: Ctrl+Shift+R (or Ctrl+F5)

2. **Go Through Onboarding**
   - Navigate to `/welcome`
   - Fill out all forms
   - Click "Next" through each step
   - When you reach the "Prompts" page, watch the console

3. **Expected Console Logs**
   You should see these messages in order:
   ```
   🟣 [PromptsForm] Component mounted
   🔵 [PromptsForm] Starting save process...
   🔵 [PromptsForm] Profile saved, waiting for state update...
   🔵 [PromptsForm] Setting analysisStarted to true
   🟢 [PromptsForm] Profile ID check - analysisStarted: true
   🟢 [PromptsForm] Starting analysis with profile data  ← THIS IS THE KEY LOG
   🟢 [PromptsForm] Pipeline config: {...}
   ```

4. **If Analysis Still Doesn't Trigger**
   
   Check if you see this log:
   ```
   🟢 [PromptsForm] Starting analysis with profile data
   ```
   
   - **YES** - Analysis is triggering, check the pipeline/API logs
   - **NO** - The component needs to be refreshed, try:
     - Hard refresh (Ctrl+Shift+R)
     - Clear localStorage: `localStorage.clear()`
     - Restart dev server

## What Should Happen

Once the analysis triggers, you should see:
1. Progress UI showing stages: "Analyzing AI Visibility..."
2. API calls to `/api/geo/direct-analysis`
3. Firegeo processing prompts
4. Results saved to database
5. Completion screen

## Current Known Issues

1. **Database Schema Not Migrated**
   - The `userId`, `prompts`, and `analysis_runs` tables haven't been created yet
   - This causes a warning in Firegeo: "API token has no userId"
   - **Impact**: Analysis runs but results won't be saved properly

2. **To Fix Database Issue**
   ```powershell
   cd mudra-app
   npx prisma db push --accept-data-loss
   # OR
   npx prisma migrate dev --name add_user_and_prompt_models
   ```

## Temporary Workaround

The code now handles missing userId gracefully:
- Creates brand profile without userId if schema not migrated
- Analysis runs with brandProfileId = 0 as fallback
- Results are still returned to frontend, just not persisted

## Next Steps

1. Test that analysis triggers with the fixed code
2. Apply database migration to enable user creation and result persistence
3. Verify end-to-end flow saves results correctly
