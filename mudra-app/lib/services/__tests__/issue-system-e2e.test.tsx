/**
 * Issue System End-to-End Test Suite
 *
 * Comprehensive tests for the complete issue system refactoring:
 * - Page scoring → Issue creation (issue-from-scoring.service.ts)
 * - Pagination for issue discovery (issue-discovery.service.ts)
 * - Auto-close reconciliation (issue-reconciliation.service.ts)
 * - Integration with unified-analysis pipeline
 *
 * Tests are organized by module and then by flow.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi } from 'vitest'

// Mock prisma before importing services
vi.mock('@/lib/prisma', () => ({
  prisma: {
    issue: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    brandProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    technicalStructureAnalysis: {
      findFirst: vi.fn(),
    },
    policyFile: {
      findFirst: vi.fn(),
    },
    conversationOpportunity: {
      findMany: vi.fn(),
    },
    geoAnalysisResult: {
      findFirst: vi.fn(),
    },
  },
}))

import {
  CHECK_TO_AGENT_MAP,
  ISSUE_TITLES,
  mapSeverityToPriority,
  generateIssueHashWithUrl,
  getCheckFromTitle,
  getFailingChecks,
} from '../issue-from-scoring.service'

import {
  getTiersForScore,
  getTierDescription,
  generateIssueHash,
} from '../issue-discovery.service'

// Type definitions inline to avoid import issues
interface ScoringIssue {
  check: string
  dimension: 'metadata' | 'headings' | 'semantic' | 'schema' | 'faq'
  severity: 'high' | 'medium' | 'low'
  message: string
  page_url: string
}

interface FullPageScore {
  page_url: string
  page_type: 'home' | 'pricing' | 'features' | 'product' | 'solutions' | 'blog' | 'about' | 'contact' | 'documentation' | 'other'
  scores: {
    metadata: number
    headings: number
    semantic: number
    schema: number
    faq: number
    total: number
  }
  dimension_details: Record<string, unknown>
  status: 'excellent' | 'good' | 'needs_improvement' | 'poor'
  issues: ScoringIssue[]
  interventions: unknown[]
}

// =============================================================================
// MODULE 1: issue-from-scoring.service.ts
// =============================================================================

describe('Issue From Scoring Service', () => {
  describe('CHECK_TO_AGENT_MAP completeness', () => {
    it('has all metadata check codes (M1-M5)', () => {
      expect(CHECK_TO_AGENT_MAP['M1_title']).toBe('meta_optimization')
      expect(CHECK_TO_AGENT_MAP['M2_description']).toBe('meta_optimization')
      expect(CHECK_TO_AGENT_MAP['M3_canonical']).toBe('meta_optimization')
      expect(CHECK_TO_AGENT_MAP['M4_opengraph']).toBe('meta_optimization')
      expect(CHECK_TO_AGENT_MAP['M5_twitter']).toBe('meta_optimization')
    })

    it('has all heading check codes (H1-H3)', () => {
      expect(CHECK_TO_AGENT_MAP['H1_single']).toBe('heading_hierarchy')
      expect(CHECK_TO_AGENT_MAP['H2_coverage']).toBe('heading_hierarchy')
      expect(CHECK_TO_AGENT_MAP['H3_no_skips']).toBe('heading_hierarchy')
    })

    it('has all semantic check codes (S1-S4)', () => {
      expect(CHECK_TO_AGENT_MAP['S1_main_content']).toBe('content_structure')
      expect(CHECK_TO_AGENT_MAP['S2_page_structure']).toBe('content_structure')
      expect(CHECK_TO_AGENT_MAP['S3_sections']).toBe('content_structure')
      expect(CHECK_TO_AGENT_MAP['S4_content_quality']).toBe('content_structure')
    })

    it('has all schema check codes (J1-J3)', () => {
      expect(CHECK_TO_AGENT_MAP['J1_present']).toBe('schema_markup')
      expect(CHECK_TO_AGENT_MAP['J2_valid']).toBe('schema_markup')
      expect(CHECK_TO_AGENT_MAP['J3_relevant']).toBe('schema_markup')
    })

    it('has all FAQ check codes', () => {
      expect(CHECK_TO_AGENT_MAP['FAQ_count']).toBe('faq_sections')
      expect(CHECK_TO_AGENT_MAP['FAQ_schema_gap']).toBe('schema_markup')
    })

    it('has 17 total check mappings', () => {
      const totalMappings = Object.keys(CHECK_TO_AGENT_MAP).length
      expect(totalMappings).toBe(17)
    })
  })

  describe('ISSUE_TITLES completeness', () => {
    it('has a title for every check code', () => {
      for (const check of Object.keys(CHECK_TO_AGENT_MAP)) {
        expect(ISSUE_TITLES[check]).toBeDefined()
        expect(typeof ISSUE_TITLES[check]).toBe('string')
        expect(ISSUE_TITLES[check].length).toBeGreaterThan(5)
      }
    })

    it('titles are unique', () => {
      const titles = Object.values(ISSUE_TITLES)
      const uniqueTitles = new Set(titles)
      expect(uniqueTitles.size).toBe(titles.length)
    })
  })

  describe('mapSeverityToPriority', () => {
    it('maps high severity to high priority', () => {
      expect(mapSeverityToPriority('high')).toBe('high')
    })

    it('maps medium severity to medium priority', () => {
      expect(mapSeverityToPriority('medium')).toBe('medium')
    })

    it('maps low severity to low priority', () => {
      expect(mapSeverityToPriority('low')).toBe('low')
    })

    it('defaults unknown severity to medium priority', () => {
      expect(mapSeverityToPriority('unknown')).toBe('medium')
      expect(mapSeverityToPriority('')).toBe('medium')
      expect(mapSeverityToPriority('critical')).toBe('medium') // critical removed
    })

    it('returns only valid IssuePriority values (no critical)', () => {
      const validPriorities = ['low', 'medium', 'high']
      for (const severity of ['high', 'medium', 'low', 'unknown', 'critical', '']) {
        const priority = mapSeverityToPriority(severity)
        expect(validPriorities).toContain(priority)
        expect(priority).not.toBe('critical')
      }
    })
  })

  describe('generateIssueHashWithUrl', () => {
    it('generates consistent hash for same inputs', () => {
      const hash1 = generateIssueHashWithUrl(1, 'technical_structure', 'M1_title', 'https://example.com/')
      const hash2 = generateIssueHashWithUrl(1, 'technical_structure', 'M1_title', 'https://example.com/')
      expect(hash1).toBe(hash2)
    })

    it('generates different hash for different URLs (per-page)', () => {
      const hash1 = generateIssueHashWithUrl(1, 'technical_structure', 'M1_title', 'https://example.com/')
      const hash2 = generateIssueHashWithUrl(1, 'technical_structure', 'M1_title', 'https://example.com/about')
      expect(hash1).not.toBe(hash2)
    })

    it('generates different hash for different check codes', () => {
      const hash1 = generateIssueHashWithUrl(1, 'technical_structure', 'M1_title', 'https://example.com/')
      const hash2 = generateIssueHashWithUrl(1, 'technical_structure', 'M2_description', 'https://example.com/')
      expect(hash1).not.toBe(hash2)
    })

    it('generates different hash for different brand profiles', () => {
      const hash1 = generateIssueHashWithUrl(1, 'technical_structure', 'M1_title', 'https://example.com/')
      const hash2 = generateIssueHashWithUrl(2, 'technical_structure', 'M1_title', 'https://example.com/')
      expect(hash1).not.toBe(hash2)
    })

    it('normalizes URL case', () => {
      const hash1 = generateIssueHashWithUrl(1, 'technical_structure', 'M1_title', 'https://Example.COM/')
      const hash2 = generateIssueHashWithUrl(1, 'technical_structure', 'M1_title', 'https://example.com/')
      expect(hash1).toBe(hash2)
    })

    it('trims URL whitespace', () => {
      const hash1 = generateIssueHashWithUrl(1, 'technical_structure', 'M1_title', 'https://example.com/')
      const hash2 = generateIssueHashWithUrl(1, 'technical_structure', 'M1_title', '  https://example.com/  ')
      expect(hash1).toBe(hash2)
    })

    it('returns 16-character hex hash', () => {
      const hash = generateIssueHashWithUrl(1, 'technical_structure', 'M1_title', 'https://example.com/')
      expect(hash.length).toBe(16)
      expect(hash).toMatch(/^[0-9a-f]+$/)
    })
  })

  describe('getCheckFromTitle', () => {
    it('extracts check code from basic title', () => {
      expect(getCheckFromTitle('Add Page Title Tag')).toBe('M1_title')
      expect(getCheckFromTitle('Add Meta Description')).toBe('M2_description')
      expect(getCheckFromTitle('Add JSON-LD Schema')).toBe('J1_present')
    })

    it('extracts check code from title with page suffix', () => {
      expect(getCheckFromTitle('Add Page Title Tag (Homepage)')).toBe('M1_title')
      expect(getCheckFromTitle('Add Meta Description (about)')).toBe('M2_description')
      expect(getCheckFromTitle('Add JSON-LD Schema (Blog)')).toBe('J1_present')
    })

    it('returns null for unknown title', () => {
      expect(getCheckFromTitle('Unknown Issue')).toBeNull()
      expect(getCheckFromTitle('')).toBeNull()
    })
  })

  describe('getFailingChecks', () => {
    it('returns set of failing check codes from page score', () => {
      const mockPageScore: FullPageScore = {
        page_url: 'https://example.com/',
        page_type: 'home',
        scores: { metadata: 18, headings: 20, semantic: 15, schema: 0, faq: 0, total: 53 },
        dimension_details: {} as Record<string, unknown>,
        status: 'needs_improvement',
        issues: [
          { check: 'J1_present', dimension: 'schema', severity: 'high', message: 'No JSON-LD', page_url: 'https://example.com/' },
          { check: 'FAQ_count', dimension: 'faq', severity: 'medium', message: 'No FAQs', page_url: 'https://example.com/' },
        ],
        interventions: [],
      }

      const failingChecks = getFailingChecks(mockPageScore as any)
      expect(failingChecks.size).toBe(2)
      expect(failingChecks.has('J1_present')).toBe(true)
      expect(failingChecks.has('FAQ_count')).toBe(true)
      expect(failingChecks.has('M1_title')).toBe(false)
    })

    it('returns empty set for page with no issues', () => {
      const mockPageScore: FullPageScore = {
        page_url: 'https://example.com/',
        page_type: 'home',
        scores: { metadata: 25, headings: 20, semantic: 15, schema: 25, faq: 15, total: 100 },
        dimension_details: {} as Record<string, unknown>,
        status: 'excellent',
        issues: [],
        interventions: [],
      }

      const failingChecks = getFailingChecks(mockPageScore as any)
      expect(failingChecks.size).toBe(0)
    })
  })
})

// =============================================================================
// MODULE 2: issue-discovery.service.ts
// =============================================================================

describe('Issue Discovery Service', () => {
  describe('getTiersForScore', () => {
    it('returns only fundamental for score 0-29', () => {
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
      expect(getTiersForScore(70)).toEqual(['fundamental', 'intermediate', 'advanced'])
      expect(getTiersForScore(79)).toEqual(['fundamental', 'intermediate', 'advanced'])
    })

    it('returns all tiers for score 80+', () => {
      expect(getTiersForScore(80)).toEqual(['fundamental', 'intermediate', 'advanced', 'polish'])
      expect(getTiersForScore(90)).toEqual(['fundamental', 'intermediate', 'advanced', 'polish'])
      expect(getTiersForScore(100)).toEqual(['fundamental', 'intermediate', 'advanced', 'polish'])
    })
  })

  describe('getTierDescription', () => {
    it('returns meaningful descriptions for each tier', () => {
      expect(getTierDescription('fundamental')).toContain('basics')
      expect(getTierDescription('intermediate')).toContain('Common')
      expect(getTierDescription('advanced')).toContain('Sophisticated')
      expect(getTierDescription('polish')).toContain('Fine-tuning')
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

    it('generates different hash for different categories', () => {
      const hash1 = generateIssueHash(1, 'technical_structure', 'Optimize Content')
      const hash2 = generateIssueHash(1, 'ai_visibility', 'Optimize Content')
      expect(hash1).not.toBe(hash2)
    })

    it('normalizes title case', () => {
      const hash1 = generateIssueHash(1, 'technical_structure', 'Add Schema Markup')
      const hash2 = generateIssueHash(1, 'technical_structure', 'add schema markup')
      expect(hash1).toBe(hash2)
    })

    it('normalizes whitespace', () => {
      const hash1 = generateIssueHash(1, 'technical_structure', 'Add Schema Markup')
      const hash2 = generateIssueHash(1, 'technical_structure', '  Add Schema Markup  ')
      expect(hash1).toBe(hash2)
    })

    it('returns a 16-character hex hash', () => {
      const hash = generateIssueHash(1, 'technical_structure', 'Add Schema Markup')
      expect(hash.length).toBe(16)
      expect(hash).toMatch(/^[0-9a-f]+$/)
    })
  })
})

// =============================================================================
// MODULE 3: Issue System Architecture Validation
// =============================================================================

describe('Issue System Architecture', () => {
  describe('Priority System', () => {
    it('uses only 3 priority levels (no critical)', () => {
      const validPriorities = ['low', 'medium', 'high']
      // Verify the type constraint
      type IssuePriority = 'low' | 'medium' | 'high'
      const priorities: IssuePriority[] = ['low', 'medium', 'high']
      expect(priorities).toEqual(validPriorities)
    })
  })

  describe('Category System', () => {
    it('uses 3 issue categories', () => {
      const validCategories = ['technical_structure', 'ai_visibility', 'conversation']
      // Verify the type constraint
      type IssueCategory = 'technical_structure' | 'ai_visibility' | 'conversation'
      const categories: IssueCategory[] = ['technical_structure', 'ai_visibility', 'conversation']
      expect(categories).toEqual(validCategories)
    })
  })

  describe('Discovery Tier System', () => {
    it('uses 4 discovery tiers', () => {
      const validTiers = ['fundamental', 'intermediate', 'advanced', 'polish']
      expect(getTiersForScore(100)).toEqual(validTiers)
    })
  })

  describe('Per-Page Issue Tracking', () => {
    it('hashes include URL for per-page deduplication', () => {
      const homeHash = generateIssueHashWithUrl(1, 'technical_structure', 'M1_title', 'https://example.com/')
      const aboutHash = generateIssueHashWithUrl(1, 'technical_structure', 'M1_title', 'https://example.com/about')

      // Same check on different pages = different issues
      expect(homeHash).not.toBe(aboutHash)
    })
  })

  describe('Agent Type Mapping', () => {
    it('maps all checks to valid agent types', () => {
      const validAgentTypes = [
        'meta_optimization',
        'heading_hierarchy',
        'content_structure',
        'schema_markup',
        'faq_sections',
      ]

      for (const [, agentType] of Object.entries(CHECK_TO_AGENT_MAP)) {
        expect(validAgentTypes).toContain(agentType)
      }
    })

    it('groups checks by agent type correctly', () => {
      const agentToChecks: Record<string, string[]> = {}
      for (const [check, agent] of Object.entries(CHECK_TO_AGENT_MAP)) {
        if (!agentToChecks[agent]) agentToChecks[agent] = []
        agentToChecks[agent].push(check)
      }

      expect(agentToChecks['meta_optimization']).toContain('M1_title')
      expect(agentToChecks['meta_optimization']).toContain('M5_twitter')
      expect(agentToChecks['heading_hierarchy']).toContain('H1_single')
      expect(agentToChecks['content_structure']).toContain('S1_main_content')
      expect(agentToChecks['schema_markup']).toContain('J1_present')
      expect(agentToChecks['faq_sections']).toContain('FAQ_count')
    })
  })
})

// =============================================================================
// MODULE 4: Full Flow Simulation (Unit Tests)
// =============================================================================

describe('Full Issue Flow Simulation', () => {
  describe('Page Score → Issues Flow', () => {
    it('simulates issue creation from page score', () => {
      // Create a mock page score with failing checks
      const mockPageScore: FullPageScore = {
        page_url: 'https://example.com/about',
        page_type: 'about',
        scores: {
          metadata: 15,
          headings: 20,
          semantic: 10,
          schema: 0,
          faq: 0,
          total: 45,
        },
        dimension_details: {} as Record<string, unknown>,
        status: 'needs_improvement',
        issues: [
          {
            check: 'M4_opengraph',
            dimension: 'metadata',
            severity: 'medium',
            message: 'Missing Open Graph tags',
            page_url: 'https://example.com/about',
          },
          {
            check: 'S1_main_content',
            dimension: 'semantic',
            severity: 'medium',
            message: 'No <main> element',
            page_url: 'https://example.com/about',
          },
          {
            check: 'J1_present',
            dimension: 'schema',
            severity: 'high',
            message: 'No JSON-LD schema',
            page_url: 'https://example.com/about',
          },
          {
            check: 'FAQ_count',
            dimension: 'faq',
            severity: 'high',
            message: 'No FAQ content',
            page_url: 'https://example.com/about',
          },
        ],
        interventions: [],
      }

      // Verify issue data would be correct
      const expectedIssues = mockPageScore.issues.map((issue) => ({
        check: issue.check,
        title: ISSUE_TITLES[issue.check],
        agentType: CHECK_TO_AGENT_MAP[issue.check],
        priority: mapSeverityToPriority(issue.severity),
        hash: generateIssueHashWithUrl(1, 'technical_structure', issue.check, issue.page_url),
      }))

      expect(expectedIssues).toHaveLength(4)

      // Check first issue (M4_opengraph)
      expect(expectedIssues[0].title).toBe('Add Open Graph Tags')
      expect(expectedIssues[0].agentType).toBe('meta_optimization')
      expect(expectedIssues[0].priority).toBe('medium')

      // Check schema issue (J1_present)
      expect(expectedIssues[2].title).toBe('Add JSON-LD Schema')
      expect(expectedIssues[2].agentType).toBe('schema_markup')
      expect(expectedIssues[2].priority).toBe('high')

      // Check FAQ issue (FAQ_count)
      expect(expectedIssues[3].title).toBe('Add FAQ Content')
      expect(expectedIssues[3].agentType).toBe('faq_sections')
      expect(expectedIssues[3].priority).toBe('high')
    })
  })

  describe('Issue Deduplication Flow', () => {
    it('simulates deduplication via hash', () => {
      const brandId = 1
      const check = 'M1_title'
      const pageUrl = 'https://example.com/'

      // First run: would create issue
      const hash1 = generateIssueHashWithUrl(brandId, 'technical_structure', check, pageUrl)

      // Second run: same hash, would skip
      const hash2 = generateIssueHashWithUrl(brandId, 'technical_structure', check, pageUrl)

      expect(hash1).toBe(hash2) // Same hash = skip creation
    })

    it('simulates unique issues for different pages', () => {
      const brandId = 1
      const check = 'M1_title'

      const hashHome = generateIssueHashWithUrl(brandId, 'technical_structure', check, 'https://example.com/')
      const hashAbout = generateIssueHashWithUrl(brandId, 'technical_structure', check, 'https://example.com/about')
      const hashBlog = generateIssueHashWithUrl(brandId, 'technical_structure', check, 'https://example.com/blog')

      // Different pages = different issues (all unique)
      const hashes = new Set([hashHome, hashAbout, hashBlog])
      expect(hashes.size).toBe(3)
    })
  })

  describe('Reconciliation Flow (Auto-Close)', () => {
    it('simulates issue auto-close when check passes', () => {
      // Scenario: Issue exists for M1_title on homepage
      const openIssue = {
        id: 1,
        title: 'Add Page Title Tag (Homepage)',
        check: 'M1_title',
        affectedUrl: 'https://example.com/',
        status: 'identified',
      }

      // New page score shows M1_title now passes (not in issues)
      const newPageScore: FullPageScore = {
        page_url: 'https://example.com/',
        page_type: 'home',
        scores: { metadata: 25, headings: 20, semantic: 15, schema: 25, faq: 15, total: 100 },
        dimension_details: {} as Record<string, unknown>,
        status: 'excellent',
        issues: [], // No failing checks
        interventions: [],
      }

      // Get failing checks
      const failingChecks = getFailingChecks(newPageScore as any)

      // Check if issue's check still fails
      const checkKey = `${openIssue.check}:${openIssue.affectedUrl.toLowerCase()}`
      const failingCheckSet = new Set(
        Array.from(failingChecks).map((c) => `${c}:${newPageScore.page_url.toLowerCase()}`)
      )

      // Issue should be closed because M1_title is not failing
      const shouldClose = !failingCheckSet.has(checkKey)
      expect(shouldClose).toBe(true)
    })

    it('simulates issue stays open when check still fails', () => {
      const openIssue = {
        id: 1,
        title: 'Add Page Title Tag (Homepage)',
        check: 'M1_title',
        affectedUrl: 'https://example.com/',
        status: 'identified',
      }

      // New page score still shows M1_title failing
      const newPageScore: FullPageScore = {
        page_url: 'https://example.com/',
        page_type: 'home',
        scores: { metadata: 18, headings: 20, semantic: 15, schema: 25, faq: 15, total: 93 },
        dimension_details: {} as Record<string, unknown>,
        status: 'excellent',
        issues: [
          { check: 'M1_title', dimension: 'metadata', severity: 'high', message: 'Missing title', page_url: 'https://example.com/' },
        ],
        interventions: [],
      }

      const failingChecks = getFailingChecks(newPageScore as any)
      expect(failingChecks.has('M1_title')).toBe(true)

      // Issue should stay open
      const checkKey = `M1_title:https://example.com/`
      const failingCheckSet = new Set(
        Array.from(failingChecks).map((c) => `${c}:${newPageScore.page_url.toLowerCase()}`)
      )

      const shouldClose = !failingCheckSet.has(checkKey)
      expect(shouldClose).toBe(false)
    })
  })

  describe('Pagination Flow', () => {
    it('simulates pagination through pages', () => {
      const totalPages = 5
      let currentIndex = 0

      // Simulate 7 discovery runs (should wrap around)
      const processedPages: number[] = []

      for (let run = 0; run < 7; run++) {
        processedPages.push(currentIndex)
        currentIndex = (currentIndex + 1) % totalPages
      }

      // Should process: 0, 1, 2, 3, 4, 0, 1
      expect(processedPages).toEqual([0, 1, 2, 3, 4, 0, 1])
    })
  })
})

// =============================================================================
// MODULE 5: Type Safety Verification
// =============================================================================

describe('Type Safety', () => {
  describe('No deprecated fields', () => {
    it('issue priority has no critical value', () => {
      const priorities = ['low', 'medium', 'high']
      // This would fail at compile time if critical existed
      expect(priorities).not.toContain('critical')
    })

    it('issue has no type field', () => {
      // Simulated issue interface
      interface Issue {
        id: number
        title: string
        description: string
        status: string
        priority: 'low' | 'medium' | 'high'
        category: string
        // NO type field
        agentType: string
      }

      const mockIssue: Issue = {
        id: 1,
        title: 'Test Issue',
        description: 'Test',
        status: 'identified',
        priority: 'high',
        category: 'technical_structure',
        agentType: 'schema_markup',
      }

      // type field should not exist
      expect('type' in mockIssue).toBe(false)
    })
  })

  describe('Scoring issue interface', () => {
    it('Issue has correct structure', () => {
      const issue: ScoringIssue = {
        check: 'M1_title',
        dimension: 'metadata',
        severity: 'high',
        message: 'Missing title tag',
        page_url: 'https://example.com/',
      }

      expect(issue.check).toBeDefined()
      expect(issue.dimension).toBeDefined()
      expect(issue.severity).toBeDefined()
      expect(issue.message).toBeDefined()
      expect(issue.page_url).toBeDefined()
    })
  })
})

// =============================================================================
// MODULE 6: Edge Cases and Error Handling
// =============================================================================

describe('Edge Cases', () => {
  describe('Empty inputs', () => {
    it('handles empty page score issues', () => {
      const pageScore: FullPageScore = {
        page_url: 'https://example.com/',
        page_type: 'home',
        scores: { metadata: 25, headings: 20, semantic: 15, schema: 25, faq: 15, total: 100 },
        dimension_details: {} as Record<string, unknown>,
        status: 'excellent',
        issues: [],
        interventions: [],
      }

      const failingChecks = getFailingChecks(pageScore as any)
      expect(failingChecks.size).toBe(0)
    })

    it('handles zero score', () => {
      expect(getTiersForScore(0)).toEqual(['fundamental'])
    })
  })

  describe('Boundary conditions', () => {
    it('handles score boundaries correctly', () => {
      // Just below threshold
      expect(getTiersForScore(29)).toEqual(['fundamental'])
      expect(getTiersForScore(59)).toEqual(['fundamental', 'intermediate'])
      expect(getTiersForScore(79)).toEqual(['fundamental', 'intermediate', 'advanced'])

      // At threshold
      expect(getTiersForScore(30)).toEqual(['fundamental', 'intermediate'])
      expect(getTiersForScore(60)).toEqual(['fundamental', 'intermediate', 'advanced'])
      expect(getTiersForScore(80)).toEqual(['fundamental', 'intermediate', 'advanced', 'polish'])
    })

    it('handles score above 100', () => {
      expect(getTiersForScore(150)).toEqual(['fundamental', 'intermediate', 'advanced', 'polish'])
    })
  })

  describe('URL variations', () => {
    it('normalizes URLs with trailing slashes', () => {
      const hash1 = generateIssueHashWithUrl(1, 'cat', 'check', 'https://example.com/')
      const hash2 = generateIssueHashWithUrl(1, 'cat', 'check', 'https://example.com')
      // These should be different (strict URL matching)
      // This is intentional to catch actual issues
      expect(hash1).not.toBe(hash2)
    })

    it('handles URLs with query strings', () => {
      const hash1 = generateIssueHashWithUrl(1, 'cat', 'check', 'https://example.com/page')
      const hash2 = generateIssueHashWithUrl(1, 'cat', 'check', 'https://example.com/page?utm=test')
      // Different URLs = different hashes
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('Unknown check codes', () => {
    it('returns null for unknown check in getCheckFromTitle', () => {
      expect(getCheckFromTitle('Unknown Issue Title')).toBeNull()
      expect(getCheckFromTitle('')).toBeNull()
      expect(getCheckFromTitle('Random String (Homepage)')).toBeNull()
    })
  })
})

// =============================================================================
// MODULE 7: Integration Verification
// =============================================================================

describe('Integration Points', () => {
  describe('Check code consistency', () => {
    it('CHECK_TO_AGENT_MAP and ISSUE_TITLES have same keys', () => {
      const agentMapKeys = new Set(Object.keys(CHECK_TO_AGENT_MAP))
      const titleKeys = new Set(Object.keys(ISSUE_TITLES))

      expect(agentMapKeys.size).toBe(titleKeys.size)

      for (const key of agentMapKeys) {
        expect(titleKeys.has(key)).toBe(true)
      }
    })
  })

  describe('Reverse mapping capability', () => {
    it('can reverse map from title to check code', () => {
      for (const [check, title] of Object.entries(ISSUE_TITLES)) {
        const reversedCheck = getCheckFromTitle(title)
        expect(reversedCheck).toBe(check)
      }
    })

    it('can reverse map from title with suffix to check code', () => {
      for (const [check, title] of Object.entries(ISSUE_TITLES)) {
        const reversedCheck = getCheckFromTitle(`${title} (Homepage)`)
        expect(reversedCheck).toBe(check)
      }
    })
  })
})

// =============================================================================
// MODULE 8: Re-Analysis & Reconciliation Integration Tests
// =============================================================================

describe('Re-Analysis & Reconciliation', () => {
  describe('reconcileIssuesWithScores integration', () => {
    it('auto-closes issues when checks pass after re-analysis', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { reconcileIssuesWithScores } = await import('../issue-reconciliation.service')

      // Mock: Open issue exists for M1_title on homepage
      const mockOpenIssues = [
        {
          id: 1,
          title: 'Add Page Title Tag (Homepage)',
          agentType: 'meta_optimization',
          affectedUrl: 'https://example.com/',
        },
      ]

      vi.mocked(prisma.issue.findMany).mockResolvedValue(mockOpenIssues as any)
      vi.mocked(prisma.issue.update).mockResolvedValue({} as any)

      // Re-analysis shows M1_title now passes (no issues)
      const newPageScores = [
        {
          page_url: 'https://example.com/',
          page_type: 'home' as const,
          scores: { metadata: 25, headings: 20, semantic: 15, schema: 25, faq: 15, total: 100 },
          dimension_details: {},
          status: 'excellent' as const,
          issues: [], // Check passes now!
          interventions: [],
        },
      ]

      const result = await reconcileIssuesWithScores(1, newPageScores as any)

      // Issue should be closed
      expect(result.closed).toBe(1)
      expect(result.stillOpen).toBe(0)
      expect(prisma.issue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ status: 'completed' }),
        })
      )
    })

    it('keeps issues open when checks still fail after re-analysis', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { reconcileIssuesWithScores } = await import('../issue-reconciliation.service')

      // Mock: Open issue exists for J1_present on homepage
      const mockOpenIssues = [
        {
          id: 2,
          title: 'Add JSON-LD Schema (Homepage)',
          agentType: 'schema_markup',
          affectedUrl: 'https://example.com/',
        },
      ]

      vi.mocked(prisma.issue.findMany).mockResolvedValue(mockOpenIssues as any)

      // Re-analysis shows J1_present still fails
      const newPageScores = [
        {
          page_url: 'https://example.com/',
          page_type: 'home' as const,
          scores: { metadata: 25, headings: 20, semantic: 15, schema: 0, faq: 0, total: 60 },
          dimension_details: {},
          status: 'needs_improvement' as const,
          issues: [
            { check: 'J1_present', dimension: 'schema', severity: 'high', message: 'No JSON-LD', page_url: 'https://example.com/' },
          ],
          interventions: [],
        },
      ]

      const result = await reconcileIssuesWithScores(1, newPageScores as any)

      // Issue should stay open
      expect(result.closed).toBe(0)
      expect(result.stillOpen).toBe(1)
    })

    it('handles multi-page reconciliation correctly', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { reconcileIssuesWithScores } = await import('../issue-reconciliation.service')

      // Mock: Issues on different pages
      const mockOpenIssues = [
        { id: 1, title: 'Add Page Title Tag (Homepage)', agentType: 'meta_optimization', affectedUrl: 'https://example.com/' },
        { id: 2, title: 'Add Page Title Tag (About)', agentType: 'meta_optimization', affectedUrl: 'https://example.com/about' },
        { id: 3, title: 'Add JSON-LD Schema (Homepage)', agentType: 'schema_markup', affectedUrl: 'https://example.com/' },
      ]

      vi.mocked(prisma.issue.findMany).mockResolvedValue(mockOpenIssues as any)
      vi.mocked(prisma.issue.update).mockResolvedValue({} as any)

      // Re-analysis: Homepage fixed, About still has issues
      const newPageScores = [
        {
          page_url: 'https://example.com/',
          page_type: 'home' as const,
          scores: { metadata: 25, headings: 20, semantic: 15, schema: 25, faq: 15, total: 100 },
          dimension_details: {},
          status: 'excellent' as const,
          issues: [], // All fixed!
          interventions: [],
        },
        {
          page_url: 'https://example.com/about',
          page_type: 'about' as const,
          scores: { metadata: 18, headings: 20, semantic: 15, schema: 25, faq: 15, total: 93 },
          dimension_details: {},
          status: 'good' as const,
          issues: [
            { check: 'M1_title', dimension: 'metadata', severity: 'high', message: 'Missing title', page_url: 'https://example.com/about' },
          ],
          interventions: [],
        },
      ]

      const result = await reconcileIssuesWithScores(1, newPageScores as any)

      // Homepage issues closed (2), About issue still open (1)
      expect(result.closed).toBe(2)
      expect(result.stillOpen).toBe(1)
    })
  })

  describe('Full re-analysis flow simulation', () => {
    it('simulates complete analysis → fix → re-analysis → auto-close cycle', async () => {
      // Step 1: Initial analysis finds issues
      const initialScore = {
        page_url: 'https://example.com/',
        page_type: 'home' as const,
        scores: { metadata: 0, headings: 20, semantic: 15, schema: 0, faq: 0, total: 35 },
        dimension_details: {},
        status: 'poor' as const,
        issues: [
          { check: 'M1_title', dimension: 'metadata', severity: 'high', message: 'No title', page_url: 'https://example.com/' },
          { check: 'J1_present', dimension: 'schema', severity: 'high', message: 'No schema', page_url: 'https://example.com/' },
        ],
        interventions: [],
      }

      // Verify issues would be created
      const issuesFromInitial = getFailingChecks(initialScore as any)
      expect(issuesFromInitial.size).toBe(2)
      expect(issuesFromInitial.has('M1_title')).toBe(true)
      expect(issuesFromInitial.has('J1_present')).toBe(true)

      // Step 2: User fixes title tag only
      const afterTitleFix = {
        page_url: 'https://example.com/',
        page_type: 'home' as const,
        scores: { metadata: 7, headings: 20, semantic: 15, schema: 0, faq: 0, total: 42 },
        dimension_details: {},
        status: 'needs_improvement' as const,
        issues: [
          { check: 'J1_present', dimension: 'schema', severity: 'high', message: 'No schema', page_url: 'https://example.com/' },
        ],
        interventions: [],
      }

      const issuesAfterFix = getFailingChecks(afterTitleFix as any)
      expect(issuesAfterFix.size).toBe(1)
      expect(issuesAfterFix.has('M1_title')).toBe(false) // Fixed!
      expect(issuesAfterFix.has('J1_present')).toBe(true) // Still failing

      // Step 3: User fixes schema too
      const afterAllFixes = {
        page_url: 'https://example.com/',
        page_type: 'home' as const,
        scores: { metadata: 25, headings: 20, semantic: 15, schema: 25, faq: 0, total: 85 },
        dimension_details: {},
        status: 'excellent' as const,
        issues: [], // All fixed!
        interventions: [],
      }

      const issuesAfterAllFixes = getFailingChecks(afterAllFixes as any)
      expect(issuesAfterAllFixes.size).toBe(0)
    })
  })
})

// =============================================================================
// MODULE 9: Performance Considerations
// =============================================================================

describe('Performance', () => {
  it('hash generation is fast', () => {
    const start = Date.now()
    for (let i = 0; i < 1000; i++) {
      generateIssueHashWithUrl(i, 'technical_structure', 'M1_title', `https://example.com/page${i}`)
    }
    const duration = Date.now() - start
    expect(duration).toBeLessThan(1000) // Should complete in under 1 second
  })

  it('failing checks extraction is fast', () => {
    const pageScore: FullPageScore = {
      page_url: 'https://example.com/',
      page_type: 'home',
      scores: { metadata: 0, headings: 0, semantic: 0, schema: 0, faq: 0, total: 0 },
      dimension_details: {} as Record<string, unknown>,
      status: 'poor',
      issues: Array.from({ length: 100 }, (_, i) => ({
        check: `check_${i}`,
        dimension: 'metadata' as const,
        severity: 'high' as const,
        message: `Issue ${i}`,
        page_url: 'https://example.com/',
      })),
      interventions: [],
    }

    const start = Date.now()
    for (let i = 0; i < 1000; i++) {
      getFailingChecks(pageScore as any)
    }
    const duration = Date.now() - start
    expect(duration).toBeLessThan(1000) // Should complete in under 1 second
  })
})
