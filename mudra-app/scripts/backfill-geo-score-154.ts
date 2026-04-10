/**
 * Backfill script: Fix GeoAnalysisResult id=154 overallScore
 * 
 * The overallScore was stored as 0 because Claude had 0 prompt tests,
 * causing NaN to propagate through the averaging calculation.
 * 
 * Recalculates overallScore from the stored per-provider analyses JSON.
 * 
 * Usage: npx tsx scripts/backfill-geo-score-154.ts
 */

import { prisma } from '../lib/prisma';

interface ProviderAnalysis {
  provider: string;
  brandVisibilityScore: number;
  promptTests: unknown[];
}

async function backfill() {
  const record = await prisma.geoAnalysisResult.findUnique({
    where: { id: 154 },
  });

  if (!record) {
    console.error('GeoAnalysisResult id=154 not found');
    process.exit(1);
  }

  console.log(`Current overallScore: ${record.overallScore}`);

  const analyses = record.analyses as unknown as ProviderAnalysis[];
  if (!Array.isArray(analyses) || analyses.length === 0) {
    console.error('No analyses data found in record');
    process.exit(1);
  }

  // Recalculate: treat NaN/undefined scores as 0, average across all providers
  const scores = analyses.map(a => {
    const score = Number.isFinite(a.brandVisibilityScore) ? a.brandVisibilityScore : 0;
    console.log(`  ${a.provider}: visibilityScore=${a.brandVisibilityScore}, tests=${a.promptTests?.length ?? 0}, using=${score}`);
    return score;
  });

  const correctedScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
  console.log(`\nRecalculated overallScore: ${correctedScore}`);

  if (correctedScore === record.overallScore) {
    console.log('Score already correct, no update needed.');
    return;
  }

  await prisma.geoAnalysisResult.update({
    where: { id: 154 },
    data: { overallScore: correctedScore },
  });

  console.log(`✅ Updated GeoAnalysisResult id=154 overallScore: ${record.overallScore} → ${correctedScore}`);
}

backfill()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
