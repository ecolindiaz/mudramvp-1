/**
 * Code-Specific Validators for Issue Agent Output
 * 
 * These validators replace NLP-based scorers (faithfulness, relevancy, hallucination)
 * which don't work well for code generation tasks. Each validator returns a score 0-1
 * and a reason string for debugging.
 * 
 * Validators:
 * 1. syntaxValidator - Does the code parse without errors?
 * 2. issueResolutionValidator - Does output contain required elements for the issue type?
 * 3. contextFidelityValidator - Does code use real content from source/page context?
 * 4. filePathValidator - Does output target a valid file path in the repo?
 */

import type { AgentOutput, IssueContext } from './types'

// Issue type to required elements mapping
const ISSUE_REQUIREMENTS: Record<string, {
  requiredPatterns: RegExp[]
  requiredFields?: string[]
  description: string
}> = {
  // Schema issues
  'organization_schema': {
    requiredPatterns: [/@type["':\s]+Organization/i, /@context/i],
    requiredFields: ['name', 'url'],
    description: 'Organization schema with name and url',
  },
  'website_schema': {
    requiredPatterns: [/@type["':\s]+WebSite/i, /@context/i],
    requiredFields: ['name', 'url'],
    description: 'WebSite schema with name and url',
  },
  'faq_schema': {
    requiredPatterns: [/@type["':\s]+FAQPage/i, /@context/i, /mainEntity/i],
    description: 'FAQPage schema with mainEntity array',
  },
  'product_schema': {
    requiredPatterns: [/@type["':\s]+Product/i, /@context/i],
    requiredFields: ['name'],
    description: 'Product schema with name',
  },
  'article_schema': {
    requiredPatterns: [/@type["':\s]+(Article|BlogPosting|NewsArticle)/i, /@context/i],
    requiredFields: ['headline'],
    description: 'Article schema with headline',
  },
  'breadcrumb_schema': {
    requiredPatterns: [/@type["':\s]+BreadcrumbList/i, /@context/i, /itemListElement/i],
    description: 'BreadcrumbList schema with itemListElement',
  },
  'howto_schema': {
    requiredPatterns: [/@type["':\s]+HowTo/i, /@context/i, /step/i],
    description: 'HowTo schema with steps',
  },
  'service_schema': {
    requiredPatterns: [/@type["':\s]+Service/i, /@context/i],
    requiredFields: ['name'],
    description: 'Service schema with name',
  },
  'local_business_schema': {
    requiredPatterns: [/@type["':\s]+(LocalBusiness|Organization)/i, /@context/i],
    requiredFields: ['name', 'address'],
    description: 'LocalBusiness schema with name and address',
  },

  // SEO issues
  'h1_heading': {
    requiredPatterns: [/<h1[^>]*>|className=["'][^"']*text-.*xl/i],
    description: 'H1 heading element',
  },
  'meta_description': {
    requiredPatterns: [/meta.*description|description.*=|metadata.*description/i],
    description: 'Meta description tag or metadata export',
  },
  'meta_title': {
    requiredPatterns: [/<title>|title.*=|metadata.*title/i],
    description: 'Title tag or metadata export',
  },
  'canonical_url': {
    requiredPatterns: [/canonical|alternates/i],
    description: 'Canonical URL link or alternates',
  },
  'meta_optimization': {
    requiredPatterns: [/canonical|alternates|metadata|<title>|description/i],
    description: 'Metadata export or canonical URL',
  },
  'robots_txt': {
    requiredPatterns: [/User-agent:/i],
    description: 'robots.txt with User-agent directive',
  },
  'sitemap': {
    requiredPatterns: [/<urlset|<sitemapindex|\?xml/i],
    description: 'XML sitemap',
  },

  // GEO issues  
  'llms_txt': {
    requiredPatterns: [/^#|^>/m],
    description: 'llms.txt with headers or content blocks',
  },
  'ai_crawler': {
    requiredPatterns: [/(GPTBot|Claude-Web|Anthropic|Perplexity|Google-Extended)/i],
    description: 'AI crawler directives',
  },

  // Content issues
  'faq_content': {
    requiredPatterns: [/\?|question|answer|Q:|A:/i],
    description: 'FAQ content with questions and answers',
  },
}

export interface ValidatorResult {
  score: number
  reason: string
  details?: Record<string, unknown>
}

export interface StructuredAgentOutput {
  reasoning: string
  changes: string[]
  targetFile: string
  code: string
  insertionPoint?: string  // Where in the file to insert (e.g., "after imports", "in metadata export")
}

/**
 * Parse structured JSON output from agent response.
 * Agent is prompted to return: { reasoning, changes, targetFile, code }
 */
export function parseStructuredOutput(responseText: string): StructuredAgentOutput | null {
  // Try to find JSON object in response
  const jsonMatch = responseText.match(/\{[\s\S]*"reasoning"[\s\S]*"code"[\s\S]*\}/i)
  if (!jsonMatch) {
    // Try code block with JSON
    const codeBlockMatch = responseText.match(/```(?:json)?\s*\n?(\{[\s\S]*\})\s*```/i)
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1])
        if (parsed.reasoning && parsed.code) {
          return {
            reasoning: parsed.reasoning || '',
            changes: Array.isArray(parsed.changes) ? parsed.changes : [],
            targetFile: parsed.targetFile || '',
            code: parsed.code || '',
            insertionPoint: parsed.insertionPoint,
          }
        }
      } catch { /* not valid JSON */ }
    }
    return null
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    if (parsed.reasoning && parsed.code) {
      return {
        reasoning: parsed.reasoning || '',
        changes: Array.isArray(parsed.changes) ? parsed.changes : [],
        targetFile: parsed.targetFile || '',
        code: parsed.code || '',
        insertionPoint: parsed.insertionPoint,
      }
    }
  } catch { /* not valid JSON */ }

  return null
}

/**
 * Validate code syntax by attempting to parse it.
 * Supports: JSON, JSX/TSX, HTML, plain text configs
 */
export function validateSyntax(code: string, fileType?: string): ValidatorResult {
  const trimmed = code.trim()
  
  // JSON validation
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed)
      return { score: 1.0, reason: 'Valid JSON syntax' }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown parse error'
      return { score: 0.0, reason: `Invalid JSON: ${error}` }
    }
  }

  // JSX/TSX basic validation (check for balanced tags)
  if (fileType === 'tsx' || fileType === 'jsx' || trimmed.includes('<') && trimmed.includes('>')) {
    const openTags = (trimmed.match(/<[a-zA-Z][^/>]*(?<!\\)>/g) || []).length
    const closeTags = (trimmed.match(/<\/[a-zA-Z][^>]*>/g) || []).length
    const selfClosing = (trimmed.match(/<[a-zA-Z][^>]*\/>/g) || []).length
    
    // Account for self-closing tags
    const expectedClose = openTags - selfClosing
    if (Math.abs(expectedClose - closeTags) > 2) {
      return { 
        score: 0.3, 
        reason: `Possibly unbalanced tags: ${openTags} open, ${closeTags} close, ${selfClosing} self-closing`,
        details: { openTags, closeTags, selfClosing }
      }
    }
    
    // Check for common JSX syntax errors
    if (trimmed.includes('class=') && !trimmed.includes('className=')) {
      return { score: 0.7, reason: 'Uses class= instead of className= (JSX)' }
    }
    
    return { score: 1.0, reason: 'JSX syntax appears valid' }
  }

  // Config files (robots.txt, llms.txt)
  if (trimmed.startsWith('User-agent:') || trimmed.startsWith('#')) {
    return { score: 1.0, reason: 'Config file syntax valid' }
  }

  // XML/Sitemap
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<urlset')) {
    // Basic XML validation
    const hasClosingTag = trimmed.includes('</urlset>') || trimmed.includes('</sitemapindex>')
    if (!hasClosingTag && trimmed.includes('<urlset')) {
      return { score: 0.5, reason: 'XML may be incomplete (missing closing tag)' }
    }
    return { score: 1.0, reason: 'XML syntax appears valid' }
  }

  // Default: assume valid for plain text
  return { score: 0.9, reason: 'Plain text content (no syntax validation needed)' }
}

/**
 * Validate that output addresses the specific issue type.
 * Checks for required patterns and fields based on agentType.
 */
export function validateIssueResolution(
  code: string,
  agentType: string,
  issueTitle?: string
): ValidatorResult {
  // Normalize agent type to match our requirements
  const normalizedType = agentType
    .toLowerCase()
    .replace(/[-_\s]+/g, '_')
    .replace(/_agent$/, '')

  const requirements = ISSUE_REQUIREMENTS[normalizedType]
  
  if (!requirements) {
    // Unknown agent type - do basic validation
    if (code.length < 10) {
      return { score: 0.2, reason: 'Output too short to be meaningful' }
    }
    return { score: 0.8, reason: `No specific requirements for agent type: ${agentType}` }
  }

  const matchedPatterns: string[] = []
  const missingPatterns: string[] = []

  for (const pattern of requirements.requiredPatterns) {
    if (pattern.test(code)) {
      matchedPatterns.push(pattern.source)
    } else {
      missingPatterns.push(pattern.source)
    }
  }

  const patternScore = requirements.requiredPatterns.length > 0
    ? matchedPatterns.length / requirements.requiredPatterns.length
    : 1.0

  // Check required fields for JSON-LD schemas
  let fieldScore = 1.0
  const missingFields: string[] = []
  if (requirements.requiredFields && code.includes('@type')) {
    try {
      // Extract JSON from code
      const jsonMatch = code.match(/\{[\s\S]*"@type"[\s\S]*\}/i)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        for (const field of requirements.requiredFields) {
          if (!parsed[field]) {
            missingFields.push(field)
          }
        }
        fieldScore = requirements.requiredFields.length > 0
          ? (requirements.requiredFields.length - missingFields.length) / requirements.requiredFields.length
          : 1.0
      }
    } catch { /* JSON parse failed, skip field validation */ }
  }

  const finalScore = (patternScore * 0.7) + (fieldScore * 0.3)

  if (finalScore >= 0.9) {
    return { 
      score: finalScore, 
      reason: `Output contains all required elements for ${requirements.description}`,
      details: { matchedPatterns, missingPatterns, missingFields }
    }
  } else if (finalScore >= 0.5) {
    return {
      score: finalScore,
      reason: `Output partially addresses issue. Missing: ${[...missingPatterns, ...missingFields].join(', ')}`,
      details: { matchedPatterns, missingPatterns, missingFields }
    }
  } else {
    return {
      score: finalScore,
      reason: `Output does not adequately address the issue. Expected: ${requirements.description}`,
      details: { matchedPatterns, missingPatterns, missingFields }
    }
  }
}

/**
 * Validate that code uses real content from the provided context.
 * Prevents hallucination by checking for actual strings from source/page.
 */
export function validateContextFidelity(
  code: string,
  context: {
    pageContent?: string | null
    sourceFile?: string | null
    brandName?: string | null
    brandWebsite?: string | null
  }
): ValidatorResult {
  const matches: string[] = []
  const checks: { name: string; found: boolean }[] = []

  // Check brand name appears in output (if brand-related content)
  if (context.brandName && context.brandName.length > 2) {
    const brandRegex = new RegExp(escapeRegex(context.brandName), 'i')
    const found = brandRegex.test(code)
    checks.push({ name: 'brandName', found })
    if (found) matches.push('brand name')
  }

  // Check website domain appears (if URL-related content)
  if (context.brandWebsite) {
    const domain = extractDomain(context.brandWebsite)
    if (domain && domain.length > 3) {
      const found = code.toLowerCase().includes(domain.toLowerCase())
      checks.push({ name: 'website', found })
      if (found) matches.push('website domain')
    }
  }

  // Check for content from page scrape
  if (context.pageContent && context.pageContent.length > 50) {
    // Extract significant phrases (3+ words) from page content
    const phrases = extractSignificantPhrases(context.pageContent, 5)
    let phraseMatches = 0
    for (const phrase of phrases.slice(0, 10)) { // Check top 10 phrases
      if (code.toLowerCase().includes(phrase.toLowerCase())) {
        phraseMatches++
      }
    }
    const phraseScore = phrases.length > 0 ? Math.min(phraseMatches / 3, 1) : 0
    checks.push({ name: 'pageContent', found: phraseScore > 0.3 })
    if (phraseScore > 0) matches.push(`${phraseMatches} phrases from page`)
  }

  // Check source file elements are preserved
  if (context.sourceFile && context.sourceFile.length > 50) {
    // Look for import statements, function names, variable names from source
    const sourceImports: string[] = context.sourceFile.match(/import\s+.*from\s+['"][^'"]+['"]/g) ?? []
    const codeImports: string[] = code.match(/import\s+.*from\s+['"][^'"]+['"]/g) ?? []
    
    // Check if code preserves some imports (if it's a React component)
    if (sourceImports.length > 0 && codeImports.length > 0) {
      const preservedImports = codeImports.filter(imp => sourceImports.includes(imp)).length
      checks.push({ name: 'imports', found: preservedImports > 0 })
      if (preservedImports > 0) matches.push(`${preservedImports} preserved imports`)
    }
  }

  // Calculate score
  const passedChecks = checks.filter(c => c.found).length
  const totalChecks = checks.length

  if (totalChecks === 0) {
    return { 
      score: 0.8, 
      reason: 'No context available for fidelity check',
      details: { matches, checks }
    }
  }

  const score = passedChecks / totalChecks

  if (score >= 0.7) {
    return {
      score: Math.min(score, 1.0),
      reason: `Output uses real content: ${matches.join(', ')}`,
      details: { matches, checks }
    }
  } else if (score >= 0.3) {
    return {
      score,
      reason: `Partial context fidelity. Found: ${matches.join(', ') || 'limited matches'}`,
      details: { matches, checks }
    }
  } else {
    return {
      score,
      reason: 'Output may contain hallucinated content - limited matches to provided context',
      details: { matches, checks }
    }
  }
}

/**
 * Validate that the target file path is reasonable for the issue.
 */
export function validateFilePath(
  targetFile: string,
  context: {
    sourceFilePath?: string | null
    framework?: string
    affectedUrl?: string | null
  }
): ValidatorResult {
  if (!targetFile || targetFile.length < 3) {
    return { score: 0.3, reason: 'No target file specified' }
  }

  // Check for valid file extension
  const validExtensions = ['.tsx', '.ts', '.jsx', '.js', '.json', '.txt', '.xml', '.md', '.html']
  const hasValidExt = validExtensions.some(ext => targetFile.endsWith(ext))
  if (!hasValidExt) {
    return { score: 0.4, reason: `Invalid file extension: ${targetFile}` }
  }

  // If we have the original source file path, check for consistency
  if (context.sourceFilePath) {
    // Exact match is ideal
    if (targetFile === context.sourceFilePath) {
      return { score: 1.0, reason: 'Target matches source file path exactly' }
    }
    
    // Same directory is good
    const targetDir = targetFile.split('/').slice(0, -1).join('/')
    const sourceDir = context.sourceFilePath.split('/').slice(0, -1).join('/')
    if (targetDir === sourceDir) {
      return { score: 0.9, reason: 'Target in same directory as source file' }
    }
  }

  // Check path makes sense for framework
  if (context.framework) {
    const frameworkPaths: Record<string, RegExp[]> = {
      'nextjs-app': [/^(src\/)?app\//, /^(src\/)?components\//],
      'nextjs-pages': [/^(src\/)?pages\//, /^(src\/)?components\//],
      'react': [/^(src\/)?components\//, /^(src\/)?pages\//],
      'astro': [/^src\/(pages|components|layouts)\//],
      'gatsby': [/^src\/(pages|components|templates)\//],
    }

    const patterns = frameworkPaths[context.framework] || []
    if (patterns.length > 0) {
      const matchesFramework = patterns.some(p => p.test(targetFile))
      if (!matchesFramework) {
        return { 
          score: 0.6, 
          reason: `Path may not follow ${context.framework} conventions: ${targetFile}` 
        }
      }
    }
  }

  return { score: 0.85, reason: 'Target file path appears valid' }
}

// Helper functions

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function extractSignificantPhrases(text: string, minWords: number = 3): string[] {
  // Clean text
  const cleaned = text
    .replace(/[#*_`]/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Extract sentences
  const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 10)
  
  // Get unique phrases of minWords or more
  const phrases: string[] = []
  for (const sentence of sentences.slice(0, 20)) {
    const words = sentence.trim().split(/\s+/)
    if (words.length >= minWords) {
      // Take first minWords words as a phrase
      phrases.push(words.slice(0, minWords + 2).join(' ').trim())
    }
  }

  return [...new Set(phrases)]
}

/**
 * Run all code validators and return aggregate result.
 */
export async function runCodeValidators(
  output: StructuredAgentOutput | string,
  agentType: string,
  context: {
    pageContent?: string | null
    sourceFile?: string | null
    sourceFilePath?: string | null
    brandName?: string | null
    brandWebsite?: string | null
    framework?: string
    affectedUrl?: string | null
    issueTitle?: string
  }
): Promise<{
  passed: boolean
  score: number
  results: Record<string, ValidatorResult>
}> {
  const isStructured = typeof output !== 'string'
  const code = isStructured ? output.code : output
  const targetFile = isStructured ? output.targetFile : context.sourceFilePath || ''

  const results: Record<string, ValidatorResult> = {}

  // Run validators
  results.syntax = validateSyntax(code)
  results.issueResolution = validateIssueResolution(code, agentType, context.issueTitle)
  results.contextFidelity = validateContextFidelity(code, {
    pageContent: context.pageContent,
    sourceFile: context.sourceFile,
    brandName: context.brandName,
    brandWebsite: context.brandWebsite,
  })
  results.filePath = validateFilePath(targetFile, {
    sourceFilePath: context.sourceFilePath,
    framework: context.framework,
    affectedUrl: context.affectedUrl,
  })

  // Calculate weighted score
  const weights = {
    syntax: 0.25,
    issueResolution: 0.35,
    contextFidelity: 0.25,
    filePath: 0.15,
  }

  const weightedScore = Object.entries(results).reduce((sum, [key, result]) => {
    return sum + (result.score * (weights[key as keyof typeof weights] || 0))
  }, 0)

  // Pass if weighted score >= 0.65 and no critical failures
  const criticalFailure = results.syntax.score < 0.5 || results.issueResolution.score < 0.4
  const passed = weightedScore >= 0.65 && !criticalFailure

  return {
    passed,
    score: weightedScore,
    results,
  }
}

/**
 * Format validator failures into feedback for retry prompt.
 */
export function formatValidatorFeedback(
  results: Record<string, ValidatorResult>,
  retryNumber: number
): string {
  const failures = Object.entries(results)
    .filter(([_, result]) => result.score < 0.7)
    .map(([name, result]) => `- **${name}**: ${result.reason}`)

  if (failures.length === 0) return ''

  return `
## Code Validation Failure (Retry ${retryNumber})
The previous output failed code-specific validation checks:

${failures.join('\n')}

Please address these issues in your next attempt:
1. Ensure code is syntactically valid
2. Include all required elements for this issue type
3. Use actual content from the provided page/source context
4. Target the correct file path
`
}
