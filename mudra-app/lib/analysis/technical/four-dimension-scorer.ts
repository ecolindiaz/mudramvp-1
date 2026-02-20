/**
 * Four-Dimension Scoring Module
 *
 * Implements the 4-dimension scoring system for Answer Engine Optimization:
 * - Schema: 40 points (J1-J4)
 * - Metadata: 30 points (M1-M5)
 * - FAQ: 20 points (linear scale)
 * - Content: 10 points (C1-C2)
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
import { validateRequiredProperties } from "./schema-required-properties";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Score weights for each dimension
 */
export const DIMENSION_WEIGHTS = {
	schema: 40,
	metadata: 30,
	faq: 20,
	content: 10,
} as const;

/**
 * Individual check weights within metadata dimension
 */
const METADATA_WEIGHTS = {
	M1_title: 8,
	M2_description: 8,
	M3_canonical: 6,
	M4_opengraph: 4,
	M5_twitter: 4,
} as const;

/**
 * Individual check weights within content dimension
 */
const CONTENT_WEIGHTS = {
	C1_word_count: 5,
	C2_paragraph_structure: 5,
} as const;

/**
 * Individual check weights within schema dimension
 *
 * J4_coverage ensures the score reflects whether ALL recommended schemas
 * for the page type are present — not just "at least one relevant type."
 */
const SCHEMA_WEIGHTS = {
	J1_present: 10,
	J2a_valid_structure: 4,
	J2b_required_properties: 4,
	J3_relevant: 11,
	J4_coverage: 11,
} as const;

/**
 * Page types where FAQ scoring is relevant.
 * Non-FAQ page types (about, contact, documentation, other) get 0/0 for FAQ.
 */
const FAQ_RELEVANT_PAGE_TYPES = new Set<string>([
	"home", "pricing", "features", "product", "solutions", "blog",
	"use-cases", "customers",
]);

/**
 * Non-marketing page types that should be excluded from scoring and issue creation.
 * These are form/utility pages whose content users can't meaningfully optimize.
 */
export const NON_MARKETING_PAGE_TYPES = new Set<string>([
	"contact", "demo", "login", "signup", "legal",
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
// METADATA SCORING (30 points)
// ============================================================================

/**
 * Scores metadata elements
 *
 * M1 - Title tag present: 8 points
 * M2 - Meta description present: 8 points
 * M3 - Canonical URL present: 6 points
 * M4 - Open Graph present: 4 points
 * M5 - Twitter Cards present: 4 points
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
// CONTENT SCORING (10 points)
// ============================================================================

/**
 * Scores content quality
 *
 * C1 - Word count >= 300: 5 points
 * C2 - Paragraph structure >= 3 paragraphs: 5 points
 */
export function scoreContent(extraction: DOMExtraction): DimensionScore {
	const { content_snapshot } = extraction.extraction;
	const checks: Record<string, CheckResult> = {};
	let totalScore = 0;
	let passedCount = 0;

	// C1 - Word count
	const c1Passed = content_snapshot.word_count >= 300;
	checks.C1_word_count = createCheckResult(
		c1Passed,
		CONTENT_WEIGHTS.C1_word_count,
		c1Passed
			? `Good content depth (${content_snapshot.word_count} words)`
			: `Thin content (${content_snapshot.word_count} words, need 300+)`
	);
	if (c1Passed) {
		totalScore += CONTENT_WEIGHTS.C1_word_count;
		passedCount++;
	}

	// C2 - Paragraph structure
	const c2Passed = content_snapshot.paragraphs.length >= 3;
	checks.C2_paragraph_structure = createCheckResult(
		c2Passed,
		CONTENT_WEIGHTS.C2_paragraph_structure,
		c2Passed
			? `Good paragraph structure (${content_snapshot.paragraphs.length} paragraphs)`
			: `Poor paragraph structure (${content_snapshot.paragraphs.length} paragraphs, need 3+)`
	);
	if (c2Passed) {
		totalScore += CONTENT_WEIGHTS.C2_paragraph_structure;
		passedCount++;
	}

	return {
		dimension: "content",
		score: totalScore,
		max_score: DIMENSION_WEIGHTS.content,
		checks,
		passed_count: passedCount,
		total_count: 2,
	};
}

// ============================================================================
// SCHEMA / JSON-LD SCORING (40 points)
// ============================================================================

/**
 * Scores Schema/JSON-LD implementation
 *
 * J1 - JSON-LD present: 10 points (at least one script tag)
 * J2 - Valid structure: 8 points (parses, has @context AND @type)
 * J3 - Relevant schema type: 11 points (one of the AEO-relevant types)
 * J4 - Schema coverage: 11 points (all recommended schemas for page type are present)
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

	// J2a - Valid structure (@context AND @type)
	const validBlocks = schema.jsonld_blocks.filter((b) => b.valid);
	const j2aPassed = validBlocks.length > 0;
	checks.J2a_valid_structure = createCheckResult(
		j2aPassed,
		SCHEMA_WEIGHTS.J2a_valid_structure,
		j2aPassed
			? `Valid JSON-LD structure (${validBlocks.length} valid blocks)`
			: schema.jsonld_blocks.length > 0
				? "JSON-LD found but invalid structure (missing @context or @type)"
				: "No JSON-LD to validate"
	);
	if (j2aPassed) {
		totalScore += SCHEMA_WEIGHTS.J2a_valid_structure;
		passedCount++;
	}

	// J2b - Required properties present for each type
	let allRequiredPresent = true;
	const missingProps: string[] = [];
	for (const block of validBlocks) {
		const result = validateRequiredProperties(block.data);
		if (result.missing.length > 0) {
			allRequiredPresent = false;
			missingProps.push(`${result.type}: missing ${result.missing.map(m => m.property).join(", ")}`);
		}
	}
	const j2bPassed = j2aPassed && allRequiredPresent;
	checks.J2b_required_properties = createCheckResult(
		j2bPassed,
		SCHEMA_WEIGHTS.J2b_required_properties,
		j2bPassed
			? "All valid schemas have required properties"
			: !j2aPassed
				? "No valid schemas to check required properties"
				: `Missing required properties: ${missingProps.join("; ")}`
	);
	if (j2bPassed) {
		totalScore += SCHEMA_WEIGHTS.J2b_required_properties;
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
		total_count: 5,
	};
}

// ============================================================================
// FAQ SCORING (20 points)
// ============================================================================

/**
 * Scores FAQ content
 *
 * Linear scale: faq_score = min(faq_count * 5, 20)
 * 0 FAQs = 0 points
 * 1 FAQ = 5 points
 * 2 FAQs = 10 points
 * 3 FAQs = 15 points
 * 4+ FAQs = 20 points (capped)
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
	const score = Math.min(faqCount * 5, 20);

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
							: faqCount === 3
								? "3 FAQs found (+15 points)"
								: `${faqCount} FAQs found (max +20 points)`,
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
	schemaScore: DimensionScore,
	faqScore: DimensionScore,
	contentScore: DimensionScore
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

	// Content issues
	if (!contentScore.checks.C1_word_count?.passed) {
		const wordCount = extraction.extraction.content_snapshot.word_count;
		const severity: IssueSeverity = wordCount < 150 ? "high" : "medium";
		issues.push(
			createIssue("C1_word_count", "content", severity, `Thin content (${wordCount} words, need 300+)`, pageUrl)
		);
	}
	if (!contentScore.checks.C2_paragraph_structure?.passed) {
		const paragraphCount = extraction.extraction.content_snapshot.paragraphs.length;
		issues.push(
			createIssue("C2_paragraph_structure", "content", "medium", `Poor paragraph structure (${paragraphCount} paragraphs, need 3+)`, pageUrl)
		);
	}

	// Schema issues — page-type-specific when no schema exists at all
	if (!schemaScore.checks.J1_present?.passed) {
		const recommendedSchemas = getRecommendedSchemas(extraction.page_type, extraction.extraction, extraction.recommendedSchemas);
		const schemaList = recommendedSchemas.join(' + ');
		let message = `No JSON-LD schema found. Recommended for this page: ${schemaList}`;
		// Embed extracted FAQ data so downstream script generators can use real content
		if (recommendedSchemas.includes("FAQPage") && extraction.extraction.faqs.combined_faqs.length > 0) {
			const faqData = extraction.extraction.faqs.combined_faqs.map(f => ({
				question: f.question,
				answer: f.answer,
			}));
			message += `\n<!-- FAQ_DATA: ${JSON.stringify(faqData)} -->`;
		}
		issues.push(createIssue(
			"J1_present",
			"schema",
			"high",
			message,
			pageUrl
		));
	}
	if (!schemaScore.checks.J2a_valid_structure?.passed && extraction.extraction.schema.jsonld_blocks.length > 0) {
		const existingTypes = extraction.extraction.schema.schema_types;
		const typeInfo = existingTypes.length > 0 ? `. Current types: ${existingTypes.join(', ')}` : '';
		issues.push(createIssue("J2a_valid_structure", "schema", "high", `Invalid JSON-LD structure (missing @context or @type)${typeInfo}`, pageUrl));
	}
	if (!schemaScore.checks.J2b_required_properties?.passed && schemaScore.checks.J2a_valid_structure?.passed) {
		issues.push(createIssue("J2b_required_properties", "schema", "medium", `Schema blocks missing required properties — check Google structured data requirements`, pageUrl));
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
			let message = `Additional schemas recommended (current: ${currentTypes}). Add: ${missingSchemas.join(' + ')}`;
			// Embed extracted FAQ data so downstream script generators can use real content
			if (missingSchemas.includes("FAQPage") && extraction.extraction.faqs.combined_faqs.length > 0) {
				const faqData = extraction.extraction.faqs.combined_faqs.map(f => ({
					question: f.question,
					answer: f.answer,
				}));
				message += `\n<!-- FAQ_DATA: ${JSON.stringify(faqData)} -->`;
			}
			issues.push(createIssue(
				"J4_coverage",
				"schema",
				"medium",
				message,
				pageUrl
			));
		}
	}

	// FAQ issues (only for FAQ-relevant page types)
	// Note: FAQ_schema_gap was removed — FAQPage is already included in J1/J4
	// recommended schemas when FAQ content exists, avoiding duplicate issues.
	if (FAQ_RELEVANT_PAGE_TYPES.has(extraction.page_type)) {
		if (faqScore.score === 0) {
			issues.push(createIssue("FAQ_count", "faq", "medium",
				`No FAQ content found\n<!-- PAGE_TYPE: ${extraction.page_type} -->`, pageUrl));
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
	schemaScore: DimensionScore,
	faqScore: DimensionScore,
	contentScore: DimensionScore
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
				"+8 points",
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
				"+8 points",
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
			createIntervention("M4_opengraph", "low", "inject_opengraph_tags", "head", "+4 points")
		);
	}
	if (!metadataScore.checks.M5_twitter?.passed) {
		interventions.push(
			createIntervention("M5_twitter", "low", "inject_twitter_cards", "head", "+4 points")
		);
	}

	// Content interventions
	if (!contentScore.checks.C1_word_count?.passed) {
		interventions.push(
			createIntervention("C1_word_count", "medium", "add_more_content", "body > main", "+5 points", "Add substantive content to reach 300+ words")
		);
	}
	if (!contentScore.checks.C2_paragraph_structure?.passed) {
		interventions.push(
			createIntervention("C2_paragraph_structure", "low", "improve_paragraph_structure", "body > main", "+5 points", "Break content into 3+ well-structured paragraphs")
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
				"+40 points (full schema dimension)",
				`<script type="application/ld+json">{"@context":"https://schema.org","@type":"${schemaType}",...}</script>`
			)
		);
	}
	if (!schemaScore.checks.J2a_valid_structure?.passed && extraction.extraction.schema.jsonld_blocks.length > 0) {
		interventions.push(createIntervention("J2a_valid_structure", "high", "fix_jsonld_syntax", "head", "+4 points"));
	}
	if (!schemaScore.checks.J2b_required_properties?.passed && schemaScore.checks.J2a_valid_structure?.passed) {
		interventions.push(createIntervention("J2b_required_properties", "medium", "add_required_schema_properties", "head", "+4 points"));
	}
	if (!schemaScore.checks.J3_relevant?.passed && extraction.extraction.schema.has_schema) {
		interventions.push(
			createIntervention("J3_relevant", "medium", "update_schema_type", "head", "+11 points")
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
					"+11 points",
					missingSchemas.map(s => `<script type="application/ld+json">{"@context":"https://schema.org","@type":"${s}",...}</script>`).join('\n')
				)
			);
		}
	}

	// FAQ interventions (only for FAQ-relevant page types)
	// Note: FAQ_schema_gap intervention removed — FAQPage flows through J1/J4.
	if (FAQ_RELEVANT_PAGE_TYPES.has(extraction.page_type)) {
		if (faqScore.score === 0) {
			interventions.push(
				createIntervention(
					"FAQ_count",
					"high",
					"generate_faq_section",
					"body > main",
					"+20 points",
					"Generate FAQ section with 3-5 Q&As + FAQPage schema"
				)
			);
		} else if (faqScore.score < 20) {
			interventions.push(
				createIntervention(
					"FAQ_count",
					"low",
					"expand_faq_content",
					"body > main",
					`+${20 - faqScore.score} points`,
					"Add more FAQ items to reach 4+"
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
		let filtered: string[];
		if (extraction) {
			const expandedExisting = new Set(extraction.schema.schema_types);
			for (const t of extraction.schema.schema_types) {
				const parent = SUBTYPE_TO_PARENT.get(t);
				if (parent) expandedExisting.add(parent);
			}
			filtered = precomputedSchemas.filter((s) => !expandedExisting.has(s));
		} else {
			filtered = [...precomputedSchemas];
		}

		// Post-filter: remove content-dependent types when extraction signals are absent
		if (extraction) {
			filtered = filtered.filter(s => {
				if (s === "VideoObject" && !extraction.has_video_primary_content) return false;
				if (s === "Review" && !extraction.has_testimonial_content) return false;
				return true;
			});
		}

		return filtered;
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
 * Computes the complete page score using the 4-dimension system
 *
 * @param extraction - The DOMExtraction result from htmlToExtraction
 * @returns FullPageScore with all dimension scores, issues, and interventions
 */
export function computePageScore(extraction: DOMExtraction): FullPageScore {
	// Skip non-marketing pages — they produce irrelevant issues
	if (NON_MARKETING_PAGE_TYPES.has(extraction.page_type)) {
		return {
			page_url: extraction.page_url,
			page_type: extraction.page_type,
			scores: { schema: 0, metadata: 0, faq: 0, content: 0, total: 0 },
			dimension_details: {
				schema: { dimension: "schema", score: 0, max_score: 0, checks: {}, passed_count: 0, total_count: 0 },
				metadata: { dimension: "metadata", score: 0, max_score: 0, checks: {}, passed_count: 0, total_count: 0 },
				faq: { dimension: "faq", score: 0, max_score: 0, checks: {}, passed_count: 0, total_count: 0 },
				content: { dimension: "content", score: 0, max_score: 0, checks: {}, passed_count: 0, total_count: 0 },
			},
			status: "poor",
			issues: [],
			interventions: [],
		};
	}

	// Score each dimension
	const schemaScore = scoreSchema(extraction);
	const metadataScore = scoreMetadata(extraction);
	const faqScore = scoreFaq(extraction);
	const contentScore = scoreContent(extraction);

	// Calculate total (normalized to 100 when FAQ is excluded)
	const maxPossible = schemaScore.max_score + metadataScore.max_score +
		faqScore.max_score + contentScore.max_score;
	const rawTotal = schemaScore.score + metadataScore.score +
		faqScore.score + contentScore.score;
	const total = maxPossible > 0 ? Math.round((rawTotal / maxPossible) * 100) : 0;

	// Generate issues and interventions
	const issues = generateIssues(
		extraction,
		metadataScore,
		schemaScore,
		faqScore,
		contentScore
	);

	const interventions = generateInterventions(
		extraction,
		metadataScore,
		schemaScore,
		faqScore,
		contentScore
	);

	return {
		page_url: extraction.page_url,
		page_type: extraction.page_type,
		scores: {
			schema: schemaScore.score,
			metadata: metadataScore.score,
			faq: faqScore.score,
			content: contentScore.score,
			total,
		},
		dimension_details: {
			schema: schemaScore,
			metadata: metadataScore,
			faq: faqScore,
			content: contentScore,
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
	// Exclude non-marketing pages so they don't drag down the site average
	const marketingPages = pageScores.filter(ps => !NON_MARKETING_PAGE_TYPES.has(ps.page_type));
	if (marketingPages.length === 0) return 0;
	const total = marketingPages.reduce((sum, ps) => sum + ps.scores.total, 0);
	return Math.round(total / marketingPages.length);
}

// Export individual scorers for testing
export const scorers = {
	scoreMetadata,
	scoreSchema,
	scoreFaq,
	scoreContent,
};
