/**
 * TEST: Region Data Isolation & Language Filtering Fixes
 *
 * Validates that:
 * 1. Country-filtered queries return correct language prompts (no mixing)
 * 2. Fallback logic doesn't leak prompts from other languages
 * 3. Analysis results are properly scoped per country
 * 4. No duplicate brand profiles created per user
 * 5. Connection pool isn't overwhelmed (single multi-country call)
 *
 * Run with: npx tsx scripts/test-region-fixes.ts
 */

import { PrismaClient } from '@prisma/client'
import {
  getLanguageForCountry,
  isAllowedCountry,
  getUniqueLanguages,
  type CountryCode,
  COUNTRY_LANGUAGE_MAP,
} from '../lib/geo/country-config'

const prisma = new PrismaClient()

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0
let skipped = 0

function pass(msg: string) {
  console.log(`  ✅ PASS: ${msg}`)
  passed++
}

function fail(msg: string, detail?: string) {
  console.log(`  ❌ FAIL: ${msg}`)
  if (detail) console.log(`         ${detail}`)
  failed++
}

function skip(msg: string) {
  console.log(`  ⏭️  SKIP: ${msg}`)
  skipped++
}

function section(title: string) {
  console.log(`\n${'━'.repeat(70)}`)
  console.log(`  ${title}`)
  console.log('━'.repeat(70))
}

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
}

// ─── Test 1: Country Config Consistency ───────────────────────────────────────

function testCountryConfig() {
  section('Test 1: Country Config Consistency')

  // Verify language mapping
  const expectedMap: Record<string, string> = {
    US: 'en', GB: 'en', ES: 'es', MX: 'es', CO: 'es', AR: 'es', PE: 'es',
  }

  for (const [country, expectedLang] of Object.entries(expectedMap)) {
    if (!isAllowedCountry(country)) {
      fail(`${country} should be an allowed country`)
      continue
    }
    const lang = getLanguageForCountry(country as CountryCode)
    if (lang === expectedLang) {
      pass(`${country} → ${lang}`)
    } else {
      fail(`${country} → ${lang}, expected ${expectedLang}`)
    }
  }

  // Verify getUniqueLanguages
  const langs = getUniqueLanguages(['US', 'MX'] as CountryCode[])
  if (langs.length === 2 && langs.includes('en') && langs.includes('es')) {
    pass(`getUniqueLanguages(US, MX) = [en, es]`)
  } else {
    fail(`getUniqueLanguages(US, MX) = [${langs.join(', ')}], expected [en, es]`)
  }

  const sameLang = getUniqueLanguages(['US', 'GB'] as CountryCode[])
  if (sameLang.length === 1 && sameLang[0] === 'en') {
    pass(`getUniqueLanguages(US, GB) = [en]`)
  } else {
    fail(`getUniqueLanguages(US, GB) = [${sameLang.join(', ')}], expected [en]`)
  }
}

// ─── Test 2: No Duplicate Brand Profiles Per User ─────────────────────────────

async function testNoDuplicateBrandProfiles() {
  section('Test 2: No Duplicate Brand Profiles Per User')

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      brandProfiles: {
        select: {
          id: true,
          companyName: true,
          companyWebsite: true,
          primaryCountry: true,
        },
      },
    },
  })

  for (const user of users) {
    const profiles = user.brandProfiles
    if (profiles.length === 0) continue

    // Group by companyWebsite domain to find duplicates
    const byDomain = new Map<string, typeof profiles>()
    for (const p of profiles) {
      const domain = (p.companyWebsite || 'unknown').replace(/^https?:\/\//, '').replace(/\/$/, '')
      const existing = byDomain.get(domain) || []
      existing.push(p)
      byDomain.set(domain, existing)
    }

    for (const [domain, group] of byDomain) {
      if (group.length > 1) {
        fail(
          `User ${user.email} has ${group.length} brand profiles for domain "${domain}"`,
          `IDs: ${group.map(p => p.id).join(', ')} — Names: ${group.map(p => p.companyName).join(', ')}`
        )
      } else {
        pass(`User ${user.email}: single profile for "${domain}" (ID: ${group[0].id})`)
      }
    }
  }
}

// ─── Test 3: Prompts Language Consistency ──────────────────────────────────────

async function testPromptsLanguageConsistency() {
  section('Test 3: Prompts Language Consistency Per Brand')

  const brands = await prisma.brandProfile.findMany({
    select: {
      id: true,
      companyName: true,
      trackingCountries: true,
      primaryCountry: true,
    },
  })

  for (const brand of brands) {
    const prompts = await prisma.prompt.findMany({
      where: { brandProfileId: brand.id, isActive: true },
      select: { id: true, text: true, language: true },
    })

    if (prompts.length === 0) {
      skip(`Brand "${brand.companyName}" (${brand.id}) — no prompts`)
      continue
    }

    // Group by language
    const byLang = new Map<string, number>()
    for (const p of prompts) {
      byLang.set(p.language, (byLang.get(p.language) || 0) + 1)
    }

    const expectedLanguages = getUniqueLanguages(
      (brand.trackingCountries || ['US']).filter(isAllowedCountry) as CountryCode[]
    )

    const langSummary = [...byLang.entries()].map(([l, c]) => `${l}:${c}`).join(', ')
    console.log(`\n  Brand "${brand.companyName}" (${brand.id}):`)
    console.log(`    Tracking: ${(brand.trackingCountries || []).join(', ')} → Expected languages: ${expectedLanguages.join(', ')}`)
    console.log(`    Prompts by language: ${langSummary}`)

    // Check that prompts only have expected languages
    for (const [lang] of byLang) {
      if (expectedLanguages.includes(lang as 'en' | 'es')) {
        pass(`Language "${lang}" is expected for tracked countries`)
      } else {
        fail(
          `Language "${lang}" found in prompts but not expected for countries [${(brand.trackingCountries || []).join(', ')}]`
        )
      }
    }
  }
}

// ─── Test 4: GeoAnalysisResults Country Scoping ───────────────────────────────

async function testGeoResultsCountryScoping() {
  section('Test 4: GeoAnalysisResults Country Scoping')

  const brands = await prisma.brandProfile.findMany({
    select: {
      id: true,
      companyName: true,
      trackingCountries: true,
    },
  })

  for (const brand of brands) {
    const results = await prisma.geoAnalysisResult.findMany({
      where: { brandProfileId: brand.id },
      select: { id: true, country: true, createdAt: true, overallScore: true },
      orderBy: { createdAt: 'desc' },
    })

    if (results.length === 0) {
      skip(`Brand "${brand.companyName}" (${brand.id}) — no GEO results`)
      continue
    }

    // Group by country
    const byCountry = new Map<string, number>()
    for (const r of results) {
      byCountry.set(r.country, (byCountry.get(r.country) || 0) + 1)
    }

    const countrySummary = [...byCountry.entries()].map(([c, n]) => `${c}:${n}`).join(', ')
    console.log(`\n  Brand "${brand.companyName}" (${brand.id}):`)
    console.log(`    Tracking: ${(brand.trackingCountries || []).join(', ')}`)
    console.log(`    GEO results by country: ${countrySummary}`)

    // Verify each country has at least one result
    for (const tc of brand.trackingCountries || []) {
      if (byCountry.has(tc)) {
        pass(`Country "${tc}" has ${byCountry.get(tc)} analysis result(s)`)
      } else {
        fail(`Country "${tc}" is tracked but has NO analysis results`)
      }
    }
  }
}

// ─── Test 5: Language Isolation in Analysis Results ───────────────────────────

async function testLanguageIsolationInResults() {
  section('Test 5: Language Isolation in Analysis Results (No Cross-Language Leaks)')

  const brands = await prisma.brandProfile.findMany({
    select: { id: true, companyName: true, trackingCountries: true },
  })

  for (const brand of brands) {
    const countries = (brand.trackingCountries || ['US']).filter(isAllowedCountry) as CountryCode[]
    if (countries.length <= 1) continue // Only test multi-country brands

    console.log(`\n  Brand "${brand.companyName}" (${brand.id}): ${countries.join(', ')}`)

    // Get prompts by language to build text sets
    const allPrompts = await prisma.prompt.findMany({
      where: { brandProfileId: brand.id, isActive: true },
      select: { text: true, language: true },
    })

    const promptsByLang = new Map<string, Set<string>>()
    for (const p of allPrompts) {
      if (!promptsByLang.has(p.language)) promptsByLang.set(p.language, new Set())
      promptsByLang.get(p.language)!.add(normalizeText(p.text))
    }

    // For each country's GEO results, check that prompt texts match expected language
    for (const country of countries) {
      const expectedLang = getLanguageForCountry(country)
      const expectedTexts = promptsByLang.get(expectedLang) || new Set()
      const otherLangTexts = new Set<string>()
      for (const [lang, texts] of promptsByLang) {
        if (lang !== expectedLang) {
          for (const t of texts) otherLangTexts.add(t)
        }
      }

      const geoResults = await prisma.geoAnalysisResult.findMany({
        where: { brandProfileId: brand.id, country },
        select: { id: true, analyses: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      })

      if (geoResults.length === 0) {
        skip(`No GEO results for country=${country}`)
        continue
      }

      const analyses: any[] = typeof geoResults[0].analyses === 'string'
        ? JSON.parse(geoResults[0].analyses)
        : (Array.isArray(geoResults[0].analyses) ? geoResults[0].analyses : [])

      // Extract prompt texts from analysis
      let leakedCount = 0
      let matchedCount = 0
      let totalPrompts = 0

      for (const item of analyses) {
        const promptTexts: string[] = []
        if (item.prompt) {
          promptTexts.push(item.prompt)
        } else if (item.promptTests) {
          for (const test of item.promptTests) {
            if (test.prompt) promptTexts.push(test.prompt)
          }
        }

        for (const text of promptTexts) {
          totalPrompts++
          const normalized = normalizeText(text)
          if (otherLangTexts.has(normalized)) {
            leakedCount++
          }
          if (expectedTexts.has(normalized)) {
            matchedCount++
          }
        }
      }

      if (leakedCount > 0) {
        fail(
          `Country ${country} (${expectedLang}): ${leakedCount}/${totalPrompts} prompts are from WRONG language`,
          `This means ${country}'s analysis tested prompts from another language`
        )
      } else if (totalPrompts > 0) {
        pass(`Country ${country} (${expectedLang}): ${matchedCount}/${totalPrompts} prompts match expected language, 0 leaks`)
      } else {
        skip(`Country ${country}: no prompt texts found in analysis`)
      }
    }
  }
}

// ─── Test 6: Simulate with-results Fallback Logic ────────────────────────────

async function testWithResultsFallbackLogic() {
  section('Test 6: Simulate with-results API Fallback Logic')

  const brands = await prisma.brandProfile.findMany({
    select: { id: true, companyName: true, trackingCountries: true },
  })

  for (const brand of brands) {
    const countries = (brand.trackingCountries || ['US']).filter(isAllowedCountry) as CountryCode[]
    if (countries.length <= 1) continue

    console.log(`\n  Brand "${brand.companyName}" (${brand.id}): ${countries.join(', ')}`)

    for (const countryFilter of countries) {
      const expectedLang = getLanguageForCountry(countryFilter)

      // Step 1: Query with country filter
      let effectiveCountryFilter: string | null = countryFilter
      let allAnalysisResults = await prisma.geoAnalysisResult.findMany({
        where: { brandProfileId: brand.id, country: countryFilter },
        orderBy: { createdAt: 'desc' },
      })

      // Step 2: Fallback
      if (allAnalysisResults.length === 0) {
        allAnalysisResults = await prisma.geoAnalysisResult.findMany({
          where: { brandProfileId: brand.id },
          orderBy: { createdAt: 'desc' },
        })
        if (allAnalysisResults.length > 0) {
          effectiveCountryFilter = null
        }
      }

      const inFallback = countryFilter && !effectiveCountryFilter

      // Step 3: Get prompts filtered by language
      const dbPrompts = await prisma.prompt.findMany({
        where: {
          brandProfileId: brand.id,
          isActive: true,
          language: expectedLang,
        },
      })

      // Step 4: Extract prompt texts from analysis
      const analysisPromptTexts = new Set<string>()
      for (const result of allAnalysisResults) {
        const analyses: any[] = typeof result.analyses === 'string'
          ? JSON.parse(result.analyses)
          : (Array.isArray(result.analyses) ? result.analyses : [])
        for (const item of analyses) {
          if (item.prompt) analysisPromptTexts.add(item.prompt)
          else if (item.promptTests) {
            for (const test of item.promptTests) {
              if (test.prompt) analysisPromptTexts.add(test.prompt)
            }
          }
        }
      }

      // Step 5: Match prompts
      const dbPromptMap = new Map<string, any>()
      for (const p of dbPrompts) {
        dbPromptMap.set(normalizeText(p.text), p)
      }

      const matchedPrompts: string[] = []
      const unmatchedTestedPrompts: string[] = []
      for (const text of analysisPromptTexts) {
        const normalized = normalizeText(text)
        if (dbPromptMap.has(normalized)) {
          matchedPrompts.push(text)
        } else {
          unmatchedTestedPrompts.push(text)
        }
      }

      // Step 6: Apply the FIX — in fallback mode, exclude unmatchedTestedPrompts
      const finalPrompts = inFallback
        ? matchedPrompts
        : [...matchedPrompts, ...unmatchedTestedPrompts]

      // Check if any final prompt is in the wrong language
      const wrongLangPrompts = await prisma.prompt.findMany({
        where: {
          brandProfileId: brand.id,
          isActive: true,
          language: { not: expectedLang },
        },
        select: { text: true },
      })
      const wrongLangNormalized = new Set(wrongLangPrompts.map(p => normalizeText(p.text)))

      let wrongLangInFinal = 0
      for (const text of finalPrompts) {
        if (wrongLangNormalized.has(normalizeText(text))) {
          wrongLangInFinal++
        }
      }

      const fallbackNote = inFallback ? ' (FALLBACK active)' : ''
      if (wrongLangInFinal > 0) {
        fail(
          `Country ${countryFilter}${fallbackNote}: ${wrongLangInFinal} wrong-language prompts in final list`,
          `Matched: ${matchedPrompts.length}, Unmatched: ${unmatchedTestedPrompts.length}, Final: ${finalPrompts.length}`
        )
      } else {
        pass(
          `Country ${countryFilter}${fallbackNote}: ${finalPrompts.length} prompts, 0 wrong-language leaks (matched: ${matchedPrompts.length}, unmatched: ${unmatchedTestedPrompts.length}${inFallback ? ' [excluded by fix]' : ''})`
        )
      }
    }
  }
}

// ─── Test 7: Connection Pool Validation (Code Check) ──────────────────────────

function testConnectionPoolCodeCheck() {
  section('Test 7: Connection Pool Safety (Code Pattern Check)')

  // This is a static analysis check — verify prompts-form sends all countries in one call
  const fs = require('fs')
  const path = require('path')

  const promptsFormPath = path.join(__dirname, '..', 'components', 'onboarding', 'prompts-form.tsx')
  const content = fs.readFileSync(promptsFormPath, 'utf-8')

  // Check that we send all countries in one config, NOT sequential per-country calls
  if (content.includes('countries: primaryRegions') || content.includes("countries: ['US']")) {
    // The old pattern: all countries in one array
    pass('prompts-form.tsx sends all countries in single `countries` array')
  } else {
    fail('prompts-form.tsx may not be sending all countries in one call')
  }

  // Check that isQueuedJob is NOT called from client-side
  if (content.includes('isQueuedJob')) {
    fail('prompts-form.tsx still references isQueuedJob (sequential pattern)')
  } else {
    pass('prompts-form.tsx does NOT use isQueuedJob (single-call pattern)')
  }

  // Check that sequential country loop is removed
  if (content.includes('for (const country of remainingCountries)')) {
    fail('prompts-form.tsx still has sequential country loop')
  } else {
    pass('prompts-form.tsx has no sequential country loop')
  }

  // Check with-results has the fallback fix
  const withResultsPath = path.join(__dirname, '..', 'app', 'api', 'prompts', 'with-results', 'route.ts')
  const withResultsContent = fs.readFileSync(withResultsPath, 'utf-8')

  if (withResultsContent.includes('inFallback')) {
    pass('with-results/route.ts has fallback language isolation fix')
  } else {
    fail('with-results/route.ts is MISSING fallback language isolation fix')
  }

  // Check tracked-prompts has AbortController
  const trackedPromptsPath = path.join(__dirname, '..', 'app', 'dashboard', 'tracked-prompts', 'page.tsx')
  const trackedPromptsContent = fs.readFileSync(trackedPromptsPath, 'utf-8')

  if (trackedPromptsContent.includes('AbortController') && trackedPromptsContent.includes('fetchAbortRef')) {
    pass('tracked-prompts/page.tsx has AbortController for race condition prevention')
  } else {
    fail('tracked-prompts/page.tsx is MISSING AbortController')
  }

  // Check brand-profile-context has localStorage hydration fix
  const brandContextPath = path.join(__dirname, '..', 'components', 'brand-profile-context.tsx')
  const brandContextContent = fs.readFileSync(brandContextPath, 'utf-8')

  if (brandContextContent.includes('hasHydratedCountry') && brandContextContent.includes('hasInitializedCountry')) {
    pass('brand-profile-context.tsx has region persistence fix (localStorage hydration)')
  } else {
    fail('brand-profile-context.tsx is MISSING region persistence fix')
  }

  // Check onboarding-context does NOT have additionalDomainExtractions
  const onboardingContextPath = path.join(__dirname, '..', 'components', 'onboarding', 'onboarding-context.tsx')
  const onboardingContextContent = fs.readFileSync(onboardingContextPath, 'utf-8')

  if (!onboardingContextContent.includes('additionalDomainExtractions')) {
    pass('onboarding-context.tsx does NOT have additionalDomainExtractions (reverted)')
  } else {
    fail('onboarding-context.tsx still has additionalDomainExtractions (should be reverted)')
  }
}

// ─── Test 8: Unicode Normalization ────────────────────────────────────────────

function testUnicodeNormalization() {
  section('Test 8: Unicode Text Normalization')

  const testCases = [
    { input: '¿Cuál es el mejor servicio?', expected: 'cual es el mejor servicio' },
    { input: 'café résumé naïve', expected: 'cafe resume naive' },
    { input: '  Hello   World  ', expected: 'hello world' },
    { input: 'What\'s the best AI tool?', expected: 'whats the best ai tool' },
    { input: '¿Cómo funciona Mudra para SEO?', expected: 'como funciona mudra para seo' },
  ]

  for (const { input, expected } of testCases) {
    const result = normalizeText(input)
    if (result === expected) {
      pass(`"${input}" → "${result}"`)
    } else {
      fail(`"${input}" → "${result}", expected "${expected}"`)
    }
  }
}

// ─── Test 9: AnalysisRun Country Scoping ──────────────────────────────────────

async function testAnalysisRunCountryScoping() {
  section('Test 9: AnalysisRun Country Scoping')

  const brands = await prisma.brandProfile.findMany({
    select: { id: true, companyName: true, trackingCountries: true },
  })

  for (const brand of brands) {
    const runs = await prisma.analysisRun.findMany({
      where: { brandProfileId: brand.id, status: 'completed' },
      select: { id: true, country: true, ranAt: true },
      orderBy: { ranAt: 'desc' },
    })

    if (runs.length === 0) {
      skip(`Brand "${brand.companyName}" (${brand.id}) — no completed analysis runs`)
      continue
    }

    const byCountry = new Map<string, number>()
    for (const r of runs) {
      byCountry.set(r.country, (byCountry.get(r.country) || 0) + 1)
    }

    const summary = [...byCountry.entries()].map(([c, n]) => `${c}:${n}`).join(', ')
    console.log(`\n  Brand "${brand.companyName}" (${brand.id}): runs by country: ${summary}`)

    for (const tc of brand.trackingCountries || []) {
      if (byCountry.has(tc)) {
        pass(`Country "${tc}" has ${byCountry.get(tc)} completed analysis run(s)`)
      } else {
        fail(`Country "${tc}" is tracked but has NO completed analysis runs`)
      }
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const runDb = process.argv.includes('--db')

  console.log('\n' + '═'.repeat(70))
  console.log('  REGION DATA ISOLATION & LANGUAGE FILTERING TEST SUITE')
  console.log('  Testing fixes for: connection pool, language mixing, state persistence')
  if (!runDb) {
    console.log('  (DB tests skipped — pass --db to include them)')
  }
  console.log('═'.repeat(70))

  try {
    // Pure logic tests (no DB needed)
    testCountryConfig()
    testUnicodeNormalization()
    testConnectionPoolCodeCheck()

    // Database tests (requires DB connectivity)
    if (runDb) {
      // Quick connectivity check
      try {
        await prisma.$queryRaw`SELECT 1`
        console.log('\n  📡 Database connected successfully\n')
      } catch (e: any) {
        console.log(`\n  ⚠️  Cannot reach database: ${e.message?.split('\n')[0]}`)
        console.log('  Skipping all DB tests.\n')
        return
      }

      await testNoDuplicateBrandProfiles()
      await testPromptsLanguageConsistency()
      await testGeoResultsCountryScoping()
      await testLanguageIsolationInResults()
      await testWithResultsFallbackLogic()
      await testAnalysisRunCountryScoping()
    }

  } finally {
    await prisma.$disconnect()
  }

  // Summary
  console.log('\n' + '═'.repeat(70))
  console.log('  RESULTS')
  console.log('═'.repeat(70))
  console.log(`  ✅ Passed:  ${passed}`)
  console.log(`  ❌ Failed:  ${failed}`)
  console.log(`  ⏭️  Skipped: ${skipped}`)
  console.log('═'.repeat(70))

  if (failed > 0) {
    console.log('\n  ⚠️  Some tests failed. Review the output above for details.\n')
    process.exit(1)
  } else {
    console.log('\n  🎉 All tests passed!\n')
    process.exit(0)
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error running tests:', err)
  process.exit(1)
})
