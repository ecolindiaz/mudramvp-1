/**
 * Blog Post Publish API
 * 
 * POST - Publish a campaign as a blog post to user's website
 * 
 * This endpoint:
 * 1. Verifies blog setup is complete
 * 2. Triggers the blogPostPublisherAgent to create post files
 * 3. Creates a PR to the user's repository
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from '@/lib/auth/require-auth';
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis';
import { getBrandProfileByUserId } from '@/lib/prisma-brand-profile';
import { isBlogSetupComplete } from '@/lib/services/blog-setup.service';
import { prisma } from '@/lib/prisma';
import { mastra } from '@/mastra';
import { createBlogPostPR } from '@/lib/services/github.service';

export const maxDuration = 120; // 2 minutes for agent + PR creation

export async function POST(req: NextRequest) {
  // Apply rate limiting (expensive operation)
  const rateLimited = await applyRateLimitAsync(req, 'aiGeneration');
  if (rateLimited) return rateLimited;

  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    const body = await req.json();
    const { campaignId } = body;

    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: "campaignId is required" },
        { status: 400 }
      );
    }

    // Get brand profile
    const brandProfile = await getBrandProfileByUserId(authResult.user.id);
    
    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: "Brand profile not found" },
        { status: 404 }
      );
    }

    // Check blog setup status
    const { isComplete, prUrl: setupPrUrl } = await isBlogSetupComplete(brandProfile.id);
    
    if (!isComplete) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Blog setup not complete",
          message: "Please merge the blog setup PR first",
          setupPrUrl,
        },
        { status: 400 }
      );
    }

    // Get the campaign
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        userId: true,
        title: true,
        body: true,
        slug: true,
        status: true,
        metadata: true,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (campaign.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Get the blog post publisher agent
    const agent = mastra.getAgent('blogPostPublisherAgent');
    if (!agent) {
      console.error('[BlogPublish] blogPostPublisherAgent not found in Mastra');
      return NextResponse.json(
        { success: false, error: "Blog publishing agent not configured" },
        { status: 500 }
      );
    }

    // Prepare metadata
    const metadata = campaign.metadata as Record<string, unknown> || {};
    const metaDescription = (metadata.metaDescription as string) || '';
    
    // Get author info from brand profile
    const authorName = brandProfile.userName || 'Content Team';
    const authorRole = brandProfile.userRole || 'Editor';

    console.log(`[BlogPublish] Publishing campaign ${campaignId} to blog...`);

    // Generate the blog post content using the agent
    const prompt = `Create a blog post file for the following content:

## Post Details
- Title: ${campaign.title}
- Slug: ${campaign.slug || campaign.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}
- Meta Description: ${metaDescription}
- Author: ${authorName}, ${authorRole}
- Date: ${new Date().toISOString().split('T')[0]}

## Tech Stack Context
- Website: ${brandProfile.companyWebsite}
- Assume Next.js App Router with MDX support (most common setup)

## Post Content (Markdown)
${campaign.body}

Generate the file(s) needed to add this as a blog post. Return JSON with:
- filesToCreate: Array of { path, content, description }
- publishedUrl: The URL path where the post will be accessible
- commitMessage: A descriptive commit message`;

    const response = await agent.generate(prompt);
    
    // Parse the agent response
    let agentOutput;
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.text.match(/```json\n?([\s\S]*?)\n?```/) || 
                        response.text.match(/\{[\s\S]*"filesToCreate"[\s\S]*\}/);
      if (jsonMatch) {
        agentOutput = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[BlogPublish] Failed to parse agent response:', parseError);
      console.log('[BlogPublish] Raw response:', response.text);
      return NextResponse.json(
        { 
          success: false, 
          error: "Failed to generate blog post files",
          details: "Agent response parsing failed"
        },
        { status: 500 }
      );
    }

    // Sanitize and validate file paths — defense against LLM path traversal
    const SAFE_PATH_PATTERN = /^content\/blog\/[a-z0-9][a-z0-9_-]*\.(md|mdx)$/;
    const files = agentOutput.filesToCreate.map((f: { path: string; content: string }) => {
      // Strip null bytes, encoded traversals, and leading slashes
      const sanitizedPath = f.path
        .replace(/\0/g, '')                // null bytes
        .replace(/%2e/gi, '.')             // URL-encoded dots
        .replace(/%2f/gi, '/')             // URL-encoded slashes
        .replace(/^\/+/, '')              // leading slashes
        .replace(/\.\.\//g, '');           // directory traversal

      if (!SAFE_PATH_PATTERN.test(sanitizedPath)) {
        throw new Error(`Invalid file path rejected: paths must match content/blog/<slug>.(md|mdx)`);
      }
      return {
        path: sanitizedPath,
        content: f.content,
      };
    });

    const prTitle = `Add blog post: ${campaign.title}`;
    const prBody = `## New Blog Post

**Title:** ${campaign.title}
**Slug:** ${campaign.slug}
**Author:** ${authorName}

Published from Mudra Content Lab.

### Files Added
${files.map((f: { path: string }) => `- \`${f.path}\``).join('\n')}
`;

    try {
      const prResult = await createBlogPostPR({
        brandProfileId: brandProfile.id,
        title: prTitle,
        body: prBody,
        branch: `mudra/blog-post-${campaign.slug || Date.now()}`,
        files,
      });

      // Update campaign status to published
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'published',
          publishedAt: new Date(),
          metadata: {
            ...metadata,
            publishedVia: 'blog_publish_agent',
            prUrl: prResult.prUrl,
            prNumber: prResult.prNumber,
            publishedPath: agentOutput.publishedUrl,
          },
        },
      });

      console.log(`[BlogPublish] Successfully published campaign ${campaignId}, PR: ${prResult.prUrl}`);

      return NextResponse.json({
        success: true,
        prUrl: prResult.prUrl,
        prNumber: prResult.prNumber,
        publishedPath: agentOutput.publishedUrl,
        message: "Blog post PR created! Merge to publish.",
      });
    } catch (prError: any) {
      console.error('[BlogPublish] Failed to create PR:', prError);
      
      // Store the generated content even if PR fails
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          metadata: {
            ...metadata,
            generatedBlogFiles: agentOutput.filesToCreate,
            publishError: prError.message,
          },
        },
      });

      return NextResponse.json(
        { 
          success: false, 
          error: "Failed to create PR",
          details: prError.message,
          generatedFiles: agentOutput.filesToCreate,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[API /content-lab/publish] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to publish blog post" },
      { status: 500 }
    );
  }
}
