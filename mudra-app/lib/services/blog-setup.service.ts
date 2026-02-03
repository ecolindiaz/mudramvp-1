/**
 * Blog Setup Service
 * 
 * Handles:
 * 1. Creating the initial "Set Up Blog Page" issue for new users
 * 2. Checking if blog setup is complete (issue merged)
 * 3. Publishing blog posts to user's website
 */

import { prisma } from '@/lib/prisma'
import { generateIssueHash } from './issue-discovery.service'

// Constants
export const BLOG_SETUP_ISSUE_TITLE = 'Set Up Blog Page'
export const BLOG_SETUP_ISSUE_TYPE = 'blog_setup'
export const BLOG_SETUP_CATEGORY = 'technical_structure'

/**
 * Create the initial "Set Up Blog Page" issue for a new user
 * This is called after onboarding completes
 */
export async function createInitialBlogSetupIssue(brandProfileId: number): Promise<{ created: boolean; issueId?: number }> {
  // Check if issue already exists
  const existingIssue = await prisma.issue.findFirst({
    where: {
      brandProfileId,
      agentType: BLOG_SETUP_ISSUE_TYPE,
    },
  })

  if (existingIssue) {
    console.log(`[BlogSetup] Blog setup issue already exists for brand ${brandProfileId}`)
    return { created: false, issueId: existingIssue.id }
  }

  // Generate unique hash for deduplication
  const issueHash = generateIssueHash(
    brandProfileId,
    BLOG_SETUP_CATEGORY,
    BLOG_SETUP_ISSUE_TITLE
  )

  // Create the issue
  const issue = await prisma.issue.create({
    data: {
      brandProfileId,
      title: BLOG_SETUP_ISSUE_TITLE,
      description: `Set up a blog page on your website to publish AI-optimized content directly from Content Lab.

**What this does:**
- Checks if your website has a blog page
- If not, creates the necessary files for a blog
- Opens a Pull Request with the changes

**Once merged:**
- You can publish content directly from Content Lab
- Posts will be automatically added to your website's blog
- SEO metadata and structured data included

Deploy this agent to get started!`,
      status: 'identified',
      priority: 'high',
      category: BLOG_SETUP_CATEGORY,
      discoveryTier: 'fundamental',
      agentType: BLOG_SETUP_ISSUE_TYPE,
      estimatedImpact: 'Enables content publishing to your website',
      issueHash,
    },
  })

  console.log(`[BlogSetup] Created blog setup issue ${issue.id} for brand ${brandProfileId}`)
  return { created: true, issueId: issue.id }
}

/**
 * Check if the blog setup issue has been completed (merged)
 * Returns true if user can publish content
 */
export async function isBlogSetupComplete(brandProfileId: number): Promise<{
  isComplete: boolean
  status: 'not_found' | 'identified' | 'in_progress' | 'completed' | 'merged'
  issueId?: number
  prUrl?: string
}> {
  const issue = await prisma.issue.findFirst({
    where: {
      brandProfileId,
      agentType: BLOG_SETUP_ISSUE_TYPE,
    },
    select: {
      id: true,
      status: true,
      prUrl: true,
      prStatus: true,
    },
  })

  if (!issue) {
    return { isComplete: false, status: 'not_found' }
  }

  // Blog setup is complete when the PR is merged
  const isComplete = issue.status === 'merged' || issue.prStatus === 'merged'

  return {
    isComplete,
    status: issue.status as 'identified' | 'in_progress' | 'completed' | 'merged',
    issueId: issue.id,
    prUrl: issue.prUrl || undefined,
  }
}

/**
 * Get the blog setup status for display in UI
 */
export async function getBlogSetupStatus(brandProfileId: number): Promise<{
  canPublish: boolean
  setupStatus: 'not_started' | 'pr_open' | 'ready'
  message: string
  actionRequired?: string
  issueId?: number
  prUrl?: string
}> {
  const { isComplete, status, issueId, prUrl } = await isBlogSetupComplete(brandProfileId)

  if (isComplete) {
    return {
      canPublish: true,
      setupStatus: 'ready',
      message: 'Blog is set up! You can publish content.',
      issueId,
    }
  }

  if (status === 'in_progress' || status === 'completed') {
    return {
      canPublish: false,
      setupStatus: 'pr_open',
      message: 'Blog setup PR is waiting to be merged',
      actionRequired: 'Merge the Pull Request to enable publishing',
      issueId,
      prUrl,
    }
  }

  return {
    canPublish: false,
    setupStatus: 'not_started',
    message: 'Set up your blog to publish content',
    actionRequired: 'Deploy the "Set Up Blog Page" agent from Issues',
    issueId,
  }
}

/**
 * Mark blog setup as complete (called when PR is merged)
 */
export async function markBlogSetupComplete(issueId: number): Promise<void> {
  await prisma.issue.update({
    where: { id: issueId },
    data: {
      status: 'merged',
      prStatus: 'merged',
    },
  })
  console.log(`[BlogSetup] Marked issue ${issueId} as merged`)
}

export interface BlogPublishRequest {
  brandProfileId: number
  campaignId: string
  title: string
  content: string
  slug: string
  metaDescription?: string
  author?: {
    name: string
    role: string
  }
}

export interface BlogPublishResult {
  success: boolean
  prUrl?: string
  prNumber?: number
  publishedPath?: string
  error?: string
}

/**
 * Publish a blog post to the user's website
 * This triggers the blogPostPublisherAgent to create a PR
 */
export async function publishBlogPost(request: BlogPublishRequest): Promise<BlogPublishResult> {
  // First verify blog setup is complete
  const { isComplete } = await isBlogSetupComplete(request.brandProfileId)
  
  if (!isComplete) {
    return {
      success: false,
      error: 'Blog setup is not complete. Please merge the blog setup PR first.',
    }
  }

  // Get brand profile for website context
  const brandProfile = await prisma.brandProfile.findUnique({
    where: { id: request.brandProfileId },
    select: {
      companyWebsite: true,
      companyName: true,
    },
  })

  if (!brandProfile?.companyWebsite) {
    return {
      success: false,
      error: 'No website configured for this brand profile.',
    }
  }

  // The actual publishing will be handled by the API route
  // which calls the blogPostPublisherAgent and creates a PR
  // This function just validates the prerequisites
  return {
    success: true,
    publishedPath: `/blog/${request.slug}`,
  }
}
