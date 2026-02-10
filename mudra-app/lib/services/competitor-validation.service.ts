/**
 * Multi-Stage Competitor Validation Pipeline
 *
 * Stage 1: Structured extraction with reasoning (GPT-4)
 * Stage 2: Cross-validation with different model (Claude)
 * Stage 3: External verification (Clearbit + web search)
 *
 * Provides high-accuracy competitor identification with confidence scores.
 */

import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

// Initialize clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ValidatedCompetitor {
  name: string
  confidence: 'high' | 'medium' | 'low'
  confidenceScore: number // 0-1
  verificationSources: string[]
  position?: number
  sentiment?: 'positive' | 'neutral' | 'negative'
}

interface ExtractionCandidate {
  name: string
  isCompany: boolean
  reason: string
}

interface ExtractionResult {
  reasoning: ExtractionCandidate[]
  validCompetitors: string[]
}

/**
 * Stage 1: Structured extraction with chain-of-thought reasoning
 * Uses GPT-4 to extract and reason about each candidate
 */
async function stage1StructuredExtraction(
  aiResponse: string,
  brandName: string
): Promise<{ candidates: string[]; reasoning: ExtractionCandidate[] }> {
  const prompt = `You are a company name extractor. Analyze this AI response and identify REAL company/product/service names that are competitors or alternatives.

BRAND BEING ANALYZED: "${brandName}" (exclude this from competitors)

AI RESPONSE TO ANALYZE:
"""
${aiResponse.slice(0, 4000)}
"""

TASK: For each potential company/product name you find, evaluate:
1. Is this a proper noun / brand name? (not a generic term)
2. Is this an actual company, product, platform, or service?
3. Is this NOT a description, phrase, action item, or recommendation?

RULES:
- INCLUDE: Real companies (Netlify, AWS, Stripe, Heroku, Cloudflare, etc.)
- INCLUDE: Real products/platforms (GitHub Pages, Firebase Hosting, etc.)
- EXCLUDE: Descriptions ("Excellent DX", "Enterprise-grade", "Fast deployments")
- EXCLUDE: Actions/recommendations ("Plan for...", "Consider...", "Monitor...")
- EXCLUDE: Categories ("Cloud Solutions", "Alternative Platforms", "Hosting Options")
- EXCLUDE: Partial sentences or phrases with verbs
- EXCLUDE: Generic terms (framework, platform, service, tool)
- EXCLUDE: The brand being analyzed ("${brandName}")

Return ONLY valid JSON (no markdown, no explanation):
{
  "reasoning": [
    {"name": "Netlify", "isCompany": true, "reason": "Known web hosting platform"},
    {"name": "Excellent DX", "isCompany": false, "reason": "Descriptive phrase about developer experience"},
    {"name": "Railway", "isCompany": true, "reason": "Known cloud platform for deployments"}
  ],
  "validCompetitors": ["Netlify", "Railway"]
}`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1, // Low temperature for consistency
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content || '{}'
    const result: ExtractionResult = JSON.parse(content)

    return {
      candidates: result.validCompetitors || [],
      reasoning: result.reasoning || []
    }
  } catch (error) {
    console.error('Stage 1 extraction failed:', error)
    return { candidates: [], reasoning: [] }
  }
}

/**
 * Stage 2: Cross-validation with Claude
 * Validates the extracted names using a different model to catch blind spots
 */
async function stage2CrossValidation(
  candidates: string[],
  brandName: string
): Promise<Map<string, boolean>> {
  if (candidates.length === 0) {
    return new Map()
  }

  const prompt = `You are a company name validator. Your job is to verify which of these are REAL technology companies, products, platforms, or services.

CANDIDATES TO VALIDATE:
${candidates.map((c, i) => `${i + 1}. "${c}"`).join('\n')}

BRAND TO EXCLUDE: "${brandName}"

For each candidate, determine if it's a REAL company/product name.

REAL examples: Netlify, AWS, Heroku, Vercel, Railway, Cloudflare, DigitalOcean, Firebase
NOT REAL examples: "Cloud Solutions", "Best Practices", "Enterprise Features", "Fast Deployment"

Return ONLY valid JSON (no markdown):
{
  "validations": [
    {"name": "Netlify", "isReal": true},
    {"name": "Cloud Solutions", "isReal": false}
  ]
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })

    const content = response.content[0]?.type === 'text' ? response.content[0].text : '{}'

    // Extract JSON from response (Claude sometimes wraps in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn('Stage 2: Could not parse Claude response')
      return new Map(candidates.map(c => [c, true])) // Fallback: trust Stage 1
    }

    const result = JSON.parse(jsonMatch[0])
    const validationMap = new Map<string, boolean>()

    for (const v of result.validations || []) {
      validationMap.set(v.name, v.isReal === true)
    }

    return validationMap
  } catch (error) {
    console.error('Stage 2 cross-validation failed:', error)
    // Fallback: trust Stage 1 results
    return new Map(candidates.map(c => [c, true]))
  }
}

/**
 * Stage 3: External verification using Clearbit Logo API
 * If a company has a logo in Clearbit, it's likely a real company
 */
async function stage3ExternalVerification(
  candidates: string[]
): Promise<Map<string, { verified: boolean; source: string }>> {
  const results = new Map<string, { verified: boolean; source: string }>()

  // Known tech companies (curated whitelist for instant verification)
  const knownCompanies = new Set([
    // Cloud & Hosting
    'aws', 'amazon web services', 'google cloud', 'gcp', 'azure', 'microsoft azure',
    'vercel', 'netlify', 'heroku', 'railway', 'render', 'fly.io', 'digitalocean',
    'cloudflare', 'cloudflare pages', 'cloudflare workers', 'fastly', 'akamai',
    'firebase', 'firebase hosting', 'supabase', 'planetscale', 'neon',
    'aws amplify', 'aws lambda', 'aws cloudfront', 'github pages',

    // DevOps & CI/CD
    'github', 'gitlab', 'bitbucket', 'jenkins', 'circleci', 'travis ci',
    'github actions', 'gitlab ci/cd', 'teamcity', 'bamboo', 'harness',
    'docker', 'kubernetes', 'terraform', 'pulumi', 'ansible',

    // Monitoring & Observability
    'datadog', 'new relic', 'sentry', 'splunk', 'elastic', 'grafana',
    'prometheus', 'dynatrace', 'logrocket', 'fullstory', 'hotjar',
    'pagerduty', 'opsgenie', 'statuspage', 'raygun', 'bugsnag',

    // Databases
    'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch',
    'cockroachdb', 'fauna', 'dynamodb', 'cassandra', 'snowflake',

    // Frontend & Frameworks
    'next.js', 'nuxt', 'gatsby', 'remix', 'astro', 'svelte', 'vue',
    'react', 'angular', 'webpack', 'vite', 'turbopack', 'esbuild',

    // AI & ML
    'openai', 'anthropic', 'hugging face', 'replicate', 'modal',
    'langchain', 'pinecone', 'weaviate', 'cohere', 'stability ai',

    // E-commerce & CMS
    'shopify', 'stripe', 'square', 'paypal', 'contentful', 'sanity',
    'strapi', 'wordpress', 'webflow', 'wix', 'squarespace',

    // Communication
    'twilio', 'sendgrid', 'mailgun', 'postmark', 'slack', 'discord',

    // Auth & Security
    'auth0', 'okta', 'clerk', 'firebase auth', 'supabase auth',

    // Low-code / No-code
    'retool', 'bubble', 'airtable', 'notion', 'coda', 'zapier',
    'lovable', 'bolt.new', 'v0', 'cursor', 'replit',

    // Other tech companies
    'segment', 'amplitude', 'mixpanel', 'heap', 'posthog',
    'launchdarkly', 'split', 'optimizely', 'algolia', 'typesense',
    'coolify', 'dokku', 'caprover', 'northflank', 'qovery',
    'zeabur', 'koyeb', 'adaptable', 'cyclic', 'deta',
  ])

  for (const name of candidates) {
    const lowerName = name.toLowerCase()

    // Check against known companies list
    if (knownCompanies.has(lowerName)) {
      results.set(name, { verified: true, source: 'known_company_list' })
      continue
    }

    // Check if any known company is contained in the name
    let foundKnown = false
    for (const known of knownCompanies) {
      if (lowerName.includes(known) || known.includes(lowerName)) {
        results.set(name, { verified: true, source: 'known_company_match' })
        foundKnown = true
        break
      }
    }

    if (!foundKnown) {
      // Try Clearbit Logo API (if logo exists, company likely exists)
      try {
        const domain = guessDomain(name)
        if (domain) {
          const logoUrl = `https://logo.clearbit.com/${domain}`
          const response = await fetch(logoUrl, { method: 'HEAD' })

          if (response.ok) {
            results.set(name, { verified: true, source: 'clearbit_logo' })
            continue
          }
        }
      } catch {
        // Clearbit check failed, continue
      }

      // Not verified by any source
      results.set(name, { verified: false, source: 'unverified' })
    }
  }

  return results
}

/**
 * Guess domain from company name for Clearbit lookup
 */
function guessDomain(companyName: string): string | null {
  const name = companyName.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')

  if (name.length < 2) return null

  // Common domain patterns
  const patterns = [
    `${name}.com`,
    `${name}.io`,
    `${name}.dev`,
    `${name}.co`,
    `${name}.ai`,
  ]

  // Return first pattern (we could try multiple, but that's slow)
  return patterns[0]
}

/**
 * Calculate final confidence score based on all stages
 */
function calculateConfidence(
  name: string,
  stage1Included: boolean,
  stage2Validated: boolean | undefined,
  stage3Verification: { verified: boolean; source: string } | undefined
): { confidence: 'high' | 'medium' | 'low'; score: number; sources: string[] } {
  const sources: string[] = []
  let score = 0

  // Stage 1: GPT-4 extraction (base score)
  if (stage1Included) {
    score += 0.3
    sources.push('gpt4_extraction')
  }

  // Stage 2: Claude validation
  if (stage2Validated === true) {
    score += 0.3
    sources.push('claude_validation')
  } else if (stage2Validated === false) {
    score -= 0.2 // Penalize if Claude rejected it
  }

  // Stage 3: External verification
  if (stage3Verification?.verified) {
    score += 0.4
    sources.push(stage3Verification.source)
  }

  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low'
  if (score >= 0.7) {
    confidence = 'high'
  } else if (score >= 0.4) {
    confidence = 'medium'
  } else {
    confidence = 'low'
  }

  return { confidence, score: Math.max(0, Math.min(1, score)), sources }
}

/**
 * Main pipeline: Validate a list of competitor names
 * This validates EXISTING extracted names, not re-extracting from text.
 */
export async function validateCompetitors(
  aiResponse: string,
  brandName: string,
  existingCompetitors?: string[]
): Promise<ValidatedCompetitor[]> {
  console.log('🔍 Starting competitor validation pipeline...')

  // Use existing competitors as the primary source
  const candidates = existingCompetitors || []

  if (candidates.length === 0) {
    console.log('  No candidates to validate')
    return []
  }

  console.log(`  Validating ${candidates.length} existing competitor names...`)

  // Stage 1: Quick filter - remove obvious junk with pattern matching
  const quickFiltered = candidates.filter(name => quickValidateName(name))
  console.log(`  Quick filter: ${quickFiltered.length} passed (${candidates.length - quickFiltered.length} obvious junk removed)`)

  // Stage 2: Known companies whitelist - instant high confidence
  const knownCompanyResults = await stage3ExternalVerification(quickFiltered)
  const knownCompanies: string[] = []
  const unknownCompanies: string[] = []

  for (const name of quickFiltered) {
    const verification = knownCompanyResults.get(name)
    if (verification?.verified) {
      knownCompanies.push(name)
    } else {
      unknownCompanies.push(name)
    }
  }
  console.log(`  Known companies: ${knownCompanies.length} verified instantly`)

  // Stage 3: AI validation for unknown companies (batch process)
  let aiValidatedCompanies: string[] = []
  if (unknownCompanies.length > 0) {
    console.log(`  AI validation: Processing ${unknownCompanies.length} unknown names...`)
    const aiResults = await batchValidateWithAI(unknownCompanies, brandName)
    aiValidatedCompanies = unknownCompanies.filter(name => aiResults.get(name) === true)
    console.log(`  AI validation: ${aiValidatedCompanies.length} confirmed as real companies`)
  }

  // Combine results
  const allValidated = [...knownCompanies, ...aiValidatedCompanies]

  // Build final results with confidence scores
  const results: ValidatedCompetitor[] = []

  for (const name of allValidated) {
    const isKnown = knownCompanies.includes(name)
    const verification = knownCompanyResults.get(name)

    results.push({
      name,
      confidence: isKnown ? 'high' : 'medium',
      confidenceScore: isKnown ? 1.0 : 0.7,
      verificationSources: isKnown
        ? ['known_company_list', verification?.source || 'whitelist']
        : ['ai_validation']
    })
  }

  // Sort by confidence score (highest first)
  results.sort((a, b) => b.confidenceScore - a.confidenceScore)

  console.log(`✅ Validation complete: ${results.length} competitors validated`)
  console.log(`   High confidence: ${results.filter(r => r.confidence === 'high').length}`)
  console.log(`   Medium confidence: ${results.filter(r => r.confidence === 'medium').length}`)

  return results
}

/**
 * Batch validate company names with AI (Claude)
 * Efficiently validates many names in a single API call
 */
async function batchValidateWithAI(
  names: string[],
  brandName: string
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>()

  // Process in batches of 50 to avoid token limits
  const batchSize = 50
  for (let i = 0; i < names.length; i += batchSize) {
    const batch = names.slice(i, i + batchSize)

    const prompt = `You are a company/product name validator. Determine which of these are REAL technology companies, products, platforms, or services.

BRAND TO EXCLUDE: "${brandName}" (don't validate this one)

CANDIDATES TO VALIDATE:
${batch.map((n, idx) => `${idx + 1}. "${n}"`).join('\n')}

RULES:
- Answer YES for real companies/products (e.g., Netlify, AWS, Render, Railway, Stripe)
- Answer NO for phrases, descriptions, or generic terms (e.g., "Cost at Scale", "Best Practices")
- Answer NO for partial sentences or instructions
- When in doubt, answer NO

Return ONLY a JSON object with each name mapped to true (real) or false (not real):
{
  "Netlify": true,
  "Cost at Scale": false,
  "Railway": true
}`

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })

      const content = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
      const jsonMatch = content.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        for (const name of batch) {
          // Check various key formats
          const isValid = parsed[name] === true ||
                          parsed[name.toLowerCase()] === true ||
                          parsed[name.trim()] === true
          results.set(name, isValid)
        }
      } else {
        // Fallback: use quick validation if parsing fails (don't silently drop all)
        console.warn('  AI validation: Could not parse response, falling back to quick validation')
        batch.forEach(name => results.set(name, quickValidateName(name)))
      }
    } catch (error) {
      console.warn(`  AI validation batch failed:`, error)
      // Fallback: use quick validation
      batch.forEach(name => results.set(name, quickValidateName(name)))
    }
  }

  return results
}

/**
 * Quick validation for a single name (used at query time for legacy data)
 * This is a synchronous function for fast filtering.
 */
export function quickValidateName(name: string): boolean {
  // Quick checks first
  if (!name || name.length < 2 || name.length > 35) return false

  const lower = name.toLowerCase().trim()

  // Single generic words that are never company names
  const genericWords = new Set([
    'for', 'the', 'and', 'but', 'framework', 'built', 'platform', 'service',
    'tool', 'tools', 'solution', 'solutions', 'system', 'systems', 'app',
    'application', 'software', 'cloud', 'server', 'servers', 'hosting',
    'enterprise', 'startup', 'startups', 'company', 'companies', 'product',
    'products', 'website', 'websites', 'web', 'mobile', 'desktop', 'api',
    'support', 'feature', 'features', 'pricing', 'high', 'low', 'full',
    'you', 'use', 'need', 'want', 'backend', 'frontend', 'developer',
    'an open', 'emphasis on', 'multi', 'emerging', 'emergent',
    'adopt', 'leverage', 'consider', 'implement', 'integrate', 'monitor',
    'conduct', 'track', 'user', 'its', 'post', 'offers', 'free', 'usage',
    'real', 'front', 'crm', 'headless', 'strengths', 'styling',
    'containers', 'rendering strategy', 'caching', 'data layer',
    'asset optimization', 'monitoring & ci', 'infrastructure',
    'security & accessibility', 'scope & scale', 'session playback',
    'analytics vs monitoring', 'privacy & data ownership', 'budget & usability',
  ])
  if (genericWords.has(lower)) return false

  // Known bad patterns - sentences/phrases
  const badPatterns = [
    // Starts with articles/pronouns/prepositions
    /^(the|a|an|for|with|and|or|but|if|when|this|that|you|we|they|it|its|i|my|our|your|their)\s/i,
    // Contains verbs (indicates sentence)
    /\s(is|are|was|were|has|have|had|can|will|would|should|could|may|might|do|does|did|being|been)\s/i,
    // Contains sentence connectors
    /\s(that|which|who|because|since|although|though|where|whom|whose)\s/i,
    // Starts with adjectives (descriptions, not company names)
    /^(excellent|exceptional|enterprise|platform|general|alternative|advanced|basic|superior|strong|high|low|best|top|leading|popular|modern|new|old|free|open|closed|public|private|custom|managed|hosted|cloud|on-prem|hybrid|real|full|minimal|rapid|instant|fast|slow|easy|hard|simple|complex|reliable|scalable|secure|robust|flexible|powerful|lightweight|heavy|known|tailored|limited|unique|equipped|delivers|concentrates|supports|maintains|offers|provides|promises|pricing)\s/i,
    // Starts with verbs (actions, not company names)
    /^(plan|monitor|evaluate|assess|consider|check|look|define|use|try|get|set|run|build|create|deploy|host|serve|provide|offer|deliver|enable|support|ensure|leverage|adopt|implement|integrate|configure|optimize|maximize|minimize|avoid|prevent|explore|discover|learn|understand|know|need|want|require|prefer|recommend|suggest|push|organize|map|pilot|conduct|track|offload|estimate|rooted)\s/i,
    // Common sentence endings
    /\s(if|when|later|early|now|then|here|there|only|also|even|just|still|already|yet|too|very|quite|rather|much|more|less|most|least)$/i,
    // Contains "& " or " & " followed by generic terms
    /\s&\s(roles|features|needs|options|tools|services|solutions|benefits|advantages|limitations|challenges|considerations|pricing|reach|complexity|compliance|reach|ownership|usability|scale|ai|ci|visibility)/i,
    // Phrases that describe rather than name
    /(costs|pricing|budget|scale|architecture|infrastructure|development|deployment|hosting|monitoring|logging|testing|security|performance|reliability|scalability|availability|latency|throughput)\s+(at|for|with|and|or|if|can|will|may)/i,
    // Phrases with "Why" or question-like patterns
    /^why\s/i,
    // Category labels
    /^(best for|strengths|unique advantages|why developers|why it stands out)/i,
    // Contains parentheses with URLs or explanations (not company names)
    /\(\s*(https?:|by\s|e\.g\.|now\s)/i,
    // Contains " vs " (comparison, not company name)
    /\svs\s/i,
    // 3+ word phrases ending in plural category nouns (category headings, not companies)
    /^\S+\s+\S+\s+.*\b(marketplaces|networks|services|providers|platforms|solutions|tools|systems|agencies|organizations|ecosystems|protocols|frameworks|offerings|alternatives|options)$/i,
    // Names containing '/' that aren't known patterns like "ci/cd" — almost never companies
    /\/(?!cd\b)/i,
    // Action phrases
    /^(deploy|configure|set up|push to|launch|organize your|map your)/i,
    // Phrases ending with generic nouns (descriptions, not companies)
    /\s(requirements|limitations|workflow|costs|pricing|latency|lock|drop|enhancements|features|metrics|integration|productivity|performance|architecture|overhead|tier|experience|domain|control|support|management|configuration|deployment|migration|infrastructure|scalability|flexibility|compatibility|accessibility|reliability|security|compliance|governance)$/i,
    // Phrases that are "X at Y" or "X for Y" patterns (descriptions)
    /\s(at|for)\s+(scale|enterprise|production|development|teams|developers|startups|businesses)$/i,
    // Single-word generic nouns that slipped through
    /^(additionally|furthermore|moreover|however|therefore|consequently|specifically|particularly|especially|generally|typically|usually|often|sometimes|rarely|always|never|still|yet|also|even|just|only|simply|merely|basically|essentially|primarily|mainly|mostly|largely|entirely|completely|fully|partially|somewhat|slightly|highly|extremely|very|quite|rather|fairly|pretty|really|actually|certainly|definitely|probably|possibly|perhaps|maybe|likely|unlikely|obviously|clearly|apparently|evidently|presumably|supposedly|allegedly|reportedly|seemingly|ostensibly)$/i,
  ]

  for (const pattern of badPatterns) {
    if (pattern.test(name)) return false
  }

  // Space count check - max 3 spaces (4 words)
  const spaceCount = (name.match(/\s/g) || []).length
  if (spaceCount > 3) return false

  // Ends with punctuation (sentences)
  if (/[.!?:,;]$/.test(name)) return false

  // All lowercase and longer than 12 chars without any caps/numbers = likely a phrase
  if (name === lower && name.length > 12 && !/[A-Z0-9.]/.test(name)) return false

  // Contains URL-like patterns
  if (/\.(com|io|dev|co|ai|org|net)\b/i.test(name) && name.includes('(')) return false

  return true
}

/**
 * Batch validate names for query-time filtering
 */
export function batchQuickValidate(names: string[]): string[] {
  return names.filter(name => quickValidateName(name))
}
