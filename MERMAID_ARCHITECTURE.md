# Mudra MVP - Mermaid Architecture Diagrams

## System Architecture Overview

```mermaid
graph TB
    subgraph Analytics["Analytics & Monitoring"]
        A1[Vercel Analytics]
        A2[Prisma Insights]
        A3[Console Logging]
    end

    subgraph External["External Services"]
        E1[OpenAI ChatGPT]
        E2[Anthropic Claude]
        E3[Google Gemini]
        E4[DirectGEO API]
        E1 --> E4
        E2 --> E4
        E3 --> E4
    end

    subgraph Scraping["Web Scraping Service"]
        S1[Firecrawl API]
        S2[Enhanced GEO Scraper]
        S3[Metadata Extraction]
        S4[Schema Parser]
        S5[LLM File Checker]
    end

    subgraph Frontend["Frontend Applications"]
        F1[Next.js Web App]
        F2[Dashboard]
        F3[Onboarding]
        F4[Analytics View]
        F5[Mobile Apps - Future]
        F1 --> F2
        F1 --> F3
        F1 --> F4
    end

    subgraph API["API Layer - Next.js Routes"]
        API1[Analysis APIs]
        API2[Brand Profile APIs]
        API3[User APIs]
        API4[Scraping APIs]
        API5[Task APIs]
        API6[Prompt APIs]
    end

    subgraph Services["Business Logic Layer"]
        SV1[Unified Analysis Service]
        SV2[Analysis Pipeline Service]
        SV3[Prompt Storage Service]
        SV4[Analysis Run Service]
        SV5[Technical Score Calculator]
        SV6[Enhanced GEO Scraper]
    end

    subgraph ORM["Data Access Layer"]
        ORM1[Prisma ORM]
        ORM2[Type-safe Queries]
        ORM3[Migrations]
        ORM4[Connection Pool]
    end

    subgraph Database["PostgreSQL Database"]
        DB1[User]
        DB2[BrandProfile]
        DB3[GeoAnalysisResult]
        DB4[TechnicalStructureAnalysis]
        DB5[NaturalLanguageReport]
        DB6[Prompt]
        DB7[Task]
        DB8[Site]
        DB9[Snapshot]
    end

    Analytics -.->|Monitor| API
    External -->|HTTP/JSON| API
    Scraping -->|HTTP/JSON| API
    Frontend -->|HTTP/JSON| API
    API --> Services
    Services --> ORM
    ORM --> Database

    style Analytics fill:#e1f5ff
    style External fill:#ffe1e1
    style Scraping fill:#e1ffe1
    style Frontend fill:#fff4e1
    style API fill:#f0e1ff
    style Services fill:#ffe1f5
    style ORM fill:#e1ffe8
    style Database fill:#e8e1ff
```

## Detailed Component Architecture

```mermaid
graph LR
    subgraph Client["Client Layer"]
        C1[Browser]
        C2[Next.js App]
    end

    subgraph APIRoutes["API Routes"]
        A1[/api/analysis/unified]
        A2[/api/analysis/pipeline]
        A3[/api/analysis/geo-history]
        A4[/api/analysis/technical-history]
        A5[/api/analysis/results]
        A6[/api/brand-profile]
        A7[/api/run-scraper]
        A8[/api/prompts]
    end

    subgraph CoreServices["Core Services"]
        S1[Unified Analysis]
        S2[Analysis Pipeline]
        S3[Prompt Storage]
        S4[Technical Scorer]
    end

    subgraph ExternalAPIs["External APIs"]
        X1[DirectGEO API]
        X2[Firecrawl API]
    end

    subgraph DataLayer["Data Layer"]
        D1[(PostgreSQL)]
        D2[Prisma Client]
    end

    C1 --> C2
    C2 --> A1 & A2 & A3 & A4 & A5 & A6 & A7 & A8
    A1 & A2 --> S1
    S1 --> S2 & S3 & S4
    S1 --> X1 & X2
    S2 & S3 & S4 --> D2
    D2 --> D1

    style Client fill:#e3f2fd
    style APIRoutes fill:#f3e5f5
    style CoreServices fill:#e8f5e9
    style ExternalAPIs fill:#fff3e0
    style DataLayer fill:#fce4ec
```

## Onboarding Flow

```mermaid
sequenceDiagram
    actor User
    participant OnboardingForm
    participant OnboardingContext
    participant BrandProfileAPI
    participant Database
    participant UnifiedAnalysis
    participant DirectGEO
    participant Firecrawl
    participant Dashboard

    User->>OnboardingForm: Complete forms
    OnboardingForm->>OnboardingContext: updateData()
    OnboardingContext->>OnboardingContext: Save to localStorage
    
    User->>OnboardingForm: Click "Finish"
    OnboardingForm->>OnboardingContext: saveToProfile()
    OnboardingContext->>BrandProfileAPI: POST /api/brand-profile
    
    BrandProfileAPI->>Database: Create User
    Database-->>BrandProfileAPI: userId: 1
    BrandProfileAPI->>Database: Create BrandProfile
    Database-->>BrandProfileAPI: brandProfileId: 1
    BrandProfileAPI-->>OnboardingContext: {id: 1, userId: 1, ...}
    
    OnboardingContext->>OnboardingForm: Profile saved with ID
    OnboardingForm->>OnboardingForm: Wait for profile.id > 0
    
    OnboardingForm->>UnifiedAnalysis: runPipeline({brandProfileId: 1})
    
    par Parallel Analysis
        UnifiedAnalysis->>DirectGEO: Test AI Visibility
        DirectGEO-->>UnifiedAnalysis: GEO Score: 33
        and
        UnifiedAnalysis->>Firecrawl: Scrape Website
        Firecrawl-->>UnifiedAnalysis: Metadata + Structure
        UnifiedAnalysis->>UnifiedAnalysis: Calculate Tech Score: 34
    end
    
    UnifiedAnalysis->>Database: Save GeoAnalysisResult
    UnifiedAnalysis->>Database: Save TechnicalStructureAnalysis
    UnifiedAnalysis->>Database: Save NaturalLanguageReport
    
    UnifiedAnalysis-->>OnboardingForm: Analysis Complete
    OnboardingForm->>Dashboard: Redirect to /dashboard
    Dashboard->>Database: Fetch results by brandProfileId
    Dashboard-->>User: Display metrics
```

## Dashboard "Analyze Website" Flow

```mermaid
sequenceDiagram
    actor User
    participant Dashboard
    participant UnifiedAPI
    participant UnifiedService
    participant DirectGEO
    participant Firecrawl
    participant Database
    participant OverviewMetrics

    User->>Dashboard: Click "Analyze Website"
    Dashboard->>Dashboard: Validate profile.id > 0
    
    Dashboard->>UnifiedAPI: POST /api/analysis/unified<br/>{brandProfileId, skipCooldown: true}
    
    UnifiedAPI->>UnifiedService: runUnifiedAnalysis()
    
    par Parallel Execution
        UnifiedService->>DirectGEO: analyzeDirectGeoVisibility()
        DirectGEO-->>UnifiedService: {overallScore: 35, analyses: [...]}
        and
        UnifiedService->>Firecrawl: scrapeCompanyPage()
        Firecrawl-->>UnifiedService: {metadata, schema, structure}
        UnifiedService->>UnifiedService: computeTechnicalScore()
    end
    
    UnifiedService->>Database: Save GeoAnalysisResult<br/>(brandProfileId: 1)
    UnifiedService->>Database: Save TechnicalStructureAnalysis<br/>(brandProfileId: 1)
    
    UnifiedService-->>UnifiedAPI: {success: true, scores: {...}}
    UnifiedAPI-->>Dashboard: Analysis complete
    
    Dashboard->>Dashboard: Dispatch 'mudra:website-analyzed' event
    Dashboard->>OverviewMetrics: Event listener triggers refresh()
    
    OverviewMetrics->>Database: GET /api/analysis/geo-history?limit=2
    Database-->>OverviewMetrics: [current, previous]
    
    OverviewMetrics->>Database: GET /api/analysis/technical-history?limit=2
    Database-->>OverviewMetrics: [current, previous]
    
    OverviewMetrics->>OverviewMetrics: Calculate deltas
    OverviewMetrics-->>User: Display updated metrics with trends
```

## Historical Metrics Flow

```mermaid
graph TD
    A[Dashboard Loads] --> B{Profile ID Valid?}
    B -->|No| C[Show Loading State]
    B -->|Yes| D[Fetch Historical Data]
    
    D --> E[GET /api/analysis/geo-history?limit=2]
    D --> F[GET /api/analysis/technical-history?limit=2]
    D --> G[GET /api/analysis/results]
    
    E --> H[GeoAnalysisResult Table]
    F --> I[TechnicalStructureAnalysis Table]
    G --> J[All Analysis Tables]
    
    H --> K[Returns: Array with 2 records<br/>Ordered by timestamp DESC]
    I --> L[Returns: Array with 2 records<br/>Ordered by createdAt DESC]
    J --> M[Returns: Latest records]
    
    K --> N[Extract Current & Previous Scores]
    L --> N
    M --> N
    
    N --> O[Calculate Deltas<br/>delta = current - previous / previous * 100]
    
    O --> P[Display Overview Cards]
    P --> Q[AI Visibility: 35 ↑ +17.9%]
    P --> R[Technical Score: 34 ↑ +13.3%]
    P --> S[Traffic: 1.2K ↓ -5.0%]
    
    style A fill:#e3f2fd
    style D fill:#f3e5f5
    style O fill:#c8e6c9
    style P fill:#fff9c4
    style Q fill:#c5e1a5
    style R fill:#c5e1a5
    style S fill:#ffccbc
```

## Database Schema Relationships

```mermaid
erDiagram
    User ||--o{ BrandProfile : "owns"
    BrandProfile ||--o{ GeoAnalysisResult : "has"
    BrandProfile ||--o{ TechnicalStructureAnalysis : "has"
    BrandProfile ||--o{ NaturalLanguageReport : "has"
    BrandProfile ||--o{ Prompt : "has"
    BrandProfile ||--o{ AnalysisRun : "has"
    Site ||--o{ Snapshot : "has"
    Snapshot ||--o{ Score : "has"
    
    User {
        int id PK
        string email
        string name
        datetime createdAt
    }
    
    BrandProfile {
        int id PK
        int userId FK
        string companyName
        string companyWebsite
        string companyDescription
        string companyIndustry
        json competitors
        datetime createdAt
    }
    
    GeoAnalysisResult {
        int id PK
        int brandProfileId FK
        float overallScore
        json analyses
        json summary
        datetime timestamp
    }
    
    TechnicalStructureAnalysis {
        int id PK
        int brandProfileId FK
        float overallScore
        float seoScore
        json recommendations
        json metadata
        datetime createdAt
    }
    
    NaturalLanguageReport {
        int id PK
        int brandProfileId FK
        string title
        string summary
        json sections
        json recommendations
        datetime generatedAt
    }
    
    Prompt {
        int id PK
        int brandProfileId FK
        string text
        string category
        boolean isActive
        boolean isCustom
        datetime createdAt
    }
    
    AnalysisRun {
        int id PK
        int brandProfileId FK
        string status
        json results
        float overallScore
        datetime createdAt
    }
    
    Site {
        string id PK
        string url
        int companyId
        datetime createdAt
    }
    
    Snapshot {
        string id PK
        string siteId FK
        json metadata
        json schema
        datetime createdAt
    }
    
    Score {
        string id PK
        string snapshotId FK
        float total
        json components
        datetime createdAt
    }
```

## Technical Scoring Components

```mermaid
graph TD
    A[Website Scraped] --> B[Compute Technical Score]
    
    B --> C[SEO Category - 40%]
    B --> D[GEO Category - 60%]
    
    C --> C1[Meta Title: 10 pts]
    C --> C2[Meta Description: 8 pts]
    C --> C3[H1 Tags: 8 pts]
    C --> C4[H2 Tags: 6 pts]
    C --> C5[Favicon: 4 pts]
    C --> C6[Canonical URL: 4 pts]
    
    D --> D1[Schema.org: 10 pts]
    D --> D2[FAQ Schema: 8 pts]
    D --> D3[JSON-LD: 8 pts]
    D --> D4[robots.txt: 6 pts]
    D --> D5[llms.txt: 8 pts]
    D --> D6[llms-full.txt: 6 pts]
    
    C1 & C2 & C3 & C4 & C5 & C6 --> E[SEO Score: 40 pts max]
    D1 & D2 & D3 & D4 & D5 & D6 --> F[GEO Score: 46 pts max]
    
    E & F --> G[Total: 76 pts]
    G --> H[Normalize to 0-100]
    
    H --> I[Generate Findings]
    I --> I1[High Severity - Critical]
    I --> I2[Medium Severity - Warnings]
    I --> I3[Low Severity - Suggestions]
    
    I1 & I2 & I3 --> J[Create Recommendations]
    J --> K[Save to TechnicalStructureAnalysis]
    
    style A fill:#e3f2fd
    style B fill:#f3e5f5
    style C fill:#fff3e0
    style D fill:#e8f5e9
    style H fill:#c8e6c9
    style J fill:#ffccbc
```

## Unified Analysis Service Architecture

```mermaid
graph TB
    A[runUnifiedAnalysis] --> B{Config}
    B -->|skipCooldown: true| C[Dashboard Mode]
    B -->|skipCooldown: false| D[Onboarding Mode]
    
    C --> E[Skip cooldown check]
    D --> F[Check analysis cooldown]
    
    E & F --> G[Parallel Execution]
    
    G --> H[runGeoAnalysisCore]
    G --> I[runTechnicalAnalysisCore]
    
    H --> H1[Get Active Prompts]
    H1 -->|None exist| H2[Generate Initial Prompts]
    H1 -->|Have prompts| H3[Use Existing Prompts]
    H2 & H3 --> H4[Call DirectGEO API]
    H4 --> H5[Save GeoAnalysisResult]
    
    I --> I1[Scrape Website - Firecrawl]
    I1 --> I2[Convert to Snapshot]
    I2 --> I3[Compute Technical Score]
    I3 --> I4[Calculate SEO & GEO Scores]
    I4 --> I5[Generate Recommendations]
    I5 --> I6[Save TechnicalStructureAnalysis]
    
    H5 & I6 --> J{generateReport?}
    J -->|true - Onboarding| K[Generate Natural Language Report]
    J -->|false - Dashboard| L[Skip Report]
    
    K --> M[Combine GEO + Tech Results]
    M --> N[Generate Insights & Summary]
    N --> O[Save NaturalLanguageReport]
    
    O & L --> P[Return UnifiedAnalysisResult]
    
    style A fill:#e3f2fd
    style G fill:#f3e5f5
    style H fill:#fff3e0
    style I fill:#e8f5e9
    style K fill:#ffccbc
    style P fill:#c8e6c9
```

## Prompt Management Flow

```mermaid
sequenceDiagram
    participant Service as Unified Analysis
    participant PromptStorage as Prompt Storage Service
    participant Database as PostgreSQL
    participant DirectGEO as DirectGEO API

    Service->>PromptStorage: getActivePrompts(brandProfileId)
    PromptStorage->>Database: SELECT * FROM prompts<br/>WHERE brandProfileId = ? AND isActive = true
    
    alt Prompts Exist
        Database-->>PromptStorage: Return active prompts
        PromptStorage-->>Service: Array of prompts
    else No Prompts
        Database-->>PromptStorage: Empty array
        PromptStorage->>PromptStorage: generateInitialPrompts()
        PromptStorage->>Database: INSERT INTO prompts (brandProfileId, text, category)
        Database-->>PromptStorage: Created prompts
        PromptStorage-->>Service: New prompts array
    end
    
    Service->>Service: Map prompts to text array
    Service->>DirectGEO: POST /analyze<br/>{brandName, customPrompts: [...]}
    DirectGEO-->>Service: {overallScore, analyses, recommendations}
    
    Service->>Database: Save GeoAnalysisResult
    Database-->>Service: Saved with brandProfileId link
```

## Component Interaction Map

```mermaid
graph LR
    subgraph Frontend_Components
        FC1[Dashboard Page]
        FC2[Overview Metrics]
        FC3[Analysis Results Cards]
        FC4[Brand Profile Form]
        FC5[Onboarding Forms]
    end
    
    subgraph Hooks
        H1[use-brand-profile]
        H2[use-analysis-pipeline]
        H3[use-analysis-results]
        H4[use-direct-geo-analysis]
    end
    
    subgraph Context
        CTX1[BrandProfileContext]
        CTX2[OnboardingContext]
    end
    
    subgraph API_Endpoints
        API1[/api/analysis/unified]
        API2[/api/analysis/geo-history]
        API3[/api/analysis/technical-history]
        API4[/api/brand-profile]
    end
    
    FC1 --> H1 & H3
    FC2 --> H3
    FC3 --> H3
    FC4 --> H1
    FC5 --> H2
    
    H1 --> CTX1
    H2 --> API1
    H3 --> API2 & API3
    H5 --> CTX2
    
    CTX1 --> API4
    
    style Frontend_Components fill:#e3f2fd
    style Hooks fill:#f3e5f5
    style Context fill:#fff3e0
    style API_Endpoints fill:#e8f5e9
```

## Data Flow: Onboarding to Dashboard

```mermaid
flowchart TD
    A[User Starts Onboarding] --> B[Fill Company Info]
    B --> C[Fill Profile Info]
    C --> D[Add Competitors]
    D --> E[Set Visibility Goals]
    
    E --> F{Save Profile}
    F -->|New User| G[Create User Record]
    F -->|Existing| H[Update Profile]
    
    G --> I[Create BrandProfile]
    H --> I
    
    I --> J[Get brandProfileId]
    J --> K{brandProfileId > 0?}
    K -->|No| L[Wait for ID]
    K -->|Yes| M[Trigger Unified Analysis]
    L --> K
    
    M --> N[Parallel Processing]
    N --> O[GEO Analysis]
    N --> P[Technical Analysis]
    
    O --> Q[Save to Database]
    P --> Q
    
    Q --> R[Generate Report]
    R --> S[Save Report]
    
    S --> T[Redirect to Dashboard]
    T --> U[Load Dashboard]
    U --> V[Fetch Analysis History]
    V --> W[Display Metrics]
    
    W --> X{User Action}
    X -->|Click Analyze| Y[Run New Analysis]
    X -->|View Results| Z[Show Detailed Cards]
    X -->|Edit Profile| AA[Open Profile Form]
    
    Y --> M
    
    style A fill:#e3f2fd
    style M fill:#f3e5f5
    style Q fill:#c8e6c9
    style T fill:#fff9c4
    style W fill:#c5e1a5
```
