/**
 * Issue From Scoring Service
 *
 * Converts computePageScore() issues into database Issue records.
 * Uses deterministic scoring-based issue creation instead of LLM hallucination.
 *
 * Key features:
 * - Maps check codes to agent types
 * - Generates per-page issue hashes for deduplication
 * - Maps severity levels to priority
 */

import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import type { FullPageScore } from '@/lib/analysis/technical/types'

// Types
export type IssuePriority = 'low' | 'medium' | 'high'

/**
 * Mapping from scoring check codes to agent types
 */
export const CHECK_TO_AGENT_MAP: Record<string, string> = {
  // Metadata (25 pts)
  'M1_title': 'meta_optimization',
  'M2_description': 'meta_optimization',
  'M3_canonical': 'meta_optimization',
  'M4_opengraph': 'meta_optimization',
  'M5_twitter': 'meta_optimization',

  // Headings (20 pts)
  'H1_single': 'heading_hierarchy',
  'H2_coverage': 'heading_hierarchy',
  'H3_no_skips': 'heading_hierarchy',

  // Semantic (15 pts)
  'S1_main_content': 'content_structure',
  'S2_page_structure': 'content_structure',
  'S3_sections': 'content_structure',
  'S4_content_quality': 'content_structure',

  // Schema (25 pts)
  'J1_present': 'schema_markup',
  'J2_valid': 'schema_markup',
  'J3_relevant': 'schema_markup',

  // FAQ (15 pts)
  'FAQ_count': 'faq_sections',
  'FAQ_schema_gap': 'schema_markup',
}

/**
 * Mapping from check codes to human-readable issue titles
 */
export const ISSUE_TITLES: Record<string, string> = {
  'M1_title': 'Add Page Title Tag',
  'M2_description': 'Add Meta Description',
  'M3_canonical': 'Add Canonical URL',
  'M4_opengraph': 'Add Open Graph Tags',
  'M5_twitter': 'Add Twitter Card Tags',
  'H1_single': 'Fix H1 Heading',
  'H2_coverage': 'Improve Heading Coverage',
  'H3_no_skips': 'Fix Heading Hierarchy',
  'S1_main_content': 'Add Main Content Element',
  'S2_page_structure': 'Add Page Structure Elements',
  'S3_sections': 'Add Semantic Sections',
  'S4_content_quality': 'Improve Content Quality',
  'J1_present': 'Add JSON-LD Schema',
  'J2_valid': 'Fix JSON-LD Syntax',
  'J3_relevant': 'Use AEO-Relevant Schema Types',
  'FAQ_count': 'Add FAQ Content',
  'FAQ_schema_gap': 'Add FAQPage Schema for Existing FAQs',
}

/**
 * Mapping from check codes to detailed descriptions
 */
const ISSUE_DESCRIPTIONS: Record<string, string> = {
  'M1_title': 'This page is missing a <title> tag. A descriptive title is essential for AI systems to understand and cite your content correctly.',
  'M2_description': 'This page is missing a meta description. Meta descriptions help AI systems understand your page content and generate accurate summaries.',
  'M3_canonical': 'This page is missing a canonical URL. Canonical URLs help AI systems know which version of a page to cite.',
  'M4_opengraph': 'This page is missing Open Graph tags. OG tags improve how your content appears when shared and help AI understand page metadata.',
  'M5_twitter': 'This page is missing Twitter Card tags. Twitter cards improve social sharing and provide additional metadata signals.',
  'H1_single': 'This page has an H1 heading issue (missing or multiple H1s). A single, clear H1 helps AI understand the main topic.',
  'H2_coverage': 'This page has insufficient heading coverage. Well-structured headings help AI parse and understand content hierarchy.',
  'H3_no_skips': 'This page has skipped heading levels. Proper heading hierarchy (H1 > H2 > H3) helps AI understand content structure.',
  'S1_main_content': 'This page is missing <main> or <article> elements. Semantic elements help AI identify primary content.',
  'S2_page_structure': 'This page is missing <header> and/or <footer> elements. Page structure elements help AI understand page layout.',
  'S3_sections': 'This page lacks semantic HTML elements. Using semantic HTML helps AI understand content organization.',
  'S4_content_quality': 'This page has thin or poorly structured content. Substantive content with good paragraph structure improves AI citability.',
  'J1_present': 'This page has no JSON-LD schema markup. Structured data is critical for AI systems to understand your content.',
  'J2_valid': 'This page has invalid JSON-LD schema. Invalid schema is ignored by AI systems and search engines.',
  'J3_relevant': 'This page has schema types that are not optimized for Answer Engine visibility. Use Organization, Product, FAQPage, Article, etc.',
  'FAQ_count': 'This page has no FAQ content. FAQ sections are highly valued by AI for direct answer generation.',
  'FAQ_schema_gap': 'This page has FAQ content but no FAQPage schema. Adding schema will make your FAQs eligible for rich results.',
}

/**
 * Mapping from check codes to estimated impact
 */
const ISSUE_IMPACTS: Record<string, string> = {
  'M1_title': '+7 points',
  'M2_description': '+7 points',
  'M3_canonical': '+6 points',
  'M4_opengraph': '+3 points',
  'M5_twitter': '+2 points',
  'H1_single': '+8 points',
  'H2_coverage': '+6 points',
  'H3_no_skips': '+6 points',
  'S1_main_content': '+4 points',
  'S2_page_structure': '+4 points',
  'S3_sections': '+4 points',
  'S4_content_quality': '+3 points',
  'J1_present': '+8 points',
  'J2_valid': '+7 points',
  'J3_relevant': '+10 points',
  'FAQ_count': '+15 points',
  'FAQ_schema_gap': 'Rich results eligibility',
}

/**
 * Map dimension to discovery tier
 */
function getDimensionTier(dimension: string): 'fundamental' | 'intermediate' | 'advanced' {
  switch (dimension) {
    case 'metadata':
    case 'headings':
    case 'schema':
      return 'fundamental'
    case 'semantic':
    case 'faq':
      return 'intermediate'
    default:
      return 'fundamental'
  }
}

/**
 * Map severity to priority
 * high -> high, medium -> medium, low -> low
 */
export function mapSeverityToPriority(severity: string): IssuePriority {
  switch (severity) {
    case 'high':
      return 'high'
    case 'medium':
      return 'medium'
    case 'low':
      return 'low'
    default:
      return 'medium'
  }
}

/**
 * Generate unique hash for issue deduplication - includes URL for per-page tracking
 */
export function generateIssueHashWithUrl(
  brandProfileId: number,
  category: string,
  check: string,
  pageUrl: string
): string {
  const normalized = `${brandProfileId}-${category}-${check}-${pageUrl.toLowerCase().trim()}`
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

/**
 * Create issues from a page score result
 * @param brandProfileId - The brand profile ID
 * @param pageScore - The full page score from computePageScore()
 * @returns Number of issues created
 */
export async function createIssuesFromPageScore(
  brandProfileId: number,
  pageScore: FullPageScore
): Promise<{ created: number; updated: number; skipped: number }> {
  let created = 0
  let updated = 0
  let skipped = 0

  for (const issue of pageScore.issues) {
    const check = issue.check
    const agentType = CHECK_TO_AGENT_MAP[check]
    let title = ISSUE_TITLES[check] || `Fix: ${issue.message}`
    let description = ISSUE_DESCRIPTIONS[check] || issue.message
    let impact = ISSUE_IMPACTS[check] || 'Improved AEO score'

    // J1_present: Use page-type-specific title and full schema impact
    if (check === 'J1_present') {
      const schemaMatch = issue.message.match(/Recommended for this page: (.+)$/)
      if (schemaMatch) {
        title = `Add ${schemaMatch[1]} Schema`
      }
      impact = '+25 points (full schema implementation)'
      description = `This page has no JSON-LD schema markup. Structured data is critical for AI systems to understand your content.\n\nRecommended schemas: ${schemaMatch?.[1] || 'appropriate type for this page'}.`
    }

    if (!agentType) {
      console.warn(`[IssueFromScoring] No agent mapping for check: ${check}`)
      skipped++
      continue
    }

    // Generate hash including URL for per-page deduplication
    const hash = generateIssueHashWithUrl(
      brandProfileId,
      'technical_structure',
      check,
      pageScore.page_url
    )

    // Check if issue already exists
    const existing = await prisma.issue.findUnique({
      where: { issueHash: hash }
    })

    if (existing) {
      // Only update if still in 'identified' status (not in progress or completed)
      if (existing.status === 'identified') {
        await prisma.issue.update({
          where: { id: existing.id },
          data: {
            description: `${description}\n\nAffected page: ${pageScore.page_url}`,
            priority: mapSeverityToPriority(issue.severity),
            estimatedImpact: impact,
            updatedAt: new Date()
          }
        })
        updated++
      } else {
        skipped++
      }
      continue
    }

    // Create new issue
    await prisma.issue.create({
      data: {
        brandProfileId,
        title: `${title} (${getPageName(pageScore.page_url)})`,
        description: `${description}\n\nAffected page: ${pageScore.page_url}`,
        status: 'identified',
        priority: mapSeverityToPriority(issue.severity),
        category: 'technical_structure',
        discoveryTier: getDimensionTier(issue.dimension),
        agentType,
        estimatedImpact: impact,
        affectedUrl: pageScore.page_url,
        discoveredFromScore: pageScore.scores.total,
        sourceAnalysis: 'technical_analysis',
        issueHash: hash
      }
    })
    created++
  }

  console.log(`[IssueFromScoring] Page ${pageScore.page_url}: created=${created}, updated=${updated}, skipped=${skipped}`)
  return { created, updated, skipped }
}

/**
 * Get a short page name from URL for display
 */
function getPageName(url: string): string {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname
    if (path === '/' || path === '') {
      return 'Homepage'
    }
    // Get last segment of path
    const segments = path.split('/').filter(Boolean)
    const lastSegment = segments[segments.length - 1] || 'page'
    // Capitalize first letter
    return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1)
  } catch {
    return 'Page'
  }
}

/**
 * Bulk create issues from multiple page scores
 */
export async function createIssuesFromMultiplePageScores(
  brandProfileId: number,
  pageScores: FullPageScore[]
): Promise<{ totalCreated: number; totalUpdated: number; totalSkipped: number }> {
  let totalCreated = 0
  let totalUpdated = 0
  let totalSkipped = 0

  for (const pageScore of pageScores) {
    const result = await createIssuesFromPageScore(brandProfileId, pageScore)
    totalCreated += result.created
    totalUpdated += result.updated
    totalSkipped += result.skipped
  }

  console.log(`[IssueFromScoring] Bulk create complete: created=${totalCreated}, updated=${totalUpdated}, skipped=${totalSkipped}`)
  return { totalCreated, totalUpdated, totalSkipped }
}

/**
 * Get the check code from an issue title (reverse mapping)
 */
export function getCheckFromTitle(title: string): string | null {
  // Remove page name suffix like "(Homepage)" or "(about)"
  const cleanTitle = title.replace(/\s*\([^)]+\)$/, '').trim()

  for (const [check, issueTitle] of Object.entries(ISSUE_TITLES)) {
    if (cleanTitle === issueTitle) {
      return check
    }
  }
  return null
}

/**
 * Get all failing checks from a page score
 */
export function getFailingChecks(pageScore: FullPageScore): Set<string> {
  return new Set(pageScore.issues.map(issue => issue.check))
}
