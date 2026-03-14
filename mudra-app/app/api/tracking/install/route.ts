/**
 * Install Tracking via Agent
 * 
 * POST /api/tracking/install
 * Automatically installs tracking code on user's website via GitHub PR
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { installTrackingViaAgent } from '@/lib/services/tracking-agent.service';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { repoFullName, branch = 'main' } = body;

    if (!repoFullName) {
      return NextResponse.json(
        { success: false, error: { message: 'Repository name is required', code: 'MISSING_REPO' } },
        { status: 400 }
      );
    }

    // Get brand profile
    const brandProfile = await prisma.brandProfile.findFirst({
      where: { userId: session.user.id }
    });

    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: { message: 'Brand profile not found', code: 'NOT_FOUND' } },
        { status: 404 }
      );
    }

    // Check GitHub integration exists
    const githubIntegration = await prisma.gitHubIntegration.findUnique({
      where: { userId: session.user.id }
    });

    if (!githubIntegration) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: 'GitHub not connected. Please connect GitHub first.', 
            code: 'GITHUB_NOT_CONNECTED' 
          } 
        },
        { status: 400 }
      );
    }

    // Install tracking via agent
    const result = await installTrackingViaAgent(brandProfile.id, repoFullName, branch);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { message: result.error, code: 'INSTALL_FAILED' } },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        prUrl: result.prUrl,
        prNumber: result.prNumber,
        message: 'Pull request created! Merge it to enable tracking.'
      }
    });

  } catch (error) {
    console.error('[Tracking Install API] Error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: 'Failed to install tracking',
          code: 'INTERNAL_ERROR'
        } 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tracking/install
 * Check installation status and get available repositories
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }

    // Get GitHub integration with repositories
    const githubIntegration = await prisma.gitHubIntegration.findUnique({
      where: { userId: session.user.id }
    });

    // Get brand profile tracking status
    const brandProfile = await prisma.brandProfile.findFirst({
      where: { userId: session.user.id }
    });

    return NextResponse.json({
      success: true,
      data: {
        githubConnected: !!githubIntegration,
        githubUsername: githubIntegration?.githubUsername,
        repositories: githubIntegration?.repositories || [],
        trackingStatus: brandProfile?.trackingStatus || 'not_connected',
        trackingSiteId: brandProfile?.trackingSiteId
      }
    });

  } catch (error) {
    console.error('[Tracking Install API] Error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          message: 'Failed to get installation status',
          code: 'INTERNAL_ERROR'
        } 
      },
      { status: 500 }
    );
  }
}
