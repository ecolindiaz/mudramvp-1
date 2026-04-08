import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeUrl } from "@/lib/utils/normalize-url";
import { discoverPages } from "@/lib/services/sitemap-discovery.service";

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// POST /api/sitemap-pages/discover  { brandProfileId }
// Run page discovery and return only untracked pages
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { brandProfileId } = body as { brandProfileId?: number };

    if (!brandProfileId) {
      return NextResponse.json(
        { error: "brandProfileId is required" },
        { status: 400 }
      );
    }

    // Ownership check + get website domain
    const profile = await prisma.brandProfile.findFirst({
      where: { id: brandProfileId, userId: session.user.id },
      select: { id: true, companyWebsite: true },
    });
    if (!profile) {
      return NextResponse.json(
        { error: "Brand profile not found" },
        { status: 404 }
      );
    }

    const companyWebsite = profile.companyWebsite || "";
    if (!companyWebsite) {
      return NextResponse.json(
        { error: "Brand profile has no website configured" },
        { status: 400 }
      );
    }

    // Run discovery with wider limits (no onboarding cap)
    const result = await discoverPages(companyWebsite, {
      maxPages: 100,
      maxBlogs: 50,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Discovery failed" },
        { status: 502 }
      );
    }

    // Fetch existing tracked URLs for this brand
    const existingPages = await prisma.sitemapPage.findMany({
      where: { brand_profile_id: brandProfileId },
      select: { page_url: true },
    });
    const trackedUrls = new Set(
      existingPages.map((p) => normalizeUrl(p.page_url))
    );

    // Build AI metadata lookup from aiPages (if available)
    const aiMetaMap = new Map<
      string,
      { title: string; reason: string; importance: number }
    >();
    if (result.aiPages) {
      for (const ap of result.aiPages) {
        aiMetaMap.set(normalizeUrl(ap.url), {
          title: ap.title,
          reason: ap.reason,
          importance: ap.importance,
        });
      }
    }

    // Filter to only untracked pages and merge AI metadata
    const newPages = result.pages
      .filter((p) => !trackedUrls.has(normalizeUrl(p.url)))
      .map((p) => {
        const aiMeta = aiMetaMap.get(normalizeUrl(p.url));
        return {
          url: p.url,
          pageType: p.pageType,
          priority: p.priority,
          title: aiMeta?.title ?? p.title ?? null,
          reason: aiMeta?.reason ?? null,
          importance: aiMeta?.importance ?? null,
        };
      });

    // Final canonical dedupe prevents returning equivalent URLs that differ only by formatting.
    const seenCanonicalUrls = new Set<string>();
    const dedupedNewPages = newPages.filter((page) => {
      const canonical = normalizeUrl(page.url);
      if (seenCanonicalUrls.has(canonical)) return false;
      seenCanonicalUrls.add(canonical);
      return true;
    });

    return NextResponse.json({
      pages: dedupedNewPages,
      totalDiscovered: result.totalDiscovered,
      newCount: dedupedNewPages.length,
      trackedCount: existingPages.length,
    });
  } catch (error) {
    console.error("[SitemapPages Discover]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
