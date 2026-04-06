import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeUrl } from "@/lib/utils/normalize-url";
import { discoverPages } from "@/lib/services/sitemap-discovery.service";
import { discoverSitemap } from "@/lib/services/sitemap-parser.service";
import { detectPageType } from "@/lib/analysis/technical/dom-extractor";
import { extractLocaleFromUrl } from "@/lib/utils/locale-from-url";
import { PAGE_PRIORITY } from "@/lib/analysis/technical/types";
import type { SitemapEntry } from "@/lib/types/site-scraping.types";

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Hreflang-aware locale deduplication.
//
// 1. Build translation groups via hreflang alternate links (handles different
//    slugs across languages, e.g. /blog/que-es-fatca ↔ /en/blog/what-is-fatca-english).
// 2. Fall back to locale-prefix dedup for entries without hreflang data.
// 3. Within each group, prefer English ("en") version, then x-default, then
//    the non-prefixed URL.
// ---------------------------------------------------------------------------
function deduplicateWithHreflang(
  entries: SitemapEntry[]
): SitemapEntry[] {
  // Union-Find to group URLs that are translations of each other
  const norm = (url: string) => url.replace(/\/+$/, "").toLowerCase();
  const parent = new Map<string, string>();

  function find(u: string): string {
    let r = u;
    while (parent.get(r) !== r) r = parent.get(r) ?? r;
    // path compress
    let cur = u;
    while (cur !== r) {
      const next = parent.get(cur) ?? cur;
      parent.set(cur, r);
      cur = next;
    }
    return r;
  }

  function union(a: string, b: string) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  // Track hreflang metadata per URL (which hreflang code this URL represents)
  const hreflangOf = new Map<string, string>(); // normalized url → hreflang code

  // Initialize all entries
  for (const entry of entries) {
    const key = norm(entry.loc);
    if (!parent.has(key)) parent.set(key, key);

    if (entry.alternates) {
      for (const alt of entry.alternates) {
        const altKey = norm(alt.href);
        if (!parent.has(altKey)) parent.set(altKey, altKey);
        // Union the <loc> with each of its alternates
        union(key, altKey);
        // Record the hreflang code for this alternate URL
        hreflangOf.set(altKey, alt.hreflang);
      }
    }
  }

  // Group entries by their union-find root
  const groups = new Map<string, SitemapEntry[]>();
  for (const entry of entries) {
    const root = find(norm(entry.loc));
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(entry);
  }

  // Detect the site's default language from hreflang data.
  // If non-prefixed URLs are consistently tagged as a non-English language,
  // standalone non-prefixed pages are assumed to be in that language.
  let defaultLang: string | null = null;
  for (const entry of entries) {
    if (entry.alternates && !extractLocaleFromUrl(entry.loc)) {
      // This is a non-prefixed URL with hreflang data — check what language it's tagged as
      const selfHreflang = hreflangOf.get(norm(entry.loc));
      if (selfHreflang && selfHreflang !== "x-default" && selfHreflang !== "en") {
        defaultLang = selfHreflang;
        break; // one sample is enough
      }
    }
  }

  // Separate grouped (hreflang-linked) from ungrouped entries
  const ungrouped: SitemapEntry[] = [];
  const result: SitemapEntry[] = [];

  for (const group of groups.values()) {
    if (group.length === 1 && !group[0].alternates) {
      ungrouped.push(group[0]);
    } else {
      // Pick the best entry from the hreflang group
      result.push(pickPreferred(group, hreflangOf));
    }
  }

  // Locale-prefix dedup for remaining ungrouped entries
  const prefixGroups = new Map<string, SitemapEntry[]>();
  for (const entry of ungrouped) {
    const locale = extractLocaleFromUrl(entry.loc);

    // If the site's default language is non-English and this is a non-prefixed
    // standalone page, it's likely in the default (non-English) language → skip.
    if (defaultLang && !locale) {
      continue;
    }

    let canonicalPath: string;
    try {
      canonicalPath = new URL(entry.loc).pathname;
    } catch {
      prefixGroups.set(`__invalid_${entry.loc}`, [entry]);
      continue;
    }
    if (locale) {
      canonicalPath = canonicalPath.replace(
        new RegExp(`^/${locale}(?:-[a-z]{2})?(?=/|$)`, "i"),
        ""
      );
      if (!canonicalPath.startsWith("/")) canonicalPath = "/" + canonicalPath;
    }
    const key = canonicalPath.toLowerCase().replace(/\/+$/, "") || "/";
    if (!prefixGroups.has(key)) prefixGroups.set(key, []);
    prefixGroups.get(key)!.push(entry);
  }

  for (const group of prefixGroups.values()) {
    result.push(pickPreferred(group, hreflangOf));
  }

  return result;
}

/** From a group of locale variants, pick the English / preferred version. */
function pickPreferred(
  group: SitemapEntry[],
  hreflangOf: Map<string, string>
): SitemapEntry {
  if (group.length === 1) return group[0];

  const norm = (url: string) => url.replace(/\/+$/, "").toLowerCase();

  // 1. Prefer the entry whose hreflang is "en"
  const en = group.find((e) => {
    const code = hreflangOf.get(norm(e.loc));
    return code === "en";
  });
  if (en) return en;

  // 2. Prefer the entry with an /en/ locale prefix
  const enPrefixed = group.find(
    (e) => extractLocaleFromUrl(e.loc) === "en"
  );
  if (enPrefixed) return enPrefixed;

  // 3. Prefer x-default
  const xDefault = group.find((e) => {
    const code = hreflangOf.get(norm(e.loc));
    return code === "x-default";
  });
  if (xDefault) return xDefault;

  // 4. Prefer non-prefixed (the site's default language)
  const nonPrefixed = group.find(
    (e) => extractLocaleFromUrl(e.loc) === null
  );
  return nonPrefixed ?? group[0];
}

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
    const { brandProfileId, mode = "smart" } = body as {
      brandProfileId?: number;
      mode?: "smart" | "sitemap";
    };

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

    // Fetch existing tracked URLs for this brand (needed by both modes)
    const existingPages = await prisma.sitemapPage.findMany({
      where: { brand_profile_id: brandProfileId },
      select: { page_url: true },
    });
    const trackedUrls = new Set(
      existingPages.map((p) => normalizeUrl(p.page_url))
    );

    // ------------------------------------------------------------------
    // MODE: sitemap — direct XML parsing, all pages, no AI filtering
    // ------------------------------------------------------------------
    if (mode === "sitemap") {
      const sitemapResult = await discoverSitemap(companyWebsite);

      if (sitemapResult.entries.length === 0) {
        return NextResponse.json({
          pages: [],
          totalDiscovered: 0,
          newCount: 0,
          trackedCount: existingPages.length,
        });
      }

      // Deduplicate locale variants using hreflang data from the sitemap.
      // This handles both same-slug variants (/blog/X ↔ /en/blog/X) and
      // translated-slug variants (/blog/que-es-fatca ↔ /en/blog/what-is-fatca-english).
      const dedupedEntries = deduplicateWithHreflang(sitemapResult.entries);

      // Classify each entry and build page items
      const allPages = dedupedEntries.map((entry) => {
        const pageType = detectPageType(entry.loc);
        return {
          url: entry.loc,
          pageType,
          priority: PAGE_PRIORITY[pageType] ?? 10,
          title: null as string | null,
          reason: null as string | null,
          importance: null as number | null,
        };
      });

      // Filter to only untracked pages
      const newPages = allPages.filter(
        (p) => !trackedUrls.has(normalizeUrl(p.url))
      );

      return NextResponse.json({
        pages: newPages,
        totalDiscovered: sitemapResult.totalPages,
        newCount: newPages.length,
        trackedCount: existingPages.length,
      });
    }

    // ------------------------------------------------------------------
    // MODE: smart (default) — AI-powered discovery via Firecrawl + OpenAI
    // ------------------------------------------------------------------
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

    return NextResponse.json({
      pages: newPages,
      totalDiscovered: result.totalDiscovered,
      newCount: newPages.length,
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
