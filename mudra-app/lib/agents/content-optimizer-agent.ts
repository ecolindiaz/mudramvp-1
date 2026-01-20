import { MudraBaseAgent, type AgentExecutionInput, type AgentExecutionOutput } from './base-agent'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

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

interface LLMGeneratedImprovement {
  type: string
  description: string
  code: string
  impact: string
  reasoning: string
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
          // Generate improvements using LLM
          const improvements = await this.generateImprovements(page)
          totalTokensUsed += 1500 // GPT-4o: ~500 input + ~1000 output tokens

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
      const analysesRaw = result.analyses
      const analyses: any[] = typeof analysesRaw === 'string' 
        ? JSON.parse(analysesRaw) 
        : (Array.isArray(analysesRaw) ? analysesRaw : [])
      
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
   * Generate improvements for a page using LLM (GPT-4o)
   * Uses brand context to generate relevant, personalized optimizations
   */
  private async generateImprovements(page: PageToOptimize): Promise<Improvement[]> {
    const brandProfile = await this.getBrandProfile()
    
    if (!brandProfile) {
      console.warn('[ContentOptimizer] Brand profile not found, using fallback generation')
      return this.generateFallbackImprovements(page)
    }

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.warn('[ContentOptimizer] OpenAI API key not configured, using fallback generation')
      return this.generateFallbackImprovements(page)
    }

    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      })

      const systemPrompt = `You are a GEO (Generative Engine Optimization) expert helping optimize web pages for AI visibility.
Your task is to generate specific, actionable code improvements that will help AI systems better understand and cite this content.

Brand Context:
- Company: ${brandProfile.companyName || 'Unknown Company'}
- Website: ${brandProfile.companyWebsite || 'https://example.com'}
- Industry: ${brandProfile.companyIndustry || 'Technology'}
- Description: ${brandProfile.companyDescription || 'No description provided'}
- Services: ${brandProfile.companyServices || 'No services listed'}
- ICP: ${brandProfile.companyICP || 'No ICP defined'}

Generate improvements as a JSON array with this structure:
[
  {
    "type": "schema_markup" | "faq_section" | "headers" | "meta_tags",
    "description": "Clear description of the improvement",
    "code": "Complete, ready-to-use HTML/JSON-LD code",
    "impact": "high" | "medium" | "low",
    "reasoning": "Why this helps AI visibility"
  }
]

Important guidelines:
1. Use REAL company data (name, website, description) in all schema markup
2. Generate FAQ questions relevant to the company's actual industry/product
3. All code must be complete and production-ready
4. Focus on improvements that help AI models cite this content
5. Prioritize: Schema markup > FAQ sections > Headers`

      const userPrompt = `Analyze this page and generate optimization improvements:

Page URL: ${page.url}
Current GEO Score: ${page.score}%
Missing Schemas: ${page.missingSchemas?.join(', ') || 'None detected'}
Has FAQ Section: ${page.hasFAQ ? 'Yes' : 'No'}
Headings: H1=${page.headings?.h1Count || 0}, H2=${page.headings?.h2Count || 0}, H3=${page.headings?.h3Count || 0}

Generate 2-4 high-impact improvements that will increase this page's AI visibility.
Return ONLY a valid JSON array, no markdown or explanation.`

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        console.warn('[ContentOptimizer] Empty LLM response, using fallback')
        return this.generateFallbackImprovements(page)
      }

      // Parse the JSON response
      let parsed: { improvements?: LLMGeneratedImprovement[] }
      try {
        parsed = JSON.parse(content)
      } catch (parseError) {
        console.error('[ContentOptimizer] Failed to parse LLM response:', parseError)
        return this.generateFallbackImprovements(page)
      }

      const llmImprovements = parsed.improvements || (Array.isArray(parsed) ? parsed : [])
      
      // Transform to our Improvement interface
      const improvements: Improvement[] = llmImprovements.map((imp: LLMGeneratedImprovement) => ({
        type: this.normalizeImprovementType(imp.type),
        description: imp.description,
        code: imp.code,
        impact: this.normalizeImpact(imp.impact),
        filePath: this.extractFilePath(page.url),
      }))

      console.log(`[ContentOptimizer] LLM generated ${improvements.length} improvements for ${page.url}`)
      
      // Sort by impact (high > medium > low)
      return improvements.sort((a, b) => {
        const impactOrder = { high: 3, medium: 2, low: 1 }
        return impactOrder[b.impact] - impactOrder[a.impact]
      })

    } catch (error) {
      console.error('[ContentOptimizer] LLM generation failed:', error)
      return this.generateFallbackImprovements(page)
    }
  }

  /**
   * Normalize improvement type from LLM response
   */
  private normalizeImprovementType(type: string): Improvement['type'] {
    const normalized = type.toLowerCase().replace(/[^a-z_]/g, '')
    const validTypes: Improvement['type'][] = ['schema_markup', 'faq_section', 'headers', 'meta_tags']
    
    if (validTypes.includes(normalized as Improvement['type'])) {
      return normalized as Improvement['type']
    }
    
    // Map common variations
    if (normalized.includes('schema')) return 'schema_markup'
    if (normalized.includes('faq')) return 'faq_section'
    if (normalized.includes('header') || normalized.includes('heading')) return 'headers'
    if (normalized.includes('meta')) return 'meta_tags'
    
    return 'schema_markup' // Default
  }

  /**
   * Normalize impact level from LLM response
   */
  private normalizeImpact(impact: string): Improvement['impact'] {
    const normalized = impact.toLowerCase()
    if (normalized.includes('high')) return 'high'
    if (normalized.includes('low')) return 'low'
    return 'medium' // Default
  }

  /**
   * Fallback improvements when LLM is unavailable
   * Uses templates with basic brand data
   */
  private async generateFallbackImprovements(page: PageToOptimize): Promise<Improvement[]> {
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
   * Generate schema markup code for a specific type (fallback/template version)
   */
  private generateSchemaMarkup(schemaType: string): string {
    // Note: This is a template fallback - LLM generates better, personalized versions
    const schemas: Record<string, string> = {
      Organization: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "[YOUR COMPANY NAME]",
  "url": "[YOUR WEBSITE URL]",
  "logo": "[YOUR LOGO URL]",
  "description": "[YOUR COMPANY DESCRIPTION]",
  "sameAs": []
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
    "item": "[YOUR WEBSITE URL]"
  }]
}
</script>`,
      FAQPage: this.generateFAQSection(),
      Product: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "[PRODUCT NAME]",
  "description": "[PRODUCT DESCRIPTION]",
  "brand": {
    "@type": "Brand",
    "name": "[YOUR COMPANY NAME]"
  }
}
</script>`,
      WebSite: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "[YOUR COMPANY NAME]",
  "url": "[YOUR WEBSITE URL]",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "[YOUR WEBSITE URL]/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
</script>`,
    }

    return schemas[schemaType] || `<!-- Add ${schemaType} schema markup here -->`
  }

  /**
   * Generate FAQ section with schema markup (fallback/template version)
   * Note: LLM generates industry-specific, personalized FAQ content
   */
  private generateFAQSection(): string {
    return `<!-- FAQ Section with Schema Markup -->
<section class="faq-section" itemscope itemtype="https://schema.org/FAQPage">
  <h2>Frequently Asked Questions</h2>
  
  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <h3 itemprop="name">What problem does your product/service solve?</h3>
    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">[Describe the core problem you solve and how your solution helps]</p>
    </div>
  </div>
  
  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <h3 itemprop="name">How does your solution work?</h3>
    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">[Explain your process or technology in simple terms]</p>
    </div>
  </div>
  
  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <h3 itemprop="name">What makes you different from competitors?</h3>
    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">[Highlight your unique value proposition]</p>
    </div>
  </div>
</section>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What problem does your product/service solve?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Describe the core problem you solve and how your solution helps]"
      }
    },
    {
      "@type": "Question",
      "name": "How does your solution work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Explain your process or technology in simple terms]"
      }
    },
    {
      "@type": "Question",
      "name": "What makes you different from competitors?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[Highlight your unique value proposition]"
      }
    }
  ]
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
