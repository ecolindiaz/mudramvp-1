import type { ScrapeSnapshot, ScoreComponent, ScoreResult, TechnicalFinding } from "@/lib/analysis/technical/types";

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

// Weights calibration for v1 (tune as needed)
export const WEIGHTS = {
	meta_title: 10,
	meta_description: 8,
	favicon: 2,
	h1_present: 8,
	heading_structure: 5,
	robots_txt: 6,
	llms_txt: 6,
	llms_full_txt: 2,
	jsonld_any: 8,
	faq_schema: 8,
	faq_content: 8,
	freshness_signals: 5,
} as const;

export function computeTechnicalScore(snapshot: ScrapeSnapshot): ScoreResult {
	const components: ScoreComponent[] = [];

	// Metadata: title
	components.push({
		key: "meta_title",
		label: "Meta title present",
		max: WEIGHTS.meta_title,
		score: snapshot.metadata?.title ? 10 : 0,
		category: "SEO",
		rationale: snapshot.metadata?.title ? "Found <title>." : "No <title> found.",
		evidence: [{ path: "metadata.title", value: snapshot.metadata?.title }],
	});

	// Metadata: description
	components.push({
		key: "meta_description",
		label: "Meta description present",
		max: WEIGHTS.meta_description,
		score: snapshot.metadata?.description ? 8 : 0,
		category: "SEO",
		rationale: snapshot.metadata?.description ? "Found meta description." : "No meta description.",
		evidence: [{ path: "metadata.description", value: snapshot.metadata?.description }],
	});

	// Favicon
	components.push({
		key: "favicon",
		label: "Favicon present",
		max: WEIGHTS.favicon,
		score: snapshot.metadata?.favicon ? 2 : 0,
		category: "SEO",
		rationale: snapshot.metadata?.favicon ? "Favicon exists." : "Missing favicon.",
		evidence: [{ path: "metadata.favicon", value: snapshot.metadata?.favicon }],
	});

	// H1
	const h1s = snapshot.htmlStructure?.headings?.h1 ?? [];
	components.push({
		key: "h1_present",
		label: "H1 present",
		max: WEIGHTS.h1_present,
		score: h1s.length > 0 ? 8 : 0,
		category: "SEO",
		rationale: h1s.length > 0 ? "At least one H1 present." : "Missing H1.",
		evidence: [{ path: "htmlStructure.headings.h1", value: h1s }],
	});

	// Heading structure sanity
	const hasStructure = Boolean(snapshot.htmlStructure?.hasProperStructure);
	components.push({
		key: "heading_structure",
		label: "Heading structure sane",
		max: WEIGHTS.heading_structure,
		score: hasStructure ? 5 : 0,
		category: "SEO",
		rationale: hasStructure ? "Sane heading nesting." : "Potential heading structure issues.",
		evidence: [{ path: "htmlStructure.hasProperStructure", value: hasStructure }],
	});

	// Robots.txt
	const hasRobots = Boolean(snapshot.txtFiles?.summary?.hasRobotsTxt);
	components.push({
		key: "robots_txt",
		label: "robots.txt present",
		max: WEIGHTS.robots_txt,
		score: hasRobots ? 6 : 0,
		category: "SEO",
		rationale: hasRobots ? "robots.txt is present." : "robots.txt missing.",
		evidence: [{ path: "txtFiles.summary.hasRobotsTxt", value: hasRobots }],
	});

	// LLMs files
	const hasLlms = Boolean(snapshot.txtFiles?.summary?.hasLlmsTxt);
	const hasLlmsFull = Boolean(snapshot.txtFiles?.summary?.hasLlmsFullTxt);
	components.push({
		key: "llms_txt",
		label: "llms.txt present",
		max: WEIGHTS.llms_txt,
		score: hasLlms ? 6 : 0,
		category: "GEO",
		rationale: hasLlms ? "llms.txt is present." : "llms.txt missing.",
		evidence: [{ path: "txtFiles.summary.hasLlmsTxt", value: hasLlms }],
	});
	components.push({
		key: "llms_full_txt",
		label: "llms-full.txt present",
		max: WEIGHTS.llms_full_txt,
		score: hasLlmsFull ? 2 : 0,
		category: "GEO",
		rationale: hasLlmsFull ? "llms-full.txt present." : "llms-full.txt missing.",
		evidence: [{ path: "txtFiles.summary.hasLlmsFullTxt", value: hasLlmsFull }],
	});

	// Schema basics
	const jsonLdCount = snapshot.schema?.summary?.jsonLdCount ?? 0;
	const faqSchemaCount = snapshot.schema?.summary?.faqSchemaCount ?? 0;
	components.push({
		key: "jsonld_any",
		label: "JSON-LD present",
		max: WEIGHTS.jsonld_any,
		score: jsonLdCount > 0 ? 8 : 0,
		category: "SEO",
		rationale: jsonLdCount > 0 ? "JSON-LD blocks found." : "No JSON-LD detected.",
		evidence: [{ path: "schema.summary.jsonLdCount", value: jsonLdCount }],
	});
	components.push({
		key: "faq_schema",
		label: "FAQ schema present",
		max: WEIGHTS.faq_schema,
		score: faqSchemaCount > 0 ? 8 : 0,
		category: "SEO",
		rationale: faqSchemaCount > 0 ? "FAQPage schema found." : "No FAQPage schema.",
		evidence: [{ path: "schema.summary.faqSchemaCount", value: faqSchemaCount }],
	});

	// FAQ content coverage (cap at max)
	const totalFaqs = snapshot.faqs?.summary?.totalUnique ?? 0;
	components.push({
		key: "faq_content",
		label: "FAQ coverage",
		max: WEIGHTS.faq_content,
		score: clamp(totalFaqs, 0, 8),
		category: "Content",
		rationale: totalFaqs > 0 ? "FAQ content present." : "No FAQ content detected.",
		evidence: [{ path: "faqs.summary.totalUnique", value: totalFaqs }],
	});

	// Freshness (stub for v1)
	components.push({
		key: "freshness_signals",
		label: "Freshness signals",
		max: WEIGHTS.freshness_signals,
		score: 0,
		category: "Content",
		rationale: "Not implemented in v1.",
		evidence: [],
	});

	const maxTotal = components.reduce((sum, c) => sum + c.max, 0);
	const rawScore = components.reduce((sum, c) => sum + c.score, 0);
	const total = maxTotal > 0 ? Math.round((rawScore / maxTotal) * 100) : 0;

	const findings: TechnicalFinding[] = [];
	if (!hasRobots) {
		findings.push({
			key: "missing_robots_txt",
			message: "robots.txt is missing.",
			severity: "medium",
			category: "SEO",
			evidence: [{ path: "txtFiles.summary.hasRobotsTxt", value: hasRobots }],
		});
	}
	if (!hasLlms) {
		findings.push({
			key: "missing_llms_txt",
			message: "llms.txt is missing.",
			severity: "high",
			category: "GEO",
			evidence: [{ path: "txtFiles.summary.hasLlmsTxt", value: hasLlms }],
		});
	}
	if (h1s.length === 0) {
		findings.push({
			key: "missing_h1",
			message: "No H1 found on the page.",
			severity: "medium",
			category: "SEO",
			evidence: [{ path: "htmlStructure.headings.h1", value: h1s }],
		});
	}
	if (!snapshot.metadata?.description) {
		findings.push({
			key: "missing_meta_description",
			message: "Meta description missing.",
			severity: "low",
			category: "SEO",
			evidence: [{ path: "metadata.description", value: snapshot.metadata?.description }],
		});
	}

	return { total, components, findings };
}


