# Mudra App Backend Architecture & Database Documentation

**Generated**: October 16, 2025  
**Stack**: Next.js 15 API Routes + Prisma ORM + PostgreSQL

---

## 🏗️ Backend Architecture Overview

### **Technology Stack**
- **Framework**: Next.js 15 App Router (API Routes in `/app/api`)
- **Database**: PostgreSQL (Hosted on Vercel/Railway/Supabase)
- **ORM**: Prisma Client
- **Authentication**: NextAuth.js
- **Validation**: Zod schemas
- **External APIs**:
  - **DirectGEO API** - Custom AI visibility testing service
  - **Firecrawl API** - Web scraping and content extraction
  - **OpenAI API** - GPT models for analysis
  - **Anthropic API** - Claude models
  - **Google AI API** - Gemini models

---

## 📊 Database Schema (Prisma)

### **Core Models**

#### **1. User**
```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  avatar        String?
  brandProfiles BrandProfile[]
  websites      Website[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

**Purpose**: User authentication and account management  
**Relations**: One-to-many with BrandProfile and Website

---

#### **2. BrandProfile** (Central Hub)
```prisma
model BrandProfile {
  id                Int      @id @default(autoincrement())
  userId            String?
  
  // Company Information
  companyName       String?
  companyWebsite    String?
  companyLinkedIn   String?
  companyTwitter    String?
  companyDescription String?
  companyIndustry   String?
  companyServices   String?
  companyICP        String?  // Ideal Customer Profile
  
  // User Information
  userName          String?
  userRole          String?
  userAvatar        String?
  
  // Analysis Metadata
  competitors       String?  // Comma-separated or JSON
  monthlySearchVolume String?
  aiRecommendations String?
  stage             String?
  resources         String?
  lastAnalysisRunAt DateTime?
  
  // Timestamps
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations (ONE brand → MANY analyses)
  user                           User?    @relation(...)
  prompts                        Prompt[]
  analysisRuns                   AnalysisRun[]
  technicalStructureAnalyses     TechnicalStructureAnalysis[]
  geoAnalysisResults             GeoAnalysisResult[]
  organicTrafficMetrics          OrganicTrafficMetrics[]
  naturalLanguageReports         NaturalLanguageReport[]
  
  @@index([userId])
}
```

**Purpose**: Central brand data hub - connects all analyses to a specific brand  
**Key Feature**: All queries filter by `brandProfileId` for data isolation  
**Created**: During onboarding (Step 3: Company Form)

---

### **Analysis Models**

#### **3. Prompt** (AI Testing Queries)
```prisma
model Prompt {
  id              Int      @id @default(autoincrement())
  brandProfileId  Int
  text            String   @db.Text
  category        String?  // Organic, Competitor, How-to, Brand-Specific
  isCustom        Boolean  @default(false)  // User-created vs AI-generated
  isActive        Boolean  @default(true)   // Used in tests or archived
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  brandProfile    BrandProfile @relation(...)
  
  @@index([brandProfileId])
  @@index([brandProfileId, isActive])
}
```

**Purpose**: Store test prompts for AI visibility analysis  
**Generation**: AI-generated (30-100 prompts) or user-created  
**Categories**:
- **Organic**: Natural search queries (40%)
- **Competitor**: Competitive comparisons (25%)
- **How-to Guides**: Tutorial-style queries (20%)
- **Brand-Specific**: Direct brand mentions (15%)

**Usage Flow**:
```
1. Brand profile created → Generate initial prompts
2. Store prompts with brandProfileId
3. Retrieve active prompts for analysis
4. Send to DirectGEO API for testing
5. Update or add custom prompts as needed
```

---

#### **4. AnalysisRun** (Execution Tracker)
```prisma
model AnalysisRun {
  id              Int      @id @default(autoincrement())
  brandProfileId  Int
  promptsUsed     Json     // Array of prompt IDs
  results         Json     // Full analysis results
  overallScore    Float    @default(0)
  status          String   @default("pending")  // pending, running, completed, failed
  ranAt           DateTime @default(now())
  completedAt     DateTime?
  
  brandProfile    BrandProfile @relation(...)
  
  @@index([brandProfileId])
  @@index([brandProfileId, ranAt])
  @@index([status])
}
```

**Purpose**: Track analysis execution and status  
**Cooldown Logic**: Checks `lastAnalysisRunAt` to enforce 5-minute cooldown  
**States**:
- `pending` - Queued for execution
- `running` - Currently processing
- `completed` - Successfully finished
- `failed` - Error occurred

---

#### **5. GeoAnalysisResult** (AI Visibility Data)
```prisma
model GeoAnalysisResult {
  id              Int      @id @default(autoincrement())
  brandProfileId  Int
  overallScore    Float    // 0-100 AI visibility score
  analyses        Json     // Provider-specific results (OpenAI, Anthropic, Google)
  summary         Json     // Aggregated insights
  timestamp       DateTime @default(now())
  
  brandProfile    BrandProfile @relation(...)
  
  @@index([brandProfileId])
  @@index([brandProfileId, timestamp])
}
```

**Purpose**: Store AI visibility test results from DirectGEO API  
**Data Structure**:
```typescript
{
  overallScore: 75.5,
  analyses: [
    {
      provider: "OpenAI",
      promptTests: [
        {
          prompt: "Best GEO platforms 2024",
          response: "...",
          brandMentioned: true,
          brandPosition: 2,
          sentiment: "positive"
        }
      ],
      brandVisibilityScore: 80,
      mentionRate: 0.75
    }
  ],
  summary: {
    brandName: "Mudra",
    competitorData: {},
    recommendations: []
  }
}
```

---

#### **6. TechnicalStructureAnalysis** (Website Health)
```prisma
model TechnicalStructureAnalysis {
  id                    Int      @id @default(autoincrement())
  brandProfileId        Int
  websiteUrl            String
  
  // Component Scores (12 total)
  overallScore          Float    // Aggregate
  technicalScore        Float    // Technical SEO
  seoScore              Float    // On-page SEO
  geoScore              Float    // GEO readiness
  performanceScore      Float
  accessibilityScore    Float
  contentQualityScore   Float
  structuredDataScore   Float
  entityRecognitionScore Float
  faqOptimizationScore  Float
  contentFreshnessScore Float
  
  // Detailed Analysis (JSON)
  rawData               Json     // Full Firecrawl results
  recommendations       Json     // AI-generated tasks
  
  timestamp             DateTime @default(now())
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  brandProfile          BrandProfile @relation(...)
  
  @@index([brandProfileId])
  @@index([brandProfileId, timestamp])
}
```

**Purpose**: Store website technical health metrics from Firecrawl scraper  
**12 Analysis Components**:
1. **SEO** - Meta tags, titles, descriptions
2. **Performance** - Page speed, Core Web Vitals
3. **Accessibility** - ARIA, alt text, semantic HTML
4. **Structured Data** - Schema.org, JSON-LD
5. **Entity Recognition** - Knowledge graph entities
6. **FAQ Optimization** - FAQ schema, Q&A pairs
7. **Content Freshness** - Publish dates, update frequency
8. **Content Authority** - Citations, statistics, expert quotes
9. **Technical Accessibility** - Mobile-friendly, HTTPS
10. **Content Quality** - Word count, readability
11. **Heading Structure** - H1-H6 hierarchy
12. **Internal Linking** - Link structure, navigation

---

#### **7. NaturalLanguageReport** (Human-Readable Summary)
```prisma
model NaturalLanguageReport {
  id              Int      @id @default(autoincrement())
  brandProfileId  Int
  reportText      String   @db.Text  // AI-generated prose
  keyFindings     Json     // Bullet points
  recommendations Json     // Actionable tasks
  geoAnalysisId   Int?
  technicalAnalysisId Int?
  createdAt       DateTime @default(now())
  
  brandProfile    BrandProfile @relation(...)
  
  @@index([brandProfileId])
  @@index([brandProfileId, createdAt])
}
```

**Purpose**: Store AI-generated analysis summaries in natural language  
**Generation**: Created during onboarding (Step 7) and on-demand  
**Used In**: Dashboard Overview page (ReportCard component)

---

### **Supporting Models**

#### **Website** (URL Tracking)
```prisma
model Website {
  id                String   @id @default(cuid())
  userId            String
  url               String
  domain            String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  technicalAnalyses TechnicalAnalysis[]
  user              User @relation(...)
  
  @@unique([userId, url])
  @@index([userId])
  @@index([domain])
}
```

**Purpose**: Track analyzed websites per user  
**Constraint**: One analysis per URL per user

---

## 🔌 API Routes Structure

### **Directory Layout**
```
app/api/
├── analysis/
│   ├── unified/route.ts          # Main analysis endpoint
│   ├── pipeline/route.ts         # Onboarding analysis
│   └── geo/
│       └── latest/route.ts       # Get latest GEO results
├── brand-profile/
│   └── route.ts                  # GET/POST brand profile
├── prompts/
│   ├── route.ts                  # CRUD operations
│   ├── generate/route.ts         # AI prompt generation
│   └── active/route.ts           # Get active prompts
├── tasks/
│   ├── route.ts                  # Task management
│   └── generate/route.ts         # AI task generation
├── auth/
│   └── [...nextauth]/route.ts    # NextAuth handlers
└── webhooks/
    └── firegeo/route.ts          # External webhooks
```

---

## 🎯 Core API Endpoints

### **1. Unified Analysis API**
**Endpoint**: `POST /api/analysis/unified`

**Purpose**: Main analysis endpoint used by dashboard  
**Process**: Runs GEO + Technical analysis in parallel

**Request Body**:
```typescript
{
  brandProfileId: number,        // Required
  brandName: string,             // Required
  website: string,               // Required
  description?: string,
  industry?: string,
  competitors?: string[],
  skipCooldown?: boolean,        // Dashboard bypass
  generateReport?: boolean       // Onboarding only
}
```

**Response**:
```typescript
{
  success: true,
  data: {
    geoAnalysisId: string,
    technicalAnalysisId: string,
    reportId?: string,
    scores: {
      aiVisibility: 75.5,
      technical: 82.3,
      seo: 78.0,
      geo: 85.2
    }
  }
}
```

**Implementation Flow**:
```javascript
1. Validate request body
2. Call runUnifiedAnalysis() service
3. Service spawns two parallel Promise.allSettled():
   a. runGeoAnalysisCore()
      - Check cooldown (unless skipCooldown)
      - Get/generate prompts
      - Call DirectGEO API
      - Save to GeoAnalysisResult table
   b. runTechnicalAnalysisCore()
      - Call Firecrawl API
      - Extract technical metrics
      - Calculate 12 component scores
      - Save to TechnicalStructureAnalysis table
4. Optionally generate NaturalLanguageReport
5. Return aggregated results
```

**Database Interactions**:
- Reads: `BrandProfile`, `Prompt` (for active prompts)
- Writes: `GeoAnalysisResult`, `TechnicalStructureAnalysis`, `AnalysisRun`, `NaturalLanguageReport?`

---

### **2. Brand Profile API**
**Endpoints**: 
- `GET /api/brand-profile` - Fetch profile
- `POST /api/brand-profile` - Create/update profile

**Purpose**: Manage brand information

**GET Response**:
```typescript
{
  id: 1,
  userId: "user_abc123",
  companyName: "Mudra",
  companyWebsite: "https://mudra.io",
  companyIndustry: "SaaS",
  companyDescription: "GEO platform for startups",
  competitors: "ycombinator.com,techstars.com",
  // ... other fields
  createdAt: "2025-10-16T...",
  updatedAt: "2025-10-16T..."
}
```

**POST Request**:
```typescript
{
  companyName: "Mudra",
  companyWebsite: "https://mudra.io",
  companyIndustry: "SaaS",
  companyDescription: "...",
  competitors: ["ycombinator.com", "techstars.com"],
  // ... other fields
}
```

**Database Operations**:
```sql
-- GET: Find by userId
SELECT * FROM BrandProfile WHERE userId = ? LIMIT 1

-- POST: Upsert (create or update)
INSERT INTO BrandProfile (...) 
VALUES (...)
ON CONFLICT (userId) DO UPDATE SET ...
```

**Service Layer** (`lib/prisma-brand-profile.ts`):
```typescript
export async function getBrandProfile(userId?: string) {
  return prisma.brandProfile.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  })
}

export async function saveBrandProfile(data: any) {
  return prisma.brandProfile.upsert({
    where: { userId: data.userId },
    update: { ...data, updatedAt: new Date() },
    create: data
  })
}
```

---

### **3. Prompts API**
**Endpoints**:
- `GET /api/prompts?brandProfileId={id}` - List prompts
- `POST /api/prompts` - Create custom prompt
- `PATCH /api/prompts` - Update prompt
- `DELETE /api/prompts?promptId={id}` - Soft delete (set isActive=false)
- `POST /api/prompts/generate` - AI-generate prompts

**GET Query Parameters**:
- `brandProfileId` (required) - Filter by brand
- `category` (optional) - Filter by Organic, Competitor, etc.
- `stats=true` (optional) - Return counts only

**GET Response**:
```typescript
{
  success: true,
  prompts: [
    {
      id: 1,
      brandProfileId: 1,
      text: "Best GEO platforms for startups in 2024",
      category: "Organic",
      isCustom: false,  // AI-generated
      isActive: true,
      createdAt: "2025-10-16T...",
      updatedAt: "2025-10-16T..."
    }
  ],
  count: 100
}
```

**POST /api/prompts/generate Flow**:
```javascript
1. Receive: { brandProfileId, count: 100 }
2. Fetch BrandProfile data
3. Call generateSophisticatedPrompts() service
4. AI generates prompts using:
   - Brand name, industry, description
   - Competitors
   - Target audience
   - Products/services
5. Distribute across categories:
   - 40 Organic
   - 25 Competitor
   - 20 How-to Guides
   - 15 Brand-Specific
6. Bulk insert into Prompt table
7. Return created prompts
```

**Database Queries**:
```sql
-- Get active prompts
SELECT * FROM Prompt 
WHERE brandProfileId = ? AND isActive = true
ORDER BY category, createdAt DESC

-- Bulk insert
INSERT INTO Prompt (brandProfileId, text, category, isCustom, isActive)
VALUES (?, ?, ?, false, true), ...

-- Soft delete
UPDATE Prompt SET isActive = false WHERE id = ?
```

---

### **4. Tasks API**
**Endpoints**:
- `GET /api/tasks?siteId={id}` - List tasks
- `PATCH /api/tasks` - Update task status
- `POST /api/tasks/generate` - AI-generate tasks from analysis

**GET Response**:
```typescript
{
  success: true,
  data: {
    tasks: [
      {
        id: "task_123",
        title: "Add Organization Schema",
        whyItMatters: "Improves brand entity recognition",
        impact: "HIGH",
        steps: ["1. Create schema.org/Organization", "2. Add to <head>"],
        tags: ["structured-data", "seo"],
        status: "open",
        confidence: 0.95
      }
    ],
    latestSnapshot: { /* website data */ }
  }
}
```

**POST /api/tasks/generate Flow**:
```javascript
1. Receive: { snapshot, siteId }
2. Extract issues from technical analysis:
   - Missing schema markup
   - Poor SEO scores
   - Accessibility violations
   - Performance problems
3. Call AI to generate actionable tasks:
   - Title: What to do
   - whyItMatters: Business impact
   - steps: Implementation guide
   - tags: Categorization
4. Save tasks to database
5. Return created tasks
```

**Database**: Uses in-memory storage or Task table (if implemented)

---

## 🔧 Service Layer Architecture

### **1. Unified Analysis Service**
**File**: `lib/services/unified-analysis.service.ts`

**Key Function**: `runUnifiedAnalysis(config)`

**Purpose**: Orchestrate parallel GEO + Technical analysis

**Flow**:
```typescript
async function runUnifiedAnalysis(config: UnifiedAnalysisConfig) {
  // 1. Spawn parallel analyses
  const [geoResult, technicalResult] = await Promise.allSettled([
    runGeoAnalysisCore(config),
    runTechnicalAnalysisCore(config)
  ])
  
  // 2. Process results
  if (geoResult.status === 'fulfilled') {
    // Save GeoAnalysisResult to database
    await prisma.geoAnalysisResult.create({ ... })
  }
  
  if (technicalResult.status === 'fulfilled') {
    // Save TechnicalStructureAnalysis to database
    await prisma.technicalStructureAnalysis.create({ ... })
  }
  
  // 3. Generate report if requested
  if (config.generateReport) {
    await generateReport({ geoAnalysisId, technicalAnalysisId })
  }
  
  return { success: true, scores: { ... } }
}
```

**Database Interactions**:
- **Reads**: 
  - `Prompt.findMany({ where: { brandProfileId, isActive: true } })`
  - `BrandProfile.findUnique({ where: { id } })`
  
- **Writes**:
  - `GeoAnalysisResult.create({ data: { ... } })`
  - `TechnicalStructureAnalysis.create({ data: { ... } })`
  - `AnalysisRun.create({ data: { ... } })`
  - `NaturalLanguageReport.create({ data: { ... } })`

---

### **2. DirectGEO Analysis Service**
**File**: `lib/services/direct-geo-analysis.service.ts`

**Purpose**: Interface with DirectGEO external API for AI visibility testing

**Process**:
```typescript
async function runGeoAnalysisCore(config) {
  // 1. Get active prompts from database
  const prompts = await getActivePrompts(config.brandProfileId)
  
  // 2. If no prompts, generate them
  if (prompts.length === 0) {
    prompts = await generateAndSaveInitialPrompts(config.brandProfileId)
  }
  
  // 3. Create analysis run record
  const analysisRun = await prisma.analysisRun.create({
    data: {
      brandProfileId: config.brandProfileId,
      promptsUsed: prompts.map(p => p.id),
      status: 'running'
    }
  })
  
  // 4. Call DirectGEO API
  const response = await fetch('DIRECTGEO_API_URL/analyze', {
    method: 'POST',
    body: JSON.stringify({
      brandName: config.brandName,
      prompts: prompts.map(p => p.text),
      competitors: config.competitors
    })
  })
  
  const data = await response.json()
  
  // 5. Save results to database
  const geoAnalysis = await prisma.geoAnalysisResult.create({
    data: {
      brandProfileId: config.brandProfileId,
      overallScore: data.overallScore,
      analyses: data.analyses,  // JSON field
      summary: data.summary      // JSON field
    }
  })
  
  // 6. Update analysis run
  await prisma.analysisRun.update({
    where: { id: analysisRun.id },
    data: {
      status: 'completed',
      results: data,
      overallScore: data.overallScore
    }
  })
  
  return { success: true, id: geoAnalysis.id, score: data.overallScore }
}
```

**External API Call** (DirectGEO):
```http
POST https://directgeo-api.com/v1/analyze
Authorization: Bearer {DIRECTGEO_API_KEY}
Content-Type: application/json

{
  "brandName": "Mudra",
  "prompts": ["Best GEO platforms 2024", ...],
  "competitors": ["ycombinator.com"],
  "providers": ["openai", "anthropic", "google"]
}
```

**DirectGEO Response**:
```json
{
  "overallScore": 75.5,
  "analyses": [
    {
      "provider": "OpenAI",
      "promptTests": [
        {
          "prompt": "Best GEO platforms 2024",
          "response": "Top platforms include Mudra, which offers...",
          "brandMentioned": true,
          "brandPosition": 2,
          "sentiment": "positive"
        }
      ],
      "brandVisibilityScore": 80,
      "mentionRate": 0.75
    }
  ],
  "recommendations": [
    "Increase content authority with more citations",
    "Add FAQ schema for better AI understanding"
  ]
}
```

---

### **3. Technical Analysis Service**
**File**: `lib/services/technical-analysis.service.ts`

**Purpose**: Scrape website and analyze technical health using Firecrawl

**Process**:
```typescript
async function runTechnicalAnalysisCore(config) {
  // 1. Call Firecrawl API to scrape website
  const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: config.website,
      formats: ['html', 'markdown'],
      onlyMainContent: false  // Get full page
    })
  })
  
  const scraperData = await scrapeResponse.json()
  
  // 2. Extract GEO metrics using enhanced scraper
  const geoData = await extractEnhancedGEOData(scraperData)
  
  // 3. Calculate 12 component scores
  const scores = {
    overall: calculateOverallScore(geoData),
    contentAuthority: geoData.geoScore.contentAuthority,
    technicalAccessibility: geoData.geoScore.technicalAccessibility,
    structuredData: geoData.geoScore.structuredData,
    entityRecognition: geoData.geoScore.entityRecognition,
    faqOptimization: geoData.geoScore.faqOptimization,
    contentFreshness: geoData.geoScore.contentFreshness,
    // ... 6 more components
  }
  
  // 4. Save to database (complex transaction with 7 related tables)
  const analysis = await prisma.$transaction(async (tx) => {
    // 4a. Main analysis record
    const technical = await tx.technicalStructureAnalysis.create({
      data: {
        brandProfileId: config.brandProfileId,
        websiteUrl: config.website,
        ...scores
      }
    })
    
    // 4b. Structured data details
    await tx.structuredData.create({
      data: {
        technicalAnalysisId: technical.id,
        jsonLdData: geoData.structuredData.jsonLd,
        schemaTypes: geoData.structuredData.schemaTypes,
        hasOrganizationSchema: !!geoData.structuredData.organizationSchema
      }
    })
    
    // 4c. Entity recognition
    await tx.entityRecognition.create({
      data: {
        technicalAnalysisId: technical.id,
        organizations: geoData.entityRecognition.organizations,
        technologies: geoData.entityRecognition.technologies
      }
    })
    
    // ... continue with 5 more related tables
    
    return technical
  })
  
  return { success: true, id: analysis.id, overallScore: scores.overall }
}
```

**Firecrawl API Call**:
```http
POST https://api.firecrawl.dev/v1/scrape
Authorization: Bearer {FIRECRAWL_API_KEY}
Content-Type: application/json

{
  "url": "https://example.com",
  "formats": ["html", "markdown"],
  "onlyMainContent": false
}
```

**Database Transaction**: Saves to 7+ related tables atomically

---

### **4. Prompt Generation Service**
**File**: `lib/services/prompt-generation.service.ts`

**Purpose**: AI-generate sophisticated test prompts

**Process**:
```typescript
async function generateSophisticatedPrompts(brandInfo) {
  // 1. Build context from brand profile
  const context = `
    Company: ${brandInfo.companyName}
    Industry: ${brandInfo.industry}
    Description: ${brandInfo.description}
    Target Audience: ${brandInfo.idealCustomer}
    Competitors: ${brandInfo.competitors.join(', ')}
    Products: ${brandInfo.productsServices.join(', ')}
  `
  
  // 2. Call OpenAI to generate prompts
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at generating GEO test prompts...'
        },
        {
          role: 'user',
          content: `Generate 100 diverse test prompts for: ${context}`
        }
      ]
    })
  })
  
  const data = await response.json()
  
  // 3. Parse and categorize prompts
  const prompts = parseGeneratedPrompts(data.choices[0].message.content)
  
  // 4. Save to database
  const created = await prisma.prompt.createMany({
    data: prompts.map(p => ({
      brandProfileId: brandInfo.id,
      text: p.text,
      category: p.category,
      isCustom: false,
      isActive: true
    }))
  })
  
  return created
}
```

**Database Interaction**:
```sql
-- Bulk insert 100 prompts
INSERT INTO Prompt (brandProfileId, text, category, isCustom, isActive)
VALUES 
  (1, 'Best GEO platforms for startups', 'Organic', false, true),
  (1, 'Mudra vs competitors comparison', 'Competitor', false, true),
  ...
  (1, 'How to improve AI visibility', 'How-to Guides', false, true)
```

---

## 🔄 Data Flow Examples

### **Example 1: Dashboard Analysis**

**Trigger**: User clicks "Run Analysis" button on dashboard

```
Frontend                  API Route               Service Layer            Database
   |                         |                         |                      |
   |-- POST /api/analysis/unified ------------------>|                      |
   |    { brandProfileId, website }                   |                      |
   |                         |                         |                      |
   |                         |-- runUnifiedAnalysis() |                      |
   |                         |                         |                      |
   |                         |             +-----------|-----+                |
   |                         |             |   Parallel      |                |
   |                         |             |   Execution     |                |
   |                         |             +-----------|-----+                |
   |                         |                    |          |                |
   |                         |       runGeoAnalysisCore()   runTechnicalAnalysisCore()
   |                         |                    |          |                |
   |                         |                    |---------|-----------------> SELECT FROM Prompt WHERE brandProfileId
   |                         |                    |<---------|----------------- [ prompts ]
   |                         |                    |          |                |
   |                         |                    |-- Call DirectGEO API      |
   |                         |                    |<- Response               |
   |                         |                    |          |                |
   |                         |                    |          |-- Call Firecrawl API
   |                         |                    |          |<- Response     |
   |                         |                    |          |                |
   |                         |                    |---------|-----------------> INSERT INTO GeoAnalysisResult
   |                         |                    |          |                |
   |                         |                    |          |-----------------> INSERT INTO TechnicalStructureAnalysis
   |                         |                    |          |                |
   |                         |<-------------------|----------|                |
   |                         |  { success, scores }          |                |
   |<-- Response ------------|                               |                |
   |    { data: { scores } }                                 |                |
   |                                                          |                |
   |-- Trigger 'mudra:website-analyzed' event                |                |
   |-- Refresh UI components                                 |                |
```

---

### **Example 2: Prompt Generation**

**Trigger**: User clicks "Generate AI Prompts" button

```
Frontend              API Route             Service Layer       External API      Database
   |                     |                       |                  |               |
   |-- POST /api/prompts/generate ----------->|                  |               |
   |    { brandProfileId }                     |                  |               |
   |                     |                       |                  |               |
   |                     |-- generatePrompts() ->|                  |               |
   |                     |                       |                  |               |
   |                     |                       |-----------------|-------------> SELECT FROM BrandProfile
   |                     |                       |<----------------|-------------- { brand data }
   |                     |                       |                  |               |
   |                     |                       |-- Call OpenAI -->|               |
   |                     |                       |  "Generate 100 prompts for..."  |
   |                     |                       |<- Response ------|               |
   |                     |                       |  { prompts: [...] }              |
   |                     |                       |                  |               |
   |                     |                       |---------------------------------> INSERT INTO Prompt (x100)
   |                     |                       |                  |               |
   |<-- Response --------|<----------------------|                  |               |
   |    { success: true, prompts: [...] }                           |               |
```

---

### **Example 3: Fetching Analysis Results**

**Trigger**: Dashboard page loads

```
Frontend              API Route             Database
   |                     |                    |
   |-- GET /api/analysis/geo/latest?brandProfileId=1 -->|
   |                     |                    |
   |                     |--------------------> SELECT * FROM GeoAnalysisResult 
   |                     |                      WHERE brandProfileId = 1 
   |                     |                      ORDER BY timestamp DESC 
   |                     |                      LIMIT 1
   |                     |                    |
   |                     |<-------------------- { geoAnalysis }
   |<-- Response --------|                    |
   |    { data: { overallScore: 75.5, ... } }|
   |                     |                    |
   |-- Render <GeoMetricsCard />             |
```

---

## 🔒 Database Query Patterns

### **Security: brandProfileId Filtering**

**Critical Pattern**: ALL user data queries MUST filter by `brandProfileId`

```typescript
// ✅ CORRECT - Filtered by brandProfileId
const prompts = await prisma.prompt.findMany({
  where: {
    brandProfileId: userBrandProfileId,  // User's own data
    isActive: true
  }
})

// ❌ WRONG - Returns all users' prompts (data leak!)
const prompts = await prisma.prompt.findMany({
  where: { isActive: true }
})
```

### **Common Query Patterns**

#### **1. Get Latest Analysis**
```typescript
const latestGeo = await prisma.geoAnalysisResult.findFirst({
  where: { brandProfileId },
  orderBy: { timestamp: 'desc' },
  include: {
    brandProfile: {
      select: { companyName: true, companyWebsite: true }
    }
  }
})
```

#### **2. Historical Trend Data**
```typescript
const history = await prisma.geoAnalysisResult.findMany({
  where: {
    brandProfileId,
    timestamp: {
      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)  // Last 30 days
    }
  },
  orderBy: { timestamp: 'asc' },
  select: {
    timestamp: true,
    overallScore: true
  }
})
```

#### **3. Aggregate Statistics**
```typescript
const stats = await prisma.prompt.groupBy({
  by: ['category'],
  where: { brandProfileId, isActive: true },
  _count: { id: true },
  _avg: { /* if you had a score field */ }
})
```

#### **4. Complex Transaction**
```typescript
const result = await prisma.$transaction(async (tx) => {
  // 1. Create analysis run
  const run = await tx.analysisRun.create({
    data: { brandProfileId, status: 'running' }
  })
  
  // 2. Save GEO results
  const geo = await tx.geoAnalysisResult.create({
    data: { brandProfileId, overallScore: 75 }
  })
  
  // 3. Update brand profile
  await tx.brandProfile.update({
    where: { id: brandProfileId },
    data: { lastAnalysisRunAt: new Date() }
  })
  
  return { run, geo }
})
```

---

## 🌐 External Service Integration

### **1. DirectGEO API**
**Purpose**: AI visibility testing across multiple providers

**Configuration**:
```env
DIRECTGEO_API_URL=https://directgeo-api.com
DIRECTGEO_API_KEY=your_api_key_here
```

**Endpoints Used**:
- `POST /analyze` - Run AI visibility test
- `GET /providers` - List available AI providers
- `POST /batch` - Batch testing

**Rate Limits**: 
- Free tier: 10 requests/hour
- Pro tier: 100 requests/hour

---

### **2. Firecrawl API**
**Purpose**: Web scraping and content extraction

**Configuration**:
```env
FIRECRAWL_API_KEY=your_api_key_here
```

**Endpoints Used**:
- `POST /v1/scrape` - Scrape single URL
- `POST /v1/crawl` - Crawl entire site
- `GET /v1/crawl/{id}` - Check crawl status

**Response Format**:
```json
{
  "success": true,
  "data": {
    "html": "<html>...</html>",
    "markdown": "# Page Title\n\n...",
    "metadata": {
      "title": "...",
      "description": "...",
      "keywords": "..."
    }
  }
}
```

---

### **3. OpenAI API**
**Purpose**: Prompt generation, task generation, NLR generation

**Configuration**:
```env
OPENAI_API_KEY=your_api_key_here
```

**Used For**:
- Generating test prompts (GPT-4)
- Creating natural language reports (GPT-4)
- Generating actionable tasks from analysis (GPT-4)

---

## 📊 Database Connection

### **Prisma Client Setup**

**File**: `lib/prisma.ts`
```typescript
import { PrismaClient } from '@prisma/client'

// Singleton pattern for Prisma Client
const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

### **Environment Variables**
```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database
DIRECT_URL=postgresql://user:password@host:5432/database  # For migrations

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# External APIs
DIRECTGEO_API_KEY=...
DIRECTGEO_API_URL=...
FIRECRAWL_API_KEY=...
OPENAI_API_KEY=...
```

### **Connection Pooling**
Prisma automatically manages connection pooling:
- **Default pool size**: 10 connections
- **Serverless**: Uses connection pooling via PgBouncer
- **Timeout**: 5 seconds

---

## 🔧 Database Migrations

### **Running Migrations**
```powershell
# Generate Prisma client
npx prisma generate

# Push schema changes (development)
npx prisma db push

# Create migration (production)
npx prisma migrate dev --name add_prompts_table

# Apply migrations (production)
npx prisma migrate deploy
```

### **Migration Files**
Located in: `prisma/migrations/`

Example migration:
```sql
-- CreateTable
CREATE TABLE "Prompt" (
  "id" SERIAL PRIMARY KEY,
  "brandProfileId" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "category" TEXT,
  "isCustom" BOOLEAN DEFAULT false,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Prompt_brandProfileId_fkey" 
    FOREIGN KEY ("brandProfileId") 
    REFERENCES "BrandProfile"("id") 
    ON DELETE CASCADE
);

-- CreateIndex
CREATE INDEX "Prompt_brandProfileId_idx" ON "Prompt"("brandProfileId");
CREATE INDEX "Prompt_brandProfileId_isActive_idx" ON "Prompt"("brandProfileId", "isActive");
```

---

## 🎯 API Error Handling

### **Standard Error Format**
```typescript
{
  success: false,
  error: {
    message: "Human-readable error message",
    code: "ERROR_CODE",  // Optional
    details: { ... }      // Optional debug info
  }
}
```

### **HTTP Status Codes**
- **200** - Success
- **400** - Bad Request (validation error)
- **401** - Unauthorized
- **404** - Not Found
- **429** - Rate Limit Exceeded
- **500** - Internal Server Error

### **Example Error Response**
```typescript
return NextResponse.json(
  {
    success: false,
    error: {
      message: 'Brand profile not found',
      code: 'BRAND_PROFILE_NOT_FOUND'
    }
  },
  { status: 404 }
)
```

---

## 🚀 Performance Optimizations

### **1. Parallel Execution**
```typescript
// Run GEO and Technical analysis in parallel
const [geoResult, techResult] = await Promise.allSettled([
  runGeoAnalysis(),
  runTechnicalAnalysis()
])
```

### **2. Database Indexes**
All foreign keys and frequently queried fields are indexed:
```prisma
@@index([brandProfileId])
@@index([brandProfileId, timestamp])
@@index([brandProfileId, isActive])
```

### **3. Selective Field Loading**
```typescript
// Only load needed fields
const profile = await prisma.brandProfile.findUnique({
  where: { id },
  select: {
    companyName: true,
    companyWebsite: true,
    // Exclude large fields like aiRecommendations
  }
})
```

### **4. Caching Strategy**
- Analysis cooldown (5 minutes) prevents excessive API calls
- Prompt generation cached in database
- Results stored for historical queries

---

## 📚 Related Documentation

- **Frontend Flow**: `/docs/mudra-app/FRONTEND_FLOW_DOCUMENTATION.md`
- **Architecture**: `/docs/architecture/UNIFIED_ANALYSIS_ARCHITECTURE.md`
- **API Specs**: `/docs/implementation/UNIFIED_ANALYSIS_IMPLEMENTATION.md`
- **Setup Guide**: `/docs/mudra-app/SETUP.md`

---

**Document Status**: ✅ Complete  
**Last Updated**: October 16, 2025  
**Maintainer**: Development Team
