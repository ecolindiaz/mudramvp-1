import { getJigsawClient } from "@/lib/clients/jigsawstack"
import { safeParseArray } from "@/lib/utils/safe-parse-array"
import { getDataForSEOClient } from "@/lib/clients/dataforseo"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { prisma } from "@/lib/prisma"
import { DATAFORSEO_LOCATION_MAP, DATAFORSEO_LANGUAGE_MAP, isAllowedCountry, type CountryCode } from "@/lib/geo/country-config"

// --- Types ---

export interface RecommendedPromptResult {
  prompt: string
  intent: string
  aiSearchVolume: number
  volumeTier: "High" | "Medium" | "Low"
}

interface BrandContext {
  companyName: string
  description: string
  industry: string
  services: string[]      // short keywords like "expense management", "corporate cards"
  competitors: string[]   // company names like "Expensify", "Brex"
  icp: string[]
}

interface GeminiValidationResult {
  relevantSet: Set<string>        // lowercased relevant prompt strings
  keywordMap: Map<string, string> // prompt (lowercased) → core keyword (lowercased)
}

// --- Constants ---

// 20 total: weighted toward Organic (40%) + Competitor (25%)
const CATEGORY_DISTRIBUTION: Record<string, number> = {
  "Organic": 8,
  "Competitor": 5,
  "How-to Guides": 3,
  "Generic": 2,
  "Brand-Specific": 1,
  "FAQ": 1,
}

const TOTAL_RECOMMENDATIONS = 20
const COOLDOWN_DAYS = 7
const JIGSAW_CONCURRENCY = 5

// --- Cooldown ---

export async function canRunRecommender(brandProfileId: number): Promise<{
  allowed: boolean
  timeUntilNext?: number
  lastRunAt?: Date
}> {
  if (process.env.DEVELOPMENT_MODE === "true") {
    return { allowed: true }
  }

  const profile = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    select: { lastRecommenderRunAt: true },
  })

  if (!profile) throw new Error(`Brand profile ${brandProfileId} not found`)
  if (!profile.lastRecommenderRunAt) return { allowed: true }

  const sevenDays = COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  const timeSince = Date.now() - profile.lastRecommenderRunAt.getTime()

  if (timeSince >= sevenDays) {
    return { allowed: true, lastRunAt: profile.lastRecommenderRunAt }
  }

  return {
    allowed: false,
    timeUntilNext: sevenDays - timeSince,
    lastRunAt: profile.lastRecommenderRunAt,
  }
}

// --- Data Parsing Helpers ---

// Common English words that are also company names — too ambiguous for search suggestions
const AMBIGUOUS_WORDS = new Set([
  "bill", "square", "stripe", "block", "toast", "snap", "box", "duo",
  "sage", "wave", "gusto", "ramp", "drift", "gong", "salsa", "chime",
  "plaid", "notion", "linear", "vercel", "arc", "ray", "path", "bolt",
])

/**
 * Extract company name from a URL or plain text.
 * "https://www.expensify.com" -> "Expensify"
 * "https://www.bill.com" -> "Bill.com" (ambiguous name gets .com suffix)
 */
function extractCompanyName(raw: string): string {
  const trimmed = raw.trim()

  // If it's a URL, extract domain
  if (trimmed.includes("://") || trimmed.includes("www.") || trimmed.includes(".com")) {
    try {
      const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`
      const hostname = new URL(url).hostname.replace(/^www\./, "")
      const name = hostname.split(".")[0]
      const capitalized = name.charAt(0).toUpperCase() + name.slice(1)

      // If the name is ambiguous, keep the .com to disambiguate
      if (AMBIGUOUS_WORDS.has(name.toLowerCase())) {
        return capitalized + ".com"
      }

      return capitalized
    } catch {
      const match = trimmed.match(/(?:www\.)?([a-z0-9-]+)\./i)
      if (match) return match[1].charAt(0).toUpperCase() + match[1].slice(1)
    }
  }

  // Plain text — check if ambiguous
  if (AMBIGUOUS_WORDS.has(trimmed.toLowerCase())) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1) + ".com"
  }

  return trimmed
}

/**
 * Extract short service keywords from long descriptions.
 * "Expense Management - Expenses that submit themselves automatically." -> "expense management"
 * "Travel - Travel management that enforces company policies." -> "corporate travel management"
 * Single-word generic terms get "management" or "software" appended.
 */
function extractServiceKeyword(raw: string, companyName: string): string {
  // Split on " - " and take the first part (the title)
  let title = raw.split(" - ")[0].trim()

  // Remove brand name prefix (e.g., "Ramp Intelligence" -> "Intelligence")
  if (title.toLowerCase().startsWith(companyName.toLowerCase() + " ")) {
    title = title.slice(companyName.length).trim()
  }

  const lower = title.toLowerCase()

  // Single-word generic terms need context
  const GENERIC_SINGLE_WORDS = ["travel", "procurement", "intelligence", "analytics"]
  if (!lower.includes(" ") && GENERIC_SINGLE_WORDS.includes(lower)) {
    // Check the description part for better context
    const desc = raw.split(" - ")[1]?.trim() || ""
    if (desc.toLowerCase().includes("management")) return `${lower} management`
    return `corporate ${lower}`
  }

  // Keep it short — max 4 words
  const words = title.split(/\s+/)
  const keyword = words.length > 4 ? words.slice(0, 4).join(" ") : title
  return keyword.toLowerCase()
}

/**
 * Parse ICP from JSON string or comma-separated values.
 */
function parseICP(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map((s: string) => s.trim()).filter(Boolean)
  } catch {}
  return raw.split(",").map(s => s.trim()).filter(Boolean)
}

// --- Quality Filters ---

/**
 * Filter out junk suggestions that aren't useful as AI prompts.
 */
function isValidSuggestion(suggestion: string): boolean {
  const s = suggestion.trim()
  const lower = s.toLowerCase()

  // Too short (< 4 words) or too long (> 15 words)
  const wordCount = s.split(/\s+/).length
  if (wordCount < 3 || wordCount > 20) return false

  // Contains URLs
  if (/https?:\/\/|www\.|\.com|\.org|\.net|\.io/i.test(s)) return false

  // Is just a domain or path
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)) return false

  // Contains login/signin/signup paths (navigational garbage)
  if (/\b(login|signin|sign.?in|sign.?up|pricing page|download|app store)\b/i.test(lower)) return false

  // Just numbers or gibberish
  if (/^[\d\s.,-]+$/.test(s)) return false

  // Too many special characters
  const specialCount = (s.match(/[^a-zA-Z0-9\s'"-]/g) || []).length
  if (specialCount > 3) return false

  return true
}

// --- Seed Generation ---

function generateSeedQueries(brand: BrandContext): Record<string, string[]> {
  const { companyName, industry, services, competitors } = brand
  // Filter out overly generic single-word services for seed diversity
  const topServices = services.filter(s => s.split(/\s+/).length >= 2).slice(0, 5)
  const topCompetitors = competitors.slice(0, 4)

  // For brand-specific: if brand name is ambiguous, add industry context
  const brandQuery = AMBIGUOUS_WORDS.has(companyName.toLowerCase())
    ? `${companyName} ${industry}`
    : companyName

  return {
    "Organic": [
      ...topServices.map(s => `best ${s} software`),
      ...topServices.map(s => `best ${s} platform`),
      ...topServices.slice(0, 2).map(s => `${s} for businesses`),
      ...topServices.slice(0, 2).map(s => `top ${s} tools`),
    ],
    "Competitor": [
      // Cross competitor x service for specificity
      ...topCompetitors.map(c => `${c} alternatives for ${topServices[0] || industry}`),
      ...topCompetitors.map(c => `${c} vs ${companyName}`),
      ...topCompetitors.slice(0, 2).flatMap(c =>
        topServices.slice(0, 2).map(s => `is ${c} good for ${s}`)
      ),
      ...topCompetitors.slice(0, 2).map(c => `${c} review`),
    ],
    "How-to Guides": [
      ...topServices.map(s => `how to choose ${s} software`),
      ...topServices.map(s => `how to automate ${s}`),
      ...topServices.slice(0, 3).map(s => `how to improve ${s}`),
      ...topServices.slice(0, 2).map(s => `how to set up ${s}`),
    ],
    "Generic": [
      ...topServices.slice(0, 3).map(s => `${s} software trends`),
      ...topServices.slice(0, 2).map(s => `${s} best practices`),
      ...topServices.slice(0, 2).map(s => `${s} solutions for startups`),
    ],
    "Brand-Specific": [
      `${brandQuery} reviews`,
      `${brandQuery} pricing`,
      `what is ${brandQuery}`,
      `is ${brandQuery} good`,
    ],
    "FAQ": [
      ...topServices.map(s => `what is ${s}`),
      ...topServices.slice(0, 2).map(s => `why use ${s} software`),
      ...topServices.slice(0, 2).map(s => `do I need ${s}`),
    ],
  }
}

// --- JigsawStack Expansion ---

async function expandWithSuggestions(seeds: string[]): Promise<string[]> {
  const jigsaw = getJigsawClient()
  const allSuggestions: string[] = []

  for (let i = 0; i < seeds.length; i += JIGSAW_CONCURRENCY) {
    const batch = seeds.slice(i, i + JIGSAW_CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(seed =>
        jigsaw.web.search_suggestions({ query: seed.slice(0, 200) })
      )
    )
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.success) {
        allSuggestions.push(...result.value.suggestions)
      }
    }
  }

  // Deduplicate + quality filter
  const seen = new Set<string>()
  return allSuggestions.filter(s => {
    if (!isValidSuggestion(s)) return false
    const key = s.toLowerCase().trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// --- DataForSEO Volume ---

interface KeywordVolume {
  keyword: string
  aiSearchVolume: number
}

async function getAISearchVolumes(
  keywords: string[],
  locationCode: number = 2840,
  languageName: string = "English"
): Promise<KeywordVolume[]> {
  if (keywords.length === 0) return []

  const client = getDataForSEOClient()
  const results: KeywordVolume[] = []

  // Max 1000 keywords per request
  const batches: string[][] = []
  for (let i = 0; i < keywords.length; i += 1000) {
    batches.push(keywords.slice(i, i + 1000))
  }

  for (const batch of batches) {
    try {
      const response = await client.post(
        "/ai_optimization/ai_keyword_data/keywords_search_volume/live",
        [{ keywords: batch, location_code: locationCode, language_name: languageName }]
      )

      const task = response.data?.tasks?.[0]
      if (task?.status_code === 20000 && task.result?.[0]?.items) {
        for (const item of task.result[0].items) {
          results.push({
            keyword: item.keyword,
            aiSearchVolume: item.ai_search_volume ?? 0,
          })
        }
      }
    } catch (error) {
      console.error("DataForSEO batch failed:", error)
    }
  }

  return results
}

function volumeTier(volume: number): "High" | "Medium" | "Low" {
  if (volume >= 1000) return "High"
  if (volume >= 100) return "Medium"
  return "Low"
}

// --- Gemini Relevance Validator ---

async function validateRelevanceWithGemini(
  candidates: string[],
  brand: BrandContext
): Promise<GeminiValidationResult> {
  const fallbackAll = (): GeminiValidationResult => ({
    relevantSet: new Set(candidates.map(c => c.toLowerCase().trim())),
    keywordMap: new Map(),
  })

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey || candidates.length === 0) {
    return fallbackAll()
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const prompt = `You are evaluating search queries for relevance to a specific company.

COMPANY: ${brand.companyName}
DESCRIPTION: ${brand.description}
INDUSTRY: ${brand.industry}
SERVICES: ${brand.services.join(", ")}
COMPETITORS: ${brand.competitors.join(", ")}

Below is a numbered list of search queries. For each query, decide if it is RELEVANT to this company's industry, services, or competitive landscape. A query is relevant if someone searching it could plausibly be a potential customer or if the company could create useful content answering it.

REJECT queries that are:
- About completely unrelated topics (sports, entertainment, cooking, etc.)
- Navigational queries for other websites
- Too generic to be useful (e.g., "what is business cards" when the service is "corporate cards for spending")
- About travel/tourism when the service is corporate travel management
- About physical business cards when the service is corporate spending cards
- Comparing corporate cards to physical business cards (these are unrelated products)

For each RELEVANT query, also extract the core 2-3 word keyword phrase that captures the main search intent (strip modifiers like "best", "top", "how to", "for [industry]", competitor names, etc.).

Return ONLY a JSON array of objects with "idx" (1-indexed query number) and "kw" (core keyword).
Example: [{"idx": 1, "kw": "labeling software"}, {"idx": 3, "kw": "expense management"}]

QUERIES:
${candidates.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Return ONLY the JSON array, no explanation.`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    // Try to parse JSON array from response
    const match = text.match(/\[[\s\S]*\]/s)
    if (!match) return fallbackAll()

    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed) || parsed.length === 0) return fallbackAll()

    const relevantSet = new Set<string>()
    const keywordMap = new Map<string, string>()

    if (typeof parsed[0] === "object" && parsed[0].idx !== undefined) {
      // New format: [{idx, kw}, ...]
      for (const item of parsed) {
        const idx = item.idx
        if (idx >= 1 && idx <= candidates.length) {
          const promptKey = candidates[idx - 1].toLowerCase().trim()
          relevantSet.add(promptKey)
          if (item.kw && typeof item.kw === "string") {
            keywordMap.set(promptKey, item.kw.toLowerCase().trim())
          }
        }
      }
      console.log(`[Recommender] Gemini validated ${relevantSet.size}/${candidates.length} candidates, extracted ${keywordMap.size} core keywords`)
    } else if (typeof parsed[0] === "number") {
      // Fallback: old format [1, 3, 5, 8]
      for (const idx of parsed) {
        if (idx >= 1 && idx <= candidates.length) {
          relevantSet.add(candidates[idx - 1].toLowerCase().trim())
        }
      }
      console.log(`[Recommender] Gemini returned old format, validated ${relevantSet.size}/${candidates.length} (no keywords extracted)`)
    } else {
      return fallbackAll()
    }

    return { relevantSet, keywordMap }
  } catch (error) {
    console.error("[Recommender] Gemini validation failed, keeping all candidates:", error)
    return fallbackAll()
  }
}

// --- Intent Classification ---

function classifySuggestion(
  suggestion: string,
  brand: BrandContext,
  seedIntent: string
): string {
  const lower = suggestion.toLowerCase()
  const brandLower = brand.companyName.toLowerCase()

  // Word-boundary match for brand name
  if (new RegExp(`\\b${escapeRegex(brandLower)}\\b`).test(lower)) return "Brand-Specific"

  // Word-boundary match for competitor names (strip .com for matching)
  for (const comp of brand.competitors) {
    const compClean = comp.toLowerCase().replace(/\.com$/, "")
    if (compClean.length >= 3 && new RegExp(`\\b${escapeRegex(compClean)}\\b`).test(lower)) {
      return "Competitor"
    }
  }

  if (lower.startsWith("how to") || lower.startsWith("how do") || lower.startsWith("how can")) return "How-to Guides"

  if (/^(what is|what are|why |when |is it|can you|should i|do i need|do you need)/.test(lower)) return "FAQ"

  return seedIntent
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// --- Deduplication & Diversity ---

const DEDUP_STOP_WORDS = new Set(["a", "an", "the", "is", "it", "in", "on", "for", "to", "of", "and", "or", "vs", "does"])

function significantWords(text: string): Set<string> {
  return new Set(
    text.toLowerCase().split(/\s+/).filter(w => !DEDUP_STOP_WORDS.has(w) && w.length > 1)
  )
}

function wordOverlap(a: Set<string>, b: Set<string>): number {
  const intersection = [...a].filter(w => b.has(w)).length
  const smaller = Math.min(a.size, b.size)
  return smaller === 0 ? 0 : intersection / smaller
}

/**
 * Remove near-duplicate prompts. Two prompts are near-duplicates if they share
 * 70%+ of their significant words (ignoring stop words).
 */
function deduplicateByOverlap(
  candidates: RecommendedPromptResult[]
): RecommendedPromptResult[] {
  const kept: RecommendedPromptResult[] = []
  const keptWords: Set<string>[] = []

  for (const candidate of candidates) {
    const words = significantWords(candidate.prompt)
    const isDuplicate = keptWords.some(kw => wordOverlap(words, kw) >= 0.7)
    if (!isDuplicate) {
      kept.push(candidate)
      keptWords.push(words)
    }
  }

  return kept
}

/**
 * Ensure competitor prompts are spread across different competitor names.
 * Round-robin: pick the best prompt for each competitor, then fill remaining slots.
 */
function diversifyByCompetitor(
  candidates: RecommendedPromptResult[],
  competitors: string[],
  quota: number
): RecommendedPromptResult[] {
  // Group by which competitor the prompt mentions
  const byCompetitor = new Map<string, RecommendedPromptResult[]>()
  const unmatched: RecommendedPromptResult[] = []

  for (const c of candidates) {
    const lower = c.prompt.toLowerCase()
    const matched = competitors.find(comp => {
      const compClean = comp.toLowerCase().replace(/\.com$/, "")
      return compClean.length >= 3 && new RegExp(`\\b${compClean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower)
    })
    if (matched) {
      if (!byCompetitor.has(matched)) byCompetitor.set(matched, [])
      byCompetitor.get(matched)!.push(c)
    } else {
      unmatched.push(c)
    }
  }

  // Round-robin: 1 from each competitor first, then fill remaining by volume
  const selected: RecommendedPromptResult[] = []
  const used = new Set<string>()

  // First pass: one per competitor (sorted by volume within each)
  for (const [, prompts] of byCompetitor) {
    if (selected.length >= quota) break
    const best = prompts[0] // already sorted by volume
    if (best) {
      selected.push(best)
      used.add(best.prompt.toLowerCase().trim())
    }
  }

  // Second pass: fill remaining slots from all candidates by volume
  if (selected.length < quota) {
    const remaining = candidates
      .filter(c => !used.has(c.prompt.toLowerCase().trim()))
    for (const c of remaining) {
      if (selected.length >= quota) break
      selected.push(c)
    }
  }

  return selected
}

// --- Main Orchestrator ---

export async function generateRecommendations(
  brandProfileId: number,
  country: string = "US"
): Promise<RecommendedPromptResult[]> {
  const countryCode: CountryCode = isAllowedCountry(country) ? country : "US"
  // 1. Load brand context
  const profile = await prisma.brandProfile.findUnique({
    where: { id: brandProfileId },
    select: {
      companyName: true,
      companyDescription: true,
      companyIndustry: true,
      companyServices: true,
      competitors: true,
      companyICP: true,
    },
  })

  if (!profile || !profile.companyName) {
    throw new Error("Brand profile missing required fields")
  }

  // Parse raw data into clean BrandContext
  const rawServices = safeParseArray(profile.companyServices)

  const rawCompetitors = profile.competitors
    ? profile.competitors.split(",").map(s => s.trim()).filter(Boolean)
    : []

  const brand: BrandContext = {
    companyName: profile.companyName,
    description: profile.companyDescription || "",
    industry: profile.companyIndustry || "technology",
    // Extract short keywords from long service descriptions
    services: rawServices.map(s => extractServiceKeyword(s, profile.companyName!)),
    // Extract company names from URLs
    competitors: rawCompetitors.map(extractCompanyName),
    icp: profile.companyICP ? parseICP(profile.companyICP) : [],
  }

  console.log("[Recommender] Brand context:", {
    name: brand.companyName,
    services: brand.services,
    competitors: brand.competitors,
  })

  // 2. Generate seeds per category
  const seedsByIntent = generateSeedQueries(brand)

  console.log("[Recommender] Seeds generated:", Object.fromEntries(
    Object.entries(seedsByIntent).map(([k, v]) => [k, v.length])
  ))

  // 3. Expand all categories via JigsawStack in parallel
  const candidatesByIntent: Record<string, string[]> = {}

  const intentEntries = Object.entries(seedsByIntent)
  const expandedPerIntent = await Promise.all(
    intentEntries.map(([, seeds]) => expandWithSuggestions(seeds))
  )

  for (let i = 0; i < intentEntries.length; i++) {
    const [intent] = intentEntries[i]
    const expanded = expandedPerIntent[i]

    for (const suggestion of expanded) {
      const actualIntent = classifySuggestion(suggestion, brand, intent)
      if (!candidatesByIntent[actualIntent]) candidatesByIntent[actualIntent] = []
      candidatesByIntent[actualIntent].push(suggestion)
    }
  }

  // Deduplicate within each category
  for (const cat of Object.keys(candidatesByIntent)) {
    const seen = new Set<string>()
    candidatesByIntent[cat] = candidatesByIntent[cat].filter(p => {
      const key = p.toLowerCase().trim()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  console.log("[Recommender] Candidates per intent:", Object.fromEntries(
    Object.entries(candidatesByIntent).map(([k, v]) => [k, v.length])
  ))

  // 4. Gemini validation + core keyword extraction
  const allCandidatesRaw = Object.values(candidatesByIntent).flat()
  const uniqueCandidatesRaw = [...new Set(allCandidatesRaw)]
  const uniqueCandidatesLower = [...new Set(allCandidatesRaw.map(c => c.toLowerCase().trim()))]

  console.log("[Recommender] Running Gemini validation for", uniqueCandidatesLower.length, "candidates")

  const { relevantSet, keywordMap } = await validateRelevanceWithGemini(uniqueCandidatesRaw, brand)

  // Apply Gemini filter to categories
  for (const cat of Object.keys(candidatesByIntent)) {
    candidatesByIntent[cat] = candidatesByIntent[cat].filter(
      c => relevantSet.has(c.toLowerCase().trim())
    )
  }

  const allCandidates = Object.values(candidatesByIntent).flat()

  // 5. Build DataForSEO keyword list using core keywords when available
  const keywordsForVolume: string[] = []
  const coreKeywordToPrompts = new Map<string, string[]>()

  for (const candidate of uniqueCandidatesLower) {
    const coreKw = keywordMap.get(candidate) || candidate
    if (!coreKeywordToPrompts.has(coreKw)) {
      coreKeywordToPrompts.set(coreKw, [])
      keywordsForVolume.push(coreKw)
    }
    coreKeywordToPrompts.get(coreKw)!.push(candidate)
  }

  console.log(`[Recommender] Sending ${keywordsForVolume.length} core keywords to DataForSEO (from ${uniqueCandidatesLower.length} candidates)`)

  // 6. DataForSEO volume lookup using core keywords
  const locationCode = DATAFORSEO_LOCATION_MAP[countryCode]
  const languageName = DATAFORSEO_LANGUAGE_MAP[countryCode]
  const volumes = await getAISearchVolumes(keywordsForVolume, locationCode, languageName)

  // Map volumes back to original prompts via core keywords
  const coreVolumeMap = new Map(volumes.map(v => [v.keyword.toLowerCase().trim(), v.aiSearchVolume]))
  const volumeMap = new Map<string, number>()
  for (const [coreKw, prompts] of coreKeywordToPrompts) {
    const vol = coreVolumeMap.get(coreKw) ?? 0
    for (const prompt of prompts) {
      volumeMap.set(prompt, vol)
    }
  }

  // 7. Get existing prompts to avoid duplicates
  const existingPrompts = await prisma.prompt.findMany({
    where: { brandProfileId, isActive: true },
    select: { text: true },
  })
  const existingSet = new Set(existingPrompts.map(p => p.text.toLowerCase().trim()))

  // 8. Select top prompts per category by volume, with dedup + competitor diversity
  const recommendations: RecommendedPromptResult[] = []

  for (const [intent, quota] of Object.entries(CATEGORY_DISTRIBUTION)) {
    let candidates = (candidatesByIntent[intent] || [])
      .filter(c => !existingSet.has(c.toLowerCase().trim()))
      .map(c => ({
        prompt: c,
        intent,
        aiSearchVolume: volumeMap.get(c.toLowerCase().trim()) ?? 0,
        volumeTier: volumeTier(volumeMap.get(c.toLowerCase().trim()) ?? 0),
      }))
      .sort((a, b) => b.aiSearchVolume - a.aiSearchVolume)

    // Remove near-duplicates: if two prompts share 80%+ of their words, keep the higher-volume one
    candidates = deduplicateByOverlap(candidates)

    // For Competitor intent: ensure diversity across competitor names
    if (intent === "Competitor" && brand.competitors.length > 1) {
      candidates = diversifyByCompetitor(candidates, brand.competitors, quota)
    } else {
      candidates = candidates.slice(0, quota)
    }

    recommendations.push(...candidates)
  }

  // 8b. Global cross-category dedup (catches "labeling" vs "labelling", same prompt in two intents)
  const globalDeduped: RecommendedPromptResult[] = []
  const globalKeptWords: Set<string>[] = []
  for (const rec of recommendations) {
    const words = significantWords(rec.prompt)
    const isDupe = globalKeptWords.some(kw => wordOverlap(words, kw) >= 0.7)
    if (!isDupe) {
      globalDeduped.push(rec)
      globalKeptWords.push(words)
    }
  }
  const removed = recommendations.length - globalDeduped.length
  if (removed > 0) console.log(`[Recommender] Global dedup removed ${removed} cross-category duplicates`)
  recommendations.length = 0
  recommendations.push(...globalDeduped)

  // 9. Backfill if fewer than 20 (brand-specific/niche categories may have few candidates)
  if (recommendations.length < TOTAL_RECOMMENDATIONS) {
    const usedSet = new Set(recommendations.map(r => r.prompt.toLowerCase().trim()))
    let remaining = allCandidates
      .filter(c => !usedSet.has(c.toLowerCase().trim()) && !existingSet.has(c.toLowerCase().trim()))
      .map(c => ({
        prompt: c,
        intent: "Organic",
        aiSearchVolume: volumeMap.get(c.toLowerCase().trim()) ?? 0,
        volumeTier: volumeTier(volumeMap.get(c.toLowerCase().trim()) ?? 0) as "High" | "Medium" | "Low",
      }))
      .sort((a, b) => b.aiSearchVolume - a.aiSearchVolume)

    // Dedup backfill candidates against existing recommendations
    remaining = remaining.filter(r => {
      const words = significantWords(r.prompt)
      return !recommendations.some(existing => wordOverlap(words, significantWords(existing.prompt)) >= 0.7)
    })

    recommendations.push(...remaining.slice(0, TOTAL_RECOMMENDATIONS - recommendations.length))
  }

  // 10. Update cooldown timestamp
  await prisma.brandProfile.update({
    where: { id: brandProfileId },
    data: { lastRecommenderRunAt: new Date() },
  })

  console.log("[Recommender] Final recommendations:", recommendations.length)

  return recommendations.slice(0, TOTAL_RECOMMENDATIONS)
}
