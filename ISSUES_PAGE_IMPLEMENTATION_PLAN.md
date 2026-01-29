# Issues Page - Implementation Plan

> **Scope Document:** [ISSUES_PAGE_IMPLEMENTATION_SCOPE.md](./ISSUES_PAGE_IMPLEMENTATION_SCOPE.md)  
> **Estimated Duration:** 3-4 weeks  
> **Created:** January 28, 2026

---

## Phase Overview

| Phase | Name | Duration | Dependencies |
|-------|------|----------|--------------|
| 1 | Database & Schema | 2 days | None |
| 2 | E2B Sandbox Service | 2 days | Phase 1 |
| 3 | Issue Discovery Agent | 3 days | Phase 1 |
| 4 | Issue Resolution Agents | 4 days | Phase 2, 3 |
| 5 | API Routes | 2 days | Phase 3, 4 |
| 6 | UI Components | 3 days | Phase 5 |
| 7 | Integration & E2E Tests | 2 days | All phases |
| 8 | GitHub Webhook Integration | 1 day | Phase 5 |

---

## Phase 1: Database & Schema (2 days)

### 1.1 Prisma Schema Updates

**File:** `mudra-app/prisma/schema.prisma`

```prisma
// Add/Update Issue model with all new fields
model Issue {
  id                  Int          @id @default(autoincrement())
  brandProfileId      Int
  title               String
  description         String?
  type                String       @default("improvement")
  status              String       @default("identified")
  priority            String       @default("medium")
  order               Int          @default(0)
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt
  
  // Category & Discovery
  category            String       // "technical_structure", "ai_visibility", "conversation"
  discoveryTier       String       // "fundamental", "intermediate", "advanced", "polish"
  minScoreRequired    Int          @default(0)
  discoveredFromScore Float?
  
  // Agent & Execution
  deployedAgentId     Int?
  agentTaskId         Int?
  agentType           String?
  
  // GitHub PR Tracking
  prUrl               String?
  prNumber            Int?
  prStatus            String?
  
  // Issue Context
  sourceAnalysis      String?
  affectedUrl         String?
  estimatedImpact     String?
  
  // E2B Sandbox Tracking
  usedE2bSandbox      Boolean      @default(false)
  e2bSandboxId        String?
  e2bExecutionMs      Int?
  e2bValidationResult Json?
  
  // Deduplication
  issueHash           String?      @unique
  
  // Relations
  brandProfile        BrandProfile @relation(fields: [brandProfileId], references: [id], onDelete: Cascade)
  deployedAgent       DeployedAgent? @relation(fields: [deployedAgentId], references: [id])
  agentTask           AgentTask?   @relation(fields: [agentTaskId], references: [id])

  @@index([brandProfileId])
  @@index([brandProfileId, status])
  @@index([brandProfileId, category])
  @@index([category, discoveryTier])
  @@map("issues")
}
```

### Tasks

| Task | File | Description | Test |
|------|------|-------------|------|
| 1.1.1 | `prisma/schema.prisma` | Add Issue model with all fields | Migration succeeds |
| 1.1.2 | `prisma/schema.prisma` | Add relation from BrandProfile to Issue[] | Query works |
| 1.1.3 | Terminal | Run `npx prisma migrate dev --name add_issues_table` | No errors |
| 1.1.4 | Terminal | Run `npx prisma generate` | Types generated |

### Tests

**File:** `mudra-app/__tests__/db/issue-schema.test.ts`

```typescript
import { prisma } from '@/lib/prisma'

describe('Issue Schema', () => {
  const testBrandProfileId = 1

  afterAll(async () => {
    await prisma.issue.deleteMany({ where: { brandProfileId: testBrandProfileId } })
  })

  it('creates issue with required fields', async () => {
    const issue = await prisma.issue.create({
      data: {
        brandProfileId: testBrandProfileId,
        title: 'Test Issue',
        category: 'technical_structure',
        discoveryTier: 'fundamental',
      }
    })
    expect(issue.id).toBeDefined()
    expect(issue.status).toBe('identified')
  })

  it('enforces unique issueHash', async () => {
    await prisma.issue.create({
      data: {
        brandProfileId: testBrandProfileId,
        title: 'Unique Test',
        category: 'technical_structure',
        discoveryTier: 'fundamental',
        issueHash: 'unique-hash-123'
      }
    })
    
    await expect(prisma.issue.create({
      data: {
        brandProfileId: testBrandProfileId,
        title: 'Duplicate Hash',
        category: 'technical_structure',
        discoveryTier: 'fundamental',
        issueHash: 'unique-hash-123'
      }
    })).rejects.toThrow()
  })

  it('cascades delete with brand profile', async () => {
    // Create temporary brand profile and issue
    // Delete brand profile
    // Verify issue is deleted
  })
})
```

---

## Phase 2: E2B Sandbox Service (2 days)

### 2.1 E2B Service Implementation

**File:** `mudra-app/lib/services/e2b-sandbox.service.ts`

### Tasks

| Task | File | Description | Test |
|------|------|-------------|------|
| 2.1.1 | `lib/services/e2b-sandbox.service.ts` | Create base E2B service with sandbox lifecycle | Unit test |
| 2.1.2 | `lib/services/e2b-sandbox.service.ts` | Add `validateSchemaInSandbox()` function | Integration test |
| 2.1.3 | `lib/services/e2b-sandbox.service.ts` | Add `testGeneratedCode()` function | Integration test |
| 2.1.4 | `lib/services/e2b-sandbox.service.ts` | Add `validateHtmlStructure()` function | Integration test |
| 2.1.5 | `lib/services/e2b-sandbox.service.ts` | Add timeout and error handling | Error scenarios |

### Implementation

```typescript
// lib/services/e2b-sandbox.service.ts
import { CodeInterpreter } from '@e2b/code-interpreter'

const E2B_TIMEOUT_MS = 30000 // 30 second timeout

interface SandboxResult<T> {
  success: boolean
  data?: T
  error?: string
  executionMs: number
  sandboxId: string
}

export async function withSandbox<T>(
  fn: (sandbox: CodeInterpreter) => Promise<T>
): Promise<SandboxResult<T>> {
  const startTime = Date.now()
  const sandbox = await CodeInterpreter.create()
  
  try {
    const data = await Promise.race([
      fn(sandbox),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Sandbox timeout')), E2B_TIMEOUT_MS)
      )
    ])
    
    return {
      success: true,
      data,
      executionMs: Date.now() - startTime,
      sandboxId: sandbox.id
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionMs: Date.now() - startTime,
      sandboxId: sandbox.id
    }
  } finally {
    await sandbox.close()
  }
}

export async function validateSchemaInSandbox(jsonLdSchema: string): Promise<SandboxResult<{
  valid: boolean
  errors: string[]
  expanded?: object
}>> {
  return withSandbox(async (sandbox) => {
    // Install required package
    await sandbox.notebook.execCell('!pip install pyld -q')
    
    const result = await sandbox.notebook.execCell(`
import json
from pyld import jsonld

schema = '''${jsonLdSchema.replace(/'/g, "\\'")}'''

try:
    parsed = json.loads(schema)
    expanded = jsonld.expand(parsed)
    print(json.dumps({"valid": True, "errors": [], "expanded": expanded}))
except json.JSONDecodeError as e:
    print(json.dumps({"valid": False, "errors": [f"JSON parse error: {str(e)}"]}))
except Exception as e:
    print(json.dumps({"valid": False, "errors": [str(e)]}))
    `)
    
    return JSON.parse(result.logs[0]?.text || '{"valid": false, "errors": ["No output"]}')
  })
}

export async function testGeneratedCode(
  code: string,
  language: 'python' | 'javascript' = 'python'
): Promise<SandboxResult<{ output: string }>> {
  return withSandbox(async (sandbox) => {
    const result = await sandbox.notebook.execCell(code)
    return {
      output: result.logs.map(l => l.text).join('\n')
    }
  })
}
```

### Tests

**File:** `mudra-app/__tests__/services/e2b-sandbox.test.ts`

```typescript
import { validateSchemaInSandbox, testGeneratedCode, withSandbox } from '@/lib/services/e2b-sandbox.service'

// Skip if no E2B API key
const describeWithE2B = process.env.E2B_API_KEY ? describe : describe.skip

describeWithE2B('E2B Sandbox Service', () => {
  jest.setTimeout(60000) // E2B can take time

  describe('validateSchemaInSandbox', () => {
    it('validates correct JSON-LD schema', async () => {
      const validSchema = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Test Company"
      })
      
      const result = await validateSchemaInSandbox(validSchema)
      
      expect(result.success).toBe(true)
      expect(result.data?.valid).toBe(true)
      expect(result.data?.errors).toHaveLength(0)
      expect(result.executionMs).toBeLessThan(30000)
    })

    it('rejects invalid JSON', async () => {
      const invalidSchema = '{ not valid json }'
      
      const result = await validateSchemaInSandbox(invalidSchema)
      
      expect(result.success).toBe(true) // Sandbox worked
      expect(result.data?.valid).toBe(false)
      expect(result.data?.errors.length).toBeGreaterThan(0)
    })
  })

  describe('testGeneratedCode', () => {
    it('executes Python code and returns output', async () => {
      const result = await testGeneratedCode('print("Hello, E2B!")')
      
      expect(result.success).toBe(true)
      expect(result.data?.output).toContain('Hello, E2B!')
    })

    it('handles code errors gracefully', async () => {
      const result = await testGeneratedCode('raise ValueError("Test error")')
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('withSandbox', () => {
    it('returns sandbox metadata', async () => {
      const result = await withSandbox(async () => 'test')
      
      expect(result.sandboxId).toBeDefined()
      expect(result.executionMs).toBeGreaterThan(0)
    })
  })
})
```

---

## Phase 3: Issue Discovery Agent (3 days)

### 3.1 Discovery Service

**File:** `mudra-app/lib/services/issue-discovery.service.ts`

### Tasks

| Task | File | Description | Test |
|------|------|-------------|------|
| 3.1.1 | `lib/services/issue-discovery.service.ts` | Create `getTiersForScore()` utility | Unit test |
| 3.1.2 | `lib/services/issue-discovery.service.ts` | Create `generateIssueHash()` function | Unit test |
| 3.1.3 | `lib/services/issue-discovery.service.ts` | Implement `discoverTechnicalIssues()` | Integration test |
| 3.1.4 | `lib/services/issue-discovery.service.ts` | Implement `discoverAIVisibilityIssues()` | Integration test |
| 3.1.5 | `lib/services/issue-discovery.service.ts` | Implement `discoverConversationOpportunities()` | Integration test |
| 3.1.6 | `lib/services/issue-discovery.service.ts` | Create main `discoverIssues()` orchestrator | E2E test |
| 3.1.7 | `lib/services/issue-discovery.service.ts` | Add deduplication with `upsertDiscoveredIssues()` | Unit test |

### Implementation Skeleton

```typescript
// lib/services/issue-discovery.service.ts
import { prisma } from '@/lib/prisma'
import { openai } from '@/lib/openai'
import crypto from 'crypto'

type DiscoveryTier = 'fundamental' | 'intermediate' | 'advanced' | 'polish'
type IssueCategory = 'technical_structure' | 'ai_visibility' | 'conversation'

interface DiscoveredIssue {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  agentType: string
  estimatedImpact: string
  affectedUrl?: string
  category: IssueCategory
  discoveryTier: DiscoveryTier
}

export function getTiersForScore(score: number): DiscoveryTier[] {
  if (score >= 80) return ['fundamental', 'intermediate', 'advanced', 'polish']
  if (score >= 60) return ['fundamental', 'intermediate', 'advanced']
  if (score >= 30) return ['fundamental', 'intermediate']
  return ['fundamental']
}

export function generateIssueHash(
  brandProfileId: number,
  category: string,
  title: string
): string {
  const normalized = `${brandProfileId}-${category}-${title.toLowerCase().trim()}`
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

export async function discoverIssues(brandProfileId: number): Promise<{
  discovered: number
  categories: Record<IssueCategory, number>
}> {
  // 1. Get current scores
  const technicalScore = await getLatestTechnicalScore(brandProfileId)
  const aiVisibilityScore = await getLatestAIVisibilityScore(brandProfileId)
  
  // 2. Get tiers for each category
  const technicalTiers = getTiersForScore(technicalScore)
  const aiVisibilityTiers = getTiersForScore(aiVisibilityScore)
  
  // 3. Get website data
  const websiteData = await getWebsiteAnalysisData(brandProfileId)
  
  // 4. Discover issues in parallel
  const [technicalIssues, aiVisibilityIssues, conversationIssues] = await Promise.all([
    discoverTechnicalIssues(brandProfileId, websiteData, technicalTiers, technicalScore),
    discoverAIVisibilityIssues(brandProfileId, websiteData, aiVisibilityTiers, aiVisibilityScore),
    discoverConversationOpportunities(brandProfileId)
  ])
  
  // 5. Upsert all issues (handles deduplication)
  const allIssues = [...technicalIssues, ...aiVisibilityIssues, ...conversationIssues]
  await upsertDiscoveredIssues(brandProfileId, allIssues)
  
  return {
    discovered: allIssues.length,
    categories: {
      technical_structure: technicalIssues.length,
      ai_visibility: aiVisibilityIssues.length,
      conversation: conversationIssues.length
    }
  }
}

async function discoverTechnicalIssues(
  brandProfileId: number,
  websiteData: WebsiteData,
  tiers: DiscoveryTier[],
  currentScore: number
): Promise<DiscoveredIssue[]> {
  const prompt = buildTechnicalDiscoveryPrompt(websiteData, tiers, currentScore)
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' }
  })
  
  const parsed = JSON.parse(response.choices[0].message.content || '{"issues":[]}')
  return parsed.issues.map((issue: DiscoveredIssue) => ({
    ...issue,
    category: 'technical_structure' as const,
    discoveredFromScore: currentScore
  }))
}

async function upsertDiscoveredIssues(
  brandProfileId: number,
  issues: DiscoveredIssue[]
): Promise<void> {
  for (const issue of issues) {
    const hash = generateIssueHash(brandProfileId, issue.category, issue.title)
    
    await prisma.issue.upsert({
      where: { issueHash: hash },
      create: {
        brandProfileId,
        title: issue.title,
        description: issue.description,
        priority: issue.priority,
        category: issue.category,
        discoveryTier: issue.discoveryTier,
        agentType: issue.agentType,
        estimatedImpact: issue.estimatedImpact,
        affectedUrl: issue.affectedUrl,
        discoveredFromScore: issue.discoveredFromScore,
        issueHash: hash,
        status: 'identified'
      },
      update: {
        // Don't update existing issues - they may have progressed
        // Only update if still in 'identified' status
      }
    })
  }
}
```

### Tests

**File:** `mudra-app/__tests__/services/issue-discovery.test.ts`

```typescript
import { 
  getTiersForScore, 
  generateIssueHash,
  discoverIssues 
} from '@/lib/services/issue-discovery.service'

describe('Issue Discovery Service', () => {
  describe('getTiersForScore', () => {
    it('returns only fundamental for score < 30', () => {
      expect(getTiersForScore(0)).toEqual(['fundamental'])
      expect(getTiersForScore(15)).toEqual(['fundamental'])
      expect(getTiersForScore(29)).toEqual(['fundamental'])
    })

    it('returns fundamental + intermediate for score 30-59', () => {
      expect(getTiersForScore(30)).toEqual(['fundamental', 'intermediate'])
      expect(getTiersForScore(45)).toEqual(['fundamental', 'intermediate'])
      expect(getTiersForScore(59)).toEqual(['fundamental', 'intermediate'])
    })

    it('returns up to advanced for score 60-79', () => {
      expect(getTiersForScore(60)).toEqual(['fundamental', 'intermediate', 'advanced'])
      expect(getTiersForScore(79)).toEqual(['fundamental', 'intermediate', 'advanced'])
    })

    it('returns all tiers for score 80+', () => {
      expect(getTiersForScore(80)).toEqual(['fundamental', 'intermediate', 'advanced', 'polish'])
      expect(getTiersForScore(100)).toEqual(['fundamental', 'intermediate', 'advanced', 'polish'])
    })
  })

  describe('generateIssueHash', () => {
    it('generates consistent hash for same inputs', () => {
      const hash1 = generateIssueHash(1, 'technical_structure', 'Add Schema Markup')
      const hash2 = generateIssueHash(1, 'technical_structure', 'Add Schema Markup')
      expect(hash1).toBe(hash2)
    })

    it('generates different hash for different titles', () => {
      const hash1 = generateIssueHash(1, 'technical_structure', 'Add Schema Markup')
      const hash2 = generateIssueHash(1, 'technical_structure', 'Fix Heading Hierarchy')
      expect(hash1).not.toBe(hash2)
    })

    it('generates different hash for different brand profiles', () => {
      const hash1 = generateIssueHash(1, 'technical_structure', 'Add Schema Markup')
      const hash2 = generateIssueHash(2, 'technical_structure', 'Add Schema Markup')
      expect(hash1).not.toBe(hash2)
    })

    it('normalizes title case', () => {
      const hash1 = generateIssueHash(1, 'technical_structure', 'Add Schema Markup')
      const hash2 = generateIssueHash(1, 'technical_structure', 'add schema markup')
      expect(hash1).toBe(hash2)
    })
  })
})

describe('Issue Discovery Integration', () => {
  // These tests require database and OpenAI
  const testBrandProfileId = 1

  beforeAll(async () => {
    // Ensure test brand profile exists with analysis data
  })

  afterAll(async () => {
    // Clean up test issues
    await prisma.issue.deleteMany({
      where: { brandProfileId: testBrandProfileId }
    })
  })

  it('discovers issues based on analysis data', async () => {
    const result = await discoverIssues(testBrandProfileId)
    
    expect(result.discovered).toBeGreaterThan(0)
    expect(result.categories.technical_structure).toBeGreaterThanOrEqual(0)
    expect(result.categories.ai_visibility).toBeGreaterThanOrEqual(0)
  })

  it('does not create duplicate issues', async () => {
    // Run discovery twice
    await discoverIssues(testBrandProfileId)
    const countBefore = await prisma.issue.count({ where: { brandProfileId: testBrandProfileId } })
    
    await discoverIssues(testBrandProfileId)
    const countAfter = await prisma.issue.count({ where: { brandProfileId: testBrandProfileId } })
    
    expect(countAfter).toBe(countBefore)
  })
})
```

---

## Phase 4: Issue Resolution Agents (4 days)

### 4.1 New Mastra Agents

| Task | File | Description | Test |
|------|------|-------------|------|
| 4.1.1 | `mastra/agents/schema-architect-agent.ts` | JSON-LD schema generation agent | Unit test |
| 4.1.2 | `mastra/agents/llms-txt-agent.ts` | llms.txt creation/optimization agent | Unit test |
| 4.1.3 | `mastra/agents/site-config-agent.ts` | robots.txt/sitemap agent | Unit test |
| 4.1.4 | `mastra/agents/content-restructure-agent.ts` | Heading hierarchy agent | Unit test |
| 4.1.5 | `mastra/agents/citation-enhancer-agent.ts` | Citation signals agent | Unit test |
| 4.1.6 | `mastra/index.ts` | Register new agents with Mastra | Integration test |

### 4.2 Agent Executor Service

**File:** `mudra-app/lib/services/issue-agent-executor.service.ts`

| Task | File | Description | Test |
|------|------|-------------|------|
| 4.2.1 | `lib/services/issue-agent-executor.service.ts` | Create agent selector by issue type | Unit test |
| 4.2.2 | `lib/services/issue-agent-executor.service.ts` | Implement `executeIssueAgent()` function | Integration test |
| 4.2.3 | `lib/services/issue-agent-executor.service.ts` | Add E2B validation integration | Integration test |
| 4.2.4 | `lib/services/issue-agent-executor.service.ts` | Add GitHub PR creation | Integration test |
| 4.2.5 | `lib/services/issue-agent-executor.service.ts` | Add status update callbacks | Unit test |

### Implementation

```typescript
// mastra/agents/schema-architect-agent.ts
import { Agent } from '@mastra/core'
import { z } from 'zod'

export const schemaArchitectAgent = new Agent({
  name: 'Schema Architect',
  instructions: `You are an expert at creating Schema.org JSON-LD markup.
  
Your task is to analyze website content and generate appropriate schema markup that:
1. Accurately represents the content type (Article, Product, FAQ, Organization, etc.)
2. Includes all relevant properties
3. Is valid JSON-LD that passes schema.org validation
4. Optimizes for rich snippets in search results
5. Enhances AI readability

When generating schema:
- Always include @context and @type
- Use proper nesting for complex types
- Include datePublished, dateModified for articles
- Add author and publisher information
- Include images with proper sizing
`,
  model: {
    provider: 'OPENAI',
    name: 'gpt-4o',
  },
  tools: {
    generateSchemaMarkup: {
      description: 'Generate JSON-LD schema for given content',
      parameters: z.object({
        contentType: z.enum(['Article', 'Product', 'FAQ', 'Organization', 'LocalBusiness', 'Service']),
        content: z.string().describe('The content to generate schema for'),
        existingSchema: z.string().optional().describe('Existing schema to enhance')
      }),
      execute: async ({ contentType, content, existingSchema }) => {
        // Generate schema based on content type
        return { schema: '...' }
      }
    }
  }
})
```

```typescript
// lib/services/issue-agent-executor.service.ts
import { mastra } from '@/mastra'
import { prisma } from '@/lib/prisma'
import { validateSchemaInSandbox } from './e2b-sandbox.service'
import { createOptimizationPR } from './github-pr.service'

const ISSUE_AGENT_MAP: Record<string, string> = {
  'schema_markup': 'schemaArchitectAgent',
  'heading_hierarchy': 'contentRestructureAgent',
  'robots_txt': 'siteConfigAgent',
  'llms_txt_missing': 'llmsTxtAgent',
  'citation_signals': 'citationEnhancerAgent',
  'reddit_opportunity': 'conversationRadarAgent',
}

const E2B_REQUIRED_TYPES = ['schema_markup', 'ai_readable_content']

export async function executeIssueAgent(issueId: number): Promise<{
  success: boolean
  prUrl?: string
  error?: string
}> {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: { brandProfile: true }
  })
  
  if (!issue) throw new Error('Issue not found')
  
  // 1. Update status to in_progress
  await prisma.issue.update({
    where: { id: issueId },
    data: { status: 'in_progress' }
  })
  
  try {
    // 2. Get appropriate agent
    const agentName = ISSUE_AGENT_MAP[issue.agentType || ''] || 'aeoGeoOptimizerAgent'
    const agent = mastra.getAgent(agentName)
    
    // 3. Execute agent
    const response = await agent.generate([
      {
        role: 'user',
        content: `Fix this issue for ${issue.brandProfile.websiteUrl}:
        
Title: ${issue.title}
Description: ${issue.description}
Affected URL: ${issue.affectedUrl || issue.brandProfile.websiteUrl}

Generate the fix and return the code/content that should be added.`
      }
    ])
    
    const generatedContent = response.text
    
    // 4. Validate with E2B if needed
    let e2bResult = null
    if (E2B_REQUIRED_TYPES.includes(issue.agentType || '')) {
      e2bResult = await validateSchemaInSandbox(generatedContent)
      
      if (!e2bResult.success || !e2bResult.data?.valid) {
        throw new Error(`Validation failed: ${e2bResult.error || e2bResult.data?.errors.join(', ')}`)
      }
      
      // Track E2B usage
      await prisma.issue.update({
        where: { id: issueId },
        data: {
          usedE2bSandbox: true,
          e2bSandboxId: e2bResult.sandboxId,
          e2bExecutionMs: e2bResult.executionMs,
          e2bValidationResult: e2bResult.data
        }
      })
    }
    
    // 5. Create GitHub PR
    const pr = await createOptimizationPR({
      brandProfileId: issue.brandProfileId,
      title: `fix: ${issue.title}`,
      description: issue.description || '',
      changes: [{ content: generatedContent, path: getFilePath(issue) }]
    })
    
    // 6. Update issue with PR info
    await prisma.issue.update({
      where: { id: issueId },
      data: {
        status: 'completed',
        prUrl: pr.url,
        prNumber: pr.number,
        prStatus: 'open'
      }
    })
    
    return { success: true, prUrl: pr.url }
    
  } catch (error) {
    // Reset status on failure
    await prisma.issue.update({
      where: { id: issueId },
      data: { status: 'identified' }
    })
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
```

### Tests

**File:** `mudra-app/__tests__/services/issue-agent-executor.test.ts`

```typescript
import { executeIssueAgent } from '@/lib/services/issue-agent-executor.service'
import { prisma } from '@/lib/prisma'

describe('Issue Agent Executor', () => {
  let testIssueId: number

  beforeAll(async () => {
    // Create test issue
    const issue = await prisma.issue.create({
      data: {
        brandProfileId: 1,
        title: 'Test Schema Issue',
        category: 'technical_structure',
        discoveryTier: 'fundamental',
        agentType: 'schema_markup'
      }
    })
    testIssueId = issue.id
  })

  afterAll(async () => {
    await prisma.issue.delete({ where: { id: testIssueId } })
  })

  it('updates issue status to in_progress during execution', async () => {
    // Mock agent execution to be slow
    const executePromise = executeIssueAgent(testIssueId)
    
    // Check status during execution
    await new Promise(r => setTimeout(r, 100))
    const issue = await prisma.issue.findUnique({ where: { id: testIssueId } })
    expect(issue?.status).toBe('in_progress')
    
    // Wait for completion
    await executePromise
  })

  it('resets status to identified on failure', async () => {
    // Create issue with invalid agent type to force failure
    const badIssue = await prisma.issue.create({
      data: {
        brandProfileId: 1,
        title: 'Bad Issue',
        category: 'technical_structure',
        discoveryTier: 'fundamental',
        agentType: 'nonexistent_agent'
      }
    })

    const result = await executeIssueAgent(badIssue.id)
    
    expect(result.success).toBe(false)
    
    const issue = await prisma.issue.findUnique({ where: { id: badIssue.id } })
    expect(issue?.status).toBe('identified')
    
    await prisma.issue.delete({ where: { id: badIssue.id } })
  })

  it('tracks E2B sandbox usage for schema issues', async () => {
    const result = await executeIssueAgent(testIssueId)
    
    if (result.success) {
      const issue = await prisma.issue.findUnique({ where: { id: testIssueId } })
      expect(issue?.usedE2bSandbox).toBe(true)
      expect(issue?.e2bSandboxId).toBeDefined()
      expect(issue?.e2bExecutionMs).toBeGreaterThan(0)
    }
  })
})
```

---

## Phase 5: API Routes (2 days)

### Tasks

| Task | File | Description | Test |
|------|------|-------------|------|
| 5.1.1 | `app/api/issues/route.ts` | GET - List issues by brandProfileId, status, category | API test |
| 5.1.2 | `app/api/issues/route.ts` | POST - Trigger issue discovery | API test |
| 5.1.3 | `app/api/issues/[id]/route.ts` | GET - Get single issue details | API test |
| 5.1.4 | `app/api/issues/[id]/route.ts` | PATCH - Update issue status/order | API test |
| 5.1.5 | `app/api/issues/[id]/deploy/route.ts` | POST - Deploy agent for issue | API test |
| 5.1.6 | `app/api/issues/[id]/retry/route.ts` | POST - Retry failed issue | API test |
| 5.1.7 | `app/api/webhooks/github/route.ts` | POST - Handle PR merge webhook | Integration test |

### Implementation

```typescript
// app/api/issues/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { discoverIssues } from '@/lib/services/issue-discovery.service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const brandProfileId = searchParams.get('brandProfileId')
  const status = searchParams.get('status')
  const category = searchParams.get('category')

  if (!brandProfileId) {
    return NextResponse.json({ error: 'brandProfileId required' }, { status: 400 })
  }

  const issues = await prisma.issue.findMany({
    where: {
      brandProfileId: parseInt(brandProfileId),
      ...(status && { status }),
      ...(category && { category })
    },
    orderBy: [
      { priority: 'desc' },
      { order: 'asc' },
      { createdAt: 'desc' }
    ]
  })

  return NextResponse.json({ success: true, data: issues })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { brandProfileId } = await req.json()

  if (!brandProfileId) {
    return NextResponse.json({ error: 'brandProfileId required' }, { status: 400 })
  }

  try {
    const result = await discoverIssues(brandProfileId)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Discovery failed' 
    }, { status: 500 })
  }
}
```

```typescript
// app/api/issues/[id]/deploy/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { executeIssueAgent } from '@/lib/services/issue-agent-executor.service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const issueId = parseInt(params.id)

  try {
    // Execute agent (async - returns immediately)
    const result = await executeIssueAgent(issueId)
    
    return NextResponse.json({ 
      success: result.success, 
      data: { prUrl: result.prUrl },
      error: result.error
    })
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Deployment failed' 
    }, { status: 500 })
  }
}
```

### Tests

**File:** `mudra-app/__tests__/api/issues.test.ts`

```typescript
import { createMocks } from 'node-mocks-http'
import { GET, POST } from '@/app/api/issues/route'

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(() => ({ user: { id: '1', email: 'test@test.com' } }))
}))

describe('Issues API', () => {
  describe('GET /api/issues', () => {
    it('returns 400 without brandProfileId', async () => {
      const { req } = createMocks({ method: 'GET' })
      const response = await GET(req as any)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('brandProfileId required')
    })

    it('returns issues for brand profile', async () => {
      const { req } = createMocks({
        method: 'GET',
        query: { brandProfileId: '1' }
      })
      const response = await GET(req as any)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(Array.isArray(data.data)).toBe(true)
    })

    it('filters by status', async () => {
      const { req } = createMocks({
        method: 'GET',
        query: { brandProfileId: '1', status: 'identified' }
      })
      const response = await GET(req as any)
      const data = await response.json()
      
      expect(data.success).toBe(true)
      data.data.forEach((issue: any) => {
        expect(issue.status).toBe('identified')
      })
    })

    it('filters by category', async () => {
      const { req } = createMocks({
        method: 'GET',
        query: { brandProfileId: '1', category: 'technical_structure' }
      })
      const response = await GET(req as any)
      const data = await response.json()
      
      expect(data.success).toBe(true)
      data.data.forEach((issue: any) => {
        expect(issue.category).toBe('technical_structure')
      })
    })
  })

  describe('POST /api/issues', () => {
    it('triggers issue discovery', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: { brandProfileId: 1 }
      })
      const response = await POST(req as any)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.discovered).toBeGreaterThanOrEqual(0)
    })
  })
})
```

---

## Phase 6: UI Components (3 days)

### Tasks

| Task | File | Description | Test |
|------|------|-------------|------|
| 6.1.1 | `components/issues/issue-board.tsx` | Kanban board container | Component test |
| 6.1.2 | `components/issues/issue-column.tsx` | Column for each status | Component test |
| 6.1.3 | `components/issues/issue-card.tsx` | Individual issue card | Component test |
| 6.1.4 | `components/issues/issue-detail-modal.tsx` | Issue detail view | Component test |
| 6.1.5 | `components/issues/deploy-agent-button.tsx` | Deploy agent CTA | Component test |
| 6.1.6 | `components/issues/issue-filters.tsx` | Category/priority filters | Component test |
| 6.1.7 | `app/dashboard/issues/page.tsx` | Issues page route | E2E test |
| 6.1.8 | `hooks/use-issues.ts` | Issues data hook with SWR | Hook test |

### Implementation

```typescript
// components/issues/issue-board.tsx
'use client'

import { useIssues } from '@/hooks/use-issues'
import { IssueColumn } from './issue-column'
import { IssueFilters } from './issue-filters'
import { useState } from 'react'

interface IssueBoardProps {
  brandProfileId: number
}

const COLUMNS = [
  { id: 'identified', title: 'Identified', color: 'bg-yellow-500' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-500' },
  { id: 'completed', title: 'Completed', color: 'bg-green-500' },
  { id: 'merged', title: 'Merged', color: 'bg-purple-500' }
]

export function IssueBoard({ brandProfileId }: IssueBoardProps) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const { issues, isLoading, error, mutate } = useIssues(brandProfileId, categoryFilter)

  if (isLoading) return <IssueBoardSkeleton />
  if (error) return <div>Error loading issues</div>

  const issuesByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.id] = issues?.filter(i => i.status === col.id) || []
    return acc
  }, {} as Record<string, typeof issues>)

  return (
    <div className="flex flex-col gap-4">
      <IssueFilters 
        category={categoryFilter}
        onCategoryChange={setCategoryFilter}
      />
      
      <div className="grid grid-cols-4 gap-4">
        {COLUMNS.map(col => (
          <IssueColumn
            key={col.id}
            title={col.title}
            color={col.color}
            issues={issuesByStatus[col.id]}
            onIssueUpdate={() => mutate()}
          />
        ))}
      </div>
    </div>
  )
}
```

```typescript
// components/issues/issue-card.tsx
'use client'

import { Issue } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Bot, GitPullRequest, ExternalLink } from 'lucide-react'
import { useState } from 'react'

interface IssueCardProps {
  issue: Issue
  onDeploy: () => void
  onUpdate: () => void
}

const CATEGORY_COLORS = {
  technical_structure: 'bg-orange-100 text-orange-800',
  ai_visibility: 'bg-blue-100 text-blue-800',
  conversation: 'bg-green-100 text-green-800'
}

const PRIORITY_COLORS = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-gray-400'
}

export function IssueCard({ issue, onDeploy, onUpdate }: IssueCardProps) {
  const [deploying, setDeploying] = useState(false)

  const handleDeploy = async () => {
    setDeploying(true)
    try {
      await fetch(`/api/issues/${issue.id}/deploy`, { method: 'POST' })
      onUpdate()
    } finally {
      setDeploying(false)
    }
  }

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[issue.priority as keyof typeof PRIORITY_COLORS]}`} />
            <span className="font-medium text-sm">{issue.title}</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pb-2">
        <p className="text-xs text-muted-foreground line-clamp-2">
          {issue.description}
        </p>
        
        <div className="flex gap-2 mt-2">
          <Badge variant="outline" className={CATEGORY_COLORS[issue.category as keyof typeof CATEGORY_COLORS]}>
            {issue.category.replace('_', ' ')}
          </Badge>
          <Badge variant="outline">
            {issue.discoveryTier}
          </Badge>
        </div>
        
        {issue.estimatedImpact && (
          <p className="text-xs text-green-600 mt-2">
            Impact: {issue.estimatedImpact}
          </p>
        )}
      </CardContent>

      <CardFooter className="pt-2">
        {issue.status === 'identified' && (
          <Button 
            size="sm" 
            onClick={handleDeploy}
            disabled={deploying}
            className="w-full"
          >
            <Bot className="w-4 h-4 mr-2" />
            {deploying ? 'Deploying...' : 'Deploy Agent'}
          </Button>
        )}
        
        {issue.prUrl && (
          <a 
            href={issue.prUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <GitPullRequest className="w-3 h-3" />
            View PR #{issue.prNumber}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </CardFooter>
    </Card>
  )
}
```

```typescript
// hooks/use-issues.ts
import useSWR from 'swr'
import { Issue } from '@prisma/client'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useIssues(brandProfileId: number, category?: string | null) {
  const params = new URLSearchParams({ brandProfileId: String(brandProfileId) })
  if (category) params.set('category', category)
  
  const { data, error, isLoading, mutate } = useSWR<{ data: Issue[] }>(
    `/api/issues?${params}`,
    fetcher,
    {
      refreshInterval: 10000 // Refresh every 10s to catch status updates
    }
  )

  return {
    issues: data?.data,
    isLoading,
    error,
    mutate
  }
}
```

### Tests

**File:** `mudra-app/__tests__/components/issue-card.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IssueCard } from '@/components/issues/issue-card'

const mockIssue = {
  id: 1,
  brandProfileId: 1,
  title: 'Add Schema Markup',
  description: 'Your homepage is missing Organization schema',
  category: 'technical_structure',
  discoveryTier: 'fundamental',
  priority: 'high',
  status: 'identified',
  estimatedImpact: '+5-8 points',
  prUrl: null,
  prNumber: null
}

describe('IssueCard', () => {
  it('renders issue title and description', () => {
    render(<IssueCard issue={mockIssue} onDeploy={jest.fn()} onUpdate={jest.fn()} />)
    
    expect(screen.getByText('Add Schema Markup')).toBeInTheDocument()
    expect(screen.getByText(/missing Organization schema/)).toBeInTheDocument()
  })

  it('shows Deploy Agent button for identified issues', () => {
    render(<IssueCard issue={mockIssue} onDeploy={jest.fn()} onUpdate={jest.fn()} />)
    
    expect(screen.getByRole('button', { name: /Deploy Agent/i })).toBeInTheDocument()
  })

  it('shows PR link for completed issues', () => {
    const completedIssue = {
      ...mockIssue,
      status: 'completed',
      prUrl: 'https://github.com/test/repo/pull/123',
      prNumber: 123
    }
    
    render(<IssueCard issue={completedIssue} onDeploy={jest.fn()} onUpdate={jest.fn()} />)
    
    expect(screen.getByText(/View PR #123/)).toBeInTheDocument()
  })

  it('calls onDeploy when Deploy Agent clicked', async () => {
    const onUpdate = jest.fn()
    global.fetch = jest.fn().mockResolvedValue({ json: () => ({ success: true }) })
    
    render(<IssueCard issue={mockIssue} onDeploy={jest.fn()} onUpdate={onUpdate} />)
    
    fireEvent.click(screen.getByRole('button', { name: /Deploy Agent/i }))
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/issues/1/deploy', { method: 'POST' })
      expect(onUpdate).toHaveBeenCalled()
    })
  })

  it('displays category badge', () => {
    render(<IssueCard issue={mockIssue} onDeploy={jest.fn()} onUpdate={jest.fn()} />)
    
    expect(screen.getByText('technical structure')).toBeInTheDocument()
  })

  it('displays estimated impact', () => {
    render(<IssueCard issue={mockIssue} onDeploy={jest.fn()} onUpdate={jest.fn()} />)
    
    expect(screen.getByText(/\+5-8 points/)).toBeInTheDocument()
  })
})
```

---

## Phase 7: Integration & E2E Tests (2 days)

### Tasks

| Task | File | Description |
|------|------|-------------|
| 7.1.1 | `__tests__/integration/issue-flow.test.ts` | Full issue lifecycle test |
| 7.1.2 | `__tests__/integration/discovery-to-pr.test.ts` | Discovery → Agent → PR flow |
| 7.1.3 | `e2e/issues.spec.ts` | Playwright E2E tests |
| 7.1.4 | `__tests__/integration/e2b-agent.test.ts` | E2B + Mastra integration |

### Integration Test

**File:** `mudra-app/__tests__/integration/issue-flow.test.ts`

```typescript
import { prisma } from '@/lib/prisma'
import { discoverIssues } from '@/lib/services/issue-discovery.service'
import { executeIssueAgent } from '@/lib/services/issue-agent-executor.service'

describe('Issue Flow Integration', () => {
  const TEST_BRAND_PROFILE_ID = 999 // Use test brand profile
  
  beforeAll(async () => {
    // Ensure test brand profile exists
    await prisma.brandProfile.upsert({
      where: { id: TEST_BRAND_PROFILE_ID },
      create: {
        id: TEST_BRAND_PROFILE_ID,
        userId: 'test-user',
        brandName: 'Test Brand',
        websiteUrl: 'https://example.com',
        industry: 'Technology'
      },
      update: {}
    })
  })

  afterAll(async () => {
    // Clean up
    await prisma.issue.deleteMany({ where: { brandProfileId: TEST_BRAND_PROFILE_ID } })
  })

  describe('Complete Issue Lifecycle', () => {
    it('discovers issues based on analysis', async () => {
      const result = await discoverIssues(TEST_BRAND_PROFILE_ID)
      
      expect(result.discovered).toBeGreaterThan(0)
      
      const issues = await prisma.issue.findMany({
        where: { brandProfileId: TEST_BRAND_PROFILE_ID }
      })
      
      expect(issues.length).toBeGreaterThan(0)
      expect(issues[0].status).toBe('identified')
    })

    it('transitions issue through statuses', async () => {
      // Get an issue
      const issue = await prisma.issue.findFirst({
        where: { brandProfileId: TEST_BRAND_PROFILE_ID, status: 'identified' }
      })
      
      if (!issue) {
        console.log('No issues found, skipping test')
        return
      }

      // Deploy agent (this will move to in_progress, then completed)
      const result = await executeIssueAgent(issue.id)
      
      // Verify status progression
      const updatedIssue = await prisma.issue.findUnique({ where: { id: issue.id } })
      
      if (result.success) {
        expect(updatedIssue?.status).toBe('completed')
        expect(updatedIssue?.prUrl).toBeDefined()
      } else {
        // On failure, should reset to identified
        expect(updatedIssue?.status).toBe('identified')
      }
    })
  })

  describe('E2B Sandbox Integration', () => {
    it('uses E2B for schema validation issues', async () => {
      // Create a schema issue
      const issue = await prisma.issue.create({
        data: {
          brandProfileId: TEST_BRAND_PROFILE_ID,
          title: 'Test Schema Issue',
          category: 'technical_structure',
          discoveryTier: 'fundamental',
          agentType: 'schema_markup'
        }
      })

      const result = await executeIssueAgent(issue.id)
      
      const updatedIssue = await prisma.issue.findUnique({ where: { id: issue.id } })
      
      // Should have used E2B
      expect(updatedIssue?.usedE2bSandbox).toBe(true)
      expect(updatedIssue?.e2bSandboxId).toBeDefined()
      
      await prisma.issue.delete({ where: { id: issue.id } })
    })

    it('does not use E2B for non-code issues', async () => {
      // Create a conversation issue
      const issue = await prisma.issue.create({
        data: {
          brandProfileId: TEST_BRAND_PROFILE_ID,
          title: 'Reddit Opportunity',
          category: 'conversation',
          discoveryTier: 'fundamental',
          agentType: 'reddit_opportunity'
        }
      })

      await executeIssueAgent(issue.id)
      
      const updatedIssue = await prisma.issue.findUnique({ where: { id: issue.id } })
      
      expect(updatedIssue?.usedE2bSandbox).toBe(false)
      
      await prisma.issue.delete({ where: { id: issue.id } })
    })
  })
})
```

### E2E Test

**File:** `mudra-app/e2e/issues.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Issues Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'testpassword')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('displays issues board with columns', async ({ page }) => {
    await page.goto('/dashboard/issues')
    
    // Verify columns exist
    await expect(page.getByText('Identified')).toBeVisible()
    await expect(page.getByText('In Progress')).toBeVisible()
    await expect(page.getByText('Completed')).toBeVisible()
    await expect(page.getByText('Merged')).toBeVisible()
  })

  test('filters issues by category', async ({ page }) => {
    await page.goto('/dashboard/issues')
    
    // Click Technical Structure filter
    await page.click('[data-testid="filter-technical_structure"]')
    
    // Verify only technical issues shown
    const issues = page.locator('[data-testid="issue-card"]')
    for (const issue of await issues.all()) {
      await expect(issue.locator('[data-category]')).toHaveAttribute('data-category', 'technical_structure')
    }
  })

  test('deploys agent for issue', async ({ page }) => {
    await page.goto('/dashboard/issues')
    
    // Find first identified issue
    const deployButton = page.locator('[data-testid="deploy-agent-button"]').first()
    
    if (await deployButton.isVisible()) {
      await deployButton.click()
      
      // Should show loading state
      await expect(deployButton).toContainText('Deploying')
      
      // Wait for completion (may take a while with E2B)
      await page.waitForTimeout(30000)
      
      // Should show PR link or error
      const prLink = page.locator('[data-testid="pr-link"]').first()
      const errorMessage = page.locator('[data-testid="error-message"]').first()
      
      await expect(prLink.or(errorMessage)).toBeVisible()
    }
  })

  test('shows issue details on click', async ({ page }) => {
    await page.goto('/dashboard/issues')
    
    const issueCard = page.locator('[data-testid="issue-card"]').first()
    await issueCard.click()
    
    // Modal should open
    await expect(page.locator('[data-testid="issue-detail-modal"]')).toBeVisible()
    
    // Should show full description
    await expect(page.locator('[data-testid="issue-description"]')).toBeVisible()
    
    // Should show agent type
    await expect(page.locator('[data-testid="issue-agent-type"]')).toBeVisible()
  })

  test('discovers new issues on refresh', async ({ page }) => {
    await page.goto('/dashboard/issues')
    
    const initialCount = await page.locator('[data-testid="issue-card"]').count()
    
    // Trigger discovery
    await page.click('[data-testid="discover-issues-button"]')
    await page.waitForTimeout(5000)
    
    const newCount = await page.locator('[data-testid="issue-card"]').count()
    
    // Count should be same or higher (deduplication prevents decrease)
    expect(newCount).toBeGreaterThanOrEqual(initialCount)
  })
})
```

---

## Phase 8: GitHub Webhook Integration (1 day)

### Tasks

| Task | File | Description | Test |
|------|------|-------------|------|
| 8.1.1 | `app/api/webhooks/github/route.ts` | Handle PR merge events | Integration test |
| 8.1.2 | `lib/services/github-webhook.service.ts` | Process webhook payload | Unit test |
| 8.1.3 | Dashboard | Configure webhook URL in GitHub App | Manual verification |

### Implementation

```typescript
// app/api/webhooks/github/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET!

function verifySignature(payload: string, signature: string): boolean {
  const expected = `sha256=${crypto
    .createHmac('sha256', GITHUB_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')}`
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

export async function POST(req: NextRequest) {
  const payload = await req.text()
  const signature = req.headers.get('x-hub-signature-256')
  
  if (!signature || !verifySignature(payload, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(payload)
  const eventType = req.headers.get('x-github-event')

  if (eventType === 'pull_request' && event.action === 'closed' && event.pull_request.merged) {
    // PR was merged - update corresponding issue
    const prNumber = event.pull_request.number
    const repoFullName = event.repository.full_name

    const issue = await prisma.issue.findFirst({
      where: {
        prNumber,
        brandProfile: {
          githubRepoUrl: { contains: repoFullName }
        }
      }
    })

    if (issue) {
      await prisma.issue.update({
        where: { id: issue.id },
        data: { 
          status: 'merged',
          prStatus: 'merged'
        }
      })

      // Trigger score recalculation
      await triggerAnalysisRefresh(issue.brandProfileId)
    }
  }

  return NextResponse.json({ received: true })
}
```

---

## Test Summary

| Type | Count | Location |
|------|-------|----------|
| Unit Tests | 15+ | `__tests__/services/`, `__tests__/components/` |
| Integration Tests | 5+ | `__tests__/integration/` |
| API Tests | 10+ | `__tests__/api/` |
| E2E Tests | 5+ | `e2e/` |

### Test Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- __tests__/services/issue-discovery.test.ts

# Run E2B tests (requires API key)
E2B_API_KEY=xxx npm test -- __tests__/services/e2b-sandbox.test.ts

# Run E2E tests
npx playwright test

# Run with coverage
npm test -- --coverage
```

---

## Dependencies to Install

```bash
npm install @e2b/code-interpreter  # Already installed
npm install node-mocks-http --save-dev  # For API testing
npm install @playwright/test --save-dev  # For E2E tests
```

---

## Timeline Summary

| Week | Phases | Deliverables |
|------|--------|--------------|
| Week 1 | 1, 2, 3 | Database schema, E2B service, Discovery agent |
| Week 2 | 4, 5 | Resolution agents, API routes |
| Week 3 | 6, 7, 8 | UI components, Tests, GitHub webhook |

---

## Success Criteria

- [ ] Issues discovered automatically after each analysis
- [ ] Issues categorized by Technical Structure, AI Visibility, Conversation
- [ ] Progressive discovery: harder issues appear as scores improve
- [ ] "Deploy Agent" executes Mastra agent with E2B validation
- [ ] GitHub PRs created automatically
- [ ] Merged PRs trigger status update via webhook
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] E2E tests cover main user flows
- [ ] <30s average time from Deploy to PR creation
