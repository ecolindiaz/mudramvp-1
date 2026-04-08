import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeUrl } from "@/lib/utils/normalize-url";
import { extractLocaleFromUrl } from "@/lib/utils/locale-from-url";
import { addAndProcessUrl } from "@/lib/services/sitemap-page-management.service";

export const maxDuration = 300;

// ---------------------------------------------------------------------------
// POST /api/sitemap-pages/bulk  { brandProfileId, urls }
// Bulk-add multiple URLs — creates all as pending, processes sequentially
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { brandProfileId, urls } = body as {
      brandProfileId?: number;
      urls?: string[];
    };

    if (!brandProfileId || !urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: "brandProfileId and urls (non-empty array) are required" },
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

    // Parse company domain for validation
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

    // Fetch existing tracked URLs to check duplicates in bulk
    const existingPages = await prisma.sitemapPage.findMany({
      where: { brand_profile_id: brandProfileId },
      select: { page_url: true },
    });
    const trackedUrls = new Set(
      existingPages.map((p) => normalizeUrl(p.page_url))
    );

    const added: Array<{ url: string; sitemapPageId: string }> = [];
    const skipped: Array<{ url: string; reason: string }> = [];

    for (const url of urls) {
      // Validate URL format
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        skipped.push({ url, reason: "Invalid URL format" });
        continue;
      }

      // Domain validation
      const inputHost = parsedUrl.hostname.replace(/^www\./, "");
      if (inputHost !== companyHost) {
        skipped.push({ url, reason: `URL must belong to ${companyHost}` });
        continue;
      }

      const normalizedUrl = normalizeUrl(url);
      const domain = parsedUrl.origin.replace(/^(https?:\/\/)www\./i, '$1');

      // Duplicate check (in-memory + DB-level)
      if (trackedUrls.has(normalizedUrl)) {
        skipped.push({ url, reason: "Already tracked" });
        continue;
      }

      // Create SitemapPage record
      try {
        const sitemapPage = await prisma.sitemapPage.create({
          data: {
            brand_profile_id: brandProfileId,
            domain,
            page_url: normalizedUrl,
            locale: extractLocaleFromUrl(normalizedUrl),
            page_type: null,
            scrape_status: "pending",
          },
        });

        added.push({ url: normalizedUrl, sitemapPageId: sitemapPage.id });
        trackedUrls.add(normalizedUrl); // Prevent duplicates within the batch
      } catch (err: unknown) {
        // Unique constraint violation — concurrent insert
        if (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code: string }).code === "P2002"
        ) {
          skipped.push({ url, reason: "Already tracked" });
        } else {
          skipped.push({ url, reason: "Database error" });
          console.error("[SitemapPages Bulk] Create failed for", url, err);
        }
      }
    }

    // Process added pages after response is sent (keeps serverless function alive)
    if (added.length > 0) {
      const domain = added[0].url.startsWith("http")
        ? new URL(added[0].url).origin
        : `https://${companyHost}`;

      after(async () => {
        for (const item of added) {
          try {
            await addAndProcessUrl(
              brandProfileId,
              domain,
              item.sitemapPageId,
              item.url,
              { skipIssueCreation: true }
            );
          } catch (err) {
            console.error(
              `[SitemapPages Bulk] Processing failed for ${item.url}:`,
              err
            );
          }
        }
      });
    }

    return NextResponse.json(
      {
        added: added.map((a) => ({
          url: a.url,
          sitemapPageId: a.sitemapPageId,
        })),
        skipped,
        totalAdded: added.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[SitemapPages Bulk]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
