# Issues Page - Implementation Scope

## Overview
The Issues page displays **dynamically discovered** optimization opportunities in a Kanban-style board. An AI agent continuously analyzes the user's website and generates issues based on what's lacking. As scores improve and fundamental issues are fixed, the agent discovers more advanced optimization opportunities.

**Key Insight:** We don't show "locked" issues. Instead, issues are **progressively discovered** as the user's scores improve - because you can't see advanced issues until the fundamentals are in place.

---

## Architecture Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Discovery** | LLM (OpenAI) | Analyze gaps, generate contextual issues |
| **Orchestration** | Mastra | Agent management, tool coordination |
| **Execution** | E2B Code Interpreter | Sandbox for code generation/validation |
| **Version Control** | GitHub API | PR creation, merge tracking |

**Flow:** Analysis → Discovery Agent → Issue Created → User Deploys → Mastra Agent → E2B Sandbox (if needed) → GitHub PR → Merge → Score Recalc → New Issues Discovered

---

## Issue Categories & Score Dependencies

### Score-Based Issue Discovery

| Category | Triggered By | Score Range | Example Issues |
|----------|-------------|-------------|----------------|
| **Technical Structure** | Technical Structure Score | 0-100 | Schema markup, meta tags, heading hierarchy, page speed |
| **AI Visibility** | AI Visibility Score | 0-100 | llms.txt creation/optimization, citation-worthy content, AI-friendly formatting |
| **Conversation Opportunities** | Conversation Radar | Active agent | Reddit discussions, forum mentions, social opportunities |

### Progressive Discovery Logic

```
Score Level          │  Issues Discovered
─────────────────────┼───────────────────────────────────────────────
Technical 0-30       │  FUNDAMENTAL: Missing robots.txt, broken sitemap,
                    │  no meta descriptions, no schema at all
                    │
Technical 30-60      │  INTERMEDIATE: Schema improvements, FAQ sections,
                    │  heading restructuring, internal linking
                    │
Technical 60-80      │  ADVANCED: Rich snippets optimization, 
                    │  breadcrumb schema, advanced structured data
                    │
Technical 80+        │  POLISH: Minor tweaks, performance optimization,
                    │  edge case fixes

AI Visibility 0-30   │  FUNDAMENTAL: No llms.txt, no AI-readable content,
                    │  poor citation signals
                    │
AI Visibility 30-60  │  INTERMEDIATE: llms.txt improvements, content
                    │  restructuring for AI consumption
                    │
AI Visibility 60+    │  ADVANCED: Citation optimization, competitive
                    │  positioning, authority signals
```

---

## User Flow

### 1. **Initial State (No GitHub)**
```
┌────────────────────────────────────────────┐
│  🔗 Connect GitHub to Deploy Fixes         │
│                                            │
│  Mudra has discovered 5 issues with your  │
│  website. Connect GitHub so agents can    │
│  create Pull Requests to fix them.        │
│                                            │
│       [Connect GitHub Repository]          │
│                                            │
│  Preview: (view-only until connected)      │
│  • Missing Schema.org markup               │
│  • No llms.txt file detected               │
│  • Heading hierarchy needs restructuring   │
└────────────────────────────────────────────┘
```

### 2. **GitHub Connected - Low Score State**
```
┌─────────────────────────────────────────────────────────────┐
│  Identified (5)  │  In Progress (0)  │  Completed  │ Merged │
├──────────────────┼───────────────────┼─────────────┼────────┤
│ 🔴 Add robots.txt│                   │             │        │
│ 🔴 Fix sitemap   │                   │             │        │
│ 🟠 Add basic     │                   │             │        │
│    schema markup │                   │             │        │
│ 🟠 Create        │                   │             │        │
│    llms.txt      │                   │             │        │
│ 🟡 Add meta      │                   │             │        │
│    descriptions  │                   │             │        │
└──────────────────┴───────────────────┴─────────────┴────────┘

💡 Fix these fundamental issues to discover more opportunities
   Technical Structure: 25/100  •  AI Visibility: 18/100
```

### 3. **As User Improves (Higher Score State)**
```
┌─────────────────────────────────────────────────────────────┐
│  Identified (3)  │  In Progress (1)  │  Completed (2) │ ... │
├──────────────────┼───────────────────┼────────────────┼─────┤
│ 🟡 Add FAQ       │ 🟠 Optimize       │ ✅ Added       │     │
│    schema        │    llms.txt       │    robots.txt  │     │
│ 🟡 Add breadcrumb│                   │ ✅ Fixed       │     │
│    navigation    │                   │    sitemap     │     │
│ 🟢 Enhance       │                   │                │     │
│    citations     │                   │                │     │
└──────────────────┴───────────────────┴────────────────┴─────┘

🎯 New opportunities discovered! 3 more issues found.
   Technical Structure: 58/100 (+33)  •  AI Visibility: 45/100 (+27)
```

### 4. **Issue Lifecycle Flow**
```
Discovery                │  System Response            │  Status
─────────────────────────┼─────────────────────────────┼────────────────
Agent analyzes site      │  Discovers gaps             │  (none - no issue yet)
Gap matches score tier   │  Creates Issue record       │  IDENTIFIED
User clicks "Deploy"     │  Deploys DeployedAgent      │  IN_PROGRESS
                        │  Creates AgentTask          │
Agent completes task     │  Updates task.status        │  COMPLETED
                        │  Creates PR in GitHub       │
User merges PR          │  GitHub webhook/manual sync │  MERGED
Score recalculates      │  Agent discovers new gaps   │  New IDENTIFIED issues
```

---

## Database Schema

### Updated `Issue` Model
```prisma
model Issue {
  id             Int          @id @default(autoincrement())
  brandProfileId Int
  title          String
  description    String?
  type           String       @default("improvement")  // bug, improvement, feature
  status         String       @default("identified")   // identified, in_progress, completed, merged
  priority       String       @default("medium")       // low, medium, high, critical
  order          Int          @default(0)              // For ordering within columns
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  brandProfile   BrandProfile @relation(fields: [brandProfileId], references: [id], onDelete: Cascade)

  // NEW FIELDS:
  // Category & Discovery
  category           String       // "technical_structure", "ai_visibility", "conversation"
  discoveryTier      String       // "fundamental", "intermediate", "advanced", "polish"
  minScoreRequired   Int          @default(0)  // Score threshold that enabled discovery
  discoveredFromScore Float?      // Actual score when this issue was discovered
  
  // Agent & Execution
  deployedAgentId    Int?
  agentTaskId        Int?
  agentType          String?      // "aeo_optimizer", "content_optimizer", "llms_txt_agent"
  
  // GitHub PR Tracking
  prUrl              String?
  prNumber           Int?
  prStatus           String?      // "open", "merged", "closed"
  
  // Issue Context
  sourceAnalysis     String?      // "technical_analysis", "geo_analysis", "conversation_radar"
  affectedUrl        String?      // Specific page URL if applicable
  estimatedImpact    String?      // "+5-8 points", "High visibility boost"
  
  // E2B Sandbox Execution Tracking
  usedE2bSandbox     Boolean      @default(false)  // Whether issue resolution used E2B
  e2bSandboxId       String?      // E2B sandbox instance ID for debugging
  e2bExecutionMs     Int?         // Sandbox execution time in milliseconds
  e2bValidationResult Json?       // Validation output from sandbox
  
  // Deduplication
  issueHash          String?      @unique  // Hash of title+category+brandProfileId to prevent duplicates
  checkCode          String?              // Scoring check code (e.g. "J1_present") — used by reconciliation to avoid title-based ambiguity

  deployedAgent      DeployedAgent? @relation(fields: [deployedAgentId], references: [id])
  agentTask          AgentTask?     @relation(fields: [agentTaskId], references: [id])

  @@index([brandProfileId])
  @@index([brandProfileId, status])
  @@index([brandProfileId, category])
  @@index([category, discoveryTier])
  @@map("issues")
}
```

### Issue Categories Enum (for reference)
```typescript
type IssueCategory = 
  | "technical_structure"   // Triggered by Technical Structure score
  | "ai_visibility"         // Triggered by AI Visibility score
  | "conversation"          // Triggered by Conversation Radar agent

type DiscoveryTier = 
  | "fundamental"    // Score 0-30: Basic issues everyone needs
  | "intermediate"   // Score 30-60: Common optimizations
  | "advanced"       // Score 60-80: Sophisticated improvements
  | "polish"         // Score 80+: Fine-tuning and edge cases
```

---

## Agent Architecture

### Mastra + E2B Integration

Each issue is handled by a specialized Mastra agent. When the user clicks "Deploy" on an issue, the corresponding agent is instantiated and executed. E2B provides sandboxed code execution for agents that need to generate, test, or validate code.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ISSUES PAGE                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Issue Card                                                        │
│   ┌─────────────────────────────────┐                               │
│   │ Add Schema.org Markup           │                               │
│   │ Agent: Schema Architect         │──┐                            │
│   │              [Deploy Agent]     │  │                            │
│   └─────────────────────────────────┘  │                            │
│                                        │                            │
│   ┌─────────────────────────────────┐  │                            │
│   │ Create llms.txt file            │  │    ┌────────────────────┐  │
│   │ Agent: LLMs.txt Indexer         │──┼───▶│   Mastra           │  │
│   │              [Deploy Agent]     │  │    │   Orchestration    │  │
│   └─────────────────────────────────┘  │    │                    │  │
│                                        │    │   ┌────────────┐   │  │
│   ┌─────────────────────────────────┐  │    │   │ E2B        │   │  │
│   │ Engage Reddit Discussion        │  │    │   │ Sandbox    │   │  │
│   │ Agent: Conversation Radar       │──┘    │   │ (code exec)│   │  │
│   │              [Deploy Agent]     │       │   └────────────┘   │  │
│   └─────────────────────────────────┘       └────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Issue-to-Agent Mapping

| Issue Category | Issue Type | Agent | Uses E2B? |
|----------------|------------|-------|-----------|
| **Technical Structure** | Missing schema markup | Schema Architect Agent | ✅ Yes (test JSON-LD) |
| **Technical Structure** | Heading hierarchy issues | Content Restructure Agent | ❌ No |
| **Technical Structure** | Missing robots.txt | Site Config Agent | ❌ No |
| **Technical Structure** | Sitemap problems | Site Config Agent | ❌ No |
| **AI Visibility** | No llms.txt | LLMs.txt Indexer Agent | ❌ No |
| **AI Visibility** | llms.txt needs optimization | LLMs.txt Optimizer Agent | ❌ No |
| **AI Visibility** | Poor citation signals | Citation Enhancer Agent | ❌ No |
| **AI Visibility** | Content not AI-readable | AEO/GEO Optimizer Agent | ✅ Yes (validate output) |
| **Conversation** | Reddit opportunity | Conversation Radar Agent | ❌ No |
| **Conversation** | Forum/social opportunity | Conversation Radar Agent | ❌ No |

### Existing Mastra Agents (in `mudra-app/mastra/agents/`)

```
├── aeo-geo-optimizer.ts        # Core AEO/GEO optimization
├── content-generator-agent.ts  # AI content generation
├── conversation-radar-agent.ts # Social media monitoring
├── gap-analysis-agent.ts       # Content gap identification
├── growth-scout.ts             # Growth opportunity detection
├── research-agent.ts           # Research and data gathering
└── tracking-verification-agent.ts # Tracking code validation
```

### New Agents Needed for Issues

| Agent Name | Purpose | Tools | E2B Usage |
|------------|---------|-------|-----------|
| `schema-architect-agent.ts` | Generate and validate JSON-LD schema | `generateSchemaMarkupTool`, `validateJsonLdTool` | Test schema in sandbox |
| `llms-txt-agent.ts` | Create and optimize llms.txt files | `generateLlmsTxtTool`, `validateLlmsTxtTool` | Validate format |
| `site-config-agent.ts` | Handle robots.txt, sitemap, meta configs | `generateRobotsTxtTool`, `validateSitemapTool` | None |
| `content-restructure-agent.ts` | Fix heading hierarchy, add FAQ sections | `analyzeHeadingsTool`, `restructureContentTool` | None |
| `citation-enhancer-agent.ts` | Add citation-worthy statements, authority signals | `citationTrackerTool`, `authoritySignalsTool` | None |

---

## E2B Integration Details

### Current Setup (Already Configured!)

```bash
# Already in .env.local and .env.production
E2B_API_KEY=e2b_04f07e4cd7ba5339c89786c7ba1e50c79b0a81f8

# Already installed
npm package: @e2b/code-interpreter v2.3.1
```

### E2B Use Cases for Issues

#### 1. Schema Validation Sandbox
```typescript
// lib/services/e2b-sandbox.service.ts
import { CodeInterpreter } from '@e2b/code-interpreter'

export async function validateSchemaInSandbox(jsonLdSchema: string): Promise<{
  valid: boolean
  errors: string[]
  warnings: string[]
}> {
  const sandbox = await CodeInterpreter.create()
  
  try {
    // Run Python validation in E2B sandbox
    const result = await sandbox.notebook.execCell(`
import json
from pyld import jsonld

schema = ${JSON.stringify(jsonLdSchema)}

# Parse and validate JSON-LD
try:
    parsed = json.loads(schema)
    expanded = jsonld.expand(parsed)
    print(json.dumps({"valid": True, "expanded": expanded}))
except Exception as e:
    print(json.dumps({"valid": False, "error": str(e)}))
    `)
    
    return JSON.parse(result.output || '{"valid": false}')
  } finally {
    await sandbox.close()
  }
}
```

#### 2. Code Generation Testing
```typescript
export async function testGeneratedCode(
  code: string, 
  language: 'python' | 'javascript'
): Promise<{
  success: boolean
  output: string
  error?: string
}> {
  const sandbox = await CodeInterpreter.create()
  
  try {
    const result = await sandbox.notebook.execCell(code)
    return {
      success: !result.error,
      output: result.output || '',
      error: result.error?.message
    }
  } finally {
    await sandbox.close()
  }
}
```

#### 3. HTML/Content Validation
```typescript
export async function validateHtmlStructure(html: string): Promise<{
  headingHierarchy: { level: number; text: string }[]
  schemaMarkup: object[]
  accessibilityIssues: string[]
}> {
  const sandbox = await CodeInterpreter.create()
  
  try {
    const result = await sandbox.notebook.execCell(`
from bs4 import BeautifulSoup
import json

html = '''${html.replace(/'/g, "\\'")}'''
soup = BeautifulSoup(html, 'html.parser')

# Extract headings
headings = []
for tag in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
    headings.append({"level": int(tag.name[1]), "text": tag.get_text()})

# Extract JSON-LD
scripts = soup.find_all('script', type='application/ld+json')
schemas = [json.loads(s.string) for s in scripts if s.string]

print(json.dumps({"headings": headings, "schemas": schemas}))
    `)
    
    return JSON.parse(result.output || '{}')
  } finally {
    await sandbox.close()
  }
}
```

### When to Use E2B vs Direct Code

| Task | Use E2B? | Reason |
|------|----------|--------|
| Validate JSON-LD schema | ✅ Yes | Need Python jsonld library |
| Test generated HTML | ✅ Yes | Sandboxed parsing is safer |
| Generate schema from template | ❌ No | Simple string manipulation |
| Create llms.txt | ❌ No | Template-based generation |
| GitHub PR creation | ❌ No | Direct API call |
| Analyze website structure | ❌ No | Use Firecrawl instead |

### E2B Costs (Pro Plan)

Since you have E2B Pro credits:
- **Sandbox startup:** ~150ms
- **Cost:** $0.00005 per sandbox second
- **Typical validation:** 2-5 seconds = $0.0001-$0.00025 per issue
- **Estimated monthly:** ~$5-10 for moderate usage

---

## Agent Execution Flow (Mastra + E2B)

### 1. User Clicks "Deploy Agent"
```typescript
// app/api/issues/[id]/deploy/route.ts
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const issue = await prisma.issue.findUnique({ where: { id: parseInt(params.id) } })
  
  // 1. Get the appropriate Mastra agent
  const agent = getAgentForIssue(issue.agentType)
  
  // 2. Create DeployedAgent record
  const deployedAgent = await prisma.deployedAgent.create({
    data: {
      brandProfileId: issue.brandProfileId,
      agentType: issue.agentType,
      agentName: `Fix: ${issue.title}`,
      status: 'deploying'
    }
  })
  
  // 3. Link issue to agent
  await prisma.issue.update({
    where: { id: issue.id },
    data: { deployedAgentId: deployedAgent.id, status: 'in_progress' }
  })
  
  // 4. Execute agent asynchronously
  executeIssueAgent(deployedAgent.id, issue).catch(console.error)
  
  return NextResponse.json({ success: true, deployedAgent })
}
```

### 2. Agent Execution with E2B
```typescript
// lib/services/issue-agent-executor.service.ts
import { mastra } from '@/mastra'
import { validateSchemaInSandbox } from './e2b-sandbox.service'

async function executeIssueAgent(deployedAgentId: number, issue: Issue) {
  const agent = mastra.getAgent(issue.agentType)
  
  // Update status
  await prisma.deployedAgent.update({
    where: { id: deployedAgentId },
    data: { status: 'active' }
  })
  
  try {
    // 1. Agent generates fix
    const response = await agent.generate([
      { role: 'user', content: `Fix this issue for ${issue.affectedUrl}: ${issue.description}` }
    ])
    
    const generatedCode = extractCodeFromResponse(response.text)
    
    // 2. Validate with E2B sandbox (if applicable)
    if (issue.category === 'technical_structure' && generatedCode.includes('application/ld+json')) {
      const validation = await validateSchemaInSandbox(generatedCode)
      if (!validation.valid) {
        throw new Error(`Schema validation failed: ${validation.errors.join(', ')}`)
      }
    }
    
    // 3. Create GitHub PR
    const pr = await createOptimizationPR({
      brandProfileId: issue.brandProfileId,
      improvements: [{ type: issue.type, code: generatedCode }],
      title: `fix: ${issue.title}`,
      description: issue.description
    })
    
    // 4. Update issue with PR
    await prisma.issue.update({
      where: { id: issue.id },
      data: { status: 'completed', prUrl: pr.url, prNumber: pr.number }
    })
    
  } catch (error) {
    await prisma.issue.update({
      where: { id: issue.id },
      data: { status: 'identified' }  // Reset to allow retry
    })
    throw error
  }
}
```

### 3. Agent Selection by Issue Type
```typescript
// lib/services/agent-selector.service.ts
import { mastra } from '@/mastra'

const ISSUE_AGENT_MAP: Record<string, string> = {
  // Technical Structure
  'schema_markup': 'schemaArchitectAgent',
  'heading_hierarchy': 'contentRestructureAgent',
  'robots_txt': 'siteConfigAgent',
  'sitemap': 'siteConfigAgent',
  'meta_descriptions': 'aeoGeoOptimizerAgent',
  
  // AI Visibility
  'llms_txt_missing': 'llmsTxtAgent',
  'llms_txt_optimization': 'llmsTxtOptimizerAgent',
  'citation_signals': 'citationEnhancerAgent',
  'ai_readable_content': 'aeoGeoOptimizerAgent',
  
  // Conversations
  'reddit_opportunity': 'conversationRadarAgent',
  'social_opportunity': 'conversationRadarAgent',
}

export function getAgentForIssue(issueType: string) {
  const agentName = ISSUE_AGENT_MAP[issueType] || 'aeoGeoOptimizerAgent'
  return mastra.getAgent(agentName)
}
```

### **Phase 1: Issue Discovery Agent (AI-Powered)** ⭐ Core Innovation

The heart of the Issues page is an **LLM-powered Issue Discovery Agent** that analyzes the user's website and generates contextual issues based on current gaps.

#### 1.1 Issue Discovery Agent Service
- **File:** `mudra-app/lib/services/issue-discovery.service.ts`
- **Trigger:** After each analysis run (unified analysis completion)
- **Flow:**
  ```typescript
  async function discoverIssues(brandProfileId: number) {
    // 1. Get current scores
    const technicalScore = await getLatestTechnicalScore(brandProfileId)
    const aiVisibilityScore = await getLatestAIVisibilityScore(brandProfileId)
    
    // 2. Get website data for analysis
    const websiteData = await getWebsiteAnalysisData(brandProfileId)
    
    // 3. Determine which tiers to analyze based on scores
    const technicalTiers = getTiersForScore(technicalScore)  // e.g., ["fundamental", "intermediate"]
    const aiVisibilityTiers = getTiersForScore(aiVisibilityScore)
    
    // 4. Run LLM analysis for each category
    const technicalIssues = await discoverTechnicalIssues(websiteData, technicalTiers)
    const aiVisibilityIssues = await discoverAIVisibilityIssues(websiteData, aiVisibilityTiers)
    
    // 5. Deduplicate and create/update issues
    await upsertDiscoveredIssues(brandProfileId, [...technicalIssues, ...aiVisibilityIssues])
    
    return { discovered: technicalIssues.length + aiVisibilityIssues.length }
  }
  ```

#### 1.2 Technical Structure Issue Discovery
- **Input:** TechnicalStructureAnalysis results, scraped website data
- **LLM Prompt:**
  ```typescript
  const TECHNICAL_DISCOVERY_PROMPT = `
  You are an expert at identifying technical SEO and AI-optimization issues.
  
  WEBSITE ANALYSIS:
  - URL: {websiteUrl}
  - Technical Score: {technicalScore}/100
  - Current Tier: {tier} (${tierDescription})
  
  CURRENT TECHNICAL STATE:
  ${JSON.stringify(technicalAnalysis, null, 2)}
  
  Based on the user's current score tier ({tier}), identify issues that:
  1. Are appropriate for their current level
  2. Will have meaningful impact when fixed
  3. Can be fixed by an automated agent
  
  For FUNDAMENTAL tier (score 0-30), focus on:
  - Missing robots.txt or sitemap.xml
  - No meta descriptions at all
  - Missing basic schema markup
  - Broken heading hierarchy (h1 missing, etc.)
  
  For INTERMEDIATE tier (score 30-60), focus on:
  - Schema markup improvements (FAQ, Product, Article)
  - Internal linking optimization
  - Heading restructuring for Q&A format
  - Image alt text and accessibility
  
  For ADVANCED tier (score 60-80), focus on:
  - Rich snippet optimization
  - Breadcrumb schema
  - Speakable schema for voice search
  - JSON-LD enhancements
  
  For POLISH tier (score 80+), focus on:
  - Minor performance optimizations
  - Edge case schema additions
  - Competitive differentiation
  
  Return a JSON array of issues:
  [
    {
      "title": "Add FAQ Schema Markup",
      "description": "Your FAQ page at /faq has 12 Q&A pairs but no schema markup...",
      "priority": "high",
      "agentType": "aeo_optimizer",
      "estimatedImpact": "+3-5 points",
      "affectedUrl": "/faq"
    }
  ]
  `
  ```

#### 1.3 AI Visibility Issue Discovery
- **Input:** GeoAnalysisResults, llms.txt content (if exists), citation data
- **LLM Prompt:**
  ```typescript
  const AI_VISIBILITY_DISCOVERY_PROMPT = `
  You are an expert at optimizing websites for AI visibility (LLMs, ChatGPT, Perplexity, etc.).
  
  CURRENT AI VISIBILITY STATE:
  - AI Visibility Score: {aiVisibilityScore}/100
  - llms.txt exists: {hasLlmsTxt}
  - llms.txt content: {llmsTxtContent}
  - Citation rate: {citationRate}%
  - Brand mention rate: {mentionRate}%
  
  WEBSITE CONTEXT:
  - Brand: {brandName}
  - Industry: {industry}
  - Main offerings: {services}
  
  For FUNDAMENTAL tier (score 0-30):
  - Missing llms.txt file entirely
  - No AI-readable content structure
  - Poor citation signals (no authoritative claims)
  - Content not formatted for LLM consumption
  
  For INTERMEDIATE tier (score 30-60):
  - llms.txt exists but incomplete/outdated
  - Content restructuring for AI understanding
  - Citation-worthy statement improvements
  - Authority signal enhancements
  
  For ADVANCED tier (score 60+):
  - llms.txt optimization for competitive positioning
  - Advanced citation strategies
  - Multi-platform AI optimization
  - Thought leadership content gaps
  
  Return issues as JSON array with:
  - title, description, priority, agentType, estimatedImpact
  `
  ```

#### 1.4 Conversation Opportunity Discovery
- **Source:** Conversation Radar agent results
- **Logic:**
  ```typescript
  async function discoverConversationIssues(brandProfileId: number) {
    // Get active conversation opportunities from Radar
    const opportunities = await prisma.conversationOpportunity.findMany({
      where: {
        brandProfileId,
        status: { in: ['new', 'queued'] },
        relevanceScore: { gte: 70 }
      }
    })
    
    // Convert high-value opportunities to Issues
    return opportunities.map(opp => ({
      title: `Engage: ${truncate(opp.title, 50)}`,
      description: `Opportunity on ${opp.platform}: ${opp.context}`,
      category: 'conversation',
      discoveryTier: 'active',  // Always current
      agentType: 'conversation_radar',
      priority: opp.relevanceScore >= 90 ? 'high' : 'medium',
      sourceAnalysis: 'conversation_radar',
      affectedUrl: opp.url
    }))
  }
  ```

### **Phase 2: GitHub Gating & Basic UI**

#### 2.1 GitHub Connection Check
- **File:** `mudra-app/app/dashboard/issues/page.tsx`
- **Logic:**
  ```typescript
  // GitHub is required to DEPLOY, but users can VIEW issues without it
  const { data: githubStatus } = useSWR('/api/integrations/github/status')
  
  // Show issues with "Connect GitHub to Deploy" banner if not connected
  if (!githubStatus?.connected) {
    return (
      <>
        <GitHubConnectBanner />
        <IssuesKanbanBoard issues={issues} deployDisabled={true} />
      </>
    )
  }
  ```

#### 2.2 Kanban Board Component
- **Component:** `IssuesKanbanBoard`
- **Location:** `mudra-app/components/issues/kanban-board.tsx`
- **Columns:**
  - **Identified** (discovered, ready to deploy)
  - **In Progress** (agent deployed, working)
  - **Completed** (agent finished, PR created)
  - **Merged** (PR merged by user)
- **Filters:**
  - Category: Technical Structure | AI Visibility | Conversations
  - Priority: Critical | High | Medium | Low
  - Tier: Fundamental | Intermediate | Advanced | Polish

### **Phase 3: Agent Deployment Integration**

#### 3.1 Deploy Agent for Issue
- **Endpoint:** `POST /api/issues/:id/deploy`
- **Flow:**
  ```typescript
  async function deployAgentForIssue(issueId: number, githubRepo: string) {
    const issue = await prisma.issue.findUnique({ where: { id: issueId } })
    
    // 1. Create deployed agent with issue context
    const agent = await prisma.deployedAgent.create({
      data: {
        brandProfileId: issue.brandProfileId,
        agentType: issue.agentType,
        agentName: `Fix: ${issue.title}`,
        status: 'deploying',
        githubRepoName: githubRepo,
        // Pass issue context to agent
        config: {
          issueId: issue.id,
          targetUrl: issue.affectedUrl,
          issueType: issue.category
        }
      }
    })
    
    // 2. Link issue to agent
    await prisma.issue.update({
      where: { id: issueId },
      data: {
        deployedAgentId: agent.id,
        status: 'in_progress'
      }
    })
    
    // 3. Create and execute task
    const task = await prisma.agentTask.create({
      data: {
        deployedAgentId: agent.id,
        taskType: 'fix_issue',
        taskName: issue.title,
        status: 'pending',
        input: { issue }
      }
    })
    
    // 4. Trigger agent execution
    await triggerAgentExecution(agent.id, task.id)
    
    return { agent, task }
  }
  ```

### **Phase 4: Score-Triggered Discovery**

#### 4.1 Automatic Re-discovery After Analysis
- **Integration Point:** End of `runUnifiedAnalysis()` in unified-analysis.service.ts
- **Code:**
  ```typescript
  // At end of runUnifiedAnalysis():
  
  // After saving analysis results...
  
  // Trigger issue discovery with new scores
  await discoverIssues(brandProfileId)
  
  // Log new issues discovered
  console.log(`[UnifiedAnalysis] Issue discovery complete for brandProfileId=${brandProfileId}`)
  ```

#### 4.2 Score Tier Calculation
- **File:** `mudra-app/lib/services/issue-discovery.service.ts`
- **Logic:**
  ```typescript
  function getTiersForScore(score: number): DiscoveryTier[] {
    // Users can see issues from their current tier AND all previous tiers
    // (in case they regressed or missed something)
    
    if (score >= 80) return ['fundamental', 'intermediate', 'advanced', 'polish']
    if (score >= 60) return ['fundamental', 'intermediate', 'advanced']
    if (score >= 30) return ['fundamental', 'intermediate']
    return ['fundamental']
  }
  
  function getPrimaryTierForScore(score: number): DiscoveryTier {
    if (score >= 80) return 'polish'
    if (score >= 60) return 'advanced'
    if (score >= 30) return 'intermediate'
    return 'fundamental'
  }
  ```

### **Phase 5: PR Merge Detection & Issue Resolution**

(Same as before - webhook + polling for PR status)

---

## API Endpoints

### New Routes to Create

#### `GET /api/issues`
- **Query:** `?brandProfileId=X&status=identified,in_progress&category=technical_structure`
- **Response:**
  ```typescript
  {
    success: true,
    data: {
      issues: Issue[],
      stats: {
        total: number,
        byStatus: { identified: 5, in_progress: 2, completed: 3, merged: 10 },
        byCategory: { technical_structure: 8, ai_visibility: 7, conversation: 5 },
        byTier: { fundamental: 3, intermediate: 10, advanced: 5, polish: 2 }
      },
      scores: {
        technicalStructure: 58,
        aiVisibility: 45,
        activeTiers: {
          technical: ['fundamental', 'intermediate'],
          aiVisibility: ['fundamental', 'intermediate']
        }
      }
    }
  }
  ```

#### `POST /api/issues/discover`
- **Action:** Trigger issue discovery for a brand profile
- **Body:** `{ brandProfileId: number, forceRefresh?: boolean }`
- **Returns:** `{ success: true, discovered: number, updated: number }`

#### `POST /api/issues/:id/deploy`
- **Action:** Deploy agent for specific issue
- **Body:** `{ githubRepo: string, githubBranch?: string }`
- **Returns:** `{ success: true, deployedAgent: {...}, agentTask: {...} }`

#### `POST /api/issues/sync-pr-status`
- **Action:** Sync PR status from GitHub for all completed issues
- **Returns:** `{ success: true, synced: number, merged: number }`

#### `POST /api/webhooks/github`
- **Webhook:** GitHub PR events (merge detection)
- **Validation:** HMAC signature check

---

## Components Structure

```
mudra-app/
├── app/
│   └── dashboard/
│       └── issues/
│           └── page.tsx              ← Main Issues page
│
├── components/
│   └── issues/
│       ├── github-connect-banner.tsx  ← Banner when GitHub not connected
│       ├── kanban-board.tsx           ← Main Kanban board component
│       ├── kanban-column.tsx          ← Individual column (Identified, etc.)
│       ├── issue-card.tsx             ← Single issue card
│       ├── issue-detail-modal.tsx     ← Full issue details popup
│       ├── deploy-agent-modal.tsx     ← Deploy agent confirmation
│       ├── pr-status-badge.tsx        ← PR status indicator
│       ├── category-filter.tsx        ← Filter by Tech/AI/Conversation
│       ├── tier-indicator.tsx         ← Shows issue tier (fundamental, etc.)
│       ├── discovery-status.tsx       ← "Analyzing your site..." indicator
│       └── score-progress-banner.tsx  ← "Improve score to discover more"
│
├── lib/
│   └── services/
│       ├── issue.service.ts              ← Issue CRUD operations
│       ├── issue-discovery.service.ts    ← LLM-powered issue discovery
│       ├── issue-dedup.service.ts        ← Deduplication logic
│       └── issue-tier.service.ts         ← Score-to-tier calculations
│
└── mastra/
    └── agents/
        └── issue-discovery.agent.ts      ← Mastra agent for LLM discovery
```

---

## UI/UX Details

### Issue Card Design (Discovered)
```
┌─────────────────────────────────────────┐
│ 🔴 CRITICAL    FUNDAMENTAL    [Deploy]  │ ← Priority + Tier + Action
├─────────────────────────────────────────┤
│ Add Schema.org Markup                   │ ← Title
│                                         │
│ No schema markup detected. Adding      │ ← Description
│ structured data improves AI under...    │
│                                         │
│ 📊 Impact: +5-8 points                  │
│ 🏷️ Category: Technical Structure        │
│ 🤖 Agent: AEO Optimizer                 │
│ 📅 Discovered 2 days ago                │
└─────────────────────────────────────────┘
```

### Category Tabs/Filters
```
┌──────────────────────────────────────────────────────────────┐
│  [All (20)]  [Technical Structure (12)]  [AI Visibility (5)]│
│              [Conversations (3)]                             │
├──────────────────────────────────────────────────────────────┤
│  Filter by tier: [Fundamental ✓] [Intermediate ✓] [Advanced]│
└──────────────────────────────────────────────────────────────┘
```

### Discovery Status Banner
```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Analyzing your website...                               │
│  ━━━━━━━━━━━━━━━━━━░░░░░░░░ 67%                             │
│  Discovered 8 issues so far • Checking AI visibility...     │
└─────────────────────────────────────────────────────────────┘
```

### Score Progress Banner (when low score)
```
┌─────────────────────────────────────────────────────────────┐
│  📈 Your Technical Structure score is 28/100                 │
│                                                              │
│  Fix these fundamental issues to discover more advanced     │
│  optimization opportunities.                                 │
│                                                              │
│  [View Score Details]                                        │
└─────────────────────────────────────────────────────────────┘
```

### Status Indicator Colors (same as before)
- **Identified:** Gray/neutral (waiting)
- **In Progress:** Orange (🟠 animating spinner)
- **Completed:** Green (✅ checkmark)
- **Merged:** Purple/blue (🎉 celebration)

### Category Colors
- **Technical Structure:** Blue (#3B82F6)
- **AI Visibility:** Purple (#8B5CF6)
- **Conversations:** Green (#10B981)

### Tier Badges
- **Fundamental:** Red badge - "🔴 Fundamental"
- **Intermediate:** Orange badge - "🟠 Intermediate"
- **Advanced:** Yellow badge - "🟡 Advanced"
- **Polish:** Green badge - "🟢 Polish"

---

## Issue Discovery Examples by Category

### Technical Structure Issues

| Score Range | Tier | Example Issues |
|-------------|------|----------------|
| 0-30 | Fundamental | Missing robots.txt, No sitemap.xml, Missing meta descriptions, No schema markup at all, Broken heading hierarchy |
| 30-60 | Intermediate | Add FAQ schema, Improve internal linking, Restructure headings as Q&A, Add breadcrumb navigation, Image alt text missing |
| 60-80 | Advanced | Add Speakable schema, Implement HowTo schema, Add Product/Service schema, Optimize Core Web Vitals, Add JSON-LD for articles |
| 80+ | Polish | Minor schema enhancements, Edge case fixes, Performance micro-optimizations, Accessibility tweaks |

### AI Visibility Issues

| Score Range | Tier | Example Issues |
|-------------|------|----------------|
| 0-30 | Fundamental | No llms.txt file, Content not AI-readable, No citation signals, Missing authority markers |
| 30-60 | Intermediate | llms.txt incomplete, Content restructuring needed, Improve citation-worthy statements, Add expertise signals |
| 60-80 | Advanced | Optimize llms.txt for competitive positioning, Multi-platform AI optimization, Thought leadership gaps, Citation strategy improvements |
| 80+ | Polish | llms.txt fine-tuning, Advanced citation tactics, Niche AI platform optimizations |

### Conversation Opportunities

| Source | Tier | Example Issues |
|--------|------|----------------|
| Reddit | Active | "Engage: Best tools for [your category] on r/startups" |
| Twitter | Active | "Reply: Industry expert asking about [your problem space]" |
| Forums | Active | "Answer: Question about [your solution area] on HackerNews" |

---

## Migration Path

### Step 1: Database Migration
```powershell
cd mudra-app
# Edit prisma/schema.prisma to add new Issue fields
npx prisma migrate dev --name add_issue_discovery_fields
npx prisma generate
```

### Step 2: Create Issue Discovery Agent
- Build `lib/services/issue-discovery.service.ts`
- Create LLM prompts for technical and AI visibility analysis
- Add tier calculation logic

### Step 3: Integrate with Unified Analysis
- Modify `runUnifiedAnalysis()` to call `discoverIssues()` at end
- Pass current scores to discovery service
- Handle deduplication

### Step 4: Build UI Components
- Kanban board with category filters
- Issue cards with tier badges
- Deploy button integration

### Step 5: Connect Conversation Radar
- Map ConversationOpportunity → Issue
- Add "conversation" category support

### Step 6: Test End-to-End
- Run analysis → verify issues discovered
- Deploy agent → verify status updates
- Merge PR → verify resolution

---

## Testing Checklist

### Unit Tests
- [ ] Tier calculation: score 25 → "fundamental" only
- [ ] Tier calculation: score 55 → ["fundamental", "intermediate"]
- [ ] Issue deduplication by hash
- [ ] LLM prompt generation with correct context

### Integration Tests
- [ ] Technical analysis completion → Issues discovered
- [ ] AI visibility analysis completion → Issues discovered
- [ ] Conversation Radar opportunity → Converted to Issue
- [ ] Deploy agent for issue → Status updates correctly
- [ ] PR merge webhook → Issue marked as merged

### E2E User Flow
- [ ] No GitHub → Shows issues view-only with connect banner
- [ ] GitHub connected → Deploy button enabled
- [ ] Low score → Only fundamental issues visible
- [ ] Fix fundamentals → Intermediate issues discovered
- [ ] Deploy agent → Status changes to "in_progress"
- [ ] Agent creates PR → Status changes to "completed"
- [ ] Merge PR → Status changes to "merged"
- [ ] Re-run analysis → New issues discovered based on improved score

### Edge Cases
- [ ] All issues in category merged → Show "All caught up!" message
- [ ] Agent deployment fails → Show error, keep in "identified"
- [ ] PR closed without merge → Keep in "completed"
- [ ] Score regresses → Show previously-discovered issues still
- [ ] Same issue discovered twice → Deduplicate by hash

---

## Performance Considerations

### Database Queries
- Always filter by `brandProfileId` first
- Use indexes: `[brandProfileId, status]`, `[brandProfileId, unlockScore]`
- Paginate if >100 issues per brand

### Real-time Updates
- WebSocket or polling for agent status (currently using polling in Agent Lab)
- Debounce GitHub webhook events (multiple events per PR merge)

### Caching
- Cache issue discovery results (only re-discover on new analysis)
- Cache GitHub PR status (fetch max once per minute)

---

## Future Enhancements (Post-MVP)

### Advanced Features
- **Drag-and-drop reordering** (Kanban style)
- **Batch deploy** (select multiple issues, deploy all)
- **Issue dependencies** (can't fix B until A is merged)
- **Custom issues** (user manually creates issues)
- **Issue templates** (pre-filled forms for common issues)

### Analytics
- **Issue resolution time** (discovered → merged)
- **Agent success rate** (% of PRs that get merged)
- **Issue impact tracking** (before/after score comparison)

### Notifications
- **Email:** "Your PR was merged! 🎉"
- **In-app:** Toast notification when status changes
- **Slack integration:** Post updates to team channel

### GitHub App Improvements
- **Auto-merge** (if all checks pass, auto-merge low-risk PRs)
- **Review requests** (tag team members in PR)
- **Multi-repo support** (issues across multiple repos)

---

## Implementation Estimate

### Time Breakdown (Assuming 1 developer)

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| **Phase 1: Issue Discovery Agent** | LLM prompts, discovery service, tier logic, deduplication | 3-4 days |
| **Phase 2: GitHub Gating & Basic UI** | Kanban board, cards, category filters, connect banner | 2-3 days |
| **Phase 3: Agent Deployment** | Deploy button, status updates, integration with Agent Lab | 2 days |
| **Phase 4: Score-Triggered Discovery** | Integration with unified analysis, automatic re-discovery | 1-2 days |
| **Phase 5: PR Merge Detection** | Webhook + polling, status sync | 2 days |
| **Phase 6: Conversation Integration** | Map Radar opportunities → Issues | 1 day |
| **Testing & Polish** | E2E testing, animations, bug fixes | 2 days |

**Total: 14-16 days** (assumes existing Agent Lab code reused)

---

## Questions for Product Decision

1. **How often should discovery run?** Every analysis? Daily? On-demand only?
2. **Should users be able to dismiss/hide issues?** Or only resolved via merge?
3. **What happens to issues when score regresses?** Keep showing? Mark as "re-opened"?
4. **Priority for Conversation issues?** Same Kanban or separate view?
5. **Should we batch-deploy multiple issues?** Or one at a time?
6. **LLM model for discovery?** GPT-4o? Claude? Local model?

---

## Success Metrics

### User Engagement
- % of users who connect GitHub after viewing Issues page
- Average issues deployed per user
- % of deployed agents that result in merged PRs

### Product Impact
- Time from issue discovered → PR merged
- Score improvement after issue is merged
- User retention (do users come back to deploy more issues?)

### Technical Health
- API response time for `/api/issues` (<500ms)
- Webhook delivery success rate (>95%)
- Agent deployment success rate (>80%)
- LLM discovery latency (<10s per category)

---

## Notes & Assumptions

1. **Existing Agent Lab code** provides the foundation (deployment, task execution, PR creation)
2. **GitHub integration** is already functional (OAuth + GitHub App)
3. **Unified analysis service** already runs and stores results
4. **Issue model** exists in schema but needs extension
5. **UI components** can reuse existing dashboard patterns (cards, modals, badges)
6. **LLM API access** available for issue discovery (OpenAI/Anthropic)
7. **Conversation Radar** already discovers opportunities that can be mapped to Issues

---

## Next Steps

1. **Review this scope** with team/stakeholders
2. **Answer product questions** (see section above)
3. **Prioritize phases** (Issue Discovery Agent is core - start there)
4. **Create GitHub issues** for each component/API endpoint
5. **Start with database migration** (extends Issue model)
6. **Build Issue Discovery Agent** (LLM prompts + service)
7. **Build basic UI** (Kanban board with category filters)
8. **Connect API endpoints** and test with real data

---

**Last Updated:** January 28, 2026  
**Status:** Draft for Review - Updated with Progressive Discovery Model  
**Owner:** Development Team

