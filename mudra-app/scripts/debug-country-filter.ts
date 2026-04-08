/**
 * Debug script: Check GeoAnalysisResult country values for a specific brandProfileId
 * Usage: npx tsx scripts/debug-country-filter.ts [brandProfileId]
 */
import { prisma } from '../lib/prisma'

async function main() {
  const brandProfileId = parseInt(process.argv[2] || '48')
  
  console.log(`\n=== Debugging country filter for brandProfileId: ${brandProfileId} ===\n`)
  
  // 1. Get ALL GeoAnalysisResults for this brand (no filters)
  const allResults = await prisma.geoAnalysisResult.findMany({
    where: { brandProfileId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      country: true,
      overallScore: true,
      createdAt: true,
      timestamp: true,
    }
  })
  
  console.log(`Total GeoAnalysisResults: ${allResults.length}`)
  
  if (allResults.length === 0) {
    console.log('No results found!')
    return
  }
  
  // 2. Show country distribution
  const countryDistribution = new Map<string, number>()
  const countryExamples = new Map<string, { id: number; createdAt: Date }[]>()
  
  for (const r of allResults) {
    const countryKey = r.country === null ? 'NULL' : r.country === '' ? 'EMPTY_STRING' : `"${r.country}"`
    countryDistribution.set(countryKey, (countryDistribution.get(countryKey) || 0) + 1)
    if (!countryExamples.has(countryKey)) countryExamples.set(countryKey, [])
    countryExamples.get(countryKey)!.push({ id: r.id, createdAt: r.createdAt })
  }
  
  console.log('\nCountry value distribution:')
  for (const [country, count] of countryDistribution.entries()) {
    console.log(`  ${country}: ${count} records`)
    const examples = countryExamples.get(country)!.slice(0, 3)
    for (const ex of examples) {
      console.log(`    - id=${ex.id}, createdAt=${ex.createdAt.toISOString()}`)
    }
  }
  
  // 3. Test the exact query from prompts/with-results
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)
  
  console.log(`\nQuery: country='US', createdAt >= ${sevenDaysAgo.toISOString()}, createdAt < ${now.toISOString()}`)
  const filteredResults = await prisma.geoAnalysisResult.findMany({
    where: {
      brandProfileId,
      country: 'US',
      createdAt: {
        gte: sevenDaysAgo,
        lt: now,
      }
    },
    select: { id: true, country: true, createdAt: true }
  })
  console.log(`Results with country='US' + date filter: ${filteredResults.length}`)
  
  // 4. Same query without country filter
  const noCountryResults = await prisma.geoAnalysisResult.findMany({
    where: {
      brandProfileId,
      createdAt: {
        gte: sevenDaysAgo,
        lt: now,
      }
    },
    select: { id: true, country: true, createdAt: true }
  })
  console.log(`Results without country filter + date filter: ${noCountryResults.length}`)
  if (noCountryResults.length > 0) {
    console.log('  Countries in these results:')
    for (const r of noCountryResults.slice(0, 10)) {
      console.log(`    id=${r.id}, country="${r.country}", createdAt=${r.createdAt.toISOString()}`)
    }
  }
  
  // 5. Check raw country values using Prisma's raw query
  console.log('\n--- Raw SQL check ---')
  const rawResults = await prisma.$queryRaw`
    SELECT id, country, "createdAt" 
    FROM "GeoAnalysisResult" 
    WHERE "brandProfileId" = ${brandProfileId}
    ORDER BY "createdAt" DESC
    LIMIT 10
  ` as any[]
  
  for (const r of rawResults) {
    const countryBytes = r.country ? Buffer.from(r.country).toString('hex') : 'null'
    console.log(`  id=${r.id}, country="${r.country}" (hex: ${countryBytes}), createdAt=${r.createdAt}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
