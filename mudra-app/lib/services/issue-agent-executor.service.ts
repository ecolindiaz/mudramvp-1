/**
 * Issue Agent Executor Service
 * 
 * Orchestrates agent execution for issue resolution.
 * Handles E2B validation and GitHub PR creation.
 */

import { prisma } from '@/lib/prisma'
import { mastra } from '@/mastra'
import { 
  validateSchemaInSandbox, 
  requiresE2bValidation,
  type SandboxResult,
  type SchemaValidationResult
} from './e2b-sandbox.service'

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
  
  // Conversations (uses existing agent)
  'conversation_engagement': 'conversationRadarAgent',
  'reddit_opportunity': 'conversationRadarAgent',
  'social_opportunity': 'conversationRadarAgent',
}

export interface ExecutionResult {
  success: boolean
  prUrl?: string
  prNumber?: number
  generatedContent?: string
  error?: string
  e2bValidation?: SandboxResult<SchemaValidationResult>
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
    
    // 7. TODO: Create GitHub PR (placeholder for now)
    // This would integrate with the existing GitHub service
    const prUrl = undefined // await createOptimizationPR(...)
    const prNumber = undefined
    
    // 8. Update issue status
    await prisma.issue.update({
      where: { id: issueId },
      data: {
        status: 'completed',
        prUrl,
        prNumber,
        prStatus: prUrl ? 'open' : undefined
      }
    })
    
    console.log(`[IssueExecutor] Issue ${issueId} completed successfully`)
    
    return {
      success: true,
      prUrl,
      prNumber,
      generatedContent,
      e2bValidation
    }
    
  } catch (error) {
    console.error(`[IssueExecutor] Error executing issue ${issueId}:`, error)
    
    // Reset status to identified on failure
    await prisma.issue.update({
      where: { id: issueId },
      data: { status: 'identified' }
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
