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
import OpenAI from 'openai'
import {
  validateSchemaInSandbox,
  validateFaqInSandbox,
  requiresE2bValidation,
  type SandboxResult,
  type SchemaValidationResult,
  type FaqValidationResult
} from './e2b-sandbox.service'
import {
  createOptimizationPR,
  checkExistingBlogFiles,
  getRepoStructure,
  mapUrlToFile,
  getValidGitHubToken,
  type RepoStructure,
  type ContentType,
} from './github.service'
import { reviewGeneratedContent, type ReviewResult } from './pr-review.service'
import { getFirecrawlClient } from '@/mastra/tools/firecrawl-client'
import { scrapeFaqContext, scrapePageContent } from './page-scrape-context.service'
import {
  hallucinationScorer,
  faithfulnessScorer,
  relevancyScorer,
  promptAlignmentScorer,
  EVAL_MODEL,
} from '@/mastra/evals'
import { createFaithfulnessScorer } from '@mastra/evals/scorers/prebuilt'
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

// Direct OpenAI client for schema injection agent (GPT-5.2 high reasoning)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Call OpenAI GPT-5.2 directly with high reasoning effort
 */
async function callOpenAIDirect(prompt: string, systemPrompt?: string): Promise<string> {
  console.log(`[IssueExecutor] Using direct OpenAI API call (gpt-5.2, reasoning: high)...`)
  console.log(`[IssueExecutor] OpenAI API key present: ${!!process.env.OPENAI_API_KEY}`)
  console.log(`[IssueExecutor] Prompt length: ${prompt.length} chars`)

  try {
    const startTime = Date.now()
    console.log(`[IssueExecutor] API call starting at ${new Date().toISOString()}`)

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      max_completion_tokens: 16384,
      reasoning_effort: 'high',
      messages,
    })

    const elapsed = Date.now() - startTime
    const choice = response.choices[0]
    console.log(`[IssueExecutor] OpenAI API response received in ${elapsed}ms, finish_reason: ${choice?.finish_reason}`)
    console.log(`[IssueExecutor] Response usage: prompt=${response.usage?.prompt_tokens}, completion=${response.usage?.completion_tokens}, total=${response.usage?.total_tokens}`)

    // Handle truncated responses (finish_reason: length) — reasoning models
    // may return null content when the output is cut off at max_completion_tokens
    if (choice?.finish_reason === 'length') {
      const partialText = choice?.message?.content
      if (partialText) {
        console.warn(`[IssueExecutor] Response truncated (finish_reason: length) but partial content available (${partialText.length} chars)`)
        return partialText
      }
      throw new Error(
        `OpenAI response truncated (finish_reason: length) with no usable content. ` +
        `Used ${response.usage?.completion_tokens ?? '?'} completion tokens. ` +
        `Try reducing prompt size or increasing max_completion_tokens.`
      )
    }

    const text = choice?.message?.content
    if (!text) {
      throw new Error('No text response from OpenAI')
    }

    return text
  } catch (error) {
    console.error(`[IssueExecutor] OpenAI API call failed:`, error)
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

// scrapePageContent imported from './page-scrape-context.service'

/**
 * Fetch the source code of the target file from the user's GitHub repo.
 * This gives the agent the actual codebase context.
 * Uses resolveGitHubContext() for shared credential resolution.
 */
async function fetchSourceFileFromGitHub(
  brandProfileId: number,
  filePath: string
): Promise<string | null> {
  try {
    const ghCtx = await resolveGitHubContext(brandProfileId)
    if (!ghCtx) return null

    const res = await fetch(
      `https://api.github.com/repos/${ghCtx.owner}/${ghCtx.repo}/contents/${filePath}?ref=${ghCtx.baseBranch}`,
      {
        headers: {
          Authorization: `Bearer ${ghCtx.accessToken}`,
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
export function getSafeUrlPathFromAffectedUrl(affectedUrl: string): string | null {
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

export function resolveSourceFilePath(agentType: string, affectedUrl: string | null, framework?: RepoStructure['framework'], hasSrcDir?: boolean): string {
  const PAGE_SPECIFIC_AGENTS = [
    'schema_markup', 'heading_hierarchy', 'content_structure', 'faq_sections',
    'meta_optimization', 'citation_signals', 'ai_content_optimizer',
    'authority_building', 'brand_messaging', 'navigation', 'nav_optimization',
  ]
  const fallbackPath = getFilePathForAgentType(agentType, framework, hasSrcDir)

  if (!affectedUrl || !PAGE_SPECIFIC_AGENTS.includes(agentType)) {
    return fallbackPath
  }

  const urlPath = getSafeUrlPathFromAffectedUrl(affectedUrl)
  if (urlPath === null) {
    console.warn(`[IssueExecutor] Unsafe affectedUrl path detected, using fallback file path. affectedUrl=${affectedUrl}`)
    return fallbackPath
  }

  // Use detected framework to build the correct file path
  const detectedFramework = framework || 'nextjs-app'
  const srcPrefix = hasSrcDir ? 'src/' : ''

  if (!urlPath || urlPath === '') {
    // Homepage
    switch (detectedFramework) {
      case 'nextjs-app':
        return `${srcPrefix}app/page.tsx`
      case 'nextjs-pages':
        return `${srcPrefix}pages/index.tsx`
      case 'astro':
        return 'src/pages/index.astro'
      case 'nuxt':
        return 'pages/index.vue'
      case 'html':
        return 'index.html'
      default:
        return `${srcPrefix}app/page.tsx`
    }
  }

  // Convert URL path to framework-specific file path
  switch (detectedFramework) {
    case 'nextjs-app':
      // e.g. "pricing" → "app/pricing/page.tsx"
      return `${srcPrefix}app/${urlPath}/page.tsx`
    case 'nextjs-pages':
      // e.g. "pricing" → "pages/pricing.tsx"
      return `${srcPrefix}pages/${urlPath}.tsx`
    case 'astro':
      // e.g. "pricing" → "src/pages/pricing.astro"
      return `src/pages/${urlPath}.astro`
    case 'nuxt':
      // e.g. "pricing" → "pages/pricing.vue"
      return `pages/${urlPath}.vue`
    case 'html':
      // e.g. "pricing" → "pricing.html" or "pricing/index.html"
      return `${urlPath}.html`
    default:
      return `${srcPrefix}app/${urlPath}/page.tsx`
  }
}

/**
 * Resolve the GitHub credentials and repo info for a brand profile.
 * Shared helper used by both fetchSourceFileFromGitHub and resolveFrameworkAwareFilePath.
 */
async function resolveGitHubContext(brandProfileId: number): Promise<{
  accessToken: string
  owner: string
  repo: string
  baseBranch: string
} | null> {
  try {
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      include: { user: { include: { githubIntegration: true } } },
    })
    if (!brandProfile?.user?.githubIntegration) return null

    const integration = brandProfile.user.githubIntegration
    const accessToken = await getValidGitHubToken(integration)

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

    return { accessToken, owner, repo, baseBranch }
  } catch (err) {
    console.warn(`[IssueExecutor] Failed to resolve GitHub context:`, err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Framework-aware file path resolution.
 *
 * 1. Fetches the repo tree from GitHub to detect the framework (Next.js App/Pages, Astro, Nuxt, HTML)
 * 2. Uses mapUrlToFile() from github.service to find the best matching file path
 * 3. Falls back to resolveSourceFilePath() if GitHub is unavailable
 *
 * Returns the resolved file path, the detected framework name, and the repo structure.
 */
export async function resolveFrameworkAwareFilePath(
  brandProfileId: number,
  agentType: string,
  affectedUrl: string | null,
  generatedCode?: string,
): Promise<{
  filePath: string
  framework: RepoStructure['framework']
  hasSrcDir: boolean
  repoStructure: RepoStructure | null
}> {
  const ghCtx = await resolveGitHubContext(brandProfileId)

  if (!ghCtx) {
    console.log(`[IssueExecutor] No GitHub context — using default path resolution`)
    const filePath = resolveSourceFilePath(agentType, affectedUrl)
    return { filePath, framework: 'unknown', hasSrcDir: false, repoStructure: null }
  }

  // For standalone config files, skip repo structure fetch entirely
  const STANDALONE_AGENTS = ['site_config', 'robots_txt', 'sitemap', 'llms_txt', 'llms_txt_missing', 'llms_txt_optimizer']
  if (STANDALONE_AGENTS.includes(agentType)) {
    const filePath = getFilePathForAgentType(agentType)
    return { filePath, framework: 'unknown', hasSrcDir: false, repoStructure: null }
  }

  try {
    const repoStructure = await getRepoStructure(
      ghCtx.accessToken, ghCtx.owner, ghCtx.repo, ghCtx.baseBranch
    )

    console.log(`[IssueExecutor] Repo framework: ${repoStructure.framework}, hasSrcDir: ${repoStructure.hasSrcDir}, pages: ${repoStructure.pageFiles.length}`)

    // Detect content type from generated code (if available) for smarter file mapping
    const contentType: ContentType = generatedCode
      ? detectContentTypeFromCode(generatedCode)
      : 'generic-jsx'

    // Check if this is global content (Organization/WebSite schema → layout file)
    const isGlobalContent: boolean = contentType === 'json-ld' &&
      !!(generatedCode?.includes('"Organization"') || generatedCode?.includes('"WebSite"'))

    // Use the URL and framework to find the best file candidates
    const targetUrl = affectedUrl || ''
    const candidates = mapUrlToFile(targetUrl, repoStructure, contentType, isGlobalContent)

    if (candidates.length > 0) {
      // Verify the top candidate actually exists in the repo's page catalog
      const bestCandidate = repoStructure.pageFiles.find(pf =>
        candidates.some(c => pf === c || pf.endsWith(c))
      ) || candidates[0]

      console.log(`[IssueExecutor] Framework-aware path: ${bestCandidate} (from ${candidates.length} candidates)`)
      return { filePath: bestCandidate, framework: repoStructure.framework, hasSrcDir: repoStructure.hasSrcDir, repoStructure }
    }

    // Fallback to framework-aware static resolver
    const filePath = resolveSourceFilePath(agentType, affectedUrl, repoStructure.framework, repoStructure.hasSrcDir)
    return { filePath, framework: repoStructure.framework, hasSrcDir: repoStructure.hasSrcDir, repoStructure }
  } catch (err) {
    console.warn(`[IssueExecutor] Framework detection failed, using defaults:`, err instanceof Error ? err.message : err)
    const filePath = resolveSourceFilePath(agentType, affectedUrl)
    return { filePath, framework: 'unknown', hasSrcDir: false, repoStructure: null }
  }
}

/**
 * Lightweight content type detection for the executor.
 * Detects json-ld, meta-tags, and faq-section; falls back to generic-jsx.
 * Note: does not detect nav-links or generic-html (handled by github.service's detectContentType).
 */
function detectContentTypeFromCode(code: string): ContentType {
  if (code.includes('application/ld+json') || code.includes('"@context"') || code.includes("'@context'")) {
    return 'json-ld'
  }
  if (code.includes('<meta ') || code.includes('og:') || code.includes('twitter:')) {
    return 'meta-tags'
  }
  if (code.toLowerCase().includes('faq') || code.includes('FAQPage')) {
    return 'faq-section'
  }
  return 'generic-jsx'
}

/**
 * Gather full context for an issue: page content + source code + existing files.
 * This is the "context enrichment" phase that runs before the agent generates code.
 *
 * Uses framework-aware path resolution: detects the user's repo framework
 * (Next.js App/Pages, Astro, Nuxt, HTML) and resolves the correct file paths
 * instead of hardcoding Next.js App Router conventions.
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
  detectedFramework: RepoStructure['framework']
}> {
  const targetUrl = issue.affectedUrl || issue.brandProfile.companyWebsite

  // 1. Scrape live page content (what users actually see)
  const pageContentPromise = targetUrl
    ? issue.agentType === 'faq_sections'
      ? scrapeFaqContext(targetUrl, issue.brandProfileId)
      : scrapePageContent(targetUrl)
    : Promise.resolve(null)

  // 2. Resolve the target file using framework-aware detection
  //    This fetches the repo tree, detects the framework (Astro, Next.js Pages, etc.),
  //    and maps the affected URL to the correct file path for that framework.
  const resolvedPath = await resolveFrameworkAwareFilePath(
    issue.brandProfileId,
    issue.agentType || 'schema_markup',
    issue.affectedUrl,
  )

  console.log(`[IssueExecutor] Resolved path: ${resolvedPath.filePath} (framework: ${resolvedPath.framework})`)

  // 3. Fetch the source file from GitHub using the resolved path
  const sourceFilePromise = fetchSourceFileFromGitHub(issue.brandProfileId, resolvedPath.filePath)

  // 4. Check blog context if applicable
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

  return {
    pageContent,
    sourceFile,
    sourceFilePath: resolvedPath.filePath,
    blogContext,
    detectedFramework: resolvedPath.framework,
  }
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

/**
 * Convert RepoStructure framework identifier to a human-readable name
 * for use in LLM system prompts.
 */
export function formatFrameworkName(framework: RepoStructure['framework']): string {
  switch (framework) {
    case 'nextjs-app': return 'Next.js App Router (React/JSX)'
    case 'nextjs-pages': return 'Next.js Pages Router (React/JSX)'
    case 'astro': return 'Astro'
    case 'nuxt': return 'Nuxt.js (Vue)'
    case 'react': return 'React (JSX)'
    case 'html': return 'HTML'
    default: return 'HTML'
  }
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
    detectedFramework?: RepoStructure['framework']
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
 * - Global content (Organization schema, WebSite schema) → layout file
 * - Page-specific content (Product, FAQ, Article schema) → page file
 * - Meta optimization → page file (each page has its own meta)
 * - Config files (robots, sitemap, llms.txt) → public/
 * - Content restructuring → page file
 * - Navigation → page file (NOT layout - nav is page content)
 * 
 * When framework is provided, returns framework-appropriate paths:
 * - nextjs-app: app/page.tsx, app/layout.tsx
 * - nextjs-pages: pages/index.tsx, pages/_app.tsx
 * - astro: src/pages/index.astro, src/layouts/Layout.astro
 * - nuxt: pages/index.vue, app.vue
 * - html: index.html
 */
export function getFilePathForAgentType(
  agentType: string,
  framework?: RepoStructure['framework'],
  hasSrcDir?: boolean,
): string {
  // Standalone config files are framework-agnostic
  const STANDALONE_PATHS: Record<string, string> = {
    'site_config': 'public/robots.txt',
    'robots_txt': 'public/robots.txt',
    'sitemap': 'public/sitemap.xml',
    'llms_txt': 'public/llms.txt',
    'llms_txt_missing': 'public/llms.txt',
    'llms_txt_optimizer': 'public/llms.txt',
  }

  if (STANDALONE_PATHS[agentType]) {
    return STANDALONE_PATHS[agentType]
  }

  const detectedFramework = framework || 'nextjs-app'
  const srcPrefix = hasSrcDir ? 'src/' : ''

  // Framework-specific page file and blog paths
  const pagePath = getFrameworkPageFile(detectedFramework, srcPrefix)
  const blogPagePath = getFrameworkBlogFile(detectedFramework, srcPrefix)
  const blogPostPath = getFrameworkBlogPostFile(detectedFramework, srcPrefix)

  const FILE_PATHS: Record<string, string> = {
    // Schema markup
    'schema_markup': pagePath,
    
    // Content structure
    'heading_hierarchy': pagePath,
    'content_structure': pagePath,
    'faq_sections': pagePath,
    
    // Meta optimization
    'meta_optimization': pagePath,
    
    // Content optimization
    'citation_signals': pagePath,
    'ai_content_optimizer': pagePath,
    'authority_building': pagePath,
    'brand_messaging': pagePath,
    
    // Navigation
    'navigation': pagePath,
    'nav_optimization': pagePath,
    
    // Blog setup
    'blog_setup': blogPagePath,
    'blog_page_missing': blogPagePath,
    'blog_post_publish': blogPostPath,
  }
  
  return FILE_PATHS[agentType] || pagePath
}

/** Get the default page file for a framework */
function getFrameworkPageFile(framework: RepoStructure['framework'], srcPrefix: string): string {
  switch (framework) {
    case 'nextjs-app': return `${srcPrefix}app/page.tsx`
    case 'nextjs-pages': return `${srcPrefix}pages/index.tsx`
    case 'astro': return 'src/pages/index.astro'
    case 'nuxt': return 'pages/index.vue'
    case 'html': return 'index.html'
    default: return `${srcPrefix}app/page.tsx`
  }
}

/** Get the blog index file for a framework */
function getFrameworkBlogFile(framework: RepoStructure['framework'], srcPrefix: string): string {
  switch (framework) {
    case 'nextjs-app': return `${srcPrefix}app/blog/page.tsx`
    case 'nextjs-pages': return `${srcPrefix}pages/blog/index.tsx`
    case 'astro': return 'src/pages/blog/index.astro'
    case 'nuxt': return 'pages/blog/index.vue'
    case 'html': return 'blog/index.html'
    default: return `${srcPrefix}app/blog/page.tsx`
  }
}

/** Get the blog post file for a framework */
function getFrameworkBlogPostFile(framework: RepoStructure['framework'], srcPrefix: string): string {
  switch (framework) {
    case 'nextjs-app': return `${srcPrefix}app/blog/[slug]/page.tsx`
    case 'nextjs-pages': return `${srcPrefix}pages/blog/[slug].tsx`
    case 'astro': return 'src/pages/blog/[slug].astro'
    case 'nuxt': return 'pages/blog/[slug].vue'
    case 'html': return 'blog/post.html'
    default: return `${srcPrefix}app/blog/[slug]/page.tsx`
  }
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
 * Extract context sections from the agent prompt for eval scorers.
 * Mirrors the hallucination scorer's getContext logic so faithfulness
 * can also evaluate against the actual page/source/brand context.
 */
function extractContextFromPrompt(prompt: string): string[] {
  const contextChunks: string[] = []

  // Extract "Live Page Content" section
  const pageContentMatch = prompt.match(/## Live Page Content[\s\S]*?```markdown\n([\s\S]*?)```/)
  if (pageContentMatch) {
    contextChunks.push(`Page content: ${pageContentMatch[1].trim()}`)
  }

  // Extract "Source File" section
  const sourceFileMatch = prompt.match(/## Source File[\s\S]*?```tsx?\n([\s\S]*?)```/)
  if (sourceFileMatch) {
    contextChunks.push(`Source file: ${sourceFileMatch[1].trim()}`)
  }

  // Extract brand info
  const brandMatch = prompt.match(/## Brand\n([\s\S]*?)(?=\n## |$)/)
  if (brandMatch) {
    contextChunks.push(`Brand info: ${brandMatch[1].trim()}`)
  }

  if (contextChunks.length === 0) {
    console.warn(`[IssueExecutor] No context sections found in prompt for faithfulness scoring`)
  } else {
    console.log(`[IssueExecutor] Extracted ${contextChunks.length} context section(s) for faithfulness scoring`)
  }

  return contextChunks
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
  systemPrompt?: string,
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
    // The alignment scorer (evaluationMode: 'both') requires system messages.
    // Without this, it throws "Both user and system prompts are required".
    // CoreSystemMessage = { role: 'system'; content: string }
    systemMessages: systemPrompt
      ? [{ role: 'system' as const, content: systemPrompt }]
      : [],
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

  // Build scorer list — alignment scorer needs system prompt, so skip it
  // when no system prompt is available (it uses evaluationMode: 'both').
  //
  // Faithfulness scorer needs context to evaluate against. Extract it from
  // the prompt (same sections the hallucination scorer's getContext parses).
  // Without context, it scores everything as 0 ("no context was provided").
  const contextChunks: string[] = extractContextFromPrompt(prompt)

  // Create a context-aware faithfulness scorer for this specific run
  const contextAwareFaithfulness = contextChunks.length > 0
    ? createFaithfulnessScorer({ model: EVAL_MODEL, options: { context: contextChunks } })
    : faithfulnessScorer // fall back to static scorer if no context found

  // Use a minimal interface for the scorer array — each scorer has different
  // generic params but they all share the same .run() signature.
  type AnyScorer = { run(args: { input: ScorerRunInputForAgent; output: ScorerRunOutputForAgent }): Promise<{ score: unknown; reason?: string }> }

  const scorers: Array<{ key: string; scorer: AnyScorer; field: keyof Omit<ScoringResult, 'details'> }> = [
    { key: 'hallucination', scorer: hallucinationScorer, field: 'hallucination' },
    { key: 'faithfulness', scorer: contextAwareFaithfulness, field: 'faithfulness' },
    { key: 'relevancy', scorer: relevancyScorer, field: 'relevancy' },
  ]

  // Only include alignment scorer when system prompt is present — without it,
  // the scorer crashes with "Both user and system prompts are required"
  if (systemPrompt) {
    scorers.push({ key: 'alignment', scorer: promptAlignmentScorer, field: 'alignment' })
  } else {
    console.warn(`[IssueExecutor] Skipping alignment scorer — no system prompt available`)
  }

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
 * 4. HARD STOP if quality gate failed after all retries (no PR created)
 * 5. Create PR (only when quality gate passed)
 * 6. Persist scores internally (never exposed in PR)
 *
 * Eval scores are INTERNAL ONLY — they are stored in the database for
 * analytics but never included in PR descriptions shown to users.
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
    
    // Pre-flight check for API keys (schema agent uses OpenAI GPT-5.2)
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('No OpenAI API key configured. Set OPENAI_API_KEY for schema injection agent (GPT-5.2).')
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

FAQ RULE: If the issue description contains a <!-- FAQ_DATA: [...] --> marker, use those EXACT question/answer pairs for the FAQPage schema. Do NOT infer FAQ content from other page sections like feature highlights, trust badges, or marketing bullets. The FAQ_DATA contains the real FAQ items already extracted from the page.

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

      // Use detected framework from repo analysis, fall back to file-extension heuristic
      const framework = context.detectedFramework && context.detectedFramework !== 'unknown'
        ? formatFrameworkName(context.detectedFramework)
        : detectFrameworkFromContext(context.sourceFilePath, context.sourceFile)

      systemPrompt = `You are an FAQ content specialist. You generate page-type-aware FAQ sections that will be committed to the user's repository via an automated PR.

GROUNDING RULE: Only generate FAQ questions that a real visitor to this page would ask. Pull answers exclusively from visible page content. Never fabricate data, pricing, features, or capabilities not present on the page.

CONTENT FOCUS:
- Prioritize representative brand questions: what the product does, who it serves, key capabilities, deployment/getting started, performance/infrastructure, security/trust, and pricing.
- If context includes multiple pages, synthesize the core offering across those pages rather than one-off page details.
- Avoid low-signal topics like cookie banners, tracking preference controls, navigation/UI text, or legal boilerplate unless the page is explicitly legal/privacy focused.

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
- Never use page-observer phrasing like "the homepage says", "the page includes", or "the headline is".
- Never ask/answer about "homepage", "this page", "the page", "headline", "CTA", "button", or where links point.
- Never include prompt/model language ("prompt", "instruction", "LLM", "assistant", "ChatGPT", "GPT", "Claude", "Gemini").

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
    // Use the framework-aware path already resolved during context enrichment
    let finalFilePath = context.sourceFilePath || resolveSourceFilePath(agentType, issue.affectedUrl)
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
          callOpenAIDirect(iterationPrompt, systemPrompt),
          AGENT_TIMEOUT_MS,
          `OpenAI API call timed out after ${AGENT_TIMEOUT_MS / 1000}s`
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
          evalScores = await runProductionScoring(basePrompt, currentCode, systemPrompt)
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
        console.warn(`[IssueExecutor] Quality gate failed after all ${MAX_QUALITY_RETRIES + 1} attempts — will NOT create PR`)
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

    // 5. Quality gate hard stop — don't create PR if quality wasn't met
    if (qualityGatePassed === false) {
      const compositeScore = evalScores ? calculateCompositeScore(evalScores) : null
      console.error(`[IssueExecutor] Issue ${issueId} quality gate failed after ${qualityRetryCount + 1} attempts (composite: ${compositeScore?.toFixed(1) ?? 'N/A'}/100) — aborting PR creation`)

      await prisma.issue.update({
        where: { id: issueId },
        data: {
          status: 'quality_failed',
          generatedOutput: currentCode || null,
          outputType: 'code',
        },
      })

      // Internal notification (fire-and-forget)
      const ownerUserId = issue.brandProfile.userId
      if (ownerUserId) {
        import('@/lib/services/notification.service').then(({ createNotification }) =>
          createNotification({
            userId: ownerUserId,
            brandProfileId: issue.brandProfileId,
            type: 'warning',
            category: 'agent_quality_alert',
            title: `Quality check failed: ${issue.title}`,
            message: `The AI agent could not produce code that met our quality standards for "${issue.title}" after ${qualityRetryCount + 1} attempts. The issue has been flagged for review.`,
            metadata: {
              issueId,
              compositeScore,
              attempts: qualityRetryCount + 1,
            } as Record<string, unknown>,
          })
        ).catch(err => console.warn('[IssueExecutor] Failed to send quality alert:', err))
      }

      return {
        success: false,
        error: `Quality gate failed after ${qualityRetryCount + 1} attempts (composite: ${compositeScore?.toFixed(1) ?? 'N/A'}/100). No PR was created.`,
        evalScores: evalScores ? {
          hallucination: evalScores.hallucination,
          faithfulness: evalScores.faithfulness,
          relevancy: evalScores.relevancy,
          alignment: evalScores.alignment,
          compositeScore: compositeScore ?? undefined,
          details: evalScores.details,
        } : undefined,
        qualityGatePassed: false,
      }
    }

    // 6. Blog-specific early exit check
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

    // 7. Validate with E2B if needed
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

    // 8. Create PR (quality gate already verified above)
    let prUrl: string | undefined
    let prNumber: number | undefined
    const compositeScore = evalScores ? calculateCompositeScore(evalScores) : null

    if (createsPullRequest(agentType)) {
      console.log(`[IssueExecutor] Creating PR for issue ${issueId}`)
      try {
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
          description: `## Issue\n${issue.description || issue.title}\n\n## Generated by\nMudra AI Agent: ${agentType}\n\n## Estimated Impact\n${issue.estimatedImpact || 'Improved AI visibility'}${e2bValidation ? `\n\n## Validation\nAutomated validation passed in ${e2bValidation.executionMs}ms` : ''}${lastReview?.reasoning ? `\n\n## Placement\n${lastReview.reasoning}` : ''}\n`,
          issueTitle: issue.title,
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
  context: { pageContent: string | null; sourceFile: string | null; sourceFilePath: string | null; blogContext: string; detectedFramework?: RepoStructure['framework'] }
): Promise<ExecutionResult> {
  console.log(`[IssueExecutor] Processing conversation issue ${issue.id}`)

  const prompt = await buildAgentPrompt({ ...issue, brandProfile: issue.brandProfile, agentType, category: null }, context)
  const responseText = await withTimeout(
    callOpenAIDirect(prompt),
    AGENT_TIMEOUT_MS,
    `OpenAI API call timed out after ${AGENT_TIMEOUT_MS / 1000}s`
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
