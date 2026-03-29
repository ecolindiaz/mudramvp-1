import { config as loadEnv } from 'dotenv';
import { prisma } from '../lib/prisma';
import { runUnifiedAnalysis } from '../lib/services/unified-analysis.service';

function loadEnvironment(): void {
  // Prefer .env.local for local development, then fall back to .env.
  loadEnv({ path: '.env.local' });
  loadEnv();
}

function normalizeWebsiteUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Website URL is empty');
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function parseArgs(argv: string[]): { brandProfileId: number; websiteOverride?: string } {
  const idRaw = argv[2];
  if (!idRaw) {
    throw new Error('Usage: npx tsx scripts/trigger-technical-analysis.ts <brandProfileId> [websiteOverride]');
  }

  const brandProfileId = Number(idRaw);
  if (!Number.isInteger(brandProfileId) || brandProfileId <= 0) {
    throw new Error(`Invalid brandProfileId: ${idRaw}`);
  }

  const websiteOverride = argv[3]?.trim() || undefined;
  return { brandProfileId, websiteOverride };
}

async function main(): Promise<void> {
  loadEnvironment();

  const { brandProfileId, websiteOverride } = parseArgs(process.argv);

  const profile = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    select: {
      id: true,
      companyName: true,
      companyWebsite: true,
      companyDescription: true,
      companyIndustry: true,
      competitors: true,
    },
  });

  if (!profile) {
    throw new Error(`Brand profile not found: ${brandProfileId}`);
  }

  const resolvedBrandName: string = (profile.companyName ?? '').trim();
  if (!resolvedBrandName) {
    throw new Error(`Brand profile ${brandProfileId} has no companyName`);
  }

  const rawWebsiteCandidate: string = websiteOverride ?? profile.companyWebsite ?? '';
  const website = normalizeWebsiteUrl(rawWebsiteCandidate);

  console.log(`[Manual Trigger] Running technical analysis for brandProfileId=${brandProfileId}`);
  console.log(`[Manual Trigger] Website: ${website}`);

  const competitors = typeof profile.competitors === 'string'
    ? profile.competitors.split(',').map((entry) => entry.trim()).filter(Boolean)
    : [];

  const result = await runUnifiedAnalysis({
    brandProfileId,
    brandName: resolvedBrandName,
    website,
    description: profile.companyDescription || undefined,
    industry: profile.companyIndustry || undefined,
    competitors,
    skipCooldown: true,
    generateReport: false,
    phase: 'technical',
  });

  console.log('\n[Manual Trigger] Result:');
  console.log(JSON.stringify(result, null, 2));

  if (!result.success || !result.technicalAnalysisId) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('[Manual Trigger] Failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
