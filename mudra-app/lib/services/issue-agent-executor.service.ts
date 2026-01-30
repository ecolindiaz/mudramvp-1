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
import { 
  validateSchemaInSandbox, 
  requiresE2bValidation,
  type SandboxResult,
  type SchemaValidationResult
} from './e2b-sandbox.service'
import { createOptimizationPR } from './github.service'

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
    console.warn(`[IssueExecutor] No agent mapping for type: ${agentType}`)
    return null
  }
  
  try {
    // Cast to any to allow dynamic agent lookup
    return mastra.getAgent(agentName as Parameters<typeof mastra.getAgent>[0])
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
 */
function getFilePathForAgentType(agentType: string): string {
  const FILE_PATHS: Record<string, string> = {
    // Schema markup goes in head or page
    'schema_markup': 'index.html',
    'schema_architect': 'index.html',
    'json_ld_generation': 'index.html',
    'structured_data': 'index.html',
    
    // Content structure
    'heading_hierarchy': 'index.html',
    'content_structure': 'index.html',
    'faq_sections': 'faq.html',
    
    // Site config files
    'site_config': 'public/',
    'robots_txt': 'public/robots.txt',
    'sitemap': 'public/sitemap.xml',
    'meta_optimization': 'index.html',
    
    // AI visibility files
    'llms_txt': 'public/llms.txt',
    'llms_txt_missing': 'public/llms.txt',
    'llms_txt_optimizer': 'public/llms.txt',
    
    // Content optimization
    'citation_signals': 'content/',
    'ai_content_optimizer': 'content/',
    'authority_building': 'content/',
    'brand_messaging': 'content/',
  }
  
  return FILE_PATHS[agentType] || 'optimizations/'
}

/**
 * Execute an agent to resolve an issue
 */
export async function executeIssueAgent(issueId: number): Promise<ExecutionResult> {
  console.log(`[IssueExecutor] Starting execution for issue ${issueId}`)
  
  // 1. Get issue with brand profile
  const issue = await prisma.issue.findUnique({
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
  
  if (!issue) {
    return { success: false, error: 'Issue not found' }
  }
  
  if (!issue.brandProfile) {
    return { success: false, error: 'Brand profile not found' }
  }
  
  // 2. Update status to in_progress
  await prisma.issue.update({
    where: { id: issueId },
    data: { status: 'in_progress' }
  })
  
  try {
    // 3. Get appropriate agent
    const agentType = issue.agentType || 'schema_markup'
    const agent = getAgentForIssue(agentType)
    
    if (!agent) {
      throw new Error(`No agent available for type: ${agentType}`)
    }
    
    console.log(`[IssueExecutor] Using agent for type: ${agentType}`)
    
    // 4. Build prompt and execute agent
    const prompt = await buildAgentPrompt({
      ...issue,
      brandProfile: issue.brandProfile
    })
    
    const response = await agent.generate(prompt)
    const responseText = response.text || ''
    
    if (!responseText) {
      throw new Error('Agent returned empty response')
    }
    
    console.log(`[IssueExecutor] Agent response length: ${responseText.length}`)
    
    // 5. Extract generated content
    const generatedContent = extractGeneratedContent(responseText)
    
    // 6. Validate with E2B if needed
    let e2bValidation: SandboxResult<SchemaValidationResult> | undefined
    
    if (requiresE2bValidation(agentType)) {
      console.log(`[IssueExecutor] Running E2B validation for ${agentType}`)
      
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
        const prResult = await createOptimizationPR({
          brandProfileId: issue.brandProfileId,
          pageUrl: issue.affectedUrl || issue.brandProfile.companyWebsite || '/',
          improvements: [{
            type: agentType,
            description: issue.title,
            code: generatedContent,
            impact: issue.estimatedImpact || 'medium',
            filePath: getFilePathForAgentType(agentType)
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
    
    console.log(`[IssueExecutor] Issue ${issueId} completed successfully`)
    
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
    console.error(`[IssueExecutor] Error executing issue ${issueId}:`, error)
    
    // Mark as failed instead of resetting to identified
    await prisma.issue.update({
      where: { id: issueId },
      data: { status: 'failed' }
    })
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
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
