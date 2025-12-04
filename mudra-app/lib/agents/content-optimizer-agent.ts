import { MudraBaseAgent, type AgentExecutionInput, type AgentExecutionOutput } from './base-agent'
import { prisma } from '@/lib/prisma'

interface PageToOptimize {
  url: string
  score: number
  missingSchemas?: string[]
  hasFAQ?: boolean
  headings?: {
    h1Count: number
    h2Count: number
    h3Count: number
  }
}

interface Improvement {
  type: 'schema_markup' | 'faq_section' | 'headers' | 'meta_tags'
  description: string
  code: string
  impact: 'high' | 'medium' | 'low'
  filePath?: string
}

interface PRResult {
  prUrl: string
  prNumber: number
}

/**
 * Content Optimizer Agent
 * Automatically identifies low-scoring pages and generates optimization PRs
 * 
 * Features:
 * - Identifies pages scoring below 70% in GEO analysis
 * - Generates schema markup improvements (Organization, FAQ, Product, etc.)
 * - Creates FAQ sections with proper schema
 * - Optimizes header hierarchy
 * - Creates GitHub PRs with improvements
 * - Tracks optimization results
 */
export class ContentOptimizerAgent extends MudraBaseAgent {
  getAgentType(): string {
    return 'content_optimizer'
  }

  async execute(input: AgentExecutionInput): Promise<AgentExecutionOutput> {
    const maxPages = (input.maxPages as number) || 50
    let totalApiCost = 0
    let totalTokensUsed = 0

    try {
      // Step 1: Identify low-scoring pages
      const pagesToOptimize = await this.identifyLowScoringPages(maxPages)

      if (pagesToOptimize.length === 0) {
        return {
          success: true,
          data: {
            message: 'No pages found that need optimization (all scores above 70%)',
            optimizedPages: [],
          },
          metrics: {
            tokensUsed: 0,
            apiCost: 0,
          },
        }
      }

      // Step 2: Generate improvements and create PRs for each page
      const optimizedPages: Array<{
        url: string
        originalScore: number
        improvements: Improvement[]
        prUrl?: string
        error?: string
      }> = []

      for (const page of pagesToOptimize) {
        try {
          // Generate improvements
          const improvements = await this.generateImprovements(page)
          totalTokensUsed += 500 // Estimate for GPT-4 call

          // Create PR
          const prResult = await this.createPR(page.url, improvements)
          
          // Save optimization record
          const execution = await prisma.agentExecution.findFirst({
            where: { executionId: this.executionId },
          })

          if (execution) {
            await this.saveOptimization({
              pageUrl: page.url,
              originalScore: page.score,
              improvements,
              prUrl: prResult.prUrl,
              executionId: execution.id,
            })
          }

          optimizedPages.push({
            url: page.url,
            originalScore: page.score,
            improvements,
            prUrl: prResult.prUrl,
          })

          totalApiCost += 0.005 // Estimate: $0.005 per page optimization
        } catch (error) {
          optimizedPages.push({
            url: page.url,
            originalScore: page.score,
            improvements: [],
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      return {
        success: true,
        data: {
          optimizedPages,
          totalPages: pagesToOptimize.length,
          successfulOptimizations: optimizedPages.filter(p => p.prUrl).length,
        },
        metrics: {
          tokensUsed: totalTokensUsed,
          apiCost: totalApiCost,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          tokensUsed: totalTokensUsed,
          apiCost: totalApiCost,
        },
      }
    }
  }

  /**
   * Identify pages with GEO scores below 70%
   */
  private async identifyLowScoringPages(limit: number = 50): Promise<PageToOptimize[]> {
    const brandProfile = await this.getBrandProfile()
    if (!brandProfile) {
      throw new Error('Brand profile not found')
    }

    // Get latest GEO analysis results
    const geoResults = await prisma.geoAnalysisResult.findMany({
      where: { brandProfileId: this.brandProfileId },
      orderBy: { timestamp: 'desc' },
      take: 1,
    })

    if (geoResults.length === 0) {
      return []
    }

    // Extract pages from analyses
    const allPages: PageToOptimize[] = []
    for (const result of geoResults) {
      const analyses = result.analyses as any[]
      
      for (const analysis of analyses) {
        if (analysis.url && analysis.score !== undefined) {
          const score = typeof analysis.score === 'number' ? analysis.score : 0
          
          // Only include pages scoring below 70%
          if (score < 70) {
            allPages.push({
              url: analysis.url,
              score,
              missingSchemas: analysis.missingSchemas || [],
              hasFAQ: analysis.hasFAQ || false,
              headings: analysis.headings || { h1Count: 0, h2Count: 0, h3Count: 0 },
            })
          }
        }
      }
    }

    // Sort by score (lowest first) and limit
    return allPages
      .sort((a, b) => a.score - b.score)
      .slice(0, limit)
  }

  /**
   * Generate improvements for a page based on its analysis
   */
  private async generateImprovements(page: PageToOptimize): Promise<Improvement[]> {
    const improvements: Improvement[] = []

    // 1. Schema markup improvements
    if (page.missingSchemas && page.missingSchemas.length > 0) {
      for (const schemaType of page.missingSchemas) {
        improvements.push({
          type: 'schema_markup',
          description: `Add ${schemaType} schema markup`,
          code: this.generateSchemaMarkup(schemaType),
          impact: 'high',
          filePath: this.extractFilePath(page.url),
        })
      }
    }

    // 2. FAQ section improvement
    if (!page.hasFAQ) {
      improvements.push({
        type: 'faq_section',
        description: 'Add FAQ section with schema markup',
        code: this.generateFAQSection(),
        impact: 'high',
        filePath: this.extractFilePath(page.url),
      })
    }

    // 3. Header optimization
    if (page.headings && page.headings.h1Count === 0) {
      improvements.push({
        type: 'headers',
        description: 'Add proper H1 header for page',
        code: '<h1>Your Main Page Title Here</h1>',
        impact: 'medium',
        filePath: this.extractFilePath(page.url),
      })
    }

    // Sort by impact (high > medium > low)
    return improvements.sort((a, b) => {
      const impactOrder = { high: 3, medium: 2, low: 1 }
      return impactOrder[b.impact] - impactOrder[a.impact]
    })
  }

  /**
   * Generate schema markup code for a specific type
   */
  private generateSchemaMarkup(schemaType: string): string {
    const brandProfile = this.getBrandProfile()
    
    const schemas: Record<string, string> = {
      Organization: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Company Name",
  "url": "${(brandProfile as any)?.companyWebsite || 'https://example.com'}",
  "logo": "${(brandProfile as any)?.companyWebsite || 'https://example.com'}/logo.png"
}
</script>`,
      BreadcrumbList: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [{
    "@type": "ListItem",
    "position": 1,
    "name": "Home",
    "item": "${(brandProfile as any)?.companyWebsite || 'https://example.com'}"
  }]
}
</script>`,
      FAQPage: this.generateFAQSection(),
    }

    return schemas[schemaType] || `<!-- Add ${schemaType} schema here -->`
  }

  /**
   * Generate FAQ section with schema markup
   */
  private generateFAQSection(): string {
    return `<section class="faq-section">
  <h2>Frequently Asked Questions</h2>
  <div class="faq-item">
    <h3>Question 1: What is your main service?</h3>
    <p>Answer: [Your detailed answer here]</p>
  </div>
  <div class="faq-item">
    <h3>Question 2: How does it work?</h3>
    <p>Answer: [Your detailed answer here]</p>
  </div>
</section>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "What is your main service?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "[Your detailed answer here]"
    }
  }, {
    "@type": "Question",
    "name": "How does it work?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "[Your detailed answer here]"
    }
  }]
}
</script>`
  }

  /**
   * Extract file path from URL
   */
  private extractFilePath(url: string): string {
    try {
      const urlObj = new URL(url)
      let path = urlObj.pathname
      
      // Convert to likely file path
      if (path === '/' || path === '') {
        return 'index.html'
      }
      
      // Remove leading slash and add .html if no extension
      path = path.replace(/^\//, '')
      if (!path.includes('.')) {
        path = path + '/index.html'
      }
      
      return path
    } catch {
      return 'index.html'
    }
  }

  /**
   * Create GitHub PR with improvements
   */
  private async createPR(pageUrl: string, improvements: Improvement[]): Promise<PRResult> {
    // Dynamic import to avoid circular dependency issues during testing
    const { createOptimizationPR } = await import('@/lib/services/github.service')
    
    return await createOptimizationPR({
      brandProfileId: this.brandProfileId,
      pageUrl,
      improvements,
      title: `GEO Optimization: ${pageUrl}`,
      description: `Automated GEO optimization for ${pageUrl}\n\nImprovements:\n${improvements.map(i => `- ${i.description}`).join('\n')}`,
    })
  }

  /**
   * Save optimization record to database
   */
  private async saveOptimization(data: {
    pageUrl: string
    originalScore: number
    improvements: Improvement[]
    prUrl: string
    executionId: number
  }): Promise<void> {
    await prisma.contentOptimization.create({
      data: {
        brandProfileId: this.brandProfileId,
        executionId: data.executionId,
        pageUrl: data.pageUrl,
        originalScore: data.originalScore,
        improvements: data.improvements as any,
        prUrl: data.prUrl,
        status: 'pr_created',
      },
    })
  }

  /**
   * Get optimization history for this brand
   */
  async getOptimizationHistory() {
    return prisma.contentOptimization.findMany({
      where: { brandProfileId: this.brandProfileId },
      orderBy: { createdAt: 'desc' },
    })
  }
}
