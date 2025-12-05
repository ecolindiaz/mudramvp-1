import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ContentOptimizerAgent } from './content-optimizer-agent'
import { prisma } from '@/lib/prisma'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    agentExecution: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    agentMemory: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    brandProfile: {
      findUnique: vi.fn(),
    },
    contentOptimization: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    geoAnalysisResult: {
      findMany: vi.fn(),
    },
    technicalStructureAnalysis: {
      findMany: vi.fn(),
    },
  },
}))

// Mock DirectGEO service
vi.mock('@/lib/services/direct-geo-analysis.service', () => ({
  testSinglePrompt: vi.fn(),
}))

// Mock GitHub service
vi.mock('@/lib/services/github.service', () => ({
  createOptimizationPR: vi.fn(),
}))

describe('ContentOptimizerAgent', () => {
  let agent: ContentOptimizerAgent
  const mockBrandProfileId = 1

  beforeEach(() => {
    vi.clearAllMocks()
    agent = new ContentOptimizerAgent({ brandProfileId: mockBrandProfileId })
  })

  describe('Initialization', () => {
    it('should initialize with correct agent type', () => {
      expect(agent.getAgentType()).toBe('content_optimizer')
    })

    it('should extend MudraBaseAgent', () => {
      expect(agent).toHaveProperty('run')
      expect(agent).toHaveProperty('execute')
    })
  })

  describe('Page Identification', () => {
    it('should identify low-scoring pages from GEO analysis', async () => {
      const mockBrandProfile = {
        id: 1,
        companyWebsite: 'https://example.com',
      }

      const mockGeoResults = [
        {
          id: 1,
          analyses: [
            { url: 'https://example.com/page1', score: 45 },
            { url: 'https://example.com/page2', score: 35 },
            { url: 'https://example.com/page3', score: 85 }, // High score, should be filtered
          ],
        },
      ]

      vi.mocked(prisma.brandProfile.findUnique).mockResolvedValue(mockBrandProfile as any)
      vi.mocked(prisma.geoAnalysisResult.findMany).mockResolvedValue(mockGeoResults as any)

      const pages = await agent['identifyLowScoringPages']()

      expect(pages).toHaveLength(2)
      expect(pages[0].url).toBe('https://example.com/page2') // Lowest score first
      expect(pages[1].url).toBe('https://example.com/page1')
    })

    it('should limit number of identified pages', async () => {
      const mockGeoResults = [
        {
          analyses: Array.from({ length: 100 }, (_, i) => ({
            url: `https://example.com/page${i}`,
            score: 40,
          })),
        },
      ]

      vi.mocked(prisma.brandProfile.findUnique).mockResolvedValue({ id: 1 } as any)
      vi.mocked(prisma.geoAnalysisResult.findMany).mockResolvedValue(mockGeoResults as any)

      const pages = await agent['identifyLowScoringPages'](10)

      expect(pages).toHaveLength(10)
    })

    it('should sort pages by score ascending', async () => {
      const mockGeoResults = [
        {
          analyses: [
            { url: 'https://example.com/page1', score: 50 },
            { url: 'https://example.com/page2', score: 30 },
            { url: 'https://example.com/page3', score: 40 },
          ],
        },
      ]

      vi.mocked(prisma.brandProfile.findUnique).mockResolvedValue({ id: 1 } as any)
      vi.mocked(prisma.geoAnalysisResult.findMany).mockResolvedValue(mockGeoResults as any)

      const pages = await agent['identifyLowScoringPages']()

      expect(pages[0].score).toBe(30)
      expect(pages[1].score).toBe(40)
      expect(pages[2].score).toBe(50)
    })
  })

  describe('Improvement Generation', () => {
    it('should generate schema markup improvements', async () => {
      const pageData = {
        url: 'https://example.com/page1',
        score: 45,
        missingSchemas: ['Organization', 'BreadcrumbList'],
      }

      const improvements = await agent['generateImprovements'](pageData)

      expect(improvements).toBeInstanceOf(Array)
      expect(improvements.length).toBeGreaterThan(0)
      expect(improvements[0]).toHaveProperty('type')
      expect(improvements[0]).toHaveProperty('description')
      expect(improvements[0]).toHaveProperty('code')
    })

    it('should generate FAQ section improvements', async () => {
      const pageData = {
        url: 'https://example.com/page1',
        score: 45,
        hasFAQ: false,
      }

      const improvements = await agent['generateImprovements'](pageData)

      const faqImprovement = improvements.find(imp => imp.type === 'faq_section')
      expect(faqImprovement).toBeDefined()
      expect(faqImprovement?.code).toContain('FAQPage')
    })

    it('should generate header optimization improvements', async () => {
      const pageData = {
        url: 'https://example.com/page1',
        score: 45,
        headings: {
          h1Count: 0,
          h2Count: 1,
          h3Count: 0,
        },
      }

      const improvements = await agent['generateImprovements'](pageData)

      const headerImprovement = improvements.find(imp => imp.type === 'headers')
      expect(headerImprovement).toBeDefined()
    })

    it('should prioritize improvements by impact', async () => {
      const pageData = {
        url: 'https://example.com/page1',
        score: 35,
        missingSchemas: ['Organization'],
        hasFAQ: false,
        headings: { h1Count: 0, h2Count: 0, h3Count: 0 },
      }

      const improvements = await agent['generateImprovements'](pageData)

      expect(improvements[0].impact).toBe('high')
    })
  })

  describe('PR Creation', () => {
    it('should create GitHub PR with improvements', async () => {
      const { createOptimizationPR } = await import('@/lib/services/github.service')
      
      vi.mocked(createOptimizationPR).mockResolvedValue({
        prUrl: 'https://github.com/user/repo/pull/123',
        prNumber: 123,
      })

      const improvements = [
        {
          type: 'schema_markup' as const,
          description: 'Add Organization schema',
          code: '<script type="application/ld+json">...</script>',
          impact: 'high' as const,
        },
      ]

      const result = await agent['createPR']('https://example.com/page1', improvements)

      expect(result.prUrl).toBe('https://github.com/user/repo/pull/123')
      expect(createOptimizationPR).toHaveBeenCalledWith(
        expect.objectContaining({
          brandProfileId: mockBrandProfileId,
          pageUrl: 'https://example.com/page1',
          improvements,
        })
      )
    })

    it('should handle PR creation failure gracefully', async () => {
      const { createOptimizationPR } = await import('@/lib/services/github.service')
      
      vi.mocked(createOptimizationPR).mockRejectedValue(new Error('GitHub API error'))

      const improvements = [{ type: 'schema_markup' as const, description: 'Test', code: 'test', impact: 'high' as const }]

      await expect(agent['createPR']('https://example.com/page1', improvements))
        .rejects
        .toThrow('GitHub API error')
    })
  })

  describe('Optimization Tracking', () => {
    it('should save optimization record to database', async () => {
      vi.mocked(prisma.contentOptimization.create).mockResolvedValue({
        id: 1,
        brandProfileId: mockBrandProfileId,
        pageUrl: 'https://example.com/page1',
        originalScore: 45,
        status: 'pr_created',
      } as any)

      await agent['saveOptimization']({
        pageUrl: 'https://example.com/page1',
        originalScore: 45,
        improvements: [],
        prUrl: 'https://github.com/user/repo/pull/123',
        executionId: 1,
      })

      expect(prisma.contentOptimization.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          brandProfileId: mockBrandProfileId,
          pageUrl: 'https://example.com/page1',
          originalScore: 45,
          status: 'pr_created',
        }),
      })
    })

    it('should retrieve optimization history', async () => {
      const mockOptimizations = [
        { id: 1, pageUrl: 'https://example.com/page1', status: 'merged' },
        { id: 2, pageUrl: 'https://example.com/page2', status: 'pr_created' },
      ]

      vi.mocked(prisma.contentOptimization.findMany).mockResolvedValue(mockOptimizations as any)

      const history = await agent.getOptimizationHistory()

      expect(history).toHaveLength(2)
      expect(prisma.contentOptimization.findMany).toHaveBeenCalledWith({
        where: { brandProfileId: mockBrandProfileId },
        orderBy: { createdAt: 'desc' },
      })
    })
  })

  describe('Full Execution', () => {
    it('should execute full optimization workflow', async () => {
      const mockExecution = {
        id: 1,
        executionId: 'test-exec-123',
      }

      const mockBrandProfile = {
        id: 1,
        companyWebsite: 'https://example.com',
      }

      const mockGeoResults = [
        {
          analyses: [
            { url: 'https://example.com/page1', score: 45 },
          ],
        },
      ]

      vi.mocked(prisma.agentExecution.create).mockResolvedValue(mockExecution as any)
      vi.mocked(prisma.agentExecution.update).mockResolvedValue(mockExecution as any)
      vi.mocked(prisma.brandProfile.findUnique).mockResolvedValue(mockBrandProfile as any)
      vi.mocked(prisma.geoAnalysisResult.findMany).mockResolvedValue(mockGeoResults as any)
      vi.mocked(prisma.contentOptimization.create).mockResolvedValue({} as any)

      const { createOptimizationPR } = await import('@/lib/services/github.service')
      vi.mocked(createOptimizationPR).mockResolvedValue({
        prUrl: 'https://github.com/user/repo/pull/123',
        prNumber: 123,
      })

      const result = await agent.run({ maxPages: 1 })

      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('optimizedPages')
    })

    it('should handle execution with no pages to optimize', async () => {
      const mockExecution = {
        id: 1,
        executionId: 'test-exec-123',
      }

      vi.mocked(prisma.agentExecution.create).mockResolvedValue(mockExecution as any)
      vi.mocked(prisma.agentExecution.update).mockResolvedValue(mockExecution as any)
      vi.mocked(prisma.brandProfile.findUnique).mockResolvedValue({ id: 1 } as any)
      vi.mocked(prisma.geoAnalysisResult.findMany).mockResolvedValue([
        { analyses: [{ url: 'https://example.com/page1', score: 95 }] }, // All high scores
      ] as any)

      const result = await agent.run({ maxPages: 10 })

      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('optimizedPages')
      expect((result.data as any).optimizedPages).toHaveLength(0)
    })

    it('should track API costs and metrics', async () => {
      const mockExecution = {
        id: 1,
        executionId: 'test-exec-123',
      }

      vi.mocked(prisma.agentExecution.create).mockResolvedValue(mockExecution as any)
      vi.mocked(prisma.agentExecution.update).mockResolvedValue(mockExecution as any)
      vi.mocked(prisma.brandProfile.findUnique).mockResolvedValue({ id: 1 } as any)
      vi.mocked(prisma.geoAnalysisResult.findMany).mockResolvedValue([
        { analyses: [] },
      ] as any)

      const result = await agent.run({})

      expect(result.metrics).toBeDefined()
      expect(result.metrics?.tokensUsed).toBe(0)
      expect(result.metrics?.apiCost).toBe(0)
    })
  })
})
