/**
 * Five-Dimension Scoring Module
 *
 * Implements the 5-dimension scoring system for Answer Engine Optimization:
 * - Metadata: 25 points (M1-M5)
 * - Headings: 20 points (H1-H3)
 * - Semantic: 15 points (S1-S3)
 * - Schema: 25 points (J1-J3)
 * - FAQ: 15 points (linear scale)
 *
 * Total: 100 points
 */

import type {
	DOMExtraction,
	DOMExtractionData,
	DimensionScore,
	FullPageScore,
	Issue,
	Intervention,
	CheckResult,
	ScoreStatus,
	ScoringDimension,
	IssueSeverity,
	InterventionPriority,
} from "./types";
import { isRelevantSchemaType, SUBTYPE_TO_PARENT } from "./dom-extractor";
import { heuristicRecommendedSchemas } from "./schema-recommender";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Score weights for each dimension
 */
export const DIMENSION_WEIGHTS = {
	metadata: 25,
	headings: 20,
	semantic: 15,
	schema: 25,
	faq: 15,
} as const;

/**
 * Individual check weights within metadata dimension
 */
const METADATA_WEIGHTS = {
	M1_title: 7,
	M2_description: 7,
	M3_canonical: 6,
	M4_opengraph: 3,
	M5_twitter: 2,
} as const;

/**
 * Individual check weights within headings dimension
 */
const HEADINGS_WEIGHTS = {
	H1_single: 8,
	H2_coverage: 6,
	H3_no_skips: 6,
} as const;

/**
 * Individual check weights within semantic dimension
 */
const SEMANTIC_WEIGHTS = {
	S1_main_content: 4,
	S2_page_structure: 4,
	S3_sections: 4,
	S4_content_quality: 3, // NEW: Content depth and readability
} as const;

/**
 * Individual check weights within schema dimension
 *
 * J4_coverage ensures the score reflects whether ALL recommended schemas
 * for the page type are present — not just "at least one relevant type."
 */
const SCHEMA_WEIGHTS = {
	J1_present: 6,
	J2_valid: 5,
	J3_relevant: 7,
	J4_coverage: 7,
} as const;

/**
 * Page types where FAQ scoring is relevant.
 * Non-FAQ page types (about, contact, documentation, other) get 0/0 for FAQ.
 */
const FAQ_RELEVANT_PAGE_TYPES = new Set<string>([
	"home", "pricing", "features", "product", "solutions", "blog",
]);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function createCheckResult(passed: boolean, maxPoints: number, rationale: string): CheckResult {
	return {
		passed,
		points: passed ? maxPoints : 0,
		max_points: maxPoints,
		rationale,
	};
}

function getScoreStatus(total: number): ScoreStatus {
	if (total >= 85) return "excellent";
	if (total >= 70) return "good";
	if (total >= 50) return "needs_improvement";
	return "poor";
}

function createIssue(
	check: string,
	dimension: ScoringDimension,
	severity: IssueSeverity,
	message: string,
	pageUrl: string
): Issue {
	return { check, dimension, severity, message, page_url: pageUrl };
}

function createIntervention(
	check: string,
	priority: InterventionPriority,
	action: string,
	target: string,
	estimatedImpact: string,
	codeHint?: string
): Intervention {
	return {
		check,
		priority,
		action,
		target,
		estimated_impact: estimatedImpact,
		code_hint: codeHint,
	};
}

// ============================================================================
// METADATA SCORING (25 points)
// ============================================================================

/**
 * Scores metadata elements
 *
 * M1 - Title tag present: 7 points
 * M2 - Meta description present: 7 points
 * M3 - Canonical URL present: 6 points
 * M4 - Open Graph present: 3 points
 * M5 - Twitter Cards present: 2 points
 */
export function scoreMetadata(extraction: DOMExtraction): DimensionScore {
	const { metadata } = extraction.extraction;
	const checks: Record<string, CheckResult> = {};
	let totalScore = 0;
	let passedCount = 0;

	// M1 - Title tag
	const m1Passed = metadata.title.present && metadata.title.length > 0;
	checks.M1_title = createCheckResult(
		m1Passed,
		METADATA_WEIGHTS.M1_title,
		m1Passed ? `Title found: "${metadata.title.content?.substring(0, 50)}..."` : "No <title> tag found"
	);
	if (m1Passed) {
		totalScore += METADATA_WEIGHTS.M1_title;
		passedCount++;
	}

	// M2 - Meta description
	const m2Passed = metadata.meta_description.present && metadata.meta_description.length > 0;
	checks.M2_description = createCheckResult(
		m2Passed,
		METADATA_WEIGHTS.M2_description,
		m2Passed ? `Meta description found (${metadata.meta_description.length} chars)` : "No meta description found"
	);
	if (m2Passed) {
		totalScore += METADATA_WEIGHTS.M2_description;
		passedCount++;
	}

	// M3 - Canonical URL
	const m3Passed = metadata.canonical.present && !!metadata.canonical.href;
	checks.M3_canonical = createCheckResult(
		m3Passed,
		METADATA_WEIGHTS.M3_canonical,
		m3Passed ? `Canonical URL: ${metadata.canonical.href}` : "No canonical URL found"
	);
	if (m3Passed) {
		totalScore += METADATA_WEIGHTS.M3_canonical;
		passedCount++;
	}

	// M4 - Open Graph (at least og:title OR og:description)
	const hasOgTitle = metadata.open_graph.tags.some((t) => t.property === "og:title");
	const hasOgDesc = metadata.open_graph.tags.some((t) => t.property === "og:description");
	const m4Passed = hasOgTitle || hasOgDesc;
	checks.M4_opengraph = createCheckResult(
		m4Passed,
		METADATA_WEIGHTS.M4_opengraph,
		m4Passed ? `Open Graph tags found (${metadata.open_graph.count} tags)` : "No Open Graph tags found"
	);
	if (m4Passed) {
		totalScore += METADATA_WEIGHTS.M4_opengraph;
		passedCount++;
	}

	// M5 - Twitter Cards (at least twitter:card OR twitter:title)
	const hasTwitterCard = metadata.twitter_cards.tags.some((t) => t.name === "twitter:card");
	const hasTwitterTitle = metadata.twitter_cards.tags.some((t) => t.name === "twitter:title");
	const m5Passed = hasTwitterCard || hasTwitterTitle;
	checks.M5_twitter = createCheckResult(
		m5Passed,
		METADATA_WEIGHTS.M5_twitter,
		m5Passed ? `Twitter Cards found (${metadata.twitter_cards.count} tags)` : "No Twitter Card tags found"
	);
	if (m5Passed) {
		totalScore += METADATA_WEIGHTS.M5_twitter;
		passedCount++;
	}

	return {
		dimension: "metadata",
		score: totalScore,
		max_score: DIMENSION_WEIGHTS.metadata,
		checks,
		passed_count: passedCount,
		total_count: 5,
	};
}

// ============================================================================
// HEADINGS SCORING (20 points)
// ============================================================================

/**
 * Scores heading hierarchy
 *
 * H1 - Single H1 present: 8 points (exactly one H1)
 * H2 - Heading coverage: 6 points (at least 3 total headings)
 * H3 - No skipped levels: 6 points (no H1->H3 jumps)
 */
export function scoreHeadings(extraction: DOMExtraction): DimensionScore {
	const { headings } = extraction.extraction;
	const checks: Record<string, CheckResult> = {};
	let totalScore = 0;
	let passedCount = 0;

	// H1 - Single H1 (exactly one)
	const h1Passed = headings.counts.h1 === 1;
	let h1Rationale: string;
	if (headings.counts.h1 === 0) {
		h1Rationale = "No H1 tag found";
	} else if (headings.counts.h1 === 1) {
		h1Rationale = "Single H1 tag found (correct)";
	} else {
		h1Rationale = `Multiple H1 tags found (${headings.counts.h1})`;
	}
	checks.H1_single = createCheckResult(h1Passed, HEADINGS_WEIGHTS.H1_single, h1Rationale);
	if (h1Passed) {
		totalScore += HEADINGS_WEIGHTS.H1_single;
		passedCount++;
	}

	// H2 - Coverage (at least 3 total headings)
	const h2Passed = headings.counts.total >= 3;
	checks.H2_coverage = createCheckResult(
		h2Passed,
		HEADINGS_WEIGHTS.H2_coverage,
		h2Passed
			? `Good heading coverage (${headings.counts.total} headings)`
			: `Insufficient heading coverage (${headings.counts.total} headings, need 3+)`
	);
	if (h2Passed) {
		totalScore += HEADINGS_WEIGHTS.H2_coverage;
		passedCount++;
	}

	// H3 - No skipped levels
	const h3Passed = headings.analysis.skipped_levels.length === 0;
	checks.H3_no_skips = createCheckResult(
		h3Passed,
		HEADINGS_WEIGHTS.H3_no_skips,
		h3Passed
			? "No skipped heading levels"
			: `Skipped heading levels: ${headings.analysis.skipped_levels.join(", ")}`
	);
	if (h3Passed) {
		totalScore += HEADINGS_WEIGHTS.H3_no_skips;
		passedCount++;
	}

	return {
		dimension: "headings",
		score: totalScore,
		max_score: DIMENSION_WEIGHTS.headings,
		checks,
		passed_count: passedCount,
		total_count: 3,
	};
}

// ============================================================================
// SEMANTIC HTML SCORING (15 points)
// ============================================================================

/**
 * Scores semantic HTML5 structure
 *
 * S1 - Main content element: 5 points (<main> OR <article>)
 * S2 - Page structure: 5 points (<header> AND <footer>)
 * S3 - Semantic sections: 5 points (total semantic elements >= 3)
 */
export function scoreSemantic(extraction: DOMExtraction): DimensionScore {
	const { semantic_html } = extraction.extraction;
	const checks: Record<string, CheckResult> = {};
	let totalScore = 0;
	let passedCount = 0;

	// S1 - Main content (<main> OR <article>)
	const s1Passed = semantic_html.elements.main.count > 0 || semantic_html.elements.article.count > 0;
	checks.S1_main_content = createCheckResult(
		s1Passed,
		SEMANTIC_WEIGHTS.S1_main_content,
		s1Passed
			? `Main content element found (main: ${semantic_html.elements.main.count}, article: ${semantic_html.elements.article.count})`
			: "No <main> or <article> element found"
	);
	if (s1Passed) {
		totalScore += SEMANTIC_WEIGHTS.S1_main_content;
		passedCount++;
	}

	// S2 - Page structure (<footer>)
	const s2Passed = semantic_html.elements.footer.count > 0;
	checks.S2_page_structure = createCheckResult(
		s2Passed,
		SEMANTIC_WEIGHTS.S2_page_structure,
		s2Passed
			? "<footer> element found"
			: "Missing <footer> element"
	);
	if (s2Passed) {
		totalScore += SEMANTIC_WEIGHTS.S2_page_structure;
		passedCount++;
	}

	// S3 - Semantic sections (total >= 3)
	const s3Passed = semantic_html.semantic_element_count >= 3;
	checks.S3_sections = createCheckResult(
		s3Passed,
		SEMANTIC_WEIGHTS.S3_sections,
		s3Passed
			? `Good semantic structure (${semantic_html.semantic_element_count} semantic elements)`
			: `Insufficient semantic elements (${semantic_html.semantic_element_count}, need 3+)`
	);
	if (s3Passed) {
		totalScore += SEMANTIC_WEIGHTS.S3_sections;
		passedCount++;
	}

	// S4 - Content Quality (NEW: uses content snapshot data)
	const { content_snapshot } = extraction.extraction;
	const hasSubstantialContent = content_snapshot.word_count >= 300;
	const hasGoodStructure = content_snapshot.paragraph_count >= 3;
	const s4Passed = hasSubstantialContent && hasGoodStructure;
	
	let s4Rationale: string;
	if (!hasSubstantialContent) {
		s4Rationale = `Thin content (${content_snapshot.word_count} words, need 300+)`;
	} else if (!hasGoodStructure) {
		s4Rationale = `Poor paragraph structure (${content_snapshot.paragraph_count} paragraphs, need 3+)`;
	} else {
		s4Rationale = `Good content depth (${content_snapshot.word_count} words, ${content_snapshot.paragraph_count} paragraphs)`;
	}
	
	checks.S4_content_quality = createCheckResult(
		s4Passed,
		SEMANTIC_WEIGHTS.S4_content_quality,
		s4Rationale
	);
	if (s4Passed) {
		totalScore += SEMANTIC_WEIGHTS.S4_content_quality;
		passedCount++;
	}

	return {
		dimension: "semantic",
		score: totalScore,
		max_score: DIMENSION_WEIGHTS.semantic,
		checks,
		passed_count: passedCount,
		total_count: 4,
	};
}

// ============================================================================
// SCHEMA / JSON-LD SCORING (25 points)
// ============================================================================

/**
 * Scores Schema/JSON-LD implementation
 *
 * J1 - JSON-LD present: 6 points (at least one script tag)
 * J2 - Valid structure: 5 points (parses, has @context AND @type)
 * J3 - Relevant schema type: 7 points (one of the AEO-relevant types)
 * J4 - Schema coverage: 7 points (all recommended schemas for page type are present)
 */
export function scoreSchema(extraction: DOMExtraction): DimensionScore {
	const { schema } = extraction.extraction;
	const checks: Record<string, CheckResult> = {};
	let totalScore = 0;
	let passedCount = 0;

	// J1 - JSON-LD present
	const j1Passed = schema.jsonld_blocks.length > 0;
	checks.J1_present = createCheckResult(
		j1Passed,
		SCHEMA_WEIGHTS.J1_present,
		j1Passed ? `JSON-LD blocks found (${schema.jsonld_blocks.length})` : "No JSON-LD schema found"
	);
	if (j1Passed) {
		totalScore += SCHEMA_WEIGHTS.J1_present;
		passedCount++;
	}

	// J2 - Valid structure (@context AND @type)
	const validBlocks = schema.jsonld_blocks.filter((b) => b.valid);
	const j2Passed = validBlocks.length > 0;
	checks.J2_valid = createCheckResult(
		j2Passed,
		SCHEMA_WEIGHTS.J2_valid,
		j2Passed
			? `Valid JSON-LD structure (${validBlocks.length} valid blocks)`
			: schema.jsonld_blocks.length > 0
				? "JSON-LD found but invalid structure (missing @context or @type)"
				: "No JSON-LD to validate"
	);
	if (j2Passed) {
		totalScore += SCHEMA_WEIGHTS.J2_valid;
		passedCount++;
	}

	// J3 - Relevant schema type
	const relevantTypes = schema.schema_types.filter((type) => isRelevantSchemaType(type));
	const j3Passed = relevantTypes.length > 0;
	checks.J3_relevant = createCheckResult(
		j3Passed,
		SCHEMA_WEIGHTS.J3_relevant,
		j3Passed
			? `Relevant schema types found: ${relevantTypes.join(", ")}`
			: schema.schema_types.length > 0
				? `Schema types found but not AEO-relevant: ${schema.schema_types.join(", ")}`
				: "No schema types to evaluate"
	);
	if (j3Passed) {
		totalScore += SCHEMA_WEIGHTS.J3_relevant;
		passedCount++;
	}

	// J4 - Schema coverage (all recommended types for this page type present)
	const missingSchemas = getRecommendedSchemas(extraction.page_type, extraction.extraction, extraction.recommendedSchemas);
	const j4Passed = j3Passed && missingSchemas.length === 0;
	let j4Rationale: string;
	if (!j3Passed) {
		j4Rationale = "No relevant schema to evaluate coverage";
	} else if (j4Passed) {
		j4Rationale = "All recommended schemas present for this page type";
	} else {
		j4Rationale = `Missing recommended schemas: ${missingSchemas.join(", ")}`;
	}
	checks.J4_coverage = createCheckResult(j4Passed, SCHEMA_WEIGHTS.J4_coverage, j4Rationale);
	if (j4Passed) {
		totalScore += SCHEMA_WEIGHTS.J4_coverage;
		passedCount++;
	}

	return {
		dimension: "schema",
		score: totalScore,
		max_score: DIMENSION_WEIGHTS.schema,
		checks,
		passed_count: passedCount,
		total_count: 4,
	};
}

// ============================================================================
// FAQ SCORING (15 points)
// ============================================================================

/**
 * Scores FAQ content
 *
 * Linear scale: faq_score = min(faq_count * 5, 15)
 * 0 FAQs = 0 points
 * 1 FAQ = 5 points
 * 2 FAQs = 10 points
 * 3+ FAQs = 15 points (capped)
 */
export function scoreFaq(extraction: DOMExtraction): DimensionScore {
	const { faqs } = extraction.extraction;

	if (!FAQ_RELEVANT_PAGE_TYPES.has(extraction.page_type)) {
		return {
			dimension: "faq", score: 0, max_score: 0,
			checks: { FAQ_not_applicable: {
				passed: true, points: 0, max_points: 0,
				rationale: `FAQ scoring not applicable for ${extraction.page_type} pages`,
			}},
			passed_count: 0, total_count: 0,
		};
	}

	const faqCount = faqs.total_faq_count;
	const score = Math.min(faqCount * 5, 15);

	const checks: Record<string, CheckResult> = {
		FAQ_count: {
			passed: faqCount > 0,
			points: score,
			max_points: DIMENSION_WEIGHTS.faq,
			rationale:
				faqCount === 0
					? "No FAQs found"
					: faqCount === 1
						? "1 FAQ found (+5 points)"
						: faqCount === 2
							? "2 FAQs found (+10 points)"
							: `${faqCount} FAQs found (max +15 points)`,
		},
	};

	// Add info about schema gap
	if (faqs.analysis.schema_gap) {
		checks.FAQ_schema_gap = {
			passed: false,
			points: 0,
			max_points: 0,
			rationale: "FAQ content exists but no FAQPage schema - opportunity to add structured data",
		};
	}
	
	// Add content quality check for FAQ answers
	if (faqCount > 0) {
		const allFaqs = faqs.combined_faqs;
		const avgAnswerLength = allFaqs.reduce((sum, faq) => sum + faq.answer_length, 0) / allFaqs.length;
		const hasSubstantiveAnswers = avgAnswerLength >= 100;
		
		checks.FAQ_answer_quality = {
			passed: hasSubstantiveAnswers,
			points: 0,
			max_points: 0,
			rationale: hasSubstantiveAnswers
				? `Good FAQ depth (avg ${Math.round(avgAnswerLength)} chars per answer)`
				: `FAQ answers too brief (avg ${Math.round(avgAnswerLength)} chars, recommend 100+)`,
		};
	}

	return {
		dimension: "faq",
		score,
		max_score: DIMENSION_WEIGHTS.faq,
		checks,
		passed_count: faqCount > 0 ? 1 : 0,
		total_count: 1,
	};
}

// ============================================================================
// ISSUE GENERATION
// ============================================================================

function generateIssues(
	extraction: DOMExtraction,
	metadataScore: DimensionScore,
	headingsScore: DimensionScore,
	semanticScore: DimensionScore,
	schemaScore: DimensionScore,
	faqScore: DimensionScore
): Issue[] {
	const issues: Issue[] = [];
	const pageUrl = extraction.page_url;

	// Metadata issues
	if (!metadataScore.checks.M1_title?.passed) {
		issues.push(createIssue("M1_title", "metadata", "high", "Missing <title> tag", pageUrl));
	}
	if (!metadataScore.checks.M2_description?.passed) {
		issues.push(createIssue("M2_description", "metadata", "medium", "Missing meta description", pageUrl));
	}
	if (!metadataScore.checks.M3_canonical?.passed) {
		issues.push(createIssue("M3_canonical", "metadata", "medium", "Missing canonical URL", pageUrl));
	}
	if (!metadataScore.checks.M4_opengraph?.passed) {
		issues.push(createIssue("M4_opengraph", "metadata", "low", "Missing Open Graph tags", pageUrl));
	}
	if (!metadataScore.checks.M5_twitter?.passed) {
		issues.push(createIssue("M5_twitter", "metadata", "low", "Missing Twitter Card tags", pageUrl));
	}

	// Heading issues
	if (!headingsScore.checks.H1_single?.passed) {
		const h1Count = extraction.extraction.headings.counts.h1;
		if (h1Count === 0) {
			issues.push(createIssue("H1_single", "headings", "high", "No H1 tag found on page", pageUrl));
		} else {
			issues.push(createIssue("H1_single", "headings", "medium", `Multiple H1 tags found (${h1Count})`, pageUrl));
		}
	}
	if (!headingsScore.checks.H2_coverage?.passed) {
		issues.push(createIssue("H2_coverage", "headings", "medium", "Insufficient heading coverage (< 3 headings)", pageUrl));
	}
	if (!headingsScore.checks.H3_no_skips?.passed) {
		issues.push(createIssue("H3_no_skips", "headings", "medium", "Skipped heading levels detected", pageUrl));
	}

	// Semantic issues
	if (!semanticScore.checks.S1_main_content?.passed) {
		issues.push(createIssue("S1_main_content", "semantic", "medium", "No <main> or <article> element", pageUrl));
	}
	if (!semanticScore.checks.S2_page_structure?.passed) {
		issues.push(createIssue("S2_page_structure", "semantic", "low", "Missing <footer> element", pageUrl));
	}
	if (!semanticScore.checks.S3_sections?.passed) {
		issues.push(createIssue("S3_sections", "semantic", "low", "Insufficient semantic HTML elements", pageUrl));
	}
	if (!semanticScore.checks.S4_content_quality?.passed) {
		const wordCount = extraction.extraction.content_snapshot.word_count;
		const severity: IssueSeverity = wordCount < 150 ? "high" : "medium";
		issues.push(
			createIssue(
				"S4_content_quality",
				"semantic",
				severity,
				`Thin or poorly structured content (${wordCount} words)`,
				pageUrl
			)
		);
	}

	// Schema issues — page-type-specific when no schema exists at all
	if (!schemaScore.checks.J1_present?.passed) {
		const recommendedSchemas = getRecommendedSchemas(extraction.page_type, extraction.extraction, extraction.recommendedSchemas);
		const schemaList = recommendedSchemas.join(' + ');
		issues.push(createIssue(
			"J1_present",
			"schema",
			"high",
			`No JSON-LD schema found. Recommended for this page: ${schemaList}`,
			pageUrl
		));
	}
	if (!schemaScore.checks.J2_valid?.passed && extraction.extraction.schema.jsonld_blocks.length > 0) {
		issues.push(createIssue("J2_valid", "schema", "high", "Invalid JSON-LD structure", pageUrl));
	}
	if (!schemaScore.checks.J3_relevant?.passed && extraction.extraction.schema.has_schema) {
		const recommended = getRecommendedSchemas(extraction.page_type, extraction.extraction, extraction.recommendedSchemas);
		const currentTypes = extraction.extraction.schema.schema_types.join(', ');
		const suggestedTypes = recommended.length > 0 ? recommended.join(' + ') : 'Organization, Article, or Product';
		issues.push(createIssue(
			"J3_relevant",
			"schema",
			"medium",
			`Schema types not optimized for AEO (current: ${currentTypes}). Recommended: ${suggestedTypes}`,
			pageUrl
		));
	}

	// J4 — Schema coverage: page has some relevant schema but is missing additional recommended types
	if (schemaScore.checks.J3_relevant?.passed) {
		const missingSchemas = getRecommendedSchemas(extraction.page_type, extraction.extraction, extraction.recommendedSchemas);
		if (missingSchemas.length > 0) {
			const currentTypes = extraction.extraction.schema.schema_types.join(', ');
			issues.push(createIssue(
				"J4_coverage",
				"schema",
				"medium",
				`Additional schemas recommended (current: ${currentTypes}). Add: ${missingSchemas.join(' + ')}`,
				pageUrl
			));
		}
	}

	// FAQ issues (only for FAQ-relevant page types)
	if (FAQ_RELEVANT_PAGE_TYPES.has(extraction.page_type)) {
		if (faqScore.score === 0) {
			issues.push(createIssue("FAQ_count", "faq", "medium", "No FAQ content found", pageUrl));
		} else if (extraction.extraction.faqs.analysis.schema_gap) {
			issues.push(createIssue("FAQ_schema_gap", "faq", "medium", "FAQ content exists but no FAQPage schema", pageUrl));
		}
	}

	return issues;
}

// ============================================================================
// INTERVENTION GENERATION
// ============================================================================

function generateInterventions(
	extraction: DOMExtraction,
	metadataScore: DimensionScore,
	headingsScore: DimensionScore,
	semanticScore: DimensionScore,
	schemaScore: DimensionScore,
	faqScore: DimensionScore
): Intervention[] {
	const interventions: Intervention[] = [];

	// Metadata interventions
	if (!metadataScore.checks.M1_title?.passed) {
		interventions.push(
			createIntervention(
				"M1_title",
				"high",
				"inject_title_tag",
				"head",
				"+7 points",
				'<title>{page_topic} | {brand}</title>'
			)
		);
	}
	if (!metadataScore.checks.M2_description?.passed) {
		interventions.push(
			createIntervention(
				"M2_description",
				"high",
				"inject_meta_description",
				"head",
				"+7 points",
				'<meta name="description" content="{summary}">'
			)
		);
	}
	if (!metadataScore.checks.M3_canonical?.passed) {
		interventions.push(
			createIntervention(
				"M3_canonical",
				"medium",
				"inject_canonical_tag",
				"head",
				"+6 points",
				'<link rel="canonical" href="{current_url}">'
			)
		);
	}
	if (!metadataScore.checks.M4_opengraph?.passed) {
		interventions.push(
			createIntervention("M4_opengraph", "low", "inject_opengraph_tags", "head", "+3 points")
		);
	}
	if (!metadataScore.checks.M5_twitter?.passed) {
		interventions.push(
			createIntervention("M5_twitter", "low", "inject_twitter_cards", "head", "+2 points")
		);
	}

	// Heading interventions
	if (!headingsScore.checks.H1_single?.passed) {
		const h1Count = extraction.extraction.headings.counts.h1;
		if (h1Count === 0) {
			interventions.push(
				createIntervention("H1_single", "high", "add_h1_tag", "body > main", "+8 points", "<h1>{heading}</h1>")
			);
		} else {
			interventions.push(
				createIntervention("H1_single", "medium", "convert_extra_h1_to_h2", "body", "+8 points")
			);
		}
	}
	if (!headingsScore.checks.H2_coverage?.passed) {
		interventions.push(
			createIntervention("H2_coverage", "medium", "add_section_headings", "body > main", "+6 points")
		);
	}
	if (!headingsScore.checks.H3_no_skips?.passed) {
		interventions.push(
			createIntervention("H3_no_skips", "medium", "fix_heading_hierarchy", "body", "+6 points")
		);
	}

	// Semantic interventions
	if (!semanticScore.checks.S1_main_content?.passed) {
		interventions.push(
			createIntervention("S1_main_content", "medium", "wrap_content_in_article", "body", "+5 points")
		);
	}
	if (!semanticScore.checks.S2_page_structure?.passed) {
		interventions.push(
			createIntervention("S2_page_structure", "low", "add_footer", "body", "+4 points")
		);
	}
	if (!semanticScore.checks.S3_sections?.passed) {
		interventions.push(
			createIntervention("S3_sections", "low", "wrap_divs_in_sections", "body", "+5 points")
		);
	}

	// Schema interventions
	if (!schemaScore.checks.J1_present?.passed) {
		const pageType = extraction.page_type;
		const schemaType = getRecommendedSchemaType(pageType, extraction.recommendedSchemas);
		interventions.push(
			createIntervention(
				"J1_present",
				"high",
				"inject_jsonld_schema",
				"head",
				"+25 points (full schema dimension)",
				`<script type="application/ld+json">{"@context":"https://schema.org","@type":"${schemaType}",...}</script>`
			)
		);
	}
	if (!schemaScore.checks.J2_valid?.passed && extraction.extraction.schema.jsonld_blocks.length > 0) {
		interventions.push(createIntervention("J2_valid", "high", "fix_jsonld_syntax", "head", "+5 points"));
	}
	if (!schemaScore.checks.J3_relevant?.passed && extraction.extraction.schema.has_schema) {
		interventions.push(
			createIntervention("J3_relevant", "medium", "update_schema_type", "head", "+7 points")
		);
	}
	// J4 — Additional schemas to inject alongside existing ones
	if (schemaScore.checks.J4_coverage && !schemaScore.checks.J4_coverage.passed && schemaScore.checks.J3_relevant?.passed) {
		const missingSchemas = getRecommendedSchemas(extraction.page_type, extraction.extraction, extraction.recommendedSchemas);
		if (missingSchemas.length > 0) {
			interventions.push(
				createIntervention(
					"J4_coverage",
					"medium",
					"inject_additional_schemas",
					"head",
					"+7 points",
					missingSchemas.map(s => `<script type="application/ld+json">{"@context":"https://schema.org","@type":"${s}",...}</script>`).join('\n')
				)
			);
		}
	}

	// FAQ interventions (only for FAQ-relevant page types)
	if (FAQ_RELEVANT_PAGE_TYPES.has(extraction.page_type)) {
		if (faqScore.score === 0) {
			interventions.push(
				createIntervention(
					"FAQ_count",
					"high",
					"generate_faq_section",
					"body > main",
					"+15 points",
					"Generate FAQ section with 3-5 Q&As + FAQPage schema"
				)
			);
		} else if (extraction.extraction.faqs.analysis.schema_gap) {
			interventions.push(
				createIntervention(
					"FAQ_schema_gap",
					"medium",
					"add_faqpage_schema",
					"head",
					"Improved rich results",
					"Add FAQPage JSON-LD for existing FAQ content"
				)
			);
		} else if (faqScore.score < 15) {
			interventions.push(
				createIntervention(
					"FAQ_count",
					"low",
					"expand_faq_content",
					"body > main",
					`+${15 - faqScore.score} points`,
					"Add more FAQ items to reach 3+"
				)
			);
		}
	}

	return interventions;
}

/**
 * Returns the primary schema type for a page (used in intervention code hints).
 */
function getRecommendedSchemaType(pageType: string, precomputedSchemas?: string[]): string {
	if (precomputedSchemas && precomputedSchemas.length > 0) {
		// Return the first non-BreadcrumbList, non-FAQPage schema as the primary type
		const primary = precomputedSchemas.find(
			(s) => s !== "BreadcrumbList" && s !== "FAQPage"
		);
		if (primary) return primary;
	}

	switch (pageType) {
		case "home":
			return "Organization";
		case "blog":
			return "BlogPosting";
		case "product":
			return "Product";
		case "pricing":
			return "Product";
		case "features":
			return "SoftwareApplication";
		case "documentation":
			return "Article";
		case "about":
			return "Organization";
		case "contact":
			return "Organization";
		case "solutions":
			return "Service";
		default:
			return "WebPage";
	}
}

/**
 * Returns the full list of recommended schemas for a page.
 *
 * Logic:
 * 1. Page-type core schemas (based on URL pattern)
 * 2. BreadcrumbList — universally recommended for every page
 * 3. Content-aware additions — FAQPage when FAQ content is detected
 *
 * Filters out any schema types the page already has.
 */
export function getRecommendedSchemas(
	pageType: string,
	extraction?: DOMExtractionData,
	precomputedSchemas?: string[]
): string[] {
	// When precomputed schemas are available (from LLM), use them directly
	// but still filter out existing schemas
	if (precomputedSchemas && precomputedSchemas.length > 0) {
		if (extraction) {
			const expandedExisting = new Set(extraction.schema.schema_types);
			for (const t of extraction.schema.schema_types) {
				const parent = SUBTYPE_TO_PARENT.get(t);
				if (parent) expandedExisting.add(parent);
			}
			return precomputedSchemas.filter((s) => !expandedExisting.has(s));
		}
		return [...precomputedSchemas];
	}

	// Heuristic fallback — single source of truth from schema-recommender
	const schemas = heuristicRecommendedSchemas(pageType);

	// BreadcrumbList for all non-home pages
	if (pageType !== "home") {
		schemas.push("BreadcrumbList");
	}

	// Content-aware: FAQPage when FAQ content exists
	if (extraction) {
		if (extraction.faqs.has_faq_content && !extraction.schema.analysis.has_faq_schema) {
			schemas.push("FAQPage");
		}
	}

	// Filter out schemas the page already has (including parent types when subtypes exist)
	if (extraction) {
		const expandedExisting = new Set(extraction.schema.schema_types);
		for (const t of extraction.schema.schema_types) {
			const parent = SUBTYPE_TO_PARENT.get(t);
			if (parent) expandedExisting.add(parent);
		}
		return schemas.filter((s) => !expandedExisting.has(s));
	}

	return schemas;
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Computes the complete page score using the 5-dimension system
 *
 * @param extraction - The DOMExtraction result from htmlToExtraction
 * @returns FullPageScore with all dimension scores, issues, and interventions
 */
export function computePageScore(extraction: DOMExtraction): FullPageScore {
	// Score each dimension
	const metadataScore = scoreMetadata(extraction);
	const headingsScore = scoreHeadings(extraction);
	const semanticScore = scoreSemantic(extraction);
	const schemaScore = scoreSchema(extraction);
	const faqScore = scoreFaq(extraction);

	// Calculate total (normalized to 100 when FAQ is excluded)
	const maxPossible = metadataScore.max_score + headingsScore.max_score +
		semanticScore.max_score + schemaScore.max_score + faqScore.max_score;
	const rawTotal = metadataScore.score + headingsScore.score +
		semanticScore.score + schemaScore.score + faqScore.score;
	const total = maxPossible > 0 ? Math.round((rawTotal / maxPossible) * 100) : 0;

	// Generate issues and interventions
	const issues = generateIssues(
		extraction,
		metadataScore,
		headingsScore,
		semanticScore,
		schemaScore,
		faqScore
	);

	const interventions = generateInterventions(
		extraction,
		metadataScore,
		headingsScore,
		semanticScore,
		schemaScore,
		faqScore
	);

	return {
		page_url: extraction.page_url,
		page_type: extraction.page_type,
		scores: {
			metadata: metadataScore.score,
			headings: headingsScore.score,
			semantic: semanticScore.score,
			schema: schemaScore.score,
			faq: faqScore.score,
			total,
		},
		dimension_details: {
			metadata: metadataScore,
			headings: headingsScore,
			semantic: semanticScore,
			schema: schemaScore,
			faq: faqScore,
		},
		status: getScoreStatus(total),
		issues,
		interventions,
	};
}

/**
 * Calculates site-wide average score from multiple page scores
 */
export function computeSiteScore(pageScores: FullPageScore[]): number {
	if (pageScores.length === 0) return 0;
	const total = pageScores.reduce((sum, ps) => sum + ps.scores.total, 0);
	return Math.round(total / pageScores.length);
}

// Export individual scorers for testing
export const scorers = {
	scoreMetadata,
	scoreHeadings,
	scoreSemantic,
	scoreSchema,
	scoreFaq,
};
