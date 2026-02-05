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
  requiresE2bValidation,
  type SandboxResult,
  type SchemaValidationResult
} from './e2b-sandbox.service'
import { createOptimizationPR } from './github.service'
import { reviewGeneratedContent, type ReviewResult } from './pr-review.service'

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

// Agent type to Mastra agent name mapping
const ISSUE_AGENT_MAP: Record<string, string> = {
  // Technical Structure
  'schema_markup': 'schemaArchitectAgent',
  'schema_architect': 'schemaArchitectAgent',
  'json_ld_generation': 'schemaArchitectAgent',
  'structured_data': 'schemaArchitectAgent',
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
  'schema_markup', 'schema_architect', 'json_ld_generation', 'structured_data',
  'heading_hierarchy', 'content_structure', 'faq_sections',
  'site_config', 'robots_txt', 'sitemap', 'meta_optimization',
  'llms_txt', 'llms_txt_missing', 'llms_txt_optimizer',
  'citation_signals', 'ai_content_optimizer', 'authority_building', 'brand_messaging',
  'blog_setup', 'blog_page_missing', 'blog_post_publish'
]

const CONVERSATION_TYPES = [
  'conversation_engagement', 'reddit_opportunity', 'social_opportunity'
]

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
 * Build context prompt for agent based on issue
 */
async function buildAgentPrompt(issue: {
  id: number
  title: string
  description: string | null
  affectedUrl: string | null
  category: string | null
  agentType: string | null
  brandProfile: {
    companyName: string | null
    companyWebsite: string | null
    companyDescription: string | null
    companyIndustry: string | null
    companyServices: string | null
  }
}): Promise<string> {
  const { brandProfile } = issue
  
  return `## Task
Fix this optimization issue for a website.

## Issue Details
- **Title**: ${issue.title}
- **Description**: ${issue.description || 'No additional details'}
- **Affected URL**: ${issue.affectedUrl || brandProfile.companyWebsite || 'Homepage'}
- **Category**: ${issue.category || 'General'}
- **Issue Type**: ${issue.agentType || 'optimization'}

## Brand Context
- **Company**: ${brandProfile.companyName || 'Unknown'}
- **Website**: ${brandProfile.companyWebsite || 'Unknown'}
- **Industry**: ${brandProfile.companyIndustry || 'Unknown'}
- **Services**: ${brandProfile.companyServices || 'Unknown'}
- **Description**: ${brandProfile.companyDescription || 'No description available'}

## Instructions
1. Generate the fix for this issue
2. Provide complete, ready-to-implement code or content
3. Include placement instructions (where to add the code)
4. Explain the expected impact

## Output Format
Provide your response with:
1. The generated code/content in a code block
2. Implementation instructions
3. Expected benefits`
}

/**
 * Extract generated content from agent response
 */
function extractGeneratedContent(responseText: string): string {
  // Look for code blocks
  const codeBlockMatch = responseText.match(/```(?:json|html|xml|txt|markdown|md)?\n?([\s\S]*?)```/i)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }
  
  // Look for JSON-LD specifically
  const jsonLdMatch = responseText.match(/\{[\s\S]*"@context"[\s\S]*"@type"[\s\S]*\}/i)
  if (jsonLdMatch) {
    return jsonLdMatch[0].trim()
  }
  
  // Return full text if no code block found
  return responseText
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
    'schema_architect': 'app/page.tsx',
    'json_ld_generation': 'app/page.tsx',
    'structured_data': 'app/page.tsx',
    
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

/**
 * Execute an agent to resolve an issue
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
  
  // 2. Update status to in_progress (with timeout)
  console.log(`[IssueExecutor] Updating issue status to in_progress...`)
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
    console.log(`[IssueExecutor] Status updated`)
  } catch (updateError) {
    console.error(`[IssueExecutor] Failed to update status:`, updateError)
    // Continue anyway - status update is not critical
  }
  
  try {
    // 3. Get appropriate agent
    const agentType = issue.agentType || 'schema_markup'
    const agentStartTime = Date.now()
    
    console.log(`[IssueExecutor] Looking up agent for type: "${agentType}"`)
    console.log(`[IssueExecutor] Agent mapping exists: ${!!ISSUE_AGENT_MAP[agentType]}`)
    
    const agent = getAgentForIssue(agentType)
    
    if (!agent) {
      console.error(`[IssueExecutor] Agent lookup failed for type: "${agentType}"`)
      console.error(`[IssueExecutor] Available mappings: ${Object.keys(ISSUE_AGENT_MAP).join(', ')}`)
      throw new Error(`No agent available for type: ${agentType}`)
    }
    
    console.log(`[IssueExecutor] Using agent for type: ${agentType}`)
    console.log(`[IssueExecutor] Issue details: title="${issue.title}", url="${issue.affectedUrl}"`)
    
    // 4. Build prompt and execute agent
    console.log(`[IssueExecutor] Building agent prompt...`)
    const prompt = await buildAgentPrompt({
      ...issue,
      brandProfile: issue.brandProfile
    })
    console.log(`[IssueExecutor] Prompt length: ${prompt.length} chars`)
    console.log(`[IssueExecutor] Prompt preview: ${prompt.substring(0, 200)}...`)
    
    // Pre-flight check for API keys
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY
    console.log(`[IssueExecutor] API Keys available - Anthropic: ${hasAnthropicKey}, OpenAI: ${hasOpenAIKey}`)
    
    if (!hasAnthropicKey && !hasOpenAIKey) {
      throw new Error('No LLM API keys configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.')
    }
    
    console.log(`[IssueExecutor] Calling Anthropic directly (bypassing Mastra)...`)
    console.log(`[IssueExecutor] Agent generate starting at ${new Date().toISOString()}`)
    const generateStartTime = Date.now()
    
    let responseText: string
    try {
      // Use direct Anthropic call instead of Mastra agent
      responseText = await withTimeout(
        callAnthropicDirect(prompt),
        AGENT_TIMEOUT_MS,
        `Anthropic API call timed out after ${AGENT_TIMEOUT_MS/1000}s`
      )
      console.log(`[IssueExecutor] Anthropic API returned successfully`)
    } catch (apiError) {
      const elapsed = Date.now() - generateStartTime
      console.error(`[IssueExecutor] Anthropic API failed after ${elapsed}ms at ${new Date().toISOString()}`)
      console.error(`[IssueExecutor] Error details:`, apiError instanceof Error ? apiError.message : String(apiError))
      throw apiError
    }
    
    const generateDuration = Date.now() - generateStartTime
    console.log(`[IssueExecutor] Anthropic call completed in ${generateDuration}ms at ${new Date().toISOString()}`)
    
    if (!responseText) {
      console.error(`[IssueExecutor] Agent returned empty response`)
      throw new Error('Agent returned empty response')
    }
    
    console.log(`[IssueExecutor] Agent response length: ${responseText.length}`)
    console.log(`[IssueExecutor] Response preview: ${responseText.substring(0, 300)}...`)
    
    // 5. Extract generated content
    console.log(`[IssueExecutor] Extracting generated content...`)
    const generatedContent = extractGeneratedContent(responseText)
    console.log(`[IssueExecutor] Extracted content length: ${generatedContent.length}`)
    
    // 6. Validate with E2B if needed
    let e2bValidation: SandboxResult<SchemaValidationResult> | undefined
    
    if (requiresE2bValidation(agentType)) {
      console.log(`[IssueExecutor] Running E2B validation for ${agentType}`)
      const e2bStartTime = Date.now()
      
      e2bValidation = await validateSchemaInSandbox(generatedContent)
      
      // Update issue with E2B tracking
      await prisma.issue.update({
        where: { id: issueId },
        data: {
          usedE2bSandbox: true,
          e2bSandboxId: e2bValidation.sandboxId,
          e2bExecutionMs: e2bValidation.executionMs,
          e2bValidationResult: e2bValidation.data as object || null
        }
      })
      
      if (!e2bValidation.success) {
        throw new Error(`E2B validation failed: ${e2bValidation.error}`)
      }
      
      if (e2bValidation.data && !e2bValidation.data.valid) {
        throw new Error(`Schema validation failed: ${e2bValidation.data.errors.join(', ')}`)
      }
      
      console.log(`[IssueExecutor] E2B validation passed in ${e2bValidation.executionMs}ms`)
    }
    
    // 7. Handle based on issue type
    let prUrl: string | undefined
    let prNumber: number | undefined
    let conversationUrl: string | undefined
    let engagementGuidance: string | undefined
    let suggestedResponse: string | undefined
    
    if (isConversationType(agentType)) {
      // CONVERSATION TYPE: Extract URL and engagement guidance from agent response
      console.log(`[IssueExecutor] Processing conversation issue ${issueId}`)
      
      // The conversation URL should already be in the issue's affectedUrl
      conversationUrl = issue.affectedUrl || undefined
      
      // Extract engagement guidance from agent response
      const guidance = extractEngagementGuidance(responseText)
      engagementGuidance = guidance.guidance
      suggestedResponse = guidance.suggestedResponse
      
      // Update issue with conversation output
      await prisma.issue.update({
        where: { id: issueId },
        data: {
          status: 'completed',
          generatedOutput: generatedContent, // Save raw agent output
          outputType: 'guidance',
          // Store the guidance in a JSON field or description
          description: `${issue.description || ''}\n\n---\n**Engagement Guidance:**\n${engagementGuidance}\n\n**Suggested Response:**\n${suggestedResponse || 'See guidance above'}`
        }
      })
      
    } else if (createsPullRequest(agentType)) {
      // PR-CREATING TYPE: Create GitHub PR with the generated content
      console.log(`[IssueExecutor] Creating PR for issue ${issueId}`)
      
      try {
        // STEP 1: Review the generated content before creating PR
        console.log(`[IssueExecutor] Running AI review on generated content...`)
        const defaultFilePath = getFilePathForAgentType(agentType)
        
        let reviewResult: ReviewResult | null = null
        let finalCode = generatedContent
        let finalFilePath = defaultFilePath
        
        try {
          reviewResult = await reviewGeneratedContent({
            generatedCode: generatedContent,
            issueTitle: issue.title,
            issueDescription: issue.description || '',
            agentType,
            targetFile: defaultFilePath,
            companyName: issue.brandProfile.companyName || '',
            websiteUrl: issue.brandProfile.companyWebsite || ''
          })
          
          // Apply review suggestions
          if (reviewResult.warnings.length > 0) {
            console.log(`[IssueExecutor] PR Review warnings: ${reviewResult.warnings.join(', ')}`)
          }
          
          if (reviewResult.suggestedFile && reviewResult.suggestedFile !== defaultFilePath) {
            console.log(`[IssueExecutor] Review suggests different file: ${reviewResult.suggestedFile} (was: ${defaultFilePath})`)
            finalFilePath = reviewResult.suggestedFile
          }
          
          if (reviewResult.improvedCode) {
            console.log(`[IssueExecutor] Review provided improved code`)
            finalCode = reviewResult.improvedCode
          }
          
          console.log(`[IssueExecutor] Review reasoning: ${reviewResult.reasoning}`)
          
        } catch (reviewError) {
          console.error(`[IssueExecutor] PR review failed, using defaults:`, reviewError)
          // Continue with defaults if review fails
        }
        
        // STEP 2: Create the PR with reviewed/improved content
        const prResult = await createOptimizationPR({
          brandProfileId: issue.brandProfileId,
          pageUrl: issue.affectedUrl || issue.brandProfile.companyWebsite || '/',
          improvements: [{
            type: agentType,
            description: issue.title,
            code: finalCode,
            impact: issue.estimatedImpact || 'medium',
            filePath: finalFilePath
          }],
          title: `[Mudra] ${issue.title}`,
          description: `## Issue
${issue.description || issue.title}

## Generated by
Mudra AI Agent: ${agentType}

## Estimated Impact
${issue.estimatedImpact || 'Improved AI visibility'}

${e2bValidation ? `## E2B Validation
✅ Validated in ${e2bValidation.executionMs}ms` : ''}

${reviewResult?.warnings.length ? `## Pre-PR Review Notes
${reviewResult.warnings.map(w => `- ⚠️ ${w}`).join('\n')}` : ''}
${reviewResult?.reasoning ? `\n**Placement:** ${reviewResult.reasoning}` : ''}
`,
          issueTitle: issue.title // Use issue title for branch naming
        })
        
        prUrl = prResult.prUrl
        prNumber = prResult.prNumber
        
        console.log(`[IssueExecutor] PR created: ${prUrl}`)
        
      } catch (prError) {
        // PR creation failed but content was generated - save content and mark as completed
        console.error(`[IssueExecutor] PR creation failed:`, prError)
        console.log(`[IssueExecutor] Saving generated content to issue for manual use`)
        // Content is saved below - user can copy it manually
      }
      
      // Update issue with PR info AND generated content (for cases where PR fails)
      await prisma.issue.update({
        where: { id: issueId },
        data: {
          status: prUrl ? 'completed' : 'completed', // Still completed even without PR
          prUrl,
          prNumber,
          prStatus: prUrl ? 'open' : undefined,
          generatedOutput: generatedContent, // Always save the generated content
          outputType: 'code'
        }
      })
    } else {
      // Generic completion for unknown types
      await prisma.issue.update({
        where: { id: issueId },
        data: { status: 'completed' }
      })
    }
    
    const totalDuration = Date.now() - agentStartTime
    console.log(`[IssueExecutor] Issue ${issueId} completed successfully in ${totalDuration}ms`)
    console.log(`[IssueExecutor] Result summary: prUrl=${prUrl || 'none'}, contentLength=${generatedContent?.length || 0}`)
    
    return {
      success: true,
      prUrl,
      prNumber,
      generatedContent,
      conversationUrl,
      engagementGuidance,
      suggestedResponse,
      e2bValidation
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error(`[IssueExecutor] Error executing issue ${issueId}:`, errorMessage)
    if (errorStack) {
      console.error(`[IssueExecutor] Stack trace:`, errorStack)
    }
    
    // Mark as failed instead of resetting to identified
    await prisma.issue.update({
      where: { id: issueId },
      data: { status: 'failed' }
    })
    
    return {
      success: false,
      error: errorMessage
    }
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
      e2bValidationResult: undefined
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
