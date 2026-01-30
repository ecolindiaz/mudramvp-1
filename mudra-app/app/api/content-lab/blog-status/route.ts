/**
 * Blog Setup Status API
 * 
 * GET - Check if blog setup is complete for publishing
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from '@/lib/auth/require-auth';
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis';
import { getBrandProfileByUserId } from '@/lib/prisma-brand-profile';
import { getBlogSetupStatus, createInitialBlogSetupIssue } from '@/lib/services/blog-setup.service';

export async function GET(req: NextRequest) {
  // Apply rate limiting
  const rateLimited = await applyRateLimitAsync(req, 'standard');
  if (rateLimited) return rateLimited;

  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult.response;
  }

  try {
    // Get brand profile
    const brandProfile = await getBrandProfileByUserId(authResult.user.id);
    
    if (!brandProfile) {
      return NextResponse.json(
        { success: false, error: "Brand profile not found" },
        { status: 404 }
      );
    }

    // Ensure blog setup issue exists (create if not)
    await createInitialBlogSetupIssue(brandProfile.id);

    // Get current status
    const status = await getBlogSetupStatus(brandProfile.id);

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error("[API /content-lab/blog-status] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get blog status" },
      { status: 500 }
    );
  }
}
