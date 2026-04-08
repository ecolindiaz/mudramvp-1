import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeUrl } from "@/lib/utils/normalize-url";
import { extractLocaleFromUrl, buildLocaleWhereClause } from "@/lib/utils/locale-from-url";
import {
  addAndProcessUrl,
  removeSitemapUrl,
} from "@/lib/services/sitemap-page-management.service";

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// GET /api/sitemap-pages?brandProfileId=N
// List all tracked pages with latest score
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const brandProfileId = Number(
      new URL(request.url).searchParams.get("brandProfileId")
    );
    if (!brandProfileId) {
      return NextResponse.json(
        { error: "brandProfileId is required" },
        { status: 400 }
      );
    }

    // Ownership check
    const profile = await prisma.brandProfile.findFirst({
      where: { id: brandProfileId, userId: session.user.id },
      select: { id: true },
    });
    if (!profile) {
      return NextResponse.json(
        { error: "Brand profile not found" },
        { status: 404 }
      );
    }

    const countryParam = new URL(request.url).searchParams.get("country");
    const localeFilter = countryParam ? buildLocaleWhereClause(countryParam) : undefined;

    const pages = await prisma.sitemapPage.findMany({
      where: {
        brand_profile_id: brandProfileId,
        ...(localeFilter || {}),
      },
      include: {
        page_scores: {
          orderBy: { scored_at: "desc" },
          take: 1,
          select: { overall_score: true, scored_at: true },
        },
      },
      orderBy: { priority: "asc" },
    });

    const result = pages.map((p) => ({
      id: p.id,
      page_url: p.page_url,
      page_type: p.page_type,
      locale: p.locale,
      scrape_status: p.scrape_status,
      last_scraped_at: p.last_scraped_at,
      score: p.page_scores[0]?.overall_score ?? null,
    }));

    return NextResponse.json({ pages: result, total: result.length });
  } catch (error) {
    console.error("[SitemapPages GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/sitemap-pages  { brandProfileId, url }
// Add a new URL — returns immediately, processing happens async
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { brandProfileId, url } = body as {
      brandProfileId?: number;
      url?: string;
    };

    if (!brandProfileId || !url) {
      return NextResponse.json(
        { error: "brandProfileId and url are required" },
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

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Domain validation — compare hostnames (handle www vs non-www)
    const companyWebsite = profile.companyWebsite || "";
    let companyHost: string;
    try {
      const raw = companyWebsite.startsWith("http")
        ? companyWebsite
        : `https://${companyWebsite}`;
      companyHost = new URL(raw).hostname.replace(/^www\./, "");
    } catch {
      return NextResponse.json(
        { error: "Brand profile has no valid website configured" },
        { status: 400 }
      );
    }

    const inputHost = parsedUrl.hostname.replace(/^www\./, "");
    if (inputHost !== companyHost) {
      return NextResponse.json(
        { error: `URL must belong to ${companyHost}` },
        { status: 400 }
      );
    }

    // Normalize URL and derive domain (strip www. for consistency)
    const normalizedUrl = normalizeUrl(url);
    const domain = parsedUrl.origin.replace(/^(https?:\/\/)www\./i, '$1');

    // Duplicate check
    const existing = await prisma.sitemapPage.findFirst({
      where: {
        brand_profile_id: brandProfileId,
        page_url: normalizedUrl,
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "URL already tracked" },
        { status: 409 }
      );
    }

    // Create SitemapPage record with pending status
    let sitemapPage;
    try {
      sitemapPage = await prisma.sitemapPage.create({
        data: {
          brand_profile_id: brandProfileId,
          domain,
          page_url: normalizedUrl,
          locale: extractLocaleFromUrl(normalizedUrl),
          page_type: null, // will be detected during extraction
          scrape_status: "pending",
        },
      });
    } catch (err: unknown) {
      // Unique constraint violation — concurrent insert beat us
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        return NextResponse.json(
          { error: "URL already tracked" },
          { status: 409 }
        );
      }
      throw err;
    }

    // Kick off async processing (fire-and-forget)
    addAndProcessUrl(brandProfileId, domain, sitemapPage.id, normalizedUrl)
      .catch((err) =>
        console.error("[SitemapPages POST] Async processing failed:", err)
      );

    return NextResponse.json(
      { sitemapPageId: sitemapPage.id, status: "pending" },
      { status: 201 }
    );
  } catch (error) {
    console.error("[SitemapPages POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/sitemap-pages  { brandProfileId, sitemapPageId }
// Remove a URL and all associated data
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { brandProfileId, sitemapPageId } = body as {
      brandProfileId?: number;
      sitemapPageId?: string;
    };

    if (!brandProfileId || !sitemapPageId) {
      return NextResponse.json(
        { error: "brandProfileId and sitemapPageId are required" },
        { status: 400 }
      );
    }

    // Ownership check
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

    // Verify the sitemap page belongs to this brand profile
    const page = await prisma.sitemapPage.findFirst({
      where: { id: sitemapPageId, brand_profile_id: brandProfileId },
      select: { id: true, domain: true },
    });
    if (!page) {
      return NextResponse.json(
        { error: "Sitemap page not found" },
        { status: 404 }
      );
    }

    const result = await removeSitemapUrl(
      brandProfileId,
      page.domain,
      sitemapPageId
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[SitemapPages DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
