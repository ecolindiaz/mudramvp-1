import type { EnhancedGEOResult } from '../../scrapers/enhanced-geo-scraper'

/**
 * Evidence reference for scoring components
 */
export interface EvidenceRef {
  /** Type of evidence found */
  type: 'meta_tag' | 'heading' | 'robots_directive' | 'schema_markup' | 'faq_section' | 'structured_data'
  /** Brief description of the evidence */
  description: string
  /** Location or context where evidence was found */
  location?: string
  /** Raw value or content found */
  value?: string | number | boolean
  /** Impact on scoring (positive/negative) */
  impact: 'positive' | 'negative' | 'neutral'
}

/**
 * Individual component score with evidence
 */
export interface ComponentScore {
  /** Component score (0-100) */
  score: number
  /** Maximum possible score for this component */
  maxScore: number
  /** Weight of this component in overall score */
  weight: number
  /** Weighted contribution to total score */
  weightedScore: number
  /** Brief rationale for the score */
  rationale: string
  /** Supporting evidence */
  evidence: EvidenceRef[]
}

/**
 * Complete scoring result with component breakdown
 */
export interface ScoreResult {
  /** Overall technical score (0-100) */
  overallScore: number
  /** Component-level scores */
  components: {
    robots: ComponentScore
    llms: ComponentScore
    meta: ComponentScore
    headings: ComponentScore
    schema: ComponentScore
    faqs: ComponentScore
  }
  /** Metadata about the scoring */
  metadata: {
    /** When the score was computed */
    computedAt: Date
    /** Total evidence pieces found */
    totalEvidence: number
    /** Score computation method version */
    version: string
  }
}

/**
 * Type alias for ScrapeSnapshot (uses EnhancedGEOResult structure)
 */
export type ScrapeSnapshot = EnhancedGEOResult

/**
 * Component weights for overall score calculation
 * Total must equal 1.0
 */
const COMPONENT_WEIGHTS = {
  robots: 0.15,    // 15% - Crawler accessibility
  llms: 0.25,      // 25% - AI/LLM optimization signals  
  meta: 0.20,      // 20% - Meta tags and descriptions
  headings: 0.15,  // 15% - H1 and heading structure
  schema: 0.15,    // 15% - Structured data markup
  faqs: 0.10       // 10% - FAQ optimization
} as const

/**
 * Compute technical score for robots.txt and crawler directives
 */
function computeRobotsScore(snapshot: ScrapeSnapshot): ComponentScore {
  const evidence: EvidenceRef[] = []
  let score = 0
  const maxScore = 100

  // Check robots meta tag
  const robotsMeta = snapshot.technicalAccessibility?.metaTags?.robots
  if (robotsMeta) {
    const robotsDirectives = robotsMeta.toLowerCase()
    
    if (robotsDirectives.includes('noindex')) {
      evidence.push({
        type: 'robots_directive',
        description: 'Page marked as noindex - blocks search engine indexing',
        value: robotsMeta,
        impact: 'negative'
      })
      score -= 40
    } else if (robotsDirectives.includes('index')) {
      evidence.push({
        type: 'robots_directive',
        description: 'Page explicitly allows indexing',
        value: robotsMeta,
        impact: 'positive'
      })
      score += 20
    }

    if (robotsDirectives.includes('nofollow')) {
      evidence.push({
        type: 'robots_directive',
        description: 'Page marked as nofollow - limits link equity',
        value: robotsMeta,
        impact: 'negative'
      })
      score -= 20
    } else if (robotsDirectives.includes('follow')) {
      evidence.push({
        type: 'robots_directive',
        description: 'Page allows link following',
        value: robotsMeta,
        impact: 'positive'
      })
      score += 15
    }
  } else {
    // Default behavior when no robots directive present
    score += 50
    evidence.push({
      type: 'robots_directive',
      description: 'No robots directive found - default crawling allowed',
      impact: 'positive'
    })
  }

  // Check HTTPS status
  if (snapshot.technicalAccessibility?.technicalElements?.httpsStatus) {
    score += 20
    evidence.push({
      type: 'meta_tag',
      description: 'HTTPS enabled - secure connection',
      value: true,
      impact: 'positive'
    })
  } else {
    score -= 30
    evidence.push({
      type: 'meta_tag',
      description: 'HTTPS not enabled - security concern',
      value: false,
      impact: 'negative'
    })
  }

  // Check status code
  const statusCode = snapshot.technicalAccessibility?.technicalElements?.statusCode
  if (statusCode === 200) {
    score += 30
    evidence.push({
      type: 'meta_tag',
      description: 'Successful HTTP response',
      value: statusCode,
      impact: 'positive'
    })
  } else if (statusCode && statusCode >= 400) {
    score -= 50
    evidence.push({
      type: 'meta_tag',
      description: 'HTTP error status',
      value: statusCode,
      impact: 'negative'
    })
  }

  // Ensure score is within bounds
  score = Math.max(0, Math.min(maxScore, score))

  const rationale = evidence.length > 0 
    ? `Robots accessibility based on ${evidence.length} technical factors`
    : 'No specific robot accessibility data found'

  return {
    score,
    maxScore,
    weight: COMPONENT_WEIGHTS.robots,
    weightedScore: (score / maxScore) * COMPONENT_WEIGHTS.robots * 100,
    rationale,
    evidence
  }
}

/**
 * Compute LLM optimization score based on AI-friendly signals
 */
function computeLLMScore(snapshot: ScrapeSnapshot): ComponentScore {
  const evidence: EvidenceRef[] = []
  let score = 0
  const maxScore = 100

  // Check content quality indicators
  const contentQuality = snapshot.contentStructure?.contentQuality
  if (contentQuality?.wordCount) {
    if (contentQuality.wordCount >= 1000) {
      score += 25
      evidence.push({
        type: 'structured_data',
        description: 'Substantial content length supports LLM comprehension',
        value: contentQuality.wordCount,
        impact: 'positive'
      })
    } else if (contentQuality.wordCount >= 300) {
      score += 15
      evidence.push({
        type: 'structured_data',
        description: 'Moderate content length',
        value: contentQuality.wordCount,
        impact: 'positive'
      })
    } else {
      score -= 10
      evidence.push({
        type: 'structured_data',
        description: 'Low content length may limit LLM understanding',
        value: contentQuality.wordCount,
        impact: 'negative'
      })
    }
  }

  // Check for authority signals
  const authoritySignals = snapshot.contentStructure?.authoritySignals
  if (authoritySignals?.statistics?.length) {
    score += 15
    evidence.push({
      type: 'structured_data',
      description: 'Statistics present - enhances content authority',
      value: authoritySignals.statistics.length,
      impact: 'positive'
    })
  }

  if (authoritySignals?.expertQuotes?.length) {
    score += 15
    evidence.push({
      type: 'structured_data',
      description: 'Expert quotes present - builds credibility',
      value: authoritySignals.expertQuotes.length,
      impact: 'positive'
    })
  }

  if (authoritySignals?.citations?.length) {
    score += 15
    evidence.push({
      type: 'structured_data',
      description: 'Citations present - supports factual claims',
      value: authoritySignals.citations.length,
      impact: 'positive'
    })
  }

  // Check entity recognition
  const entities = snapshot.entityRecognition
  const totalEntities = (entities?.organizations?.length || 0) + 
                       (entities?.people?.length || 0) + 
                       (entities?.technologies?.length || 0) + 
                       (entities?.products?.length || 0)
  
  if (totalEntities >= 5) {
    score += 20
    evidence.push({
      type: 'structured_data',
      description: 'Rich entity recognition enhances LLM context understanding',
      value: totalEntities,
      impact: 'positive'
    })
  } else if (totalEntities > 0) {
    score += 10
    evidence.push({
      type: 'structured_data',
      description: 'Some entities identified',
      value: totalEntities,
      impact: 'positive'
    })
  }

  // Content freshness signals
  if (snapshot.contentFreshness?.publishDate || snapshot.contentFreshness?.lastModified) {
    score += 10
    evidence.push({
      type: 'structured_data',
      description: 'Content freshness indicators present',
      impact: 'positive'
    })
  }

  // Ensure score is within bounds
  score = Math.max(0, Math.min(maxScore, score))

  const rationale = evidence.length > 0 
    ? `LLM optimization based on ${evidence.length} content quality factors`
    : 'Limited LLM optimization signals detected'

  return {
    score,
    maxScore,
    weight: COMPONENT_WEIGHTS.llms,
    weightedScore: (score / maxScore) * COMPONENT_WEIGHTS.llms * 100,
    rationale,
    evidence
  }
}

/**
 * Compute meta tags score
 */
function computeMetaScore(snapshot: ScrapeSnapshot): ComponentScore {
  const evidence: EvidenceRef[] = []
  let score = 0
  const maxScore = 100

  const metaTags = snapshot.technicalAccessibility?.metaTags

  // Check title tag
  if (metaTags?.title) {
    const titleLength = metaTags.title.length
    if (titleLength >= 30 && titleLength <= 60) {
      score += 25
      evidence.push({
        type: 'meta_tag',
        description: 'Title tag length is optimal for search engines',
        value: `${titleLength} characters`,
        impact: 'positive'
      })
    } else if (titleLength > 0) {
      score += 15
      evidence.push({
        type: 'meta_tag',
        description: 'Title tag present but length not optimal',
        value: `${titleLength} characters`,
        impact: 'neutral'
      })
    }
  } else {
    score -= 25
    evidence.push({
      type: 'meta_tag',
      description: 'Missing title tag - critical for SEO',
      impact: 'negative'
    })
  }

  // Check description tag
  if (metaTags?.description) {
    const descLength = metaTags.description.length
    if (descLength >= 120 && descLength <= 160) {
      score += 25
      evidence.push({
        type: 'meta_tag',
        description: 'Meta description length is optimal',
        value: `${descLength} characters`,
        impact: 'positive'
      })
    } else if (descLength > 0) {
      score += 15
      evidence.push({
        type: 'meta_tag',
        description: 'Meta description present but length not optimal',
        value: `${descLength} characters`,
        impact: 'neutral'
      })
    }
  } else {
    score -= 20
    evidence.push({
      type: 'meta_tag',
      description: 'Missing meta description',
      impact: 'negative'
    })
  }

  // Check canonical URL
  if (metaTags?.canonical) {
    score += 15
    evidence.push({
      type: 'meta_tag',
      description: 'Canonical URL specified - prevents duplicate content issues',
      value: metaTags.canonical,
      impact: 'positive'
    })
  }

  // Check Open Graph tags
  const ogTags = Object.keys(metaTags?.openGraph || {}).length
  if (ogTags >= 3) {
    score += 20
    evidence.push({
      type: 'meta_tag',
      description: 'Comprehensive Open Graph tags for social sharing',
      value: `${ogTags} tags`,
      impact: 'positive'
    })
  } else if (ogTags > 0) {
    score += 10
    evidence.push({
      type: 'meta_tag',
      description: 'Some Open Graph tags present',
      value: `${ogTags} tags`,
      impact: 'positive'
    })
  }

  // Check Twitter Card tags
  const twitterTags = Object.keys(metaTags?.twitterCard || {}).length
  if (twitterTags > 0) {
    score += 15
    evidence.push({
      type: 'meta_tag',
      description: 'Twitter Card tags enhance social media presence',
      value: `${twitterTags} tags`,
      impact: 'positive'
    })
  }

  // Ensure score is within bounds
  score = Math.max(0, Math.min(maxScore, score))

  const rationale = evidence.length > 0 
    ? `Meta tag optimization based on ${evidence.length} elements`
    : 'No meta tag data available for analysis'

  return {
    score,
    maxScore,
    weight: COMPONENT_WEIGHTS.meta,
    weightedScore: (score / maxScore) * COMPONENT_WEIGHTS.meta * 100,
    rationale,
    evidence
  }
}

/**
 * Compute headings (H1, etc.) score
 */
function computeHeadingsScore(snapshot: ScrapeSnapshot): ComponentScore {
  const evidence: EvidenceRef[] = []
  let score = 0
  const maxScore = 100

  const headings = snapshot.contentStructure?.headingsHierarchy

  // Check H1 tags
  const h1Count = headings?.h1?.length || 0
  if (h1Count === 1) {
    score += 40
    evidence.push({
      type: 'heading',
      description: 'Single H1 tag - optimal heading structure',
      value: h1Count,
      impact: 'positive'
    })
  } else if (h1Count > 1) {
    score += 20
    evidence.push({
      type: 'heading',
      description: 'Multiple H1 tags found - may confuse search engines',
      value: h1Count,
      impact: 'neutral'
    })
  } else {
    score -= 30
    evidence.push({
      type: 'heading',
      description: 'No H1 tag found - missing primary heading',
      value: h1Count,
      impact: 'negative'
    })
  }

  // Check H2 tags
  const h2Count = headings?.h2?.length || 0
  if (h2Count >= 2 && h2Count <= 6) {
    score += 25
    evidence.push({
      type: 'heading',
      description: 'Good H2 structure for content organization',
      value: h2Count,
      impact: 'positive'
    })
  } else if (h2Count > 0) {
    score += 15
    evidence.push({
      type: 'heading',
      description: 'H2 tags present',
      value: h2Count,
      impact: 'positive'
    })
  }

  // Check heading hierarchy validity
  if (snapshot.technicalAccessibility?.accessibility?.headingStructureValid) {
    score += 25
    evidence.push({
      type: 'heading',
      description: 'Valid heading hierarchy structure',
      value: true,
      impact: 'positive'
    })
  } else if (snapshot.technicalAccessibility?.accessibility?.headingStructureValid === false) {
    score -= 15
    evidence.push({
      type: 'heading',
      description: 'Invalid heading hierarchy detected',
      value: false,
      impact: 'negative'
    })
  }

  // Check for H3+ tags indicating content depth
  const h3Count = headings?.h3?.length || 0
  const h4Count = headings?.h4?.length || 0
  if (h3Count > 0 || h4Count > 0) {
    score += 10
    evidence.push({
      type: 'heading',
      description: 'Deep content structure with H3/H4 tags',
      value: h3Count + h4Count,
      impact: 'positive'
    })
  }

  // Ensure score is within bounds
  score = Math.max(0, Math.min(maxScore, score))

  const rationale = evidence.length > 0 
    ? `Heading structure analysis based on ${evidence.length} factors`
    : 'No heading structure data available'

  return {
    score,
    maxScore,
    weight: COMPONENT_WEIGHTS.headings,
    weightedScore: (score / maxScore) * COMPONENT_WEIGHTS.headings * 100,
    rationale,
    evidence
  }
}

/**
 * Compute schema markup score
 */
function computeSchemaScore(snapshot: ScrapeSnapshot): ComponentScore {
  const evidence: EvidenceRef[] = []
  let score = 0
  const maxScore = 100

  // Check for structured data presence
  const hasJsonLd = snapshot.structuredData?.jsonLd && snapshot.structuredData.jsonLd.length > 0
  const hasMicrodata = snapshot.structuredData?.microdata && snapshot.structuredData.microdata.length > 0
  const hasRdfa = snapshot.structuredData?.rdfa && snapshot.structuredData.rdfa.length > 0

  // Basic structured data presence
  if (hasJsonLd) {
    score += 30
    evidence.push({
      type: 'schema_markup',
      description: 'JSON-LD structured data present',
      value: snapshot.structuredData.jsonLd.length,
      impact: 'positive'
    })
  }

  if (hasMicrodata) {
    score += 20
    evidence.push({
      type: 'schema_markup',
      description: 'Microdata structured markup present',
      value: snapshot.structuredData.microdata.length,
      impact: 'positive'
    })
  }

  if (hasRdfa) {
    score += 15
    evidence.push({
      type: 'schema_markup',
      description: 'RDFa structured markup present',
      value: snapshot.structuredData.rdfa.length,
      impact: 'positive'
    })
  }

  // Check for specific schema types
  const schemaTypes = snapshot.structuredData?.schemaTypes || []
  if (schemaTypes.includes('Organization')) {
    score += 15
    evidence.push({
      type: 'schema_markup',
      description: 'Organization schema enhances business entity recognition',
      value: 'Organization',
      impact: 'positive'
    })
  }

  if (schemaTypes.includes('WebPage') || schemaTypes.includes('WebSite')) {
    score += 10
    evidence.push({
      type: 'schema_markup',
      description: 'Website/WebPage schema present',
      value: 'WebPage/WebSite',
      impact: 'positive'
    })
  }

  if (schemaTypes.includes('BreadcrumbList')) {
    score += 10
    evidence.push({
      type: 'schema_markup',
      description: 'Breadcrumb schema improves navigation understanding',
      value: 'BreadcrumbList',
      impact: 'positive'
    })
  }

  // Penalty for no structured data at all
  if (!hasJsonLd && !hasMicrodata && !hasRdfa) {
    score = 0
    evidence.push({
      type: 'schema_markup',
      description: 'No structured data markup found',
      impact: 'negative'
    })
  }

  // Ensure score is within bounds
  score = Math.max(0, Math.min(maxScore, score))

  const rationale = evidence.length > 0 
    ? `Schema markup analysis based on ${evidence.length} structured data elements`
    : 'No structured data markup detected'

  return {
    score,
    maxScore,
    weight: COMPONENT_WEIGHTS.schema,
    weightedScore: (score / maxScore) * COMPONENT_WEIGHTS.schema * 100,
    rationale,
    evidence
  }
}

/**
 * Compute FAQ optimization score
 */
function computeFAQScore(snapshot: ScrapeSnapshot): ComponentScore {
  const evidence: EvidenceRef[] = []
  let score = 0
  const maxScore = 100

  const faqOptimization = snapshot.faqOptimization

  // Check for FAQ sections
  const faqSectionCount = faqOptimization?.faqSections?.length || 0
  if (faqSectionCount > 0) {
    score += 40
    evidence.push({
      type: 'faq_section',
      description: 'FAQ sections found on page',
      value: faqSectionCount,
      impact: 'positive'
    })
  }

  // Check question-answer pairs
  const qaCount = faqOptimization?.questionAnswerPairs || 0
  if (qaCount >= 5) {
    score += 30
    evidence.push({
      type: 'faq_section',
      description: 'Multiple question-answer pairs enhance content depth',
      value: qaCount,
      impact: 'positive'
    })
  } else if (qaCount > 0) {
    score += 20
    evidence.push({
      type: 'faq_section',
      description: 'Some question-answer pairs present',
      value: qaCount,
      impact: 'positive'
    })
  }

  // Check for FAQ structured data
  if (faqOptimization?.faqStructuredData) {
    score += 20
    evidence.push({
      type: 'schema_markup',
      description: 'FAQ structured data markup present',
      value: true,
      impact: 'positive'
    })
  }

  // Check for FAQ schema
  if (faqOptimization?.faqSchemaPresent) {
    score += 10
    evidence.push({
      type: 'schema_markup',
      description: 'FAQ schema markup detected',
      value: true,
      impact: 'positive'
    })
  }

  // Penalty for no FAQ content
  if (faqSectionCount === 0 && qaCount === 0) {
    evidence.push({
      type: 'faq_section',
      description: 'No FAQ content found - missed opportunity for voice search optimization',
      impact: 'neutral'
    })
  }

  // Ensure score is within bounds
  score = Math.max(0, Math.min(maxScore, score))

  const rationale = evidence.length > 0 
    ? `FAQ optimization based on ${evidence.length} elements`
    : 'No FAQ optimization elements detected'

  return {
    score,
    maxScore,
    weight: COMPONENT_WEIGHTS.faqs,
    weightedScore: (score / maxScore) * COMPONENT_WEIGHTS.faqs * 100,
    rationale,
    evidence
  }
}

/**
 * Main function to compute comprehensive technical score
 * 
 * @param snapshot - ScrapeSnapshot containing website analysis data
 * @returns ScoreResult with overall score and component breakdown
 */
export function computeTechnicalScore(snapshot: ScrapeSnapshot): ScoreResult {
  // Compute individual component scores
  const robotsScore = computeRobotsScore(snapshot)
  const llmsScore = computeLLMScore(snapshot)
  const metaScore = computeMetaScore(snapshot)
  const headingsScore = computeHeadingsScore(snapshot)
  const schemaScore = computeSchemaScore(snapshot)
  const faqsScore = computeFAQScore(snapshot)

  // Calculate overall weighted score
  const overallScore = Math.round(
    robotsScore.weightedScore +
    llmsScore.weightedScore +
    metaScore.weightedScore +
    headingsScore.weightedScore +
    schemaScore.weightedScore +
    faqsScore.weightedScore
  )

  // Count total evidence
  const totalEvidence = 
    robotsScore.evidence.length +
    llmsScore.evidence.length +
    metaScore.evidence.length +
    headingsScore.evidence.length +
    schemaScore.evidence.length +
    faqsScore.evidence.length

  return {
    overallScore,
    components: {
      robots: robotsScore,
      llms: llmsScore,
      meta: metaScore,
      headings: headingsScore,
      schema: schemaScore,
      faqs: faqsScore
    },
    metadata: {
      computedAt: new Date(),
      totalEvidence,
      version: '1.0.0'
    }
  }
}