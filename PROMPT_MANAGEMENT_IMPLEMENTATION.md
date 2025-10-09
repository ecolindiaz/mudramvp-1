# AI Visibility Prompt Management System - Implementation Guide

## Overview
This implementation adds a comprehensive prompt management system with:
- Initial prompt generation during onboarding
- Persistent prompt storage in Supabase
- Prompt management UI for users to customize
- 24-hour analysis cooldown
- Analysis history tracking

## Database Schema Changes

### New Models Added to Prisma Schema

#### 1. Prompt Model
```prisma
model Prompt {
  id                String   @id @default(cuid())
  brandProfileId    Int
  text              String   @db.Text
  category          String   // "Organic", "Competitor", "How-to Guides", "Brand-Specific"
  isCustom          Boolean  @default(false)
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  brandProfile      BrandProfile @relation(fields: [brandProfileId], references: [id], onDelete: Cascade)
  
  @@map("prompts")
  @@index([brandProfileId])
  @@index([category])
  @@index([isActive])
}
```

#### 2. AnalysisRun Model
```prisma
model AnalysisRun {
  id                String   @id @default(cuid())
  brandProfileId    Int
  promptsUsed       Json     // Array of prompt IDs used
  results           Json     // Full analysis results
  overallScore      Float    @default(0)
  competitorData    Json?
  status            String   @default("completed")
  errorMessage      String?
  startedAt         DateTime @default(now())
  completedAt       DateTime?
  
  brandProfile      BrandProfile @relation(fields: [brandProfileId], references: [id], onDelete: Cascade)
  
  @@map("analysis_runs")
  @@index([brandProfileId])
  @@index([startedAt])
  @@index([overallScore])
}
```

#### 3. BrandProfile Updates
Added `lastAnalysisRunAt` field for cooldown tracking:
```prisma
model BrandProfile {
  // ... existing fields
  lastAnalysisRunAt DateTime?
  
  // New relations
  prompts           Prompt[]
  analysisRuns      AnalysisRun[]
}
```

## Migration Required

After implementation, run:
```bash
cd mudra-app
npx prisma generate
npx prisma migrate dev --name add_prompt_management
```

## New Services Created

### 1. Prompt Storage Service
**File:** `mudra-app/lib/services/prompt-storage.service.ts`

Functions:
- `generateAndSaveInitialPrompts(brandProfileId)` - Generate 50 prompts on onboarding
- `getActivePrompts(brandProfileId)` - Get all active prompts
- `getPromptsByCategory(brandProfileId, category)` - Filter by category
- `createCustomPrompt(brandProfileId, text, category)` - Add custom prompts
- `updatePrompt(promptId, updates)` - Edit prompts
- `deletePrompt(promptId)` - Soft delete (isActive = false)
- `getPromptStats(brandProfileId)` - Get statistics

### 2. Analysis Run Service
**File:** `mudra-app/lib/services/analysis-run.service.ts`

Functions:
- `createAnalysisRun(data)` - Start new analysis run
- `updateAnalysisRun(runId, updates)` - Update run status/results
- `getAnalysisRuns(brandProfileId, limit)` - Get run history
- `getLatestAnalysisRun(brandProfileId)` - Get most recent run
- `canRunAnalysis(brandProfileId)` - Check 24hr cooldown
- `updateLastAnalysisTime(brandProfileId)` - Update timestamp
- `getAnalysisStats(brandProfileId)` - Get statistics

## API Endpoints Created

### Prompt Management
1. **GET /api/prompts**
   - Query params: `brandProfileId`, `category?`, `stats?`
   - Returns: List of prompts or stats

2. **POST /api/prompts**
   - Body: `{ brandProfileId, text, category }`
   - Returns: Created prompt

3. **PATCH /api/prompts**
   - Body: `{ promptId, text?, category?, isActive? }`
   - Returns: Updated prompt

4. **DELETE /api/prompts**
   - Query params: `promptId`
   - Returns: Soft-deleted prompt

5. **POST /api/prompts/generate**
   - Body: `{ brandProfileId, brandInfo, userRequest? }`
   - Returns: AI-generated prompts

### Analysis Management
1. **GET /api/analysis/cooldown**
   - Query params: `brandProfileId`
   - Returns: `{ allowed, timeUntilNext?, lastRunAt? }`

2. **GET /api/analysis/history**
   - Query params: `brandProfileId`, `limit?`
   - Returns: Array of analysis runs

3. **GET /api/analysis/stats**
   - Query params: `brandProfileId`
   - Returns: Analysis statistics

## UI Components Created

### 1. Prompts Management Page
**File:** `mudra-app/app/dashboard/prompts/page.tsx`

Features:
- View all prompts grouped by category
- Search and filter prompts
- Add custom prompts
- Edit/delete prompts
- AI-powered prompt generation
- Category statistics

### 2. Analysis Cooldown Component
**File:** `mudra-app/components/analysis-cooldown.tsx`

Features:
- Shows analysis availability status
- Countdown timer for next analysis
- Green badge when available
- Dev mode bypass indicator

### 3. Analysis History Component
**File:** `mudra-app/components/analysis-history.tsx`

Features:
- View past analysis runs
- Score trends and comparisons
- Statistics overview (total runs, avg score, trend)
- Date/time of each analysis
- Prompt count per analysis

## Integration with Analysis Pipeline

**Updated File:** `mudra-app/lib/services/analysis-pipeline.service.ts`

Changes in `runGeoAnalysis()`:
1. Check 24hr cooldown (bypassed in dev mode)
2. Load active prompts from database
3. Generate initial prompts if none exist
4. Create AnalysisRun record (status: running)
5. Pass prompts to DirectGEO API
6. Update AnalysisRun with results
7. Update lastAnalysisRunAt timestamp

## User Flow

### Onboarding (First Time)
1. User completes brand profile form
2. Profile saved to database → returns `brandProfileId`
3. **NEW:** `generateAndSaveInitialPrompts(brandProfileId)` called
   - Uses PromptGeneration.txt system
   - Generates 50 prompts (30 Organic, 8 Competitor, 7 How-to, 5 Brand-Specific)
   - Saves to Supabase
4. Initial analysis runs with generated prompts
5. Analysis results saved with prompt IDs reference

### Subsequent Analysis
1. User clicks "Run Analysis"
2. **NEW:** System checks `canRunAnalysis()`
   - If < 24hrs: Shows countdown, blocks analysis (unless dev mode)
   - If ≥ 24hrs: Proceeds
3. System fetches active prompts from database
4. Analysis runs with stored prompts
5. Creates new AnalysisRun record
6. Updates lastAnalysisRunAt

### Prompt Management
1. User navigates to `/dashboard/prompts`
2. Views all prompts organized by category
3. Can:
   - Add custom prompts
   - Edit existing prompts
   - Disable/enable prompts
   - Search/filter prompts
   - Generate more prompts with AI
4. Next analysis uses updated prompt set

### Analysis History
1. User views analysis history component
2. Sees:
   - Total analyses run
   - Average AI visibility score
   - Score trend (improving/declining)
   - List of past runs with dates
   - Score comparisons between runs

## Environment Variables Required

No new environment variables needed. Uses existing:
- `DATABASE_URL` - Supabase connection
- `OPENAI_API_KEY` - For prompt generation

## Testing Checklist

### Database
- [ ] Run Prisma migration successfully
- [ ] Verify Prompt table created
- [ ] Verify AnalysisRun table created
- [ ] Verify BrandProfile updated

### Onboarding Flow
- [ ] Complete onboarding for new brand
- [ ] Verify 50 prompts generated and saved
- [ ] Check prompts distributed correctly by category
- [ ] Confirm initial analysis uses generated prompts

### Prompt Management
- [ ] Access `/dashboard/prompts`
- [ ] View all prompts
- [ ] Filter by category
- [ ] Search prompts
- [ ] Add custom prompt
- [ ] Edit prompt
- [ ] Delete prompt (soft delete)
- [ ] Generate more prompts with AI

### Analysis Cooldown
- [ ] Run first analysis
- [ ] Verify cooldown badge shows correctly
- [ ] Check timer countdown
- [ ] Try to run analysis before 24hrs (should block in prod)
- [ ] Verify dev mode bypass works

### Analysis History
- [ ] View analysis history
- [ ] Check statistics (total, average, trend)
- [ ] Verify run list shows correct dates
- [ ] Compare scores between runs
- [ ] Check prompt count per analysis

### Integration
- [ ] Run analysis with stored prompts
- [ ] Verify AnalysisRun created
- [ ] Check prompts saved with run
- [ ] Confirm lastAnalysisRunAt updated
- [ ] Verify analysis results saved correctly

## Development Mode Features

Set `NODE_ENV=development` to enable:
- **Cooldown Bypass**: Can run analysis anytime
- **Badge Indicator**: Shows "Dev Mode: Cooldown Bypassed"
- **Unlimited Testing**: No 24hr restriction

## Notes

1. **Prompt Generation**: Uses existing `PromptGeneration.txt` system from mudra-app/lib/Mudra Prompts/
2. **Soft Deletes**: Prompts are not deleted, just marked `isActive = false`
3. **Prompt Editing**: Users can modify AI-generated prompts
4. **Category Weights**: Organic (60%), Competitor (16%), How-to (14%), Brand-Specific (10%)
5. **Analysis History**: Stored indefinitely, limited to 10 most recent in UI by default

## Future Enhancements

Potential additions:
- Export prompts to CSV
- Import prompts from file
- Prompt templates library
- A/B testing different prompt sets
- Prompt performance analytics (which prompts get best mentions)
- Schedule automated analyses
- Email reports after analysis completion
