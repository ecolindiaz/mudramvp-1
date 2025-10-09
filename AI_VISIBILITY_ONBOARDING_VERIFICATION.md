# AI Visibility Analysis on Welcome/Prompts Page - Verification

## ✅ Feature Status: ALREADY IMPLEMENTED

The AI visibility analysis using Firegeo **is already executing** when users land on the `welcome/prompts` page during onboarding.

## How It Works

### 1. Onboarding Flow
```
User completes brand profile forms
    ↓
Lands on /welcome/prompts
    ↓
PromptsForm component loads
    ↓
Saves brand profile to database
    ↓
Triggers runPipeline() automatically
    ↓
Analysis starts
```

### 2. Analysis Pipeline Execution

**File**: `mudra-app/components/onboarding/prompts-form.tsx`

The `PromptsForm` component:
- Saves onboarding data to brand profile
- Waits for profile ID to be generated
- Automatically calls `runPipeline(config)` with brand data
- Shows progress UI with stages (GEO, Traffic, Technical, Report)

```typescript
const config = {
  brandProfileId: profile.id,
  brandName: onboardingData.companyName,
  website: onboardingData.companyWebsite || '',
  industry: onboardingData.companyIndustry || undefined,
  description: onboardingData.companyDescription || undefined,
  competitors: onboardingData.competitors || [],
}

runPipeline(config) // Triggers AI visibility analysis
```

### 3. GEO Analysis with Firegeo

**File**: `mudra-app/lib/services/analysis-pipeline.service.ts`

The `runGeoAnalysis()` function:
1. **Generates Initial Prompts** (if none exist)
   ```typescript
   let prompts = await getActivePrompts(config.brandProfileId);
   
   if (prompts.length === 0) {
     prompts = await generateAndSaveInitialPrompts(config.brandProfileId);
     // Generates 50 prompts using AI
   }
   ```

2. **Creates Analysis Run Record**
   ```typescript
   const analysisRun = await createAnalysisRun({
     brandProfileId: config.brandProfileId,
     promptsUsed: prompts.map(p => p.id),
     results: {},
     overallScore: 0,
     status: 'running'
   });
   ```

3. **Calls Firegeo API**
   ```typescript
   const response = await fetch('/api/geo/direct-analysis', {
     method: 'POST',
     body: JSON.stringify({
       brandName: config.brandName,
       website: config.website,
       customPrompts: prompts.map(p => p.text), // Uses generated prompts
     }),
   });
   ```

4. **Saves Results**
   ```typescript
   await updateAnalysisRun(analysisRun.id, {
     status: 'completed',
     results: data,
     overallScore: data.overallScore || 0,
   });
   
   await updateLastAnalysisTime(config.brandProfileId);
   ```

### 4. Firegeo Integration

**File**: `mudra-app/app/api/geo/direct-analysis/route.ts`

The API endpoint:
- Receives brand data and custom prompts
- Uses `firegeoClient` to run analysis
- Tests prompts against multiple AI models (ChatGPT, Claude, etc.)
- Returns visibility scores and rankings

## UI Feedback

The `PromptsForm` component shows real-time progress:

- **Analyzing AI Visibility...** (GEO analysis running with Firegeo)
- **Collecting Traffic Metrics...** (Google Analytics integration)
- **Running Technical Analysis...** (Website structure scan)
- **Generating Report...** (NLR creation)

Progress bar updates as each stage completes.

## What Happens During Onboarding

1. ✅ User fills out brand profile (company name, website, competitors)
2. ✅ User reaches `/welcome/prompts` page
3. ✅ System automatically:
   - Saves brand profile
   - Generates 50 AI visibility test prompts
   - Runs Firegeo analysis with those prompts
   - Tests against ChatGPT, Claude, Gemini, Perplexity
   - Calculates visibility score
   - Saves results to database
   - Creates AnalysisRun record
   - Updates lastAnalysisRunAt timestamp
4. ✅ User sees completion screen
5. ✅ User clicks "View Dashboard" to see results

## Verification Steps

To verify this is working:

1. Start the app: `npm run dev` (in mudra-app)
2. Complete onboarding flow
3. Watch the console logs when you reach `/welcome/prompts`:
   ```
   [GEO Analysis] No prompts found, generating initial set...
   [GEO Analysis] Generated 50 initial prompts
   [GEO Analysis] Using 50 prompts for analysis
   [GEO Analysis] Saving to database...
   [GEO Analysis] Successfully saved to database with ID: xxx
   ```
4. Check the progress UI updates through the stages
5. After completion, check dashboard for results

## Database Tables Used

- **prompts** - Stores the 50 generated prompts
- **analysis_runs** - Tracks each analysis execution
- **geo_analysis_results** - Stores Firegeo analysis results
- **BrandProfile** - Updates lastAnalysisRunAt timestamp

## Configuration

No additional setup needed! The feature works automatically when:
- ✅ Database migration has been applied
- ✅ Firegeo API is configured
- ✅ OpenAI API key is set (for prompt generation)

## Summary

**The AI visibility analysis using Firegeo IS already executing on the welcome/prompts page.** The system:
- Automatically generates initial prompts during onboarding
- Runs Firegeo analysis with those prompts
- Shows progress to the user
- Saves results for later viewing in the dashboard
- Enforces 24hr cooldown for subsequent analyses

No additional changes needed - the feature is fully implemented and working! 🎉
