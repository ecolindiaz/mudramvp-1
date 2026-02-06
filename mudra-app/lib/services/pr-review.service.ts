/**
 * PR Review Service
 * 
 * Provides AI-powered review of generated content before PR creation.
 * Ensures code is placed in the most appropriate location.
 */

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
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
  
  // Issue 4: Full page/document being injected (most dangerous)
  const hasDoctype = /<!DOCTYPE\s+html>/i.test(generatedCode)
  const hasHtmlTag = /<html[\s>]/i.test(generatedCode)
  const hasFullHead = /<head[\s>]/i.test(generatedCode) && /<\/head>/i.test(generatedCode)
  const hasFullBody = /<body[\s>]/i.test(generatedCode) && /<\/body>/i.test(generatedCode)
  if (hasDoctype || hasHtmlTag || (hasFullHead && hasFullBody)) {
    warnings.push('CRITICAL: Generated code contains a full HTML document structure (html/head/body). This should be a targeted snippet, not a full page. The content will be injected into an existing file.')
  }
  
  // Issue 5: Full React component being injected into an existing component
  const hasExportDefault = /export\s+default\s+function/.test(generatedCode)
  const hasImports = (generatedCode.match(/^import\s+/gm) || []).length >= 2
  if (hasExportDefault && hasImports) {
    warnings.push('CRITICAL: Generated code appears to be a complete React component with imports and export. This should be a JSX snippet that gets inserted into the existing component, not a replacement.')
  }
  
  // Issue 6: Content has duplicate page sections (header, footer, form, nav) suggesting a full page
  const sectionCounts = {
    header: (generatedCode.match(/<header[\s>]/gi) || []).length,
    footer: (generatedCode.match(/<footer[\s>]/gi) || []).length,
    nav: (generatedCode.match(/<nav[\s>]/gi) || []).length,
    form: (generatedCode.match(/<form[\s>]/gi) || []).length,
    main: (generatedCode.match(/<main[\s>]/gi) || []).length,
  }
  const pageSections = Object.entries(sectionCounts).filter(([, count]) => count > 0)
  if (pageSections.length >= 3) {
    warnings.push(`CRITICAL: Generated code contains multiple page-level sections (${pageSections.map(([s, c]) => `${s}:${c}`).join(', ')}). This looks like a full page, not a targeted fix.`)
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
4. STRIP OUT any full-page wrappers or unrelated content
5. Provide brief, actionable reasoning

Key principles:
- Navigation elements should be in PAGE components, not layouts (layouts render on every route)
- Schema markup for Organization/WebSite can be global, but Product/Article schemas should be page-specific
- Meta tags belong in the document head
- Content enhancements should generally be page-specific unless explicitly global

CRITICAL — The generated code will be INJECTED INTO an existing file. Watch for these problems:
- If the code is a FULL HTML page (has <!DOCTYPE>, <html>, <head>, <body>), extract ONLY the meaningful optimization content (e.g. the JSON-LD script tag, the meta tags, or the specific content section)
- If the code is a FULL React component (has import statements + export default), extract ONLY the JSX that needs to be inserted
- If the code contains header/footer/nav/form that duplicates what already exists on the page, REMOVE those duplicate sections
- The improvedCode field should contain ONLY the targeted snippet, never a full page
- The code must be minimal and self-contained

Respond in JSON format:
{
  "reasoning": "Brief explanation of your decision",
  "suggestedFile": "path/to/file.tsx or null to keep current",
  "improvedCode": "The TARGETED snippet only (no full page wrappers), or null if no changes needed",
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

Is this code in the right place? Should it be moved? Any improvements needed?

Respond with a JSON object containing: reasoning, suggestedFile, improvedCode (optional), additionalWarnings (array).`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1000,
    messages: [
      { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }
    ]
  })

  const textBlock = response.content.find(block => block.type === 'text')
  const content = textBlock?.type === 'text' ? textBlock.text : null
  if (!content) {
    throw new Error('No response from AI review')
  }

  // Extract JSON from the response (Claude may wrap it in markdown)
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in AI review response')
  }
  
  const result = JSON.parse(jsonMatch[0])
  
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
