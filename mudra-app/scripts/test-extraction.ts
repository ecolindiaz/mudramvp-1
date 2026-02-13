/**
 * Test script: Compare Firecrawl extraction for two different domains
 * Tests ONLY the Firecrawl scraping step (no OpenAI competitor suggestion)
 *
 * Usage: npx tsx scripts/test-extraction.ts
 */

import FirecrawlApp from '@mendable/firecrawl-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY!;
if (!FIRECRAWL_API_KEY) { console.error('Missing FIRECRAWL_API_KEY'); process.exit(1); }

interface ExtractedCompanyInfo {
  companyDescription: string;
  industry: string;
  servicesProducts: string[];
  idealCustomerProfiles: string[];
  competitorUrls: string[];
}

async function extractCompanyInfo(url: string): Promise<ExtractedCompanyInfo | null> {
  const app = new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY });

  console.log(`\n🔍 Extracting from: ${url}`);
  const start = Date.now();

  const result: any = await app.scrapeUrl(url, {
    formats: ['json'],
    jsonOptions: {
      schema: {
        type: 'object',
        properties: {
          companyDescription: {
            type: 'string',
            description: 'A concise 2-3 sentence description of what the company does and its value proposition',
          },
          industry: {
            type: 'string',
            description: 'The primary industry the company operates in (e.g., Technology, Healthcare, Finance, Education, E-commerce, Manufacturing, Real Estate, Marketing, Consulting, SaaS, AI/ML)',
          },
          servicesProducts: {
            type: 'array',
            items: { type: 'string' },
            description: 'The actual named products, tools, or services with a brief description. Format: "Product Name - Brief description of what it does".',
          },
          idealCustomerProfiles: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific target customer segments with details about company size, role, or industry',
          },
          competitorUrls: {
            type: 'array',
            items: { type: 'string' },
            description: "URLs of competitor companies mentioned on the website. Do NOT include the company's own URL.",
          },
        },
        required: ['companyDescription', 'industry', 'servicesProducts', 'idealCustomerProfiles', 'competitorUrls'],
      },
      prompt: `Extract from this company website:
1) Company description: 2-3 sentences about what they do and their unique value
2) Industry: Their primary industry
3) Products/Services: List their ACTUAL named products, tools, platforms, or service offerings (up to 7). For EACH product, include the name AND a brief description of what it does. Format as "Product Name - Brief description".
4) Ideal Customer Profiles: 5 specific target customer segments.
5) Competitor URLs: Any competitor websites mentioned (exclude the company's own website)`,
    },
    onlyMainContent: false,
    timeout: 45000,
  } as any);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (!result.success || !result.json) {
    console.error(`  ❌ Failed (${elapsed}s):`, result.error);
    return null;
  }

  const raw = result.json as ExtractedCompanyInfo;
  const inputHostname = new URL(url).hostname.replace(/^www\./, '');

  const cleaned: ExtractedCompanyInfo = {
    companyDescription: raw.companyDescription || '',
    industry: raw.industry || '',
    servicesProducts: Array.isArray(raw.servicesProducts)
      ? raw.servicesProducts.filter((s) => typeof s === 'string' && s.trim()).slice(0, 7) : [],
    idealCustomerProfiles: Array.isArray(raw.idealCustomerProfiles)
      ? raw.idealCustomerProfiles.filter((s) => typeof s === 'string' && s.trim()).slice(0, 5) : [],
    competitorUrls: Array.isArray(raw.competitorUrls)
      ? raw.competitorUrls.filter((u) => {
          if (typeof u !== 'string') return false;
          try { return new URL(u).hostname.replace(/^www\./, '') !== inputHostname; } catch { return false; }
        }) : [],
  };

  console.log(`  ✅ Done (${elapsed}s)`);
  return cleaned;
}

function printResult(label: string, data: ExtractedCompanyInfo) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  ${label}`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`\n  Description:\n     ${data.companyDescription}`);
  console.log(`\n  Industry: ${data.industry}`);
  console.log(`\n  Products / Services:`);
  if (data.servicesProducts.length === 0) console.log('     (none extracted)');
  data.servicesProducts.forEach((p, i) => console.log(`     ${i + 1}. ${p}`));
  console.log(`\n  Ideal Customer Profiles:`);
  if (data.idealCustomerProfiles.length === 0) console.log('     (none extracted)');
  data.idealCustomerProfiles.forEach((p, i) => console.log(`     ${i + 1}. ${p}`));
  console.log(`\n  Competitors (from website):`);
  if (data.competitorUrls.length === 0) console.log('     (none found on website)');
  data.competitorUrls.forEach((u, i) => console.log(`     ${i + 1}. ${u}`));
}

async function main() {
  const domains = [
    { url: 'https://www.wallbit.io/en', label: 'Domain 1: wallbit.io (Main Site)' },
    { url: 'https://markets.wallbit.io/', label: 'Domain 2: markets.wallbit.io (Markets)' },
  ];

  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  Firecrawl Extraction Test — Comparing 2 Domains                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const results: { label: string; data: ExtractedCompanyInfo }[] = [];

  for (const domain of domains) {
    try {
      const data = await extractCompanyInfo(domain.url);
      if (!data) { console.error(`  ❌ Skipping ${domain.url}`); continue; }
      results.push({ label: domain.label, data });
    } catch (err: any) {
      console.error(`  ❌ Error for ${domain.url}: ${err.message}`);
    }
  }

  for (const r of results) printResult(r.label, r.data);

  if (results.length === 2) {
    const [a, b] = results;
    console.log(`\n${'═'.repeat(70)}`);
    console.log('  COMPARISON');
    console.log(`${'═'.repeat(70)}`);
    console.log(`\n  Same industry?     ${a.data.industry === b.data.industry ? 'YES' : `NO -> "${a.data.industry}" vs "${b.data.industry}"`}`);
    console.log(`  Same description?  ${a.data.companyDescription === b.data.companyDescription ? 'YES (bad — identical KB)' : 'NO (good — different knowledge bases)'}`);

    const aP = new Set(a.data.servicesProducts.map(s => s.split(' - ')[0]?.trim()));
    const bP = new Set(b.data.servicesProducts.map(s => s.split(' - ')[0]?.trim()));
    const shared = [...aP].filter(p => bP.has(p));
    console.log(`  Product overlap?   ${shared.length}/${Math.max(aP.size, bP.size)} shared`);

    console.log(`\n  WHAT HAPPENS NEXT (per-domain, handled by OpenAI in the real flow):`);
    console.log(`  - AI competitor suggestion: runs separately per domain using THAT domain's extraction`);
    console.log(`  - Prompt generation (Claude Sonnet 4.5): runs per brandProfileId, reads from DB`);
    console.log(`    Domain 1 BrandProfile -> industry="${a.data.industry}", services=[${a.data.servicesProducts.length} items]`);
    console.log(`    Domain 2 BrandProfile -> industry="${b.data.industry}", services=[${b.data.servicesProducts.length} items]`);
    console.log(`  - Each monitor gets unique prompts tailored to its own products/industry/ICP\n`);
  }
}

main().catch((err) => { console.error('Fatal:', err.message); process.exit(1); });
