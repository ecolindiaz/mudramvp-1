/**
 * E2E Test Suite for Competitor Domain Resolution
 *
 * Tests the three-tier domain resolution system:
 *   1. Citation extraction — match competitor names to URLs in citations/sources
 *   2. Static mapping    — fall back to getCompanyDomain() (180+ known companies)
 *   3. Cleaned name + .com — last resort
 *
 * Four test jobs:
 *   1. Unit     — Tests resolveCompetitorDomains() and getCompetitorUrl() logic
 *   2. Static   — Tests getCompanyDomain() coverage for known problematic companies
 *   3. API      — Hits local /api/analysis/competitors and /api/prompts/[id] endpoints
 *   4. Full     — Runs all of the above
 *
 * Run:  npx tsx lib/tests/e2e-competitor-domains.ts [job]
 *
 * Examples:
 *   npx tsx lib/tests/e2e-competitor-domains.ts unit
 *   npx tsx lib/tests/e2e-competitor-domains.ts static
 *   npx tsx lib/tests/e2e-competitor-domains.ts api
 *   npx tsx lib/tests/e2e-competitor-domains.ts full
 */

import { resolveCompetitorDomains, getCompetitorUrl } from '../competitor-domain'
import { getCompanyDomain } from '../logo'

// ─── ANSI helpers ────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
}

let passCount = 0
let failCount = 0
let skipCount = 0

function log(msg: string, color: keyof typeof c = 'reset') {
  console.log(`${c[color]}${msg}${c.reset}`)
}

function section(title: string) {
  console.log()
  console.log(c.cyan + '═'.repeat(64) + c.reset)
  log(` ${title}`, 'cyan')
  console.log(c.cyan + '═'.repeat(64) + c.reset)
}

function subsection(title: string) {
  console.log()
  log(`  --- ${title} ---`, 'white')
}

function pass(label: string, detail?: string) {
  passCount++
  const extra = detail ? `  ${c.dim}(${detail})${c.reset}` : ''
  console.log(`  ${c.green}PASS${c.reset} ${label}${extra}`)
}

function fail(label: string, expected: string, got: string) {
  failCount++
  console.log(`  ${c.red}FAIL${c.reset} ${label}`)
  console.log(`        expected: ${c.green}${expected}${c.reset}`)
  console.log(`        got:      ${c.red}${got}${c.reset}`)
}

function skip(label: string, reason: string) {
  skipCount++
  console.log(`  ${c.yellow}SKIP${c.reset} ${label}  ${c.dim}(${reason})${c.reset}`)
}

function assertEqual(label: string, actual: string | undefined, expected: string) {
  if (actual === expected) {
    pass(label, expected)
  } else {
    fail(label, expected, String(actual))
  }
}

function assertIncludes(label: string, actual: string | undefined, substring: string) {
  if (actual && actual.includes(substring)) {
    pass(label, actual)
  } else {
    fail(label, `contains "${substring}"`, String(actual))
  }
}

function assertNotEqual(label: string, actual: string | undefined, notExpected: string) {
  if (actual !== notExpected) {
    pass(label, `"${actual}" (not "${notExpected}")`)
  } else {
    fail(label, `anything except "${notExpected}"`, String(actual))
  }
}

function assertTrue(label: string, value: boolean, detail?: string) {
  if (value) {
    pass(label, detail)
  } else {
    fail(label, 'true', 'false')
  }
}

// ─── Known problematic companies ─────────────────────────────────────────────
// Companies whose domains are NOT just name.com

const PROBLEMATIC_COMPANIES: Array<{
  name: string
  correctDomain: string
  naiveDomain: string // what the old code generated
  citationOnly?: boolean // true = not in static map, needs citation resolution (tier 1)
}> = [
  { name: 'Dataloop',        correctDomain: 'dataloop.ai',        naiveDomain: 'dataloop.com', citationOnly: true },
  { name: 'Fly.io',          correctDomain: 'fly.io',             naiveDomain: 'flyio.com' },
  { name: 'Railway',         correctDomain: 'railway.app',        naiveDomain: 'railway.com' },
  { name: 'Sentry',          correctDomain: 'sentry.io',          naiveDomain: 'sentry.com' },
  { name: 'Neon',            correctDomain: 'neon.tech',          naiveDomain: 'neon.com' },
  { name: 'Supabase',        correctDomain: 'supabase.com',       naiveDomain: 'supabase.com' },
  { name: 'Vercel',          correctDomain: 'vercel.com',         naiveDomain: 'vercel.com' },
  { name: 'Datadog',         correctDomain: 'datadoghq.com',      naiveDomain: 'datadog.com' },
  { name: 'New Relic',       correctDomain: 'newrelic.com',       naiveDomain: 'newrelic.com' },
  { name: 'Hugging Face',    correctDomain: 'huggingface.co',     naiveDomain: 'huggingface.com' },
  { name: 'Notion',          correctDomain: 'notion.so',          naiveDomain: 'notion.com' },
  { name: 'Next.js',         correctDomain: 'nextjs.org',         naiveDomain: 'nextjs.com' },
  { name: 'Remix',           correctDomain: 'remix.run',          naiveDomain: 'remix.com' },
  { name: 'Astro',           correctDomain: 'astro.build',        naiveDomain: 'astro.com' },
  { name: 'Elastic',         correctDomain: 'elastic.co',         naiveDomain: 'elastic.com' },
  { name: 'Coolify',         correctDomain: 'coolify.io',         naiveDomain: 'coolify.com' },
  { name: 'Bubble',          correctDomain: 'bubble.io',          naiveDomain: 'bubble.com' },
  { name: 'Bolt.new',        correctDomain: 'bolt.new',           naiveDomain: 'boltnew.com' },
  { name: 'CockroachDB',     correctDomain: 'cockroachlabs.com',  naiveDomain: 'cockroachdb.com' },
  { name: 'Postmark',        correctDomain: 'postmarkapp.com',    naiveDomain: 'postmark.com' },
  { name: 'AWS',             correctDomain: 'aws.amazon.com',     naiveDomain: 'aws.com' },
  { name: 'Google Cloud',    correctDomain: 'cloud.google.com',   naiveDomain: 'googlecloud.com' },
  { name: 'Travis CI',       correctDomain: 'travis-ci.com',      naiveDomain: 'travisci.com' },
  { name: 'Pinecone',        correctDomain: 'pinecone.io',        naiveDomain: 'pinecone.com' },
  { name: 'Lovable',         correctDomain: 'lovable.dev',        naiveDomain: 'lovable.com' },
  { name: 'V0',              correctDomain: 'v0.dev',             naiveDomain: 'v0.com' },
]

// ─── Fake citations for unit tests ───────────────────────────────────────────

const MOCK_CITATIONS = [
  // Competitor homepages — should be matched
  { url: 'https://dataloop.ai/platform/' },
  { url: 'https://fly.io/docs/getting-started/' },
  { url: 'https://railway.app/pricing' },
  { url: 'https://sentry.io/for/javascript/' },
  { url: 'https://www.neon.tech/blog/serverless-postgres' },
  { url: 'https://elastic.co/observability' },
  { url: 'https://bolt.new/' },
  { url: 'https://coolify.io/docs' },
  { url: 'https://astro.build/themes/' },
  { url: 'https://remix.run/docs/en/main' },
  { url: 'https://bubble.io/features' },
  { url: 'https://notion.so/product' },
  // Article/review sites — should be EXCLUDED
  { url: 'https://www.g2.com/products/dataloop/reviews' },
  { url: 'https://techcrunch.com/2024/03/railway-funding/' },
  { url: 'https://www.reddit.com/r/selfhosted/coolify' },
  { url: 'https://github.com/sentry/sentry-javascript' },
  { url: 'https://medium.com/@someone/fly-io-review' },
  { url: 'https://www.forbes.com/best-cloud-providers/' },
  { url: 'https://en.wikipedia.org/wiki/Notion_(productivity_software)' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// JOB 1: UNIT TESTS — resolveCompetitorDomains() + getCompetitorUrl()
// ═══════════════════════════════════════════════════════════════════════════════

function runUnitTests() {
  section('JOB 1: UNIT TESTS — Domain Resolution Logic')

  // ── 1a. Citation matching ──────────────────────────────────────────────────

  subsection('1a. Citation Matching (resolveCompetitorDomains)')

  const competitors = [
    'Dataloop', 'Fly.io', 'Railway', 'Sentry', 'Neon',
    'Elastic', 'Bolt.new', 'Coolify', 'Astro', 'Remix',
    'Bubble', 'Notion',
  ]

  const resolved = resolveCompetitorDomains(competitors, MOCK_CITATIONS)

  assertEqual('Dataloop resolves from citation',     resolved.get('dataloop'),  'dataloop.ai')
  assertEqual('Fly.io resolves from citation',       resolved.get('fly.io'),    'fly.io')
  assertEqual('Railway resolves from citation',      resolved.get('railway'),   'railway.app')
  assertEqual('Sentry resolves from citation',       resolved.get('sentry'),    'sentry.io')
  assertEqual('Neon resolves from citation',         resolved.get('neon'),      'neon.tech')
  assertEqual('Elastic resolves from citation',      resolved.get('elastic'),   'elastic.co')
  assertEqual('Coolify resolves from citation',      resolved.get('coolify'),   'coolify.io')
  assertEqual('Astro resolves from citation',        resolved.get('astro'),     'astro.build')
  assertEqual('Remix resolves from citation',        resolved.get('remix'),     'remix.run')
  assertEqual('Bubble resolves from citation',       resolved.get('bubble'),    'bubble.io')
  assertEqual('Notion resolves from citation',       resolved.get('notion'),    'notion.so')

  // ── 1b. Bolt.new edge case (dots in name) ─────────────────────────────────

  subsection('1b. Edge Cases')

  // Bolt.new: normalised "boltnew" should match brand part "bolt" from bolt.new
  // The brand part extraction for bolt.new -> "bolt", normalized "boltnew" != "bolt"
  // This means bolt.new won't match via citation — it will fall back to static map
  // which is correct because getCompanyDomain('bolt.new') returns 'bolt.new'
  const boltResolved = resolved.get('bolt.new') || resolved.get('boltnew')
  if (boltResolved) {
    pass('Bolt.new resolved via citation', boltResolved)
  } else {
    // Expected: falls through to static mapping
    const boltDomain = getCompanyDomain('bolt.new')
    assertEqual('Bolt.new falls back to static mapping', boltDomain, 'bolt.new')
  }

  // ── 1c. Excluded domains ──────────────────────────────────────────────────

  subsection('1c. Article/Review Site Exclusion')

  // g2.com has "dataloop" in its URL but should be excluded
  const onlyG2Citations = [{ url: 'https://www.g2.com/products/dataloop/reviews' }]
  const resolvedFromG2 = resolveCompetitorDomains(['Dataloop'], onlyG2Citations)
  assertTrue(
    'g2.com URL excluded — Dataloop not resolved from g2',
    !resolvedFromG2.has('dataloop'),
    'Map has no entry for dataloop'
  )

  // Same for github, medium, reddit
  const articleOnlyCitations = [
    { url: 'https://github.com/sentry/sentry-javascript' },
    { url: 'https://medium.com/@someone/sentry-review' },
    { url: 'https://www.reddit.com/r/programming/sentry' },
  ]
  const resolvedArticles = resolveCompetitorDomains(['Sentry'], articleOnlyCitations)
  assertTrue(
    'Article sites excluded — Sentry not matched from github/medium/reddit',
    !resolvedArticles.has('sentry'),
    'Sentry not falsely resolved'
  )

  // ── 1d. Empty input ───────────────────────────────────────────────────────

  subsection('1d. Empty / Edge Inputs')

  const emptyResolved = resolveCompetitorDomains([], [])
  assertTrue('Empty competitors returns empty map', emptyResolved.size === 0)

  const noCitationsResolved = resolveCompetitorDomains(['Railway'], [])
  assertTrue('No citations returns empty map', noCitationsResolved.size === 0)

  const invalidUrlCitations = [{ url: 'not-a-url' }, { url: '' }, {}]
  const invalidResolved = resolveCompetitorDomains(['Test'], invalidUrlCitations)
  assertTrue('Invalid URLs handled gracefully', invalidResolved.size === 0)

  // ── 1e. getCompetitorUrl() ────────────────────────────────────────────────

  subsection('1e. getCompetitorUrl() fallback chain')

  assertEqual(
    'With resolved domain → uses it',
    getCompetitorUrl('Railway', 'railway.app'),
    'https://railway.app'
  )

  assertEqual(
    'Without resolved domain → static mapping',
    getCompetitorUrl('Railway'),
    'https://railway.app'
  )

  assertEqual(
    'Unknown company → cleaned name + .com',
    getCompetitorUrl('Acme Corp'),
    'https://acmecorp.com'
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB 2: STATIC MAPPING — getCompanyDomain() for problematic companies
// ═══════════════════════════════════════════════════════════════════════════════

function runStaticMappingTests() {
  section('JOB 2: STATIC MAPPING — getCompanyDomain() Coverage')

  subsection('2a. Problematic Companies (old vs new)')

  let improvedCount = 0
  let alreadyCorrectCount = 0

  console.log()
  console.log(
    `  ${'Company'.padEnd(20)} ${'Old (naive)'.padEnd(25)} ${'New (static)'.padEnd(25)} ${'Correct'.padEnd(25)} Result`
  )
  console.log('  ' + '-'.repeat(105))

  for (const { name, correctDomain, naiveDomain, citationOnly } of PROBLEMATIC_COMPANIES) {
    const staticDomain = getCompanyDomain(name)
    const isCorrect = staticDomain === correctDomain
    const wasAlreadyCorrect = naiveDomain === correctDomain
    const improved = isCorrect && !wasAlreadyCorrect

    if (improved) improvedCount++
    if (wasAlreadyCorrect && isCorrect) alreadyCorrectCount++

    if (citationOnly && !isCorrect) {
      // Expected: not in static map, relies on citation resolution (tier 1)
      const tag = `${c.yellow}CITATION-ONLY${c.reset}`
      console.log(
        `  ${name.padEnd(20)} ${naiveDomain.padEnd(25)} ${staticDomain.padEnd(25)} ${correctDomain.padEnd(25)} ${c.yellow}SKIP${c.reset} ${tag}`
      )
      skipCount++
    } else {
      const icon = isCorrect ? `${c.green}PASS${c.reset}` : `${c.red}FAIL${c.reset}`
      const tag = improved ? `${c.green}IMPROVED${c.reset}` : wasAlreadyCorrect ? `${c.dim}same${c.reset}` : `${c.red}WRONG${c.reset}`
      console.log(
        `  ${name.padEnd(20)} ${naiveDomain.padEnd(25)} ${staticDomain.padEnd(25)} ${correctDomain.padEnd(25)} ${icon} ${tag}`
      )

      if (isCorrect) passCount++
      else failCount++
    }
  }

  console.log()
  log(`  Summary: ${improvedCount} improved, ${alreadyCorrectCount} already correct, ${PROBLEMATIC_COMPANIES.length - improvedCount - alreadyCorrectCount} still wrong`, 'white')

  // ── 2b. Verify the fallback for truly unknown companies ────────────────

  subsection('2b. Unknown Company Fallback')

  const unknownDomain = getCompanyDomain('SomeRandomStartup2024')
  assertEqual(
    'Unknown company gets .com fallback',
    unknownDomain,
    'somerandomstartup2024.com'
  )

  const domainLikeName = getCompanyDomain('fly.io')
  assertEqual(
    'Domain-like name passes through',
    domainLikeName,
    'fly.io'
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB 3: API INTEGRATION — Hit /api/analysis/competitors & /api/prompts/[id]
// ═══════════════════════════════════════════════════════════════════════════════

async function runApiTests() {
  section('JOB 3: API INTEGRATION — Live Endpoint Tests')

  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

  log(`  Base URL: ${BASE_URL}`, 'dim')

  // ── 3a. We need a valid brandProfileId. Try to get one from the DB. ────

  subsection('3a. Finding a brand profile with analysis data')

  let brandProfileId: string | null = null

  // Try to import prisma to query the DB directly
  try {
    const { prisma } = await import('../prisma')

    // Find a brand profile that has GEO analysis results
    const profile = await prisma.brandProfile.findFirst({
      where: {
        geoAnalysisResults: {
          some: {}
        }
      },
      select: {
        id: true,
        companyName: true,
        companyWebsite: true,
        _count: {
          select: { geoAnalysisResults: true }
        }
      },
      orderBy: {
        geoAnalysisResults: {
          _count: 'desc'
        }
      }
    })

    if (profile) {
      brandProfileId = String(profile.id)
      log(`  Found brand profile: ${profile.companyName} (id=${profile.id}, ${profile._count.geoAnalysisResults} analyses)`, 'green')
    } else {
      skip('API tests', 'No brand profiles with analysis data found in DB')
      return
    }

    // Also grab a prompt ID that has test results
    const prompt = await prisma.prompt.findFirst({
      where: {
        brandProfileId: profile.id,
        isActive: true,
      },
      select: { id: true, text: true }
    })

    // ── 3b. Test /api/analysis/competitors ─────────────────────────────────

    subsection('3b. GET /api/analysis/competitors')

    const competitorsUrl = `${BASE_URL}/api/analysis/competitors?brandProfileId=${brandProfileId}`
    log(`  Fetching: ${competitorsUrl}`, 'dim')

    try {
      const res = await fetch(competitorsUrl)
      const json = await res.json()

      assertTrue('Response is OK', res.ok, `status ${res.status}`)
      assertTrue('Response has success=true', json.success === true)
      assertTrue('Response has data.competitors array', Array.isArray(json.data?.competitors))

      const competitors = json.data?.competitors || []
      log(`  Got ${competitors.length} competitors`, 'white')

      if (competitors.length > 0) {
        // Check that EVERY competitor has a domain field
        const withDomain = competitors.filter((c: any) => typeof c.domain === 'string' && c.domain.length > 0)
        const withoutDomain = competitors.filter((c: any) => !c.domain)

        assertTrue(
          'All competitors have a domain field',
          withoutDomain.length === 0,
          `${withDomain.length}/${competitors.length} have domain`
        )

        // Show first 10 competitors with their domains
        console.log()
        console.log(`  ${'#'.padStart(3)} ${'Company'.padEnd(25)} ${'Domain'.padEnd(30)} ${'Old naive URL'.padEnd(30)}`)
        console.log('  ' + '-'.repeat(90))

        for (let i = 0; i < Math.min(competitors.length, 10); i++) {
          const comp = competitors[i]
          const naiveUrl = `${comp.name.toLowerCase().replace(/\s+/g, '')}.com`
          const domainChanged = comp.domain !== naiveUrl
          const marker = domainChanged ? `${c.green}*${c.reset}` : ' '
          console.log(
            `  ${String(i + 1).padStart(3)} ${comp.name.padEnd(25)} ${(comp.domain || '???').padEnd(30)} ${naiveUrl.padEnd(30)} ${marker}`
          )
        }

        // Count improvements
        const improved = competitors.filter((comp: any) => {
          const naive = `${comp.name.toLowerCase().replace(/\s+/g, '')}.com`
          return comp.domain && comp.domain !== naive
        })
        console.log()
        log(`  Domain improvements: ${improved.length}/${competitors.length} differ from naive .com`, improved.length > 0 ? 'green' : 'yellow')

        // Spot-check: verify domains look like real domains (contain a dot)
        const validDomains = competitors.filter((comp: any) => comp.domain && comp.domain.includes('.'))
        assertTrue(
          'All domains look valid (contain a dot)',
          validDomains.length === competitors.length,
          `${validDomains.length}/${competitors.length}`
        )
      } else {
        skip('Competitor domain checks', 'No competitors returned')
      }
    } catch (err) {
      fail('Fetch /api/analysis/competitors', 'success', String(err))
      log(`  Is the dev server running at ${BASE_URL}?`, 'yellow')
    }

    // ── 3c. Test /api/prompts/[id] ─────────────────────────────────────────

    subsection('3c. GET /api/prompts/[id]')

    if (!prompt) {
      skip('Prompt detail API test', 'No prompts found for this brand profile')
    } else {
      const promptUrl = `${BASE_URL}/api/prompts/${prompt.id}?brandProfileId=${brandProfileId}&dateRange=30d`
      log(`  Fetching: ${promptUrl}`, 'dim')
      log(`  Prompt: "${prompt.text.substring(0, 60)}..."`, 'dim')

      try {
        const res = await fetch(promptUrl)
        const json = await res.json()

        assertTrue('Response is OK', res.ok, `status ${res.status}`)
        assertTrue('Response has success=true', json.success === true)

        const landscape = json.prompt?.competitiveLandscape
        assertTrue('Response has competitiveLandscape', !!landscape)

        // Check competitorsWithMetrics for domain field
        const withMetrics = landscape?.competitorsWithMetrics || []
        log(`  competitorsWithMetrics: ${withMetrics.length} entries`, 'white')

        if (withMetrics.length > 0) {
          const withDomain = withMetrics.filter((c: any) => typeof c.domain === 'string' && c.domain.length > 0)
          assertTrue(
            'All competitorsWithMetrics have domain',
            withDomain.length === withMetrics.length,
            `${withDomain.length}/${withMetrics.length}`
          )

          console.log()
          console.log(`  ${'Company'.padEnd(25)} ${'Domain'.padEnd(30)} ${'Visibility'.padEnd(12)}`)
          console.log('  ' + '-'.repeat(70))

          for (const comp of withMetrics.slice(0, 8)) {
            console.log(
              `  ${comp.name.padEnd(25)} ${(comp.domain || '???').padEnd(30)} ${String(comp.visibility + '%').padEnd(12)}`
            )
          }
        }

        // Check competitorsWithYou
        const withYou = landscape?.competitorsWithYou || []
        if (withYou.length > 0) {
          const youRow = withYou.find((c: any) => c.isYou)
          if (youRow) {
            assertTrue(
              '"You" row has domain field',
              typeof youRow.domain === 'string' && youRow.domain.length > 0,
              youRow.domain
            )
          }

          const competitorRows = withYou.filter((c: any) => !c.isYou)
          const competitorRowsWithDomain = competitorRows.filter((c: any) => typeof c.domain === 'string' && c.domain.length > 0)
          assertTrue(
            'All competitor rows in competitorsWithYou have domain',
            competitorRowsWithDomain.length === competitorRows.length,
            `${competitorRowsWithDomain.length}/${competitorRows.length}`
          )
        }

        // Check if any citations exist (for context)
        const testResults = json.prompt?.testResults || []
        let totalCitations = 0
        for (const result of testResults) {
          totalCitations += (result.citations?.length || 0) + (result.sources?.length || 0)
        }
        log(`  Total citations/sources across test results: ${totalCitations}`, 'dim')
        if (totalCitations > 0) {
          log(`  Citation-based domain resolution may have contributed to results`, 'dim')
        }

      } catch (err) {
        fail('Fetch /api/prompts/[id]', 'success', String(err))
        log(`  Is the dev server running at ${BASE_URL}?`, 'yellow')
      }
    }

    // Disconnect prisma
    await prisma.$disconnect()

  } catch (dbErr) {
    // If prisma fails to import or connect, try HTTP-only approach
    log(`  Could not connect to database: ${dbErr}`, 'yellow')
    skip('API tests', 'Database connection failed. Ensure DATABASE_URL is configured.')
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB 4: FULL — Run everything
// ═══════════════════════════════════════════════════════════════════════════════

async function runFullTests() {
  runUnitTests()
  runStaticMappingTests()
  await runApiTests()
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARISON TABLE — Old vs New for all problematic companies
// ═══════════════════════════════════════════════════════════════════════════════

function runComparisonReport() {
  section('COMPARISON REPORT — Old naive .com vs New Three-Tier Resolution')

  log('  Simulating with mock citations + static mapping fallback\n', 'dim')

  // Resolve using citations
  const names = PROBLEMATIC_COMPANIES.map(p => p.name)
  const citationResolved = resolveCompetitorDomains(names, MOCK_CITATIONS)

  console.log(
    `  ${'Company'.padEnd(20)} ${'Old (naive)'.padEnd(22)} ${'Citation'.padEnd(22)} ${'Static'.padEnd(22)} ${'Final'.padEnd(22)} Correct?`
  )
  console.log('  ' + '-'.repeat(115))

  let correctCount = 0

  for (const { name, correctDomain, naiveDomain } of PROBLEMATIC_COMPANIES) {
    const fromCitation = citationResolved.get(name.toLowerCase())
    const fromStatic = getCompanyDomain(name)
    const final = fromCitation || fromStatic
    const isCorrect = final === correctDomain

    if (isCorrect) correctCount++

    const icon = isCorrect ? `${c.green}YES${c.reset}` : `${c.red}NO ${c.reset}`
    const citationCol = fromCitation ? `${c.green}${fromCitation}${c.reset}` : `${c.dim}-${c.reset}`

    console.log(
      `  ${name.padEnd(20)} ${naiveDomain.padEnd(22)} ${(fromCitation || '-').padEnd(22)} ${fromStatic.padEnd(22)} ${final.padEnd(22)} ${icon}`
    )
  }

  console.log()
  log(`  Correct: ${correctCount}/${PROBLEMATIC_COMPANIES.length}`, correctCount === PROBLEMATIC_COMPANIES.length ? 'green' : 'yellow')

  // Count how many the old approach got wrong
  const oldWrongCount = PROBLEMATIC_COMPANIES.filter(p => p.naiveDomain !== p.correctDomain).length
  log(`  Old naive approach: ${PROBLEMATIC_COMPANIES.length - oldWrongCount}/${PROBLEMATIC_COMPANIES.length} correct`, 'dim')
  log(`  Improvement: ${correctCount - (PROBLEMATIC_COMPANIES.length - oldWrongCount)} more companies resolved correctly`, 'green')
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2)
  const job = args[0] || 'full'

  console.log()
  log('================================================================', 'magenta')
  log('   COMPETITOR DOMAIN RESOLUTION — E2E TEST SUITE', 'magenta')
  log('================================================================', 'magenta')
  console.log(`\n  Job: ${job}\n`)

  const startTime = Date.now()

  switch (job.toLowerCase()) {
    case 'unit':
    case '1':
      runUnitTests()
      break

    case 'static':
    case '2':
      runStaticMappingTests()
      break

    case 'api':
    case '3':
      await runApiTests()
      break

    case 'compare':
    case 'comparison':
      runComparisonReport()
      break

    case 'full':
    case 'all':
    case '4':
      await runFullTests()
      console.log()
      runComparisonReport()
      break

    default:
      console.log('Usage: npx tsx lib/tests/e2e-competitor-domains.ts [job]')
      console.log()
      console.log('Jobs:')
      console.log('  unit (1)       — Test resolveCompetitorDomains() and getCompetitorUrl()')
      console.log('  static (2)     — Test getCompanyDomain() for known problematic companies')
      console.log('  api (3)        — Hit live API endpoints and check domain field')
      console.log('  compare        — Show old vs new comparison table')
      console.log('  full (4)       — Run all tests + comparison')
      console.log()
      console.log('Examples:')
      console.log('  npx tsx lib/tests/e2e-competitor-domains.ts unit')
      console.log('  npx tsx lib/tests/e2e-competitor-domains.ts api')
      console.log('  npx tsx lib/tests/e2e-competitor-domains.ts full')
      process.exit(1)
  }

  const duration = Date.now() - startTime

  // ── Final Summary ──────────────────────────────────────────────────────────

  console.log()
  console.log(c.cyan + '═'.repeat(64) + c.reset)
  log(' FINAL RESULTS', 'cyan')
  console.log(c.cyan + '═'.repeat(64) + c.reset)
  console.log()
  console.log(`  ${c.green}PASS: ${passCount}${c.reset}`)
  console.log(`  ${c.red}FAIL: ${failCount}${c.reset}`)
  if (skipCount > 0) {
    console.log(`  ${c.yellow}SKIP: ${skipCount}${c.reset}`)
  }
  console.log(`  ${c.dim}Time: ${duration}ms${c.reset}`)
  console.log()

  if (failCount > 0) {
    log('  TEST SUITE FAILED', 'red')
    process.exit(1)
  } else {
    log('  ALL TESTS PASSED', 'green')
    process.exit(0)
  }
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
