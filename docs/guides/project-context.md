# Mudra - Project Context and Business Logic

## Executive Summary
Mudra is a Generative Engine Optimization (GEO) platform designed to help startups increase their visibility and mentions in AI-generated responses. As AI systems like ChatGPT, Claude, and Perplexity become primary information sources, Mudra ensures startups are discoverable, citable, and authoritative in AI responses.

## Target Market
### Ideal Customer Profile (ICP)
1. **Startups** (Primary)
   - Early to growth stage companies
   - Need visibility in AI-generated responses
   - Limited marketing resources
   
2. **Generative Engine Optimization Specialists**
   - Consultants and agencies
   - Need tools to optimize client visibility
   
3. **Marketing Teams**
   - In-house teams at tech companies
   - Need to track and improve AI mentions

## Core Value Proposition
"Get your startup mentioned by AI" - Mudra analyzes, optimizes, and tracks how AI systems perceive and reference your brand, providing actionable insights to improve AI visibility.

## Platform Framework: ACDR
Mudra operates on a four-phase framework:

### 1. **Analyze** - Understanding Current AI Visibility
### 2. **Create** - Generating Optimized Content 
### 3. **Distribute** - Strategic Content Placement
### 4. **Re-Audit** - Continuous Monitoring and Improvement

## Detailed Feature Specifications

### 1. ANALYZE PHASE

#### A. Query LLMs Feature
**Purpose**: Measure how often AI models mention your startup

**Implementation Details**:
- Query multiple AI models (ChatGPT, Claude, Perplexity, etc.)
- Use 100 diverse prompts relevant to the startup's industry
- Track mention frequency, context, and sentiment

**Metrics Generated**:
- **AI Visibility Score**: Percentage of queries where startup is mentioned
- **Context Quality Score**: How accurately AI describes the startup
- **Competitive Position**: Ranking vs competitors

**Technical Requirements**:
- AI API integrations (OpenAI, Anthropic, Perplexity, Google AI Overviews)
- Prompt template system
- Result parsing and analysis engine


**User Experience**:
1. User enters company information
2. System generates industry-relevant prompts
3. Queries run in background
4. Dashboard shows real-time results
5. Before/after comparison charts

#### B. AI Crawlers Detection
**Purpose**: Verify if AI bots can access and index the website

**Implementation Details**:
- JavaScript snippet for client-side tracking
- Server log analysis capabilities
- Detection for major AI crawlers:
  - GPTBot (OpenAI)
  - ClaudeBot (Anthropic)
  - PerplexityBot
  - Google-Extended
  - CCBot (Common Crawl)

**Metrics Generated**:
- **Crawl Accessibility Score**: Overall crawler access rate
- **Crawler Frequency**: How often each bot visits
- **Page Coverage**: Which pages are being crawled
- **Error Detection**: 4xx/5xx errors encountered

**Technical Requirements**:
- Lightweight JavaScript tracking code
- Log parsing capabilities
- Real-time crawler detection
- Historical data storage

**User Experience**:
1. User adds one-line JavaScript to website
2. User provides website URL
3. System performs accessibility audit
4. Optional: Manual log file upload
5. Dashboard shows crawler activity

#### C. Technical Structure Analysis
**Purpose**: Ensure content is formatted for optimal AI comprehension

**Implementation Details**:
- HTML structure analysis
- Schema.org markup validation
- Content hierarchy assessment
- JavaScript rendering checks
- Semantic HTML5 validation

**Metrics Generated**:
- **Structure Optimization Score**: Overall technical readiness
- **Schema Implementation**: Structured data coverage
- **Content Hierarchy**: Proper H1-H6 usage
- **Accessibility Score**: WCAG compliance for AI parsing

**Technical Requirements**:
- Web scraping engine
- HTML/DOM parser
- Schema validator
- Rendering engine for JS sites

**User Experience**:
1. User provides website URL
2. System crawls 3-5 key pages automatically
3. Instant analysis results
4. Actionable recommendations
5. Optional: Additional page analysis

#### D. Context & Content Quality
**Purpose**: Ensure content meets AI citation standards and addresses ICP needs

**Implementation Details**:
- ICP question research across platforms
- Competitor content analysis
- Authority signal detection
- Citation-worthiness assessment
- Content gap identification

**Research Process**:
1. Analyze what questions ICP asks in:
   - Forums (Reddit, Stack Overflow, etc.)
   - Social media
   - Search platforms
   - Industry communities
2. Map competitor responses to these questions
3. Identify content gaps and opportunities

**Metrics Generated**:
- **Content Authority Score**: Expertise and credibility signals
- **Citation Readiness Score**: How quotable the content is
- **ICP Question Coverage**: Percentage of ICP questions addressed
- **Competitive Gap Analysis**: Content areas where competitors excel

**Technical Requirements**:
- Web scraping for competitor analysis
- NLP for content quality assessment
- Forum/social media API integrations
- Question extraction algorithms

**User Experience**:
1. User provides website and competitor URLs
2. User defines or system detects ICP
3. AI researches ICP questions
4. System analyzes content coverage
5. Generates competitive recommendations

#### E. External Footprint Analysis
**Purpose**: Measure and improve web-wide brand presence for AI credibility

**Implementation Details**:
- External mention tracking
- Backlink profile analysis
- Forum opportunity identification
- Authority source mapping
- Competitor source analysis

**Metrics Generated**:
- **External Authority Score**: Overall web presence strength
- **Mention Distribution**: Where brand appears online
- **Authority Gap Analysis**: Missing high-value sources
- **Outreach Opportunities**: Priority targets for visibility

**Technical Requirements**:
- Web crawling infrastructure
- Backlink analysis tools
- Forum monitoring capabilities
- Social media tracking

**User Experience**:
1. User provides company information
2. System maps current footprint
3. Analyzes competitor presence
4. Identifies opportunity gaps
5. Generates outreach strategy

### 2. CREATE PHASE (Future Implementation)
- AI-optimized content generation
- Schema markup generator
- Answer-ready content formats
- Authority signal templates
- Competitor-beating content strategies

### 3. DISTRIBUTE PHASE (Future Implementation)
- Strategic content placement
- Forum engagement automation
- Press release optimization
- Directory submissions
- Partnership facilitation

### 4. RE-AUDIT PHASE (Future Implementation)
- Continuous monitoring
- Trend analysis
- Competitor tracking
- Alert systems
- Performance reporting

## Dashboard Design Principles

### Layout Structure
- Clean, modern interface with card-based layouts
- Dark mode support
- Mobile-responsive design
- Real-time data updates where applicable

### Key Dashboard Sections
1. **Overview**: High-level metrics and scores
2. **AI Visibility**: Query results and trends
3. **Technical Health**: Crawler and structure data
4. **Content Analysis**: Quality and competitive metrics
5. **External Presence**: Footprint and opportunities
6. **Comparisons**: Before/after visualizations
7. **Recommendations**: Prioritized action items

### Data Visualization
- Line charts for trends
- Bar charts for comparisons
- Pie charts for distributions
- Heat maps for activity
- Progress bars for scores

## Implementation Phases

### Phase 1: Frontend & Auth (Current)
1. Set up Next.js project structure
2. Implement authentication with Better Auth
3. Create dashboard layout and navigation
4. Build UI components with shadcn/ui
5. Design responsive layouts
6. Add mock data for all "analyze" features first

### Phase 2: Backend Infrastructure
1. Set up database schema with Prisma
2. Implement API endpoints
3. Create background job system
4. Set up caching layer
5. Implement security measures

### Phase 3: AI Integrations
1. Integrate AI APIs
2. Build prompt systems
3. Implement result parsing
4. Create analysis engines
5. Set up rate limiting

### Phase 4: Production Features
1. Payment integration with Stripe
2. Email notifications
3. Export capabilities
4. Team collaboration
5. Advanced analytics

## Security & Compliance
- All sensitive data in environment variables
- GDPR compliance for EU users
- SOC 2 preparation
- Rate limiting on all APIs
- Data encryption at rest and in transit
- Regular security audits

## Monetization Strategy
- Freemium model with limited queries
- Paid tiers based on:
  - Number of websites tracked
  - Query volume
  - Team members
  - Advanced features
  - API access

## Success Metrics
- User acquisition rate
- AI Visibility Score improvements
- Customer retention
- Feature adoption rates
- Revenue per user