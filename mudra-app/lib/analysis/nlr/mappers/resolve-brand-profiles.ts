import { prisma } from "@/lib/prisma";

/**
 * Extract bare domain from a URL or domain string.
 * "https://www.example.com/path" → "example.com"
 */
function extractDomain(input: string): string {
  let d = input.trim();
  try {
    const url = new URL(d.includes("://") ? d : `https://${d}`);
    d = url.hostname;
  } catch {
    // Already a bare domain or malformed — strip protocol manually
    d = d.replace(/^https?:\/\//, "");
    d = d.split("/")[0];
  }
  return d.replace(/^www\./, "").toLowerCase();
}

/**
 * Extract the base (registrable) domain from a hostname.
 * "markets.wallbit.io" → "wallbit.io"
 * "developer.wallbit.io" → "wallbit.io"
 * "wallbit.io" → "wallbit.io"
 * "sub.deep.example.co.uk" → "example.co.uk"
 */
function extractBaseDomain(domain: string): string {
  const bare = domain.replace(/^www\./, "").toLowerCase();
  const parts = bare.split(".");
  if (parts.length <= 2) return bare;

  // Handle two-part TLDs like .co.uk, .com.br, .com.ar
  const twoPartTLDs = ["co.uk", "co.jp", "com.br", "com.ar", "com.au", "co.nz", "co.in", "org.uk", "net.au"];
  const lastTwo = parts.slice(-2).join(".");
  if (twoPartTLDs.includes(lastTwo)) {
    // e.g. sub.example.co.uk → example.co.uk
    return parts.slice(-3).join(".");
  }

  // Standard: take last 2 parts (e.g. markets.wallbit.io → wallbit.io)
  return parts.slice(-2).join(".");
}

/**
 * Resolve brandProfileIds from a companyId.
 * Pattern: companyId → Site.companyId → site.domain → match BrandProfile.companyWebsite
 *
 * BrandProfile.siteId is a tracking token (site_<hex>), NOT a Site.id (cuid),
 * so we match exclusively on companyWebsite / domain variants.
 */
export async function resolveBrandProfileIds(companyId: string): Promise<number[]> {
  const sites = await prisma.site.findMany({
    where: { companyId },
    select: { id: true, domain: true },
  });

  if (sites.length === 0) return [];

  const siteDomains = sites.map((s) => s.domain);

  // Build all URL variants for each domain (with/without www., with/without trailing slash)
  const websiteVariants: string[] = [];
  for (const d of siteDomains) {
    const bare = d.replace(/^www\./, "");
    const bases = [
      `https://${bare}`,
      `http://${bare}`,
      `https://www.${bare}`,
      `http://www.${bare}`,
      bare,
      `www.${bare}`,
    ];
    for (const b of bases) {
      websiteVariants.push(b);
      // Also match with trailing slash (e.g. "https://modal.com/")
      if (!b.endsWith("/")) websiteVariants.push(`${b}/`);
    }
  }

  const brandProfiles = await prisma.brandProfile.findMany({
    where: {
      companyWebsite: { in: websiteVariants },
    },
    select: { id: true, userId: true },
  });

  const foundIds = new Set(brandProfiles.map((bp) => bp.id));

  // Also find subdomain monitors: BrandProfiles from the same user(s)
  // whose companyWebsite domain ends with .{baseDomain}
  if (brandProfiles.length > 0) {
    const userIds = [...new Set(brandProfiles.map((bp) => bp.userId).filter(Boolean))];
    const baseDomains = [...new Set(siteDomains.map((d) => extractBaseDomain(d.replace(/^www\./, ""))))];

    if (userIds.length > 0 && baseDomains.length > 0) {
      const siblingProfiles = await prisma.brandProfile.findMany({
        where: {
          userId: { in: userIds as string[] },
          id: { notIn: [...foundIds] },
        },
        select: { id: true, companyWebsite: true },
      });

      for (const sp of siblingProfiles) {
        if (!sp.companyWebsite) continue;
        const spDomain = extractDomain(sp.companyWebsite);
        const spBase = extractBaseDomain(spDomain);
        if (baseDomains.includes(spBase)) {
          foundIds.add(sp.id);
        }
      }
    }
  }

  return [...foundIds];
}

/**
 * Resolve companyId from a brandProfileId.
 * Pattern: BrandProfile.companyWebsite → extract bare domain → Company.findFirst({ domain })
 * Fallback: Site.findFirst({ domain }) → site.companyId
 *
 * Lookup chain:
 *   1. exact domain
 *   2. www.{domain}
 *   3. base domain (strip subdomains)
 *   4. www.{baseDomain}
 *   5. Site table (exact + www)
 *   6. Site table (base domain + www.base)
 *   7. sibling BrandProfile (same userId, resolve their companyId)
 */
export async function resolveCompanyIdFromBrandProfile(
  brandProfileId: number
): Promise<string | null> {
  const bp = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    select: { companyWebsite: true, userId: true },
  });
  if (!bp?.companyWebsite) return null;

  const domain = extractDomain(bp.companyWebsite);
  if (!domain) return null;

  // 1. Try Company table with exact domain
  const company = await prisma.company.findUnique({
    where: { domain },
    select: { id: true },
  });
  if (company) return company.id;

  // 2. Try with www. prefix
  const companyWww = await prisma.company.findUnique({
    where: { domain: `www.${domain}` },
    select: { id: true },
  });
  if (companyWww) return companyWww.id;

  // 3-4. Try base domain (strip subdomains like markets.wallbit.io → wallbit.io)
  const baseDomain = extractBaseDomain(domain);
  if (baseDomain !== domain) {
    const companyBase = await prisma.company.findUnique({
      where: { domain: baseDomain },
      select: { id: true },
    });
    if (companyBase) return companyBase.id;

    const companyBaseWww = await prisma.company.findUnique({
      where: { domain: `www.${baseDomain}` },
      select: { id: true },
    });
    if (companyBaseWww) return companyBaseWww.id;
  }

  // 5. Fallback: Site table (exact + www)
  const site = await prisma.site.findFirst({
    where: { domain: { in: [domain, `www.${domain}`] } },
    select: { companyId: true },
  });
  if (site?.companyId) return site.companyId;

  // 6. Site table with base domain
  if (baseDomain !== domain) {
    const siteBase = await prisma.site.findFirst({
      where: { domain: { in: [baseDomain, `www.${baseDomain}`] } },
      select: { companyId: true },
    });
    if (siteBase?.companyId) return siteBase.companyId;
  }

  // 7. Sibling BrandProfile fallback: find another BrandProfile from the same user
  //    whose domain shares the same base domain, and resolve their companyId
  if (bp.userId) {
    const siblings = await prisma.brandProfile.findMany({
      where: {
        userId: bp.userId,
        id: { not: brandProfileId },
        companyWebsite: { not: null },
      },
      select: { id: true, companyWebsite: true },
    });

    for (const sibling of siblings) {
      if (!sibling.companyWebsite) continue;
      const siblingDomain = extractDomain(sibling.companyWebsite);
      const siblingBase = extractBaseDomain(siblingDomain);
      if (siblingBase === baseDomain) {
        // This sibling shares the same base domain — resolve their companyId
        const siblingCompany = await prisma.company.findFirst({
          where: { domain: { in: [siblingDomain, `www.${siblingDomain}`, siblingBase, `www.${siblingBase}`] } },
          select: { id: true },
        });
        if (siblingCompany) return siblingCompany.id;

        const siblingSite = await prisma.site.findFirst({
          where: { domain: { in: [siblingDomain, `www.${siblingDomain}`, siblingBase, `www.${siblingBase}`] } },
          select: { companyId: true },
        });
        if (siblingSite?.companyId) return siblingSite.companyId;
      }
    }
  }

  return null;
}
