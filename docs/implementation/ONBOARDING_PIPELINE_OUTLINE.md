# Complete Onboarding Pipeline Architecture

## Overview
The onboarding pipeline guides new users through collecting their brand information and automatically runs a comprehensive AI visibility analysis. The pipeline consists of **6 frontend steps** followed by an **automated 3-stage backend analysis**.

---

## Part 1: Frontend User Journey (6 Steps)

### Step 1: Welcome Form (`/welcome`)
**Component**: `welcome-form.tsx`  
**Purpose**: Collect basic company information  
**Data Collected**:
- Company Name (required)
- Company Website (required)
- Company Social Media (optional)

**Flow**:
1. User enters company details
2. Data saved to `OnboardingContext` (React Context)
3. Data persisted to localStorage for recovery
4. Redirects to → `/welcome/profile`

---

### Step 2: Profile Form (`/welcome/profile`)
**Component**: `profile-form.tsx`  
**Purpose**: Collect user/personal information  
**Data Collected**:
- User Name (required)
- User Role (required)

**Flow**:
1. User enters personal details
2. Data merged into `OnboardingContext`
3. Redirects to → `/welcome/company`

---

### Step 3: Company Form (`/welcome/company`)
**Component**: `company-form.tsx`  
**Purpose**: Collect detailed company profile  
**Data Collected**:
- Company Description (required)
- Industry (required)
- Services/Products (array)
- Target ICP (Ideal Customer Profile - array)

**Flow**:
1. User provides company details
2. Data merged into `OnboardingContext`
3. Redirects to → `/welcome/competitors`

---

### Step 4: Competitors Form (`/welcome/competitors`)
**Component**: `competitors-form.tsx`  
**Purpose**: Identify competitive landscape  
**Data Collected**:
- List of competitor companies/brands (array)

**Flow**:
1. User adds competitor names
2. Data merged into `OnboardingContext`
3. Redirects to → `/welcome/visibility`

---

### Step 5: Visibility/Knowledge Base Form (`/welcome/visibility`)
**Component**: `visibility-form.tsx` / `knowledge-base-form.tsx`  
**Purpose**: Upload supporting materials (optional)  
**Data Collected**:
- Knowledge base files (documents, case studies, etc.)

**Flow**:
1. User uploads files (optional)
2. Files stored in `OnboardingContext`
3. Redirects to → `/welcome/prompts`

---

### Step 6: Prompts/Analysis Page (`/welcome/prompts`)
**Component**: `prompts-form.tsx`  
**Purpose**: Trigger and monitor the analysis pipeline  

**Critical Flow**:
1. **Save Phase**:
   - Calls `saveToProfile()` from OnboardingContext
   - Converts onboarding data to BrandProfile format
   - Creates new BrandProfile record in database
   - Receives brandProfileId from database

2. **Analysis Trigger Phase**:
   - After profile saved, sets `analysisStarted = true`
   - Constructs pipeline config:
     ```typescript
     {
       brandProfileId: profile.id,
       brandName: companyName,
       website: companyWebsite,
       industry: companyIndustry,
       description: companyDescription,
       competitors: competitors[]
     }
     ```
   - Calls `runPipeline(config)` hook

3. **Monitoring Phase**:
   - Displays real-time progress (0-100%)
   - Shows current stage messages
   - Tracks 3 analysis stages + report generation
   - On completion → redirects to `/dashboard`

---

## Part 2: Backend Analysis Pipeline (3 Stages + Report)

### Pipeline Orchestration
**Service**: `analysis-pipeline.service.ts`  
**Function**: `triggerAnalysisPipeline(config)`  
**API Endpoint**: `POST /api/analysis/pipeline`

**Execution Strategy**: Stages 1-2 run in **PARALLEL** for speed, Stage 3 runs after both complete

---

### Stage 1: DirectGEO AI Visibility Analysis
**Function**: `runGeoAnalysis(config)`  
**Purpose**: Test how AI models (ChatGPT, Claude, Gemini) respond to queries about the brand

#### Sub-Steps:

1. **Cooldown Check** (Production only):
   - Service: `analysis-run.service.ts`
   - Enforces 24-hour cooldown between analyses
   - Skipped in development mode

2. **Prompt Generation**:
   - Service: `prompt-storage.service.ts`
   - Checks for existing active prompts in database
   - If none exist, generates initial prompt set:
     - **Organic**: Natural queries about the brand
     - **Competitor**: Comparative queries vs competitors
     - **How-to Guides**: Problem-solving queries
     - **Brand-Specific**: Direct brand mentions
   - Uses AI (GPT-4) to generate sophisticated prompts
   - Saves prompts to `prompts` table

3. **Create Analysis Run Record**:
   - Service: `analysis-run.service.ts`
   - Creates tracking record in `AnalysisRun` table
   - Stores: promptsUsed[], status='running', timestamp

4. **Execute DirectGEO API Call**:
   - Endpoint: `POST /api/geo/direct-analysis`
   - Sends brand info + custom prompts
   - Tests brand visibility across multiple AI models
   - Returns: analyses[], overallScore, competitorComparison[], recommendations[]

5. **Update Analysis Run**:
   - Updates status to 'completed' or 'failed'
   - Stores results, overallScore, competitorData

6. **Save to Database**:
   - Creates record in `GeoAnalysisResult` table
   - Stores: overallScore, analyses[], summary{}
   - Updates lastAnalysisTime on BrandProfile

**Output**: `geoAnalysisId` (string)

---

### Stage 2: Technical Structure Analysis
**Function**: `runTechnicalAnalysis(config)`  
**Purpose**: Analyze website technical SEO (currently placeholder)

#### Current Implementation:
- Creates placeholder record in `TechnicalStructureAnalysis` table
- Stores: websiteUrl, scores (all 0), metadata{}
- **TODO**: Integrate actual technical SEO crawling tools

**Output**: `technicalAnalysisId` (string)

---

### Stage 3: Natural Language Report Generation
**Function**: `generateAnalysisReport(data)`  
**Purpose**: Generate human-readable analysis report

#### Sub-Steps:

1. **Fetch Analysis Data**:
   - Retrieves GeoAnalysisResult by geoAnalysisId
   - Retrieves TechnicalStructureAnalysis by technicalAnalysisId

2. **Generate Report Content**:
   - Function: `generateReportContent(data)`
   - Creates sections:
     - **AI Visibility Analysis**: Overall score summary
     - **Technical Structure**: Technical findings
   - Compiles insights and recommendations
   - **TODO**: Use OpenAI/Claude to generate narrative report

3. **Save to Database**:
   - Creates record in `NaturalLanguageReport` table
   - Stores: reportText, insights[], recommendations[], metadata{}
   - Tags as reportType='onboarding'

**Output**: `reportId` (string)

---

## Data Flow Summary

```
User Input (Frontend)
  ↓
OnboardingContext (React State + localStorage)
  ↓
BrandProfile (Database Record)
  ↓
Analysis Pipeline Trigger
  ↓
┌─────────────────────┬──────────────────────┐
│  GEO Analysis       │  Technical Analysis  │ (PARALLEL)
│  (AI Visibility)    │  (SEO Structure)     │
└──────────┬──────────┴──────────┬───────────┘
           │                     │
           └──────────┬──────────┘
                      ↓
            Report Generation
                      ↓
         Dashboard with Results
```

---

## Database Tables Involved

### Onboarding Phase:
- **BrandProfile**: Core brand information
- **Prompts**: AI prompts for testing visibility

### Analysis Phase:
- **AnalysisRun**: Tracks analysis execution
- **GeoAnalysisResult**: AI visibility results
- **TechnicalStructureAnalysis**: Technical SEO results
- **NaturalLanguageReport**: Generated reports

---

## Key Services & Files

### Frontend:
- `components/onboarding/onboarding-context.tsx` - State management
- `components/onboarding/welcome-form.tsx` - Step 1
- `components/onboarding/profile-form.tsx` - Step 2
- `components/onboarding/company-form.tsx` - Step 3
- `components/onboarding/competitors-form.tsx` - Step 4
- `components/onboarding/visibility-form.tsx` - Step 5
- `components/onboarding/prompts-form.tsx` - Step 6 + trigger
- `components/brand-profile-context.tsx` - Profile state management
- `hooks/use-analysis-pipeline.ts` - Pipeline execution hook

### Backend:
- `lib/services/analysis-pipeline.service.ts` - Main orchestrator
- `lib/services/prompt-storage.service.ts` - Prompt management
- `lib/services/prompt-generation.service.ts` - AI prompt generation
- `lib/services/analysis-run.service.ts` - Analysis tracking
- `app/api/analysis/pipeline/route.ts` - Pipeline API endpoint
- `app/api/geo/direct-analysis/route.ts` - GEO analysis endpoint

---

## Progress Tracking

The pipeline reports progress through these states:

### Progress Object:
```typescript
{
  geoAnalysis: 'pending' | 'completed' | 'failed',
  technicalStructure: 'pending' | 'completed' | 'failed',
  report: 'pending' | 'completed' | 'failed'
}
```

### Overall States:
- **idle**: Not started
- **running**: Analysis in progress
- **completed**: All stages successful
- **error**: One or more stages failed

### User-Facing Messages:
- "Preparing analysis..." (idle)
- "Analyzing AI Visibility..." (GEO pending)
- "Running Technical Analysis..." (Technical pending)
- "Generating Report..." (Report pending)
- "Analysis Complete" (completed)
- "Analysis Failed" (error)

---

## Error Handling

### Frontend:
- Local validation on each form
- Display error messages inline
- Allow users to continue to dashboard even if analysis fails

### Backend:
- Each stage has try-catch error handling
- Failed stages saved to database with error messages
- Pipeline continues even if individual stages fail
- Overall success = all stages completed

### Recovery:
- OnboardingContext data persisted to localStorage
- Users can refresh and resume from last step
- Analysis can be re-run from dashboard

---

## Recent Changes (October 2025)

### Removed: Organic Traffic Metrics
- **Stage 2 was**: Organic Traffic Metrics Collection
- **Reason for removal**: Simplified onboarding, moved to post-onboarding
- **Impact**: 
  - Removed `collectTrafficMetrics()` function
  - Removed `gaPropertyId` from config
  - Removed traffic progress tracking
  - Reports now only cover AI Visibility + Technical Structure
  - Faster pipeline execution (2 parallel stages instead of 3)

---

## Future Enhancements

### Planned:
1. **Technical Analysis Integration**:
   - Actual website crawling
   - Lighthouse API integration
   - Structured data validation

2. **AI Report Generation**:
   - Use GPT-4/Claude to write narrative reports
   - Personalized recommendations
   - Industry-specific insights

3. **Prompt Optimization**:
   - A/B test prompt effectiveness
   - Learn from analysis results
   - Auto-generate better prompts over time

4. **Analytics Integration** (Post-onboarding):
   - Google Analytics connection
   - Search Console integration
   - Traffic metrics dashboard

---

## Testing & Development

### Development Mode Features:
- 24-hour cooldown disabled
- Detailed console logging throughout pipeline
- Mock data accepted for testing
- Analysis can be run multiple times

### Key Logs to Monitor:
- `[Pipeline]` - Main orchestrator
- `[GEO Analysis]` - AI visibility stage
- `[Technical Analysis]` - Technical stage
- `[Report Generation]` - Report stage
- `[PromptsForm]` - Frontend trigger
- `🟣/🔵/🟢/🔴` - Color-coded frontend logs

---

## Performance Considerations

### Optimization Strategies:
1. **Parallel Execution**: GEO + Technical run simultaneously
2. **Async Operations**: Non-blocking database writes
3. **Progress Updates**: Real-time feedback to users
4. **Error Isolation**: One stage failure doesn't break pipeline
5. **Background Processing**: Analysis runs after profile creation

### Typical Execution Time:
- Profile Creation: < 1 second
- GEO Analysis: 30-60 seconds (depends on prompt count)
- Technical Analysis: < 5 seconds (placeholder)
- Report Generation: < 2 seconds
- **Total**: ~40-70 seconds for complete pipeline

---

## Completion & Next Steps

After pipeline completes:
1. User sees "Analysis Complete!" message
2. Progress shows 100% with all stages ✓
3. "View Dashboard" button appears
4. User redirected to `/dashboard`
5. Dashboard displays:
   - Overall AI visibility score
   - Analysis insights
   - Recommendations
   - Competitor comparison
   - Historical analysis data
