/**
 * Issue Agent Executor Service
 * 
 * Orchestrates agent execution for issue resolution.
 * Handles E2B validation and GitHub PR creation.
 * 
 * Two execution paths:
 * 1. Technical Issues → Generate code → E2B validate → Create GitHub PR
 * 2. Conversation Issues → Return Reddit/social links with engagement guidance
 */

import { prisma } from '@/lib/prisma'
import { mastra } from '@/mastra'
import Anthropic from '@anthropic-ai/sdk'
import {
  validateSchemaInSandbox,
  validateFaqInSandbox,
  requiresE2bValidation,
  type SandboxResult,
  type SchemaValidationResult,
  type FaqValidationResult
} from './e2b-sandbox.service'
import { createOptimizationPR, checkExistingBlogFiles } from './github.service'
import { reviewGeneratedContent, type ReviewResult } from './pr-review.service'
import { getFirecrawlClient } from '@/mastra/tools/firecrawl-client'
import {
  hallucinationScorer,
  faithfulnessScorer,
  relevancyScorer,
  promptAlignmentScorer,
} from '@/mastra/evals'
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/evals'
import { createHash } from 'crypto'
import { readSchemaKnowledge, readFaqTemplates } from '@/lib/analysis/technical/knowledge'

// Max iterations for the generate→review→refine loop
const MAX_REVIEW_ITERATIONS = 3

// Outer loop: if eval scores or schema verification fail, retry the generate→review→refine cycle
const MAX_QUALITY_RETRIES = 2

// Quality thresholds for the gate check
const QUALITY_THRESHOLDS = {
  minFaithfulness: 0.7,
  maxHallucination: 0.3,
  minRelevancy: 0.6,
  minAlignment: 0.7,
} as const

// Timeout for agent generation (deploy route has maxDuration=300s on Vercel Pro)
const AGENT_TIMEOUT_MS = 120_000

// Direct Anthropic client as fallback
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * Call Anthropic directly without Mastra wrapper
 */
async function callAnthropicDirect(prompt: string, systemPrompt?: string): Promise<string> {
  console.log(`[IssueExecutor] Using direct Anthropic API call...`)
  console.log(`[IssueExecutor] Anthropic API key present: ${!!process.env.ANTHROPIC_API_KEY}`)
  console.log(`[IssueExecutor] API key first 10 chars: ${process.env.ANTHROPIC_API_KEY?.substring(0, 10)}...`)
  console.log(`[IssueExecutor] Calling anthropic.messages.create with model: claude-sonnet-4-5-20250929`)
  console.log(`[IssueExecutor] Prompt length: ${prompt.length} chars`)
  
  try {
    const startTime = Date.now()
    console.log(`[IssueExecutor] API call starting at ${new Date().toISOString()}`)
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [
        { role: 'user', content: prompt }
      ],
      ...(systemPrompt && { system: systemPrompt })
    })
    
    const elapsed = Date.now() - startTime
    console.log(`[IssueExecutor] Anthropic API response received in ${elapsed}ms, stop_reason: ${response.stop_reason}`)
    console.log(`[IssueExecutor] Response usage: input=${response.usage.input_tokens}, output=${response.usage.output_tokens}`)
    
    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Anthropic')
    }
    
    return textContent.text
  } catch (error) {
    console.error(`[IssueExecutor] Anthropic API call failed:`, error)
    if (error instanceof Error) {
      console.error(`[IssueExecutor] Error name: ${error.name}`)
      console.error(`[IssueExecutor] Error message: ${error.message}`)
      console.error(`[IssueExecutor] Error stack: ${error.stack}`)
    }
    throw error
  }
}

/**
 * Wrap a promise with a timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      console.error(`[IssueExecutor] TIMEOUT triggered after ${timeoutMs}ms`)
      reject(new Error(errorMessage))
    }, timeoutMs)
  })
  
  // Log heartbeat every 10 seconds
  const heartbeatId = setInterval(() => {
    console.log(`[IssueExecutor] Heartbeat - still waiting for agent response...`)
  }, 10_000)
  
  try {
    const result = await Promise.race([promise, timeoutPromise])
    clearTimeout(timeoutId!)
    clearInterval(heartbeatId)
    return result
  } catch (error) {
    clearTimeout(timeoutId!)
    clearInterval(heartbeatId)
    throw error
  }
}

/**
 * Scrape the actual page content so agents can see what's already rendered.
 * Returns markdown content or null if scraping fails.
 */
async function scrapePageContent(url: string): Promise<string | null> {
  try {
    const firecrawl = getFirecrawlClient()
    const result = await firecrawl.scrapeUrl(url, {
      formats: ['markdown'],
      onlyMainContent: true,
      timeout: 15000,
    })
    if (result.success && result.markdown) {
      const content = result.markdown.length > 6000
        ? result.markdown.slice(0, 6000) + '\n\n[...content truncated...]'
        : result.markdown
      console.log(`[IssueExecutor] Scraped page content: ${content.length} chars from ${url}`)
      return content
    }
    console.warn(`[IssueExecutor] Scrape returned no content for ${url}`)
    return null
  } catch (err) {
    console.warn(`[IssueExecutor] Failed to scrape ${url}:`, err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Fetch the source code of the target file from the user's GitHub repo.
 * This gives the agent the actual codebase context.
 */
async function fetchSourceFileFromGitHub(
  brandProfileId: number,
  filePath: string
): Promise<string | null> {
  try {
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      include: { user: { include: { githubIntegration: true } } },
    })
    if (!brandProfile?.user?.githubIntegration) return null

    const integration = brandProfile.user.githubIntegration

    // Get token — import logic from github.service pattern
    let accessToken: string
    if (integration.integrationType === 'installation' && integration.installationId) {
      // For app installations, the token is already managed
      const { decryptToken } = await import('@/lib/crypto/token-encryption')
      accessToken = decryptToken(integration.accessToken)
    } else {
      const { decryptToken } = await import('@/lib/crypto/token-encryption')
      accessToken = decryptToken(integration.accessToken)
    }

    // Determine repo
    let repoName: string | undefined
    let baseBranch = 'main'
    const agentSchedule = await prisma.agentSchedule.findFirst({
      where: { brandProfileId, isEnabled: true },
      orderBy: { createdAt: 'desc' },
    })
    if (agentSchedule?.config) {
      const config = agentSchedule.config as Record<string, unknown>
      if (config.githubRepo) {
        repoName = config.githubRepo as string
        baseBranch = (config.githubBranch as string) || 'main'
      }
    }
    if (!repoName && integration.repositories) {
      const repos = integration.repositories as string[]
      if (repos.length > 0) repoName = repos[0]
    }
    if (!repoName) return null

    const [owner, repo] = repoName.split('/')
    if (!owner || !repo) return null

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${baseBranch}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    )
    if (!res.ok) {
      console.warn(`[IssueExecutor] File not found in repo: ${filePath} (${res.status})`)
      return null
    }

    const data = await res.json()
    if (data.content && data.encoding === 'base64') {
      const decoded = Buffer.from(data.content, 'base64').toString('utf-8')
      const truncated = decoded.length > 8000
        ? decoded.slice(0, 8000) + '\n\n// [... file truncated ...]'
        : decoded
      console.log(`[IssueExecutor] Fetched source file: ${filePath} (${truncated.length} chars)`)
      return truncated
    }
    return null
  } catch (err) {
    console.warn(`[IssueExecutor] Failed to fetch source file ${filePath}:`, err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Resolve the source file path for the agent to read.
 *
 * For page-specific agents (schema_markup, heading_hierarchy, etc.), derives
 * the file path from the affected URL. E.g. https://acme.com/pricing →
 * app/pricing/page.tsx. Falls back to getFilePathForAgentType() for non-page
 * agents or when no URL is available.
 */
function getSafeUrlPathFromAffectedUrl(affectedUrl: string): string | null {
  let pathname: string

  try {
    pathname = new URL(affectedUrl).pathname
  } catch {
    // Support relative paths or missing protocol values
    try {
      pathname = new URL(affectedUrl, 'https://example.com').pathname
    } catch {
      return null
    }
  }

  const rawSegments = pathname.split('/').filter(Boolean)
  if (rawSegments.length === 0) return ''

  const safeSegments: string[] = []

  for (const rawSegment of rawSegments) {
    let decodedSegment = rawSegment
    try {
      decodedSegment = decodeURIComponent(rawSegment)
    } catch {
      return null
    }

    const segment = decodedSegment.trim()
    if (!segment || segment === '.') continue

    // Reject traversal and encoded separators before constructing repo paths.
    if (segment === '..' || segment.includes('/') || segment.includes('\\')) {
      return null
    }

    safeSegments.push(segment)
  }

  if (safeSegments.length === 0) return ''

  // Remove extension from the last segment (e.g. /pricing.html -> /pricing).
  const lastIndex = safeSegments.length - 1
  safeSegments[lastIndex] = safeSegments[lastIndex].replace(/\.[^/.]+$/, '')
  if (!safeSegments[lastIndex]) {
    safeSegments.pop()
  }

  return safeSegments.join('/')
}

function resolveSourceFilePath(agentType: string, affectedUrl: string | null): string {
  const PAGE_SPECIFIC_AGENTS = [
    'schema_markup', 'heading_hierarchy', 'content_structure', 'faq_sections',
    'meta_optimization', 'citation_signals', 'ai_content_optimizer',
    'authority_building', 'brand_messaging', 'navigation', 'nav_optimization',
  ]
  const fallbackPath = getFilePathForAgentType(agentType)

  if (!affectedUrl || !PAGE_SPECIFIC_AGENTS.includes(agentType)) {
    return fallbackPath
  }

  const urlPath = getSafeUrlPathFromAffectedUrl(affectedUrl)
  if (urlPath === null) {
    console.warn(`[IssueExecutor] Unsafe affectedUrl path detected, using fallback file path. affectedUrl=${affectedUrl}`)
    return fallbackPath
  }

  if (!urlPath || urlPath === '') {
    // Homepage
    return 'app/page.tsx'
  }

  // Convert URL path to Next.js App Router file path
  // e.g. "pricing" → "app/pricing/page.tsx"
  //      "blog/my-post" → "app/blog/my-post/page.tsx"
  return `app/${urlPath}/page.tsx`
}

/**
 * Gather full context for an issue: page content + source code + existing files.
 * This is the "context enrichment" phase that runs before the agent generates code.
 */
async function gatherIssueContext(issue: {
  affectedUrl: string | null
  agentType: string | null
  brandProfileId: number
  brandProfile: {
    companyWebsite: string | null
  }
}): Promise<{
  pageContent: string | null
  sourceFile: string | null
  sourceFilePath: string | null
  blogContext: string
}> {
  const targetUrl = issue.affectedUrl || issue.brandProfile.companyWebsite

  // 1. Scrape live page content (what users actually see)
  const pageContentPromise = targetUrl ? scrapePageContent(targetUrl) : Promise.resolve(null)

  // 2. Fetch the source file that will be modified
  //    For schema agents, derive the path from the affected URL instead of
  //    using the hardcoded 'app/page.tsx' default — a /pricing issue needs
  //    app/pricing/page.tsx, not the homepage source.
  const targetFilePath = resolveSourceFilePath(issue.agentType || 'schema_markup', issue.affectedUrl)
  const sourceFilePromise = fetchSourceFileFromGitHub(issue.brandProfileId, targetFilePath)

  // 3. Check blog context if applicable
  let blogContext = ''
  if (issue.agentType === 'blog_setup' || issue.agentType === 'blog_page_missing') {
    try {
      const blogCheck = await checkExistingBlogFiles(issue.brandProfileId)
      if (blogCheck.hasBlog) {
        blogContext = `\n## Existing Blog Detected\nBlog files already exist at: ${blogCheck.foundPaths.join(', ')}\nFramework: ${blogCheck.framework}\nDo NOT duplicate these. Only add what's missing.\n`
      } else {
        blogContext = `\n## Blog Status\nNo existing blog pages found. Framework: ${blogCheck.framework}\n`
      }
    } catch (err) {
      console.error('[IssueExecutor] Failed to check existing blog files:', err)
    }
  }

  // Run scrape + source file fetch in parallel
  const [pageContent, sourceFile] = await Promise.all([pageContentPromise, sourceFilePromise])

  return { pageContent, sourceFile, sourceFilePath: targetFilePath, blogContext }
}

// Agent type to Mastra agent name mapping
const ISSUE_AGENT_MAP: Record<string, string> = {
  // Technical Structure
  'schema_markup': 'schemaArchitectAgent',
  'heading_hierarchy': 'contentRestructureAgent',
  'content_structure': 'contentRestructureAgent',
  'faq_sections': 'contentRestructureAgent',
  'site_config': 'siteConfigAgent',
  'robots_txt': 'siteConfigAgent',
  'sitemap': 'siteConfigAgent',
  'meta_optimization': 'siteConfigAgent',
  
  // AI Visibility
  'llms_txt': 'llmsTxtAgent',
  'llms_txt_missing': 'llmsTxtAgent',
  'llms_txt_optimizer': 'llmsTxtAgent',
  'citation_signals': 'citationEnhancerAgent',
  'ai_content_optimizer': 'citationEnhancerAgent',
  'authority_building': 'citationEnhancerAgent',
  'brand_messaging': 'citationEnhancerAgent',
  
  // Blog Publishing
  'blog_setup': 'blogSetupAgent',
  'blog_page_missing': 'blogSetupAgent',
  'blog_post_publish': 'blogPostPublisherAgent',
  
  // Conversations (uses existing agent)
  'conversation_engagement': 'conversationRadarAgent',
  'reddit_opportunity': 'conversationRadarAgent',
  'social_opportunity': 'conversationRadarAgent',
}

// Issue types that create PRs vs those that return links/content
const PR_CREATING_TYPES = [
  'schema_markup',
  'heading_hierarchy', 'content_structure', 'faq_sections',
  'site_config', 'robots_txt', 'sitemap', 'meta_optimization',
  'llms_txt', 'llms_txt_missing', 'llms_txt_optimizer',
  'citation_signals', 'ai_content_optimizer', 'authority_building', 'brand_messaging',
  'blog_setup', 'blog_page_missing', 'blog_post_publish'
]

const CONVERSATION_TYPES = [
  'conversation_engagement', 'reddit_opportunity', 'social_opportunity'
]

function isSchemaAgentType(agentType: string): boolean {
  return agentType === 'schema_markup'
}

/**
 * Extract the page type from an issue description.
 * The scorer embeds `<!-- PAGE_TYPE: ... -->` in FAQ_count issues.
 */
function parsePageTypeFromDescription(description: string | null): string | null {
  if (!description) return null
  const match = description.match(/<!-- PAGE_TYPE: (\S+) -->/)
  return match ? match[1] : null
}

/**
 * Detect the frontend framework from file path and content.
 * Used to give the LLM explicit guidance on code style.
 */
export function detectFrameworkFromContext(filePath: string | null, content: string | null): string {
  if (!filePath) return 'HTML'
  if (filePath.endsWith('.astro')) return 'Astro'
  if (filePath.endsWith('.vue')) return 'Vue'
  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
    if (content?.includes('next/') || filePath.includes('app/')) return 'Next.js (React/JSX)'
    return 'React (JSX)'
  }
  return 'HTML'
}

export interface ExecutionResult {
  success: boolean
  // For PR-creating agents
  prUrl?: string
  prNumber?: number
  generatedContent?: string
  // For conversation agents
  conversationUrl?: string
  engagementGuidance?: string
  suggestedResponse?: string
  // Common
  error?: string
  e2bValidation?: SandboxResult<SchemaValidationResult>
  faqValidation?: SandboxResult<FaqValidationResult>
  // Eval scores (production quality tracking)
  evalScores?: {
    hallucination?: number
    faithfulness?: number
    relevancy?: number
    alignment?: number
    compositeScore?: number
    details?: Record<string, { score: number; reason: string }>
  }
  qualityGatePassed?: boolean
}

/**
 * Check if issue type creates PRs
 */
export function createsPullRequest(agentType: string): boolean {
  return PR_CREATING_TYPES.includes(agentType)
}

/**
 * Check if issue type is conversation-based
 */
export function isConversationType(agentType: string): boolean {
  return CONVERSATION_TYPES.includes(agentType)
}

/**
 * Get the Mastra agent for an issue type
 */
export function getAgentForIssue(agentType: string): ReturnType<typeof mastra.getAgent> | null {
  const agentName = ISSUE_AGENT_MAP[agentType]
  if (!agentName) {
    console.warn(`[IssueExecutor] No agent mapping for type: "${agentType}"`)
    console.warn(`[IssueExecutor] Available types: ${Object.keys(ISSUE_AGENT_MAP).join(', ')}`)
    return null
  }
  
  console.log(`[IssueExecutor] Mapped "${agentType}" -> agent "${agentName}"`)
  
  try {
    // Cast to any to allow dynamic agent lookup
    const agent = mastra.getAgent(agentName as Parameters<typeof mastra.getAgent>[0])
    console.log(`[IssueExecutor] Successfully retrieved agent: ${agentName}`)
    return agent
  } catch (error) {
    console.error(`[IssueExecutor] Failed to get agent ${agentName}:`, error)
    return null
  }
}

/**
 * Build context-rich prompt for agent based on issue + gathered context.
 * 
 * This prompt is intentionally less prescriptive — the issue description
 * already contains specific instructions (it's AI-generated). We focus on
 * providing rich context so the agent can make informed decisions.
 */
async function buildAgentPrompt(
  issue: {
    id: number
    title: string
    description: string | null
    affectedUrl: string | null
    category: string | null
    agentType: string | null
    brandProfileId: number
    brandProfile: {
      companyName: string | null
      companyWebsite: string | null
      companyDescription: string | null
      companyIndustry: string | null
      companyServices: string | null
    }
  },
  context: {
    pageContent: string | null
    sourceFile: string | null
    sourceFilePath: string | null
    blogContext: string
  }
): Promise<string> {
  const { brandProfile } = issue

  let prompt = `## Issue
**${issue.title}**

${issue.description || 'No additional details.'}

## Brand
- **Company**: ${brandProfile.companyName || 'Unknown'}
- **Website**: ${brandProfile.companyWebsite || 'Unknown'}
- **Industry**: ${brandProfile.companyIndustry || 'Unknown'}
- **Services**: ${brandProfile.companyServices || 'Unknown'}
- **Description**: ${brandProfile.companyDescription || 'No description available'}
`

  // Add page content context
  if (context.pageContent) {
    prompt += `
## Live Page Content (${issue.affectedUrl || brandProfile.companyWebsite})
This is what users currently see on the page. Base your work on this real content.

\`\`\`markdown
${context.pageContent}
\`\`\`
`
  } else if (issue.affectedUrl || brandProfile.companyWebsite) {
    prompt += `
## Page Content
Could not scrape the page at ${issue.affectedUrl || brandProfile.companyWebsite}. It may be a redirect, behind auth, or unreachable.
`
  }

  // Add source file context
  if (context.sourceFile && context.sourceFilePath) {
    prompt += `
## Source File: ${context.sourceFilePath}
This is the current source code of the file that will be modified:

\`\`\`tsx
${context.sourceFile}
\`\`\`
`
  }

  // Add blog context if applicable
  if (context.blogContext) {
    prompt += context.blogContext
  }

  // Minimal output guidance — let the agent be dynamic
  prompt += `
## Output
Provide your solution as a code block. Your output will be inserted into the codebase via an automated PR.
- For JSON-LD: output the JSON object
- For config files (robots.txt, llms.txt, sitemap): output the full file content
- For content/markup: output the targeted snippet
- For structured data: ensure it reflects content actually visible on the page above
`

  return prompt
}

/**
 * Extract JSON-LD schemas from generated code.
 *
 * 1. Looks for <script type="application/ld+json"> blocks (the common case).
 * 2. Falls back to brace-counted extraction for bare JSON objects containing "@context".
 */
function extractJsonLdFromCode(code: string): unknown[] {
  const schemas: unknown[] = []

  // Strategy 1: extract from <script type="application/ld+json"> tags
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let scriptMatch
  while ((scriptMatch = scriptRegex.exec(code)) !== null) {
    const content = (scriptMatch[1] || '').trim()
    if (!content) continue
    try { schemas.push(JSON.parse(content)) } catch { /* skip unparseable */ }
  }

  if (schemas.length > 0) return schemas

  // Strategy 2: brace-counted extraction for raw JSON-LD (e.g. Next.js structured data objects)
  // Find each "@context" occurrence, walk back to the opening brace, then count braces to find the end.
  const contextPattern = /"@context"/g
  let contextMatch
  while ((contextMatch = contextPattern.exec(code)) !== null) {
    // Walk backwards to find the opening brace
    let start = contextMatch.index
    while (start > 0 && code[start] !== '{') start--
    if (code[start] !== '{') continue

    // Walk forwards with brace counting to find the balanced closing brace
    let depth = 0
    let end = start
    let inString = false
    let escaped = false
    while (end < code.length) {
      const ch = code[end]
      if (escaped) { escaped = false; end++; continue }
      if (ch === '\\' && inString) { escaped = true; end++; continue }
      if (ch === '"' && !escaped) { inString = !inString; end++; continue }
      if (!inString) {
        if (ch === '{') depth++
        else if (ch === '}') { depth--; if (depth === 0) break }
      }
      end++
    }

    if (depth === 0) {
      const candidate = code.slice(start, end + 1)
      try {
        const parsed = JSON.parse(candidate)
        if (parsed && typeof parsed === 'object' && parsed['@context']) {
          schemas.push(parsed)
        }
      } catch { /* skip unparseable */ }
    }
  }

  return schemas
}

/**
 * Extract generated content from agent response
 */
function extractGeneratedContent(responseText: string): string {
  // Look for code blocks
  const codeBlockMatch = responseText.match(/```(?:json|html|xml|txt|markdown|md)?\n?([\s\S]*?)```/i)
  if (codeBlockMatch) {
    return sanitizeGeneratedContent(codeBlockMatch[1].trim())
  }
  
  // Look for JSON-LD specifically
  const jsonLdMatch = responseText.match(/\{[\s\S]*"@context"[\s\S]*"@type"[\s\S]*\}/i)
  if (jsonLdMatch) {
    return jsonLdMatch[0].trim()
  }
  
  // Return sanitized full text if no code block found
  return sanitizeGeneratedContent(responseText)
}

/**
 * Sanitize LLM-generated content to remove full-page wrappers.
 * 
 * The LLM sometimes generates an entire HTML page or React component
 * when only a snippet is needed. This strips document-level wrappers
 * and extracts only the meaningful content.
 */
function sanitizeGeneratedContent(content: string): string {
  let cleaned = content.trim()
  
  // If it's pure JSON (e.g. JSON-LD), return as-is
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    try {
      JSON.parse(cleaned)
      return cleaned
    } catch {
      // Not valid JSON, continue cleaning
    }
  }
  
  // If it's a standalone config file (robots.txt, llms.txt, sitemap), return as-is
  if (cleaned.startsWith('User-agent:') || cleaned.startsWith('# ') || cleaned.startsWith('<?xml')) {
    return cleaned
  }
  
  // Detect if LLM wrapped a snippet in a full HTML document
  const hasDoctype = /<!DOCTYPE\s+html>/i.test(cleaned)
  const hasHtmlTag = /<html[\s>]/i.test(cleaned)
  const hasHeadTag = /<head[\s>]/i.test(cleaned)
  const hasBodyTag = /<body[\s>]/i.test(cleaned)
  const isFullPage = (hasDoctype || hasHtmlTag) && (hasHeadTag || hasBodyTag)
  
  if (isFullPage) {
    console.warn('[IssueExecutor] LLM generated a full HTML page — extracting targeted content')
    
    // Extract JSON-LD if present
    const jsonLdScripts = cleaned.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)
    
    // Extract meta tags
    const metaTags = cleaned.match(/<meta[^>]+>/gi)
    
    // Extract content from <main> or <body> (excluding standard nav/header/footer)
    let bodyContent = ''
    const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    if (mainMatch) {
      bodyContent = mainMatch[1].trim()
    } else {
      const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
      if (bodyMatch) {
        bodyContent = bodyMatch[1].trim()
      }
    }
    
    // Strip out header, nav, footer from body content
    bodyContent = bodyContent
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .trim()
    
    // Prioritize: JSON-LD > meta tags > body content
    const parts: string[] = []
    if (jsonLdScripts?.length) parts.push(...jsonLdScripts)
    if (metaTags?.length) {
      // Filter out basic charset/viewport meta tags that already exist
      const meaningfulMeta = metaTags.filter(m => 
        !m.includes('charset=') && !m.includes('viewport')
      )
      if (meaningfulMeta.length) parts.push(meaningfulMeta.join('\n'))
    }
    if (bodyContent && bodyContent.length > 10) parts.push(bodyContent)
    
    if (parts.length > 0) {
      cleaned = parts.join('\n\n')
      console.log(`[IssueExecutor] Extracted ${parts.length} content section(s) from full page`)
    }
  }
  
  // Detect if LLM wrapped a snippet in a full React component definition
  const hasExportDefault = /export\s+default\s+function/i.test(cleaned)
  const hasImportReact = /import\s+.*\bReact\b.*from/i.test(cleaned)
  const isFullComponent = hasExportDefault && (hasImportReact || cleaned.includes('import '))
  
  if (isFullComponent && !cleaned.includes('{children}')) {
    console.warn('[IssueExecutor] LLM generated a full React component — extracting JSX content')
    
    // Extract the JSX from inside the return statement
    const returnMatch = cleaned.match(/return\s*\(([\s\S]*?)\)\s*;?\s*\}\s*$/)
    if (returnMatch) {
      let jsx = returnMatch[1].trim()
      // Strip the outermost wrapper div/fragment if it's just a container
      const outerWrapperMatch = jsx.match(/^<(?:div|>|React\.Fragment)[^>]*>([\s\S]*)<\/(?:div|>|React\.Fragment)>$/)
      if (outerWrapperMatch) {
        jsx = outerWrapperMatch[1].trim()
      }
      if (jsx.length > 20) {
        cleaned = jsx
        console.log(`[IssueExecutor] Extracted JSX content from component (${cleaned.length} chars)`)
      }
    }
  }
  
  return cleaned
}

/**
 * Extract engagement guidance from conversation agent response
 */
function extractEngagementGuidance(responseText: string): { 
  guidance: string
  suggestedResponse?: string 
} {
  // Look for structured sections in the response
  const guidanceMatch = responseText.match(/(?:suggested angle|engagement guidance|how to engage|strategy)[:\s]*([\s\S]*?)(?=\n\n|suggested response|$)/i)
  const responseMatch = responseText.match(/(?:suggested response|draft response|example reply)[:\s]*([\s\S]*?)(?=\n\n|$)/i)
  
  return {
    guidance: guidanceMatch?.[1]?.trim() || responseText.slice(0, 500),
    suggestedResponse: responseMatch?.[1]?.trim()
  }
}

/**
 * Get the appropriate file path for each agent type
 * 
 * File placement logic:
 * - Global content (Organization schema, WebSite schema) → layout.tsx
 * - Page-specific content (Product, FAQ, Article schema) → page.tsx
 * - Meta optimization → page.tsx (each page has its own meta)
 * - Config files (robots, sitemap, llms.txt) → public/
 * - Content restructuring → page.tsx
 * - Navigation → page.tsx (NOT layout - nav is page content)
 */
function getFilePathForAgentType(agentType: string): string {
  const FILE_PATHS: Record<string, string> = {
    // Schema markup - depends on schema type (Organization goes to layout, others to page)
    // Default to page.tsx, GitHub service will analyze content for Organization/WebSite
    'schema_markup': 'app/page.tsx',
    
    // Content structure - always page-specific
    'heading_hierarchy': 'app/page.tsx',
    'content_structure': 'app/page.tsx',
    'faq_sections': 'app/page.tsx',
    
    // Meta optimization - page-specific (each page can have unique meta)
    'meta_optimization': 'app/page.tsx',
    
    // Site config files - these are standalone files in public/
    'site_config': 'public/robots.txt',
    'robots_txt': 'public/robots.txt',
    'sitemap': 'public/sitemap.xml',
    
    // AI visibility files - standalone files
    'llms_txt': 'public/llms.txt',
    'llms_txt_missing': 'public/llms.txt',
    'llms_txt_optimizer': 'public/llms.txt',
    
    // Content optimization - page-specific
    'citation_signals': 'app/page.tsx',
    'ai_content_optimizer': 'app/page.tsx',
    'authority_building': 'app/page.tsx',
    'brand_messaging': 'app/page.tsx',
    
    // Navigation - ALWAYS page-specific, NEVER layout
    'navigation': 'app/page.tsx',
    'nav_optimization': 'app/page.tsx',
    
    // Blog setup - creates new blog directory structure
    'blog_setup': 'app/blog/page.tsx',
    'blog_page_missing': 'app/blog/page.tsx',
    'blog_post_publish': 'app/blog/[slug]/page.tsx',
  }
  
  return FILE_PATHS[agentType] || 'app/page.tsx'
}

// ─── Production Eval Scoring ─────────────────────────────────────────────────

/** Timeout for the entire scoring phase (all 4 scorers in parallel) */
const SCORING_TIMEOUT_MS = 60_000

interface ScoringResult {
  hallucination?: number
  faithfulness?: number
  relevancy?: number
  alignment?: number
  details: Record<string, { score: number; reason: string }>
}

/**
 * Run all eval scorers against a generated output in production.
 * 
 * Constructs ScorerRunInputForAgent / ScorerRunOutputForAgent from raw strings
 * to match the prebuilt scorer type signatures.
 * Runs scorers in parallel with a timeout. Individual scorer failures
 * are logged but don't fail the overall execution.
 * Returns partial results if some scorers fail/timeout.
 */
async function runProductionScoring(
  prompt: string,
  generatedCode: string,
): Promise<ScoringResult> {
  const result: ScoringResult = { details: {} }

  // Convert raw strings to the message format expected by prebuilt scorers
  const now = new Date()
  const inputForScorer: ScorerRunInputForAgent = {
    inputMessages: [{
      id: `eval-input-${Date.now()}`,
      role: 'user' as const,
      content: {
        format: 2 as const,
        parts: [{ type: 'text' as const, text: prompt }],
      },
      createdAt: now,
    }],
    rememberedMessages: [],
    systemMessages: [],
    taggedSystemMessages: {},
  }
  const outputForScorer: ScorerRunOutputForAgent = [{
    id: `eval-output-${Date.now()}`,
    role: 'assistant' as const,
    content: {
      format: 2 as const,
      parts: [{ type: 'text' as const, text: generatedCode }],
    },
    createdAt: now,
  }]

  const scorers = [
    { key: 'hallucination', scorer: hallucinationScorer, field: 'hallucination' as const },
    { key: 'faithfulness', scorer: faithfulnessScorer, field: 'faithfulness' as const },
    { key: 'relevancy', scorer: relevancyScorer, field: 'relevancy' as const },
    { key: 'alignment', scorer: promptAlignmentScorer, field: 'alignment' as const },
  ]

  const scorerPromises = scorers.map(async ({ key, scorer, field }) => {
    try {
      const scorerResult = await scorer.run({
        input: inputForScorer,
        output: outputForScorer,
      })
      const score = typeof scorerResult.score === 'number' ? scorerResult.score : NaN
      const reason = scorerResult.reason || ''
      if (!isNaN(score)) {
        result[field] = score
        result.details[key] = { score, reason }
      }
      console.log(`[IssueExecutor] Eval ${key}: ${score.toFixed(3)} — ${reason.slice(0, 120)}`)
    } catch (err) {
      console.warn(`[IssueExecutor] Scorer "${key}" failed:`, err instanceof Error ? err.message : err)
    }
  })

  try {
    await Promise.race([
      Promise.allSettled(scorerPromises),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Scoring phase timed out')), SCORING_TIMEOUT_MS)
      ),
    ])
  } catch {
    console.warn(`[IssueExecutor] Scoring phase timed out after ${SCORING_TIMEOUT_MS / 1000}s — returning partial results`)
  }

  return result
}

// ─── Composite Score ─────────────────────────────────────────────────────────

const COMPOSITE_WEIGHTS = {
  faithfulness: 0.35,
  hallucination: 0.35, // inverted: (1 - score)
  relevancy: 0.15,
  alignment: 0.15,
} as const

/**
 * Calculate weighted composite quality score (0-100).
 * Hallucination is inverted since lower is better.
 * Requires at least faithfulness + hallucination for a meaningful score.
 */
function calculateCompositeScore(scores: ScoringResult): number | null {
  const { faithfulness, hallucination } = scores
  if (faithfulness == null || hallucination == null) return null

  const weighted =
    faithfulness * COMPOSITE_WEIGHTS.faithfulness +
    (1 - hallucination) * COMPOSITE_WEIGHTS.hallucination +
    (scores.relevancy ?? 0) * COMPOSITE_WEIGHTS.relevancy +
    (scores.alignment ?? 0) * COMPOSITE_WEIGHTS.alignment

  return Math.round(weighted * 100 * 100) / 100 // 0-100, 2 decimal places
}

// ─── Eval Caching ────────────────────────────────────────────────────────────

/**
 * Compute SHA256 hash of prompt + generated code for eval caching.
 */
function computeEvalContentHash(prompt: string, generatedCode: string): string {
  return createHash('sha256')
    .update(prompt)
    .update('||')
    .update(generatedCode)
    .digest('hex')
}

/**
 * Check if we've already scored this exact content.
 * Returns cached scores if a matching hash is found from the last 24 hours.
 */
async function getCachedScores(contentHash: string, currentIssueId: number): Promise<ScoringResult | null> {
  try {
    const cached = await prisma.issue.findFirst({
      where: {
        evalContentHash: contentHash,
        id: { not: currentIssueId },
        AND: [
          { evalScoredAt: { not: null } },
          { evalScoredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        ],
      },
      select: {
        evalHallucinationScore: true,
        evalFaithfulnessScore: true,
        evalRelevancyScore: true,
        evalAlignmentScore: true,
        evalScores: true,
      },
    })

    if (!cached || cached.evalScores == null) return null

    console.log(`[IssueExecutor] Cache HIT for content hash ${contentHash.slice(0, 12)}...`)
    return {
      hallucination: cached.evalHallucinationScore ?? undefined,
      faithfulness: cached.evalFaithfulnessScore ?? undefined,
      relevancy: cached.evalRelevancyScore ?? undefined,
      alignment: cached.evalAlignmentScore ?? undefined,
      details: (cached.evalScores as Record<string, { score: number; reason: string }>) ?? {},
    }
  } catch (err) {
    console.warn(`[IssueExecutor] Cache lookup failed:`, err instanceof Error ? err.message : err)
    return null
  }
}

// ─── Quality Gate ────────────────────────────────────────────────────────────

interface QualityGateResult {
  passed: boolean
  failures: Array<{
    scorer: string
    actual: number
    threshold: number
    direction: 'above' | 'below'
    reason: string
  }>
}

/**
 * Check if eval scores meet quality thresholds.
 */
function checkQualityGate(scores: ScoringResult): QualityGateResult {
  const failures: QualityGateResult['failures'] = []

  if (scores.faithfulness != null && scores.faithfulness < QUALITY_THRESHOLDS.minFaithfulness) {
    failures.push({
      scorer: 'faithfulness',
      actual: scores.faithfulness,
      threshold: QUALITY_THRESHOLDS.minFaithfulness,
      direction: 'below',
      reason: scores.details['faithfulness']?.reason || 'Score below threshold',
    })
  }

  if (scores.hallucination != null && scores.hallucination > QUALITY_THRESHOLDS.maxHallucination) {
    failures.push({
      scorer: 'hallucination',
      actual: scores.hallucination,
      threshold: QUALITY_THRESHOLDS.maxHallucination,
      direction: 'above',
      reason: scores.details['hallucination']?.reason || 'Score above threshold',
    })
  }

  if (scores.relevancy != null && scores.relevancy < QUALITY_THRESHOLDS.minRelevancy) {
    failures.push({
      scorer: 'relevancy',
      actual: scores.relevancy,
      threshold: QUALITY_THRESHOLDS.minRelevancy,
      direction: 'below',
      reason: scores.details['relevancy']?.reason || 'Score below threshold',
    })
  }

  if (scores.alignment != null && scores.alignment < QUALITY_THRESHOLDS.minAlignment) {
    failures.push({
      scorer: 'alignment',
      actual: scores.alignment,
      threshold: QUALITY_THRESHOLDS.minAlignment,
      direction: 'below',
      reason: scores.details['alignment']?.reason || 'Score below threshold',
    })
  }

  return { passed: failures.length === 0, failures }
}

/**
 * Format quality gate failures into a prompt section for the next retry.
 * Feeds scorer reasons directly into the agent so it knows what went wrong.
 */
function formatScorerFeedbackForPrompt(gate: QualityGateResult, retryNumber: number): string {
  if (gate.passed || gate.failures.length === 0) return ''

  const lines = gate.failures.map(f => {
    const direction = f.direction === 'above'
      ? `too high (${f.actual.toFixed(3)} > ${f.threshold})`
      : `too low (${f.actual.toFixed(3)} < ${f.threshold})`
    return `- **${f.scorer}** scorer: ${direction}\n  Reason: ${f.reason}`
  })

  return `

## Quality Gate Failure (Retry ${retryNumber})
The previous output was evaluated by automated quality scorers and FAILED the quality gate.
You MUST address each issue listed below:

${lines.join('\n\n')}

Generate an improved version that specifically addresses all the quality concerns above.
Do NOT fabricate information. Only use facts from the page content and brand context provided.
`
}

/**
 * Format schema verification failures into a prompt section for the next retry.
 * Feeds verifier errors directly into the agent so it can correct schema output.
 */
function formatSchemaVerificationFeedbackForPrompt(errors: string[], retryNumber: number): string {
  if (errors.length === 0) return ''

  const lines = errors.map(error => `- ${error}`)

  return `

## Schema Verification Failure (Retry ${retryNumber})
The previous output failed schema verification. You MUST fix each error below:

${lines.join('\n')}

Return corrected schema markup that stays grounded in visible page content.
`
}

/**
 * Execute an agent to resolve an issue.
 *
 * Flow:
 * 1. Gather context (scrape page, fetch source file, check existing files)
 * 2. Build a context-rich prompt from issue + gathered context
 * 3. OUTER LOOP (quality retries):
 *    a. INNER LOOP (generate → review → refine, up to MAX_REVIEW_ITERATIONS)
 *    b. Score the output with Mastra eval scorers (with cache check)
 *    c. Check quality gate + schema verification (for schema agents)
 *    d. If checks fail, feed feedback into next retry
 * 4. Create PR (draft if quality gate failed on final retry)
 * 5. Persist scores async, send notification if quality gate failed
 */
export async function executeIssueAgent(issueId: number): Promise<ExecutionResult> {
  console.log(`[IssueExecutor] Starting execution for issue ${issueId}`)
  
  // 1. Get issue with brand profile
  console.log(`[IssueExecutor] Fetching issue from database...`)
  let issue
  try {
    issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        brandProfile: {
          select: {
            id: true,
            userId: true,
            companyName: true,
            companyWebsite: true,
            companyDescription: true,
            companyIndustry: true,
            companyServices: true
          }
        }
      }
    })
    console.log(`[IssueExecutor] Issue fetched: ${issue ? 'found' : 'not found'}`)
  } catch (dbError) {
    console.error(`[IssueExecutor] Database error fetching issue:`, dbError)
    return { success: false, error: `Database error: ${dbError instanceof Error ? dbError.message : 'Unknown'}` }
  }
  
  if (!issue) {
    return { success: false, error: 'Issue not found' }
  }
  
  if (!issue.brandProfile) {
    return { success: false, error: 'Brand profile not found' }
  }
  
  console.log(`[IssueExecutor] Issue "${issue.title}" found with brand "${issue.brandProfile.companyName}"`)
  
  // 2. Update status to in_progress
  try {
    await Promise.race([
      prisma.issue.update({
        where: { id: issueId },
        data: { status: 'in_progress' }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Status update timed out after 10s')), 10_000)
      )
    ])
  } catch (updateError) {
    console.error(`[IssueExecutor] Failed to update status:`, updateError)
  }
  
  try {
    const agentType = issue.agentType || 'schema_markup'
    const agentStartTime = Date.now()
    
    // 3. CONTEXT ENRICHMENT PHASE
    console.log(`[IssueExecutor] Gathering context for issue...`)
    const context = await gatherIssueContext({
      affectedUrl: issue.affectedUrl,
      agentType: issue.agentType,
      brandProfileId: issue.brandProfileId,
      brandProfile: issue.brandProfile,
    })
    console.log(`[IssueExecutor] Context gathered: pageContent=${!!context.pageContent}, sourceFile=${!!context.sourceFile}`)
    
    // Pre-flight check for API keys
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY
    if (!hasAnthropicKey && !process.env.OPENAI_API_KEY) {
      throw new Error('No LLM API keys configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.')
    }

    // Handle conversation types (no iterative review needed)
    if (isConversationType(agentType)) {
      return await handleConversationIssue(issue, agentType, context)
    }

    // 4. OUTER QUALITY GATE LOOP
    const basePrompt = await buildAgentPrompt({
      ...issue,
      brandProfile: issue.brandProfile
    }, context)

    // Build system prompt — schema agents get KB-grounded instructions
    let systemPrompt: string
    if (isSchemaAgentType(agentType)) {
      const issueText = `${issue.title} ${issue.description || ''}`
      const schemaKb = await readSchemaKnowledge(issueText)
      systemPrompt = `You are an expert Schema.org JSON-LD markup architect. You generate production-ready structured data that will be committed to the user's repository via an automated PR.

GROUNDING RULE: Only generate schema properties for data that actually exists on the page. Never fabricate URLs, ratings, prices, dates, authors, or any property values. If a property's value cannot be determined from the page content, omit it.

You will be given:
- The issue to fix (already contains specific instructions)
- The live page content (what users see)
- The current source code of the target file
- A schema knowledge base with required/recommended properties, examples, and restrictions

Use the knowledge base below as your authoritative reference for which properties to include, their types, and validation rules. Base all property values on actual page content.

${schemaKb}`
    } else if (agentType === 'faq_sections') {
      const pageType = parsePageTypeFromDescription(issue.description) || 'home'
      const faqKb = await readFaqTemplates(pageType)

      const framework = detectFrameworkFromContext(context.sourceFilePath, context.sourceFile)

      systemPrompt = `You are an FAQ content specialist. You generate page-type-aware FAQ sections that will be committed to the user's repository via an automated PR.

GROUNDING RULE: Only generate FAQ questions that a real visitor to this page would ask. Pull answers exclusively from visible page content. Never fabricate data, pricing, features, or capabilities not present on the page.

FRONTEND RULES:
- You are generating code for a **${framework}** project
- MATCH the existing code style in the source file: same CSS approach, same component patterns, same naming conventions
- If the source file uses Tailwind classes, use Tailwind for your FAQ section
- If it uses CSS modules or styled-components, follow that pattern
- If it uses plain HTML with inline styles or custom classes, match those
- For React/Next.js (TSX/JSX): output JSX (className, htmlFor, self-closing tags, no HTML comments)
- For plain HTML: output standard HTML
- For Astro: output HTML (Astro components use HTML syntax)
- NEVER introduce a new CSS framework or styling library
- NEVER use generic class names like "faq-section" if the existing code uses a different naming pattern
- Wrap FAQ in a semantic <section> with an id="faq" for anchor linking

CONSTRAINTS:
- Generate exactly 3–5 Q&As
- Keep each answer to 1–3 sentences, directly quotable
- Questions must reflect what the ICP would ask on THIS page type
- Start answers with a direct response (no preamble)

You will be given:
- The issue to fix (already contains specific instructions)
- The live page content (what users see)
- The current source code of the target file
- FAQ generation templates for this page type

Use the templates below as guidance for what kinds of questions to generate. Adapt them to the actual page content.

${faqKb}`
    } else {
      systemPrompt = `You are a GEO (Generative Engine Optimization) code generation agent. You generate code that will be committed to the user's repository via an automated PR.

You will be given:
- The issue to fix (already contains specific instructions)
- The live page content (what users see)
- The current source code of the target file

Use this context to produce accurate, targeted code. Base structured data on actual page content. Your output will be inserted into the existing codebase.`
    }

    let currentCode = ''
    let finalFilePath = resolveSourceFilePath(agentType, issue.affectedUrl)
    let lastReview: ReviewResult | null = null
    let evalScores: ScoringResult | undefined
    let qualityGatePassed: boolean | null = null
    let qualityRetryCount = 0
    let qualityGateResult: QualityGateResult | undefined
    let scorerFeedback = '' // accumulated from quality gate failures
    let schemaVerificationFeedback = '' // accumulated from schema verification failures

    for (let qualityRetry = 0; qualityRetry <= MAX_QUALITY_RETRIES; qualityRetry++) {
      qualityRetryCount = qualityRetry

      if (qualityRetry > 0) {
        console.log(`[IssueExecutor] === QUALITY RETRY ${qualityRetry}/${MAX_QUALITY_RETRIES} ===`)
      }

      // ── Inner generate→review→refine loop ──
      for (let iteration = 1; iteration <= MAX_REVIEW_ITERATIONS; iteration++) {
        console.log(`[IssueExecutor] === Iteration ${iteration}/${MAX_REVIEW_ITERATIONS} (quality retry ${qualityRetry}) ===`)

        // Build the prompt — include retry feedback + reviewer feedback on inner iterations
        let iterationPrompt = basePrompt + scorerFeedback + schemaVerificationFeedback
        if (iteration > 1 && lastReview) {
          const feedback = [
            ...lastReview.warnings.map(w => `- ${w}`),
            lastReview.reasoning ? `Reviewer reasoning: ${lastReview.reasoning}` : '',
            lastReview.suggestedFile && lastReview.suggestedFile !== finalFilePath
              ? `Reviewer suggests placing code in: ${lastReview.suggestedFile}`
              : '',
          ].filter(Boolean).join('\n')

          iterationPrompt = `${iterationPrompt}

## Reviewer Feedback (Iteration ${iteration - 1})
The previous output was reviewed and needs changes:

${feedback}

Previous output:
\`\`\`
${currentCode.slice(0, 2000)}
\`\`\`

Please generate an improved version addressing all the feedback above.`
        }

        // Generate
        console.log(`[IssueExecutor] Generating code (iteration ${iteration})...`)
        const responseText = await withTimeout(
          callAnthropicDirect(iterationPrompt, systemPrompt),
          AGENT_TIMEOUT_MS,
          `Anthropic API call timed out after ${AGENT_TIMEOUT_MS / 1000}s`
        )

        if (!responseText) throw new Error('Agent returned empty response')

        currentCode = extractGeneratedContent(responseText)
        console.log(`[IssueExecutor] Generated ${currentCode.length} chars`)

        // Review
        console.log(`[IssueExecutor] Reviewing generated code...`)
        try {
          lastReview = await reviewGeneratedContent({
            generatedCode: currentCode,
            issueTitle: issue.title,
            issueDescription: issue.description || '',
            agentType,
            targetFile: finalFilePath,
            companyName: issue.brandProfile.companyName || '',
            websiteUrl: issue.brandProfile.companyWebsite || ''
          })

          if (lastReview.suggestedFile && lastReview.suggestedFile !== finalFilePath) {
            console.log(`[IssueExecutor] Reviewer suggests file: ${lastReview.suggestedFile}`)
            finalFilePath = lastReview.suggestedFile
          }

          if (lastReview.improvedCode) {
            currentCode = lastReview.improvedCode
          }

          const criticalWarnings = lastReview.warnings.filter(w => w.startsWith('CRITICAL'))
          if (criticalWarnings.length === 0) {
            console.log(`[IssueExecutor] Reviewer approved on iteration ${iteration}`)
            break
          }

          console.log(`[IssueExecutor] Reviewer has ${criticalWarnings.length} critical warning(s), refining...`)

          if (iteration === MAX_REVIEW_ITERATIONS) {
            console.warn(`[IssueExecutor] Max inner iterations reached`)
          }
        } catch (reviewError) {
          console.error(`[IssueExecutor] Review failed, using current code:`, reviewError)
          break
        }
      }

      // ── Scoring (with cache check) ──
      const contentHash = computeEvalContentHash(basePrompt, currentCode)

      const cachedScores = await getCachedScores(contentHash, issueId)
      if (cachedScores) {
        evalScores = cachedScores
        console.log(`[IssueExecutor] Using cached eval scores`)
      } else {
        try {
          console.log(`[IssueExecutor] Running production eval scoring...`)
          evalScores = await runProductionScoring(basePrompt, currentCode)
          const scoreCount = Object.keys(evalScores.details).length
          console.log(`[IssueExecutor] Eval scoring complete: ${scoreCount}/4 scorers returned results`)
        } catch (scoringError) {
          console.warn(`[IssueExecutor] Scoring failed:`, scoringError instanceof Error ? scoringError.message : scoringError)
          break // Can't check quality gate without scores
        }
      }

      const compositeScore = calculateCompositeScore(evalScores)

      // Persist scores + hash + composite immediately
      await prisma.issue.update({
        where: { id: issueId },
        data: {
          evalHallucinationScore: evalScores.hallucination ?? null,
          evalFaithfulnessScore: evalScores.faithfulness ?? null,
          evalRelevancyScore: evalScores.relevancy ?? null,
          evalAlignmentScore: evalScores.alignment ?? null,
          evalScores: evalScores.details as object,
          evalScoredAt: new Date(),
          evalContentHash: contentHash,
          evalCompositeScore: compositeScore,
          evalQualityRetries: qualityRetryCount,
        },
      })

      // ── Quality gate check ──
      qualityGateResult = checkQualityGate(evalScores)
      qualityGatePassed = qualityGateResult.passed

      // ── Schema verification check (schema agents only) ──
      let schemaVerificationPassed = true
      let schemaVerificationErrors: string[] = []

      if (isSchemaAgentType(agentType)) {
        try {
          const { verifyInjectedSchemas } = await import('@/lib/analysis/technical/schema-verifier')
          const { htmlToExtraction } = await import('@/lib/analysis/technical/dom-extractor')

          // Parse JSON-LD blocks from generated code
          const schemas = extractJsonLdFromCode(currentCode)
          if (schemas.length > 0) {
            // Build minimal extraction from page content if available
            const targetUrl = issue.affectedUrl || issue.brandProfile.companyWebsite || '/'
            const minimalHtml = context.pageContent
              ? `<html><head><title>${issue.brandProfile.companyName || ''}</title></head><body>${context.pageContent}</body></html>`
              : '<html><head></head><body></body></html>'
            const extraction = htmlToExtraction(minimalHtml, targetUrl)

            const verification = verifyInjectedSchemas(schemas, extraction.extraction, targetUrl)

            const errors = verification.warnings.filter(w => w.severity === 'error')
            if (errors.length > 0) {
              schemaVerificationPassed = false
              schemaVerificationErrors = errors.map(error => error.message)
              console.error(`[IssueExecutor] Schema verification failed with ${errors.length} error(s):`, schemaVerificationErrors.join('; '))
            }

            const warningsOnly = verification.warnings.filter(w => w.severity === 'warning')
            if (warningsOnly.length > 0) {
              console.warn(`[IssueExecutor] Schema verification warnings: ${warningsOnly.map(w => w.message).join('; ')}`)
            }
          }
        } catch (verifyError) {
          console.warn('[IssueExecutor] Schema verification skipped:', verifyError instanceof Error ? verifyError.message : verifyError)
        }
      }

      if (qualityGateResult.passed && schemaVerificationPassed) {
        console.log(`[IssueExecutor] Quality gate PASSED on retry ${qualityRetry} (composite: ${compositeScore?.toFixed(1) ?? 'N/A'})`)
        break
      }

      if (!qualityGateResult.passed) {
        console.log(`[IssueExecutor] Quality gate FAILED with ${qualityGateResult.failures.length} failure(s)`)
      }
      if (!schemaVerificationPassed) {
        console.log(`[IssueExecutor] Schema verification FAILED with ${schemaVerificationErrors.length} error(s)`)
      }

      if (qualityRetry < MAX_QUALITY_RETRIES) {
        scorerFeedback = qualityGateResult.passed
          ? ''
          : formatScorerFeedbackForPrompt(qualityGateResult, qualityRetry + 1)
        schemaVerificationFeedback = schemaVerificationPassed
          ? ''
          : formatSchemaVerificationFeedbackForPrompt(schemaVerificationErrors, qualityRetry + 1)
        lastReview = null // Reset reviewer state for next outer iteration
      } else {
        if (!schemaVerificationPassed) {
          throw new Error(`Schema verification failed: ${schemaVerificationErrors.join('; ')}`)
        }
        console.warn(`[IssueExecutor] Quality gate failed on final retry — proceeding with draft PR`)
      }
    }

    // Persist final quality gate status
    await prisma.issue.update({
      where: { id: issueId },
      data: {
        evalQualityGatePassed: qualityGatePassed,
        evalQualityRetries: qualityRetryCount,
        evalQualityGateDetails: qualityGateResult ? {
          passed: qualityGateResult.passed,
          failures: qualityGateResult.failures,
        } as object : undefined,
      },
    })

    // 5. Blog-specific early exit check
    if ((agentType === 'blog_setup' || agentType === 'blog_page_missing') && currentCode) {
      try {
        const parsed = JSON.parse(currentCode)
        if (parsed.blogCheck?.found === true && (!parsed.filesToCreate || parsed.filesToCreate.length === 0)) {
          console.log(`[IssueExecutor] Blog already exists — skipping PR creation`)
          await prisma.issue.update({
            where: { id: issueId },
            data: { status: 'merged', generatedOutput: currentCode, outputType: 'code' },
          })
          return { success: true, generatedContent: parsed.integrationGuide || 'Blog already set up.' }
        }
      } catch {
        // Not JSON, proceed normally
      }
    }

    // 6. Validate with E2B if needed
    let e2bValidation: SandboxResult<SchemaValidationResult> | undefined
    let faqValidation: SandboxResult<FaqValidationResult> | undefined
    if (requiresE2bValidation(agentType)) {
      console.log(`[IssueExecutor] Running E2B validation for ${agentType}`)

      if (agentType === 'faq_sections') {
        faqValidation = await validateFaqInSandbox(currentCode)
        await prisma.issue.update({
          where: { id: issueId },
          data: {
            usedE2bSandbox: true,
            e2bSandboxId: faqValidation.sandboxId,
            e2bExecutionMs: faqValidation.executionMs,
            e2bValidationResult: faqValidation.data as object || null
          }
        })
        if (!faqValidation.success) throw new Error(`E2B FAQ validation failed: ${faqValidation.error}`)
        if (faqValidation.data && !faqValidation.data.valid) {
          throw new Error(`FAQ validation failed: ${faqValidation.data.errors.join(', ')}`)
        }
        console.log(`[IssueExecutor] FAQ validation passed in ${faqValidation.executionMs}ms (${faqValidation.data?.faqCount ?? 0} Q&As)`)
      } else {
        e2bValidation = await validateSchemaInSandbox(currentCode)
        await prisma.issue.update({
          where: { id: issueId },
          data: {
            usedE2bSandbox: true,
            e2bSandboxId: e2bValidation.sandboxId,
            e2bExecutionMs: e2bValidation.executionMs,
            e2bValidationResult: e2bValidation.data as object || null
          }
        })
        if (!e2bValidation.success) throw new Error(`E2B validation failed: ${e2bValidation.error}`)
        if (e2bValidation.data && !e2bValidation.data.valid) {
          throw new Error(`Schema validation failed: ${e2bValidation.data.errors.join(', ')}`)
        }
        console.log(`[IssueExecutor] E2B validation passed in ${e2bValidation.executionMs}ms`)
      }
    }

    // 7. Create PR (draft if quality gate failed)
    let prUrl: string | undefined
    let prNumber: number | undefined
    const isDraftDueToQuality = qualityGatePassed === false
    const compositeScore = evalScores ? calculateCompositeScore(evalScores) : null

    if (createsPullRequest(agentType)) {
      console.log(`[IssueExecutor] Creating PR for issue ${issueId}${isDraftDueToQuality ? ' (DRAFT - quality gate failed)' : ''}`)
      try {
        const qualityWarning = isDraftDueToQuality && qualityGateResult
          ? `\n\n## Warning: Quality Gate Failed\nThis PR was created as a **draft** because automated quality scoring did not meet thresholds.\n${qualityGateResult.failures.map(f => `- **${f.scorer}**: ${f.actual.toFixed(3)} (threshold: ${f.threshold})`).join('\n')}\n\nComposite score: ${compositeScore?.toFixed(1) ?? 'N/A'}/100\n\nPlease review carefully before merging.`
          : ''

        const prResult = await createOptimizationPR({
          brandProfileId: issue.brandProfileId,
          pageUrl: issue.affectedUrl || issue.brandProfile.companyWebsite || '/',
          improvements: [{
            type: agentType,
            description: issue.title,
            code: currentCode,
            impact: issue.estimatedImpact || 'medium',
            filePath: finalFilePath
          }],
          title: `[Mudra] ${issue.title}`,
          description: `## Issue\n${issue.description || issue.title}\n\n## Generated by\nMudra AI Agent: ${agentType}\n\n## Estimated Impact\n${issue.estimatedImpact || 'Improved AI visibility'}${e2bValidation ? `\n\n## E2B Validation\n Validated in ${e2bValidation.executionMs}ms` : ''}${evalScores ? `\n\n## Eval Scores\n| Scorer | Score |\n|--------|-------|\n${evalScores.hallucination != null ? `| Hallucination | ${evalScores.hallucination.toFixed(3)} |\n` : ''}${evalScores.faithfulness != null ? `| Faithfulness | ${evalScores.faithfulness.toFixed(3)} |\n` : ''}${evalScores.relevancy != null ? `| Relevancy | ${evalScores.relevancy.toFixed(3)} |\n` : ''}${evalScores.alignment != null ? `| Alignment | ${evalScores.alignment.toFixed(3)} |\n` : ''}${compositeScore != null ? `| **Composite** | **${compositeScore.toFixed(1)}/100** |\n` : ''}` : ''}${lastReview?.warnings.length ? `\n\n## Review Notes\n${lastReview.warnings.map(w => `- ${w}`).join('\n')}` : ''}${lastReview?.reasoning ? `\n\n**Placement:** ${lastReview.reasoning}` : ''}${qualityWarning}\n`,
          issueTitle: issue.title,
          draft: isDraftDueToQuality,
          labels: isDraftDueToQuality ? ['quality-gate-failed'] : undefined,
        })
        prUrl = prResult.prUrl
        prNumber = prResult.prNumber
        console.log(`[IssueExecutor] PR created: ${prUrl}`)
      } catch (prError) {
        console.error(`[IssueExecutor] PR creation failed:`, prError)
      }

      await prisma.issue.update({
        where: { id: issueId },
        data: {
          status: 'completed',
          prUrl,
          prNumber,
          prStatus: prUrl ? 'open' : undefined,
          generatedOutput: currentCode,
          outputType: 'code'
        }
      })
    } else {
      await prisma.issue.update({
        where: { id: issueId },
        data: { status: 'completed' }
      })
    }

    // 8. Send notification if quality gate failed (fire-and-forget)
    const ownerUserId = issue.brandProfile.userId
    if (isDraftDueToQuality && ownerUserId) {
      import('@/lib/services/notification.service').then(({ createNotification }) =>
        createNotification({
          userId: ownerUserId,
          brandProfileId: issue.brandProfileId,
          type: 'warning',
          category: 'agent_quality_alert',
          title: `Quality check failed: ${issue.title}`,
          message: `The generated code for "${issue.title}" did not pass automated quality checks (score: ${compositeScore?.toFixed(1) ?? 'N/A'}/100). ${prUrl ? 'A draft PR was created for review.' : 'Please review manually.'}`,
          actionUrl: prUrl,
          metadata: {
            issueId,
            prUrl,
            prNumber,
            compositeScore,
            failures: qualityGateResult?.failures,
          } as Record<string, unknown>,
        })
      ).catch(err => console.warn('[IssueExecutor] Failed to send quality alert:', err))
    }

    const totalDuration = Date.now() - agentStartTime
    console.log(`[IssueExecutor] Issue ${issueId} completed in ${totalDuration}ms (qualityGate: ${qualityGatePassed ?? 'no scores'})`)

    return {
      success: true,
      prUrl,
      prNumber,
      generatedContent: currentCode,
      e2bValidation,
      faqValidation,
      evalScores: evalScores ? {
        hallucination: evalScores.hallucination,
        faithfulness: evalScores.faithfulness,
        relevancy: evalScores.relevancy,
        alignment: evalScores.alignment,
        compositeScore: compositeScore ?? undefined,
        details: evalScores.details,
      } : undefined,
      qualityGatePassed: qualityGatePassed ?? undefined,
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[IssueExecutor] Error executing issue ${issueId}:`, errorMessage)
    if (error instanceof Error && error.stack) {
      console.error(`[IssueExecutor] Stack trace:`, error.stack)
    }

    await prisma.issue.update({
      where: { id: issueId },
      data: { status: 'failed' }
    })

    return { success: false, error: errorMessage }
  }
}

/**
 * Handle conversation-type issues (Reddit/social engagement).
 * These don't need iterative review — just generate guidance.
 */
async function handleConversationIssue(
  issue: { id: number; title: string; description: string | null; affectedUrl: string | null; brandProfileId: number; brandProfile: { companyName: string | null; companyWebsite: string | null; companyDescription: string | null; companyIndustry: string | null; companyServices: string | null } },
  agentType: string,
  context: { pageContent: string | null; sourceFile: string | null; sourceFilePath: string | null; blogContext: string }
): Promise<ExecutionResult> {
  console.log(`[IssueExecutor] Processing conversation issue ${issue.id}`)

  const prompt = await buildAgentPrompt({ ...issue, brandProfile: issue.brandProfile, agentType, category: null }, context)
  const responseText = await withTimeout(
    callAnthropicDirect(prompt),
    AGENT_TIMEOUT_MS,
    `Anthropic API call timed out after ${AGENT_TIMEOUT_MS / 1000}s`
  )

  const generatedContent = extractGeneratedContent(responseText)
  const guidance = extractEngagementGuidance(responseText)

  await prisma.issue.update({
    where: { id: issue.id },
    data: {
      status: 'completed',
      generatedOutput: generatedContent,
      outputType: 'guidance',
      description: `${issue.description || ''}\n\n---\n**Engagement Guidance:**\n${guidance.guidance}\n\n**Suggested Response:**\n${guidance.suggestedResponse || 'See guidance above'}`
    }
  })

  return {
    success: true,
    generatedContent,
    conversationUrl: issue.affectedUrl || undefined,
    engagementGuidance: guidance.guidance,
    suggestedResponse: guidance.suggestedResponse,
  }
}

/**
 * Retry a failed issue execution
 */
export async function retryIssueExecution(issueId: number): Promise<ExecutionResult> {
  // Reset any error state and try again
  await prisma.issue.update({
    where: { id: issueId },
    data: {
      status: 'identified',
      usedE2bSandbox: false,
      e2bSandboxId: null,
      e2bExecutionMs: null,
      e2bValidationResult: undefined,
      evalHallucinationScore: null,
      evalFaithfulnessScore: null,
      evalRelevancyScore: null,
      evalAlignmentScore: null,
      evalScores: undefined,
      evalScoredAt: null,
      evalCompositeScore: null,
      evalContentHash: null,
      evalQualityGatePassed: null,
      evalQualityRetries: 0,
      evalQualityGateDetails: undefined,
      userFeedbackScore: null,
      userFeedbackNotes: null,
      userReviewedAt: null,
    }
  })
  
  return executeIssueAgent(issueId)
}

/**
 * Get execution status for an issue
 */
export async function getIssueExecutionStatus(issueId: number) {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: {
      id: true,
      status: true,
      prUrl: true,
      prNumber: true,
      prStatus: true,
      usedE2bSandbox: true,
      e2bSandboxId: true,
      e2bExecutionMs: true,
      e2bValidationResult: true,
      evalHallucinationScore: true,
      evalFaithfulnessScore: true,
      evalRelevancyScore: true,
      evalAlignmentScore: true,
      evalScores: true,
      evalScoredAt: true,
      evalCompositeScore: true,
      evalContentHash: true,
      evalQualityGatePassed: true,
      evalQualityRetries: true,
      evalQualityGateDetails: true,
      userFeedbackScore: true,
      userFeedbackNotes: true,
      userReviewedAt: true,
      deployedAgent: {
        select: {
          id: true,
          status: true,
          agentName: true
        }
      }
    }
  })
  
  return issue
}
