/**
 * PR Review Service
 * 
 * Provides AI-powered review of generated content before PR creation.
 * Ensures code is placed in the most appropriate location.
 */

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface ReviewResult {
  approved: boolean
  suggestedFile: string
  suggestedLocation: 'head' | 'body-start' | 'body-end' | 'page-specific' | 'layout' | 'standalone'
  reasoning: string
  improvedCode?: string
  warnings: string[]
}

export interface ReviewInput {
  generatedCode: string
  issueTitle: string
  issueDescription: string
  agentType: string
  targetFile: string
  companyName: string
  websiteUrl: string
}

/**
 * Analyze content type and determine optimal placement
 */
function analyzeContentType(code: string): {
  type: 'schema' | 'meta' | 'navigation' | 'faq' | 'content' | 'config' | 'unknown'
  shouldBeGlobal: boolean
  preferredFiles: string[]
} {
  const lowerCode = code.toLowerCase()
  
  // Schema markup - usually global but can be page-specific
  if (code.includes('@context') || code.includes('application/ld+json')) {
    const schemaType = code.match(/"@type"\s*:\s*"(\w+)"/)?.[1]
    
    // Organization, WebSite schemas are global
    if (schemaType === 'Organization' || schemaType === 'WebSite') {
      return {
        type: 'schema',
        shouldBeGlobal: true,
        preferredFiles: ['app/layout.tsx', 'pages/_app.tsx', 'pages/_document.tsx', 'index.html']
      }
    }
    
    // Product, Article, FAQPage are page-specific
    if (schemaType === 'Product' || schemaType === 'Article' || schemaType === 'FAQPage') {
      return {
        type: 'schema',
        shouldBeGlobal: false,
        preferredFiles: ['app/page.tsx', 'pages/index.tsx', 'index.html']
      }
    }
    
    return {
      type: 'schema',
      shouldBeGlobal: false,
      preferredFiles: ['app/page.tsx', 'pages/index.tsx', 'index.html']
    }
  }
  
  // Meta tags - usually global
  if (code.includes('<meta ') || code.includes('og:') || code.includes('twitter:')) {
    return {
      type: 'meta',
      shouldBeGlobal: true,
      preferredFiles: ['app/layout.tsx', 'pages/_document.tsx', 'index.html']
    }
  }
  
  // Navigation - page-specific, NOT layout
  if (code.includes('<nav') || (lowerCode.includes('navigation') && code.includes('<a '))) {
    return {
      type: 'navigation',
      shouldBeGlobal: false, // Key insight: nav should NOT be in layout
      preferredFiles: ['app/page.tsx', 'src/app/page.tsx', 'pages/index.tsx', 'index.html']
    }
  }
  
  // FAQ section - page-specific
  if (lowerCode.includes('faq') || code.includes('FAQPage')) {
    return {
      type: 'faq',
      shouldBeGlobal: false,
      preferredFiles: ['app/page.tsx', 'pages/faq.tsx', 'faq.html', 'index.html']
    }
  }
  
  // Config files
  if (code.includes('User-agent:') || code.includes('sitemap.xml') || code.includes('robots.txt')) {
    return {
      type: 'config',
      shouldBeGlobal: true,
      preferredFiles: ['public/robots.txt', 'public/sitemap.xml']
    }
  }
  
  // General content
  return {
    type: 'content',
    shouldBeGlobal: false,
    preferredFiles: ['app/page.tsx', 'pages/index.tsx', 'index.html']
  }
}

/**
 * Review generated content and suggest optimal placement
 */
export async function reviewGeneratedContent(input: ReviewInput): Promise<ReviewResult> {
  const { generatedCode, issueTitle, issueDescription, agentType, targetFile, companyName } = input
  
  // First, do a quick static analysis
  const contentAnalysis = analyzeContentType(generatedCode)
  const warnings: string[] = []
  
  // Check for common issues
  
  // Issue 1: Navigation in layout
  if (contentAnalysis.type === 'navigation' && targetFile.includes('layout')) {
    warnings.push('Navigation content should be in a page component, not the global layout.')
  }
  
  // Issue 2: Page-specific content in global layout
  if (!contentAnalysis.shouldBeGlobal && targetFile.includes('layout')) {
    warnings.push(`${contentAnalysis.type} content is typically page-specific and may not belong in the global layout.`)
  }
  
  // Issue 3: Missing important attributes
  if (contentAnalysis.type === 'navigation' && !generatedCode.includes('aria-label')) {
    warnings.push('Navigation should include aria-label for accessibility.')
  }
  
  // Determine best file
  let suggestedFile = targetFile
  
  // Override target file based on content type
  if (!contentAnalysis.shouldBeGlobal && targetFile.includes('layout')) {
    // Suggest page.tsx instead of layout
    suggestedFile = contentAnalysis.preferredFiles[0] || 'app/page.tsx'
  }
  
  // For more complex decisions, use AI
  let reasoning = ''
  let improvedCode = generatedCode
  
  // Only use AI review for complex cases or when there are warnings
  if (warnings.length > 0 || contentAnalysis.type === 'unknown') {
    try {
      const aiReview = await performAIReview(input, contentAnalysis, warnings)
      reasoning = aiReview.reasoning
      if (aiReview.suggestedFile) {
        suggestedFile = aiReview.suggestedFile
      }
      if (aiReview.improvedCode) {
        improvedCode = aiReview.improvedCode
      }
      warnings.push(...aiReview.additionalWarnings)
    } catch (error) {
      console.error('[PRReview] AI review failed, using static analysis:', error)
      reasoning = `Based on static analysis: ${contentAnalysis.type} content ${contentAnalysis.shouldBeGlobal ? 'can be global' : 'should be page-specific'}.`
    }
  } else {
    reasoning = `Content type: ${contentAnalysis.type}. ${contentAnalysis.shouldBeGlobal ? 'Suitable for global placement.' : 'Recommended for page-specific placement.'}`
  }
  
  // Determine location
  let suggestedLocation: ReviewResult['suggestedLocation'] = 'body-end'
  
  if (contentAnalysis.type === 'schema' || contentAnalysis.type === 'meta') {
    suggestedLocation = 'head'
  } else if (contentAnalysis.type === 'navigation') {
    suggestedLocation = 'page-specific'
  } else if (contentAnalysis.type === 'config') {
    suggestedLocation = 'standalone'
  } else if (contentAnalysis.shouldBeGlobal) {
    suggestedLocation = 'layout'
  } else {
    suggestedLocation = 'page-specific'
  }
  
  return {
    approved: true, // We approve but with suggestions
    suggestedFile,
    suggestedLocation,
    reasoning,
    improvedCode,
    warnings
  }
}

/**
 * Perform AI-powered review for complex cases
 */
async function performAIReview(
  input: ReviewInput,
  contentAnalysis: ReturnType<typeof analyzeContentType>,
  existingWarnings: string[]
): Promise<{
  reasoning: string
  suggestedFile?: string
  improvedCode?: string
  additionalWarnings: string[]
}> {
  const systemPrompt = `You are a senior frontend developer reviewing code changes before they're submitted as a Pull Request.

Your job is to:
1. Evaluate if the code is placed in the optimal location
2. Suggest a better file if needed
3. Identify any issues with the code
4. Provide brief, actionable reasoning

Key principles:
- Navigation elements should be in PAGE components, not layouts (layouts render on every route)
- Schema markup for Organization/WebSite can be global, but Product/Article schemas should be page-specific
- Meta tags belong in the document head
- Content enhancements should generally be page-specific unless explicitly global

Respond in JSON format:
{
  "reasoning": "Brief explanation of your decision",
  "suggestedFile": "path/to/file.tsx or null to keep current",
  "improvedCode": "Improved version of the code or null if no changes needed",
  "additionalWarnings": ["Array of additional warnings if any"]
}`

  const userPrompt = `Review this code change:

**Issue Title:** ${input.issueTitle}
**Issue Description:** ${input.issueDescription}
**Agent Type:** ${input.agentType}
**Current Target File:** ${input.targetFile}
**Company:** ${input.companyName}

**Content Analysis:**
- Type: ${contentAnalysis.type}
- Should be global: ${contentAnalysis.shouldBeGlobal}
- Preferred files: ${contentAnalysis.preferredFiles.join(', ')}

**Existing Warnings:**
${existingWarnings.map(w => `- ${w}`).join('\n') || 'None'}

**Generated Code:**
\`\`\`
${input.generatedCode.slice(0, 2000)}
\`\`\`

Is this code in the right place? Should it be moved? Any improvements needed?`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // Use mini for cost efficiency
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 1000,
    temperature: 0.3
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from AI review')
  }

  const result = JSON.parse(content)
  
  return {
    reasoning: result.reasoning || 'AI review completed',
    suggestedFile: result.suggestedFile,
    improvedCode: result.improvedCode,
    additionalWarnings: result.additionalWarnings || []
  }
}

/**
 * Get the best target file based on content type and repo structure
 */
export function getBestTargetFile(
  contentType: string,
  agentType: string,
  availableFiles: string[]
): string {
  const analysis = analyzeContentType(contentType)
  
  // Find the first preferred file that exists
  for (const preferred of analysis.preferredFiles) {
    if (availableFiles.some(f => f.includes(preferred) || f.endsWith(preferred))) {
      return preferred
    }
  }
  
  // Fallback based on what's available
  if (availableFiles.some(f => f.includes('page.tsx'))) {
    return 'app/page.tsx'
  }
  if (availableFiles.some(f => f.includes('index.html'))) {
    return 'index.html'
  }
  
  return analysis.preferredFiles[0] || 'index.html'
}
