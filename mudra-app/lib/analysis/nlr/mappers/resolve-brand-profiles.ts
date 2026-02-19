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
    select: { id: true },
  });

  return brandProfiles.map((bp) => bp.id);
}

/**
 * Resolve companyId from a brandProfileId.
 * Pattern: BrandProfile.companyWebsite → extract bare domain → Company.findFirst({ domain })
 * Fallback: Site.findFirst({ domain }) → site.companyId
 */
export async function resolveCompanyIdFromBrandProfile(
  brandProfileId: number
): Promise<string | null> {
  const bp = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    select: { companyWebsite: true },
  });
  if (!bp?.companyWebsite) return null;

  const domain = extractDomain(bp.companyWebsite);
  if (!domain) return null;

  // Try Company table first (domain is unique)
  const company = await prisma.company.findUnique({
    where: { domain },
    select: { id: true },
  });
  if (company) return company.id;

  // Fallback: try with www. prefix
  const companyWww = await prisma.company.findUnique({
    where: { domain: `www.${domain}` },
    select: { id: true },
  });
  if (companyWww) return companyWww.id;

  // Fallback: Site table (domain may include www.)
  const site = await prisma.site.findFirst({
    where: { domain: { in: [domain, `www.${domain}`] } },
    select: { companyId: true },
  });
  return site?.companyId ?? null;
}
