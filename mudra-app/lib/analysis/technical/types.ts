// Core type definitions for Technical Structure analysis and task generation

export type TaskCategory = "SEO" | "GEO" | "Content";
export type TaskImpact = "High" | "Medium" | "Low";

// ============================================================================
// NEW TYPES FOR MULTI-PAGE 5-DIMENSION SCORING SYSTEM
// ============================================================================

/**
 * Page type classification based on URL patterns
 */
export type PageType =
	| "home"
	| "pricing"
	| "features"
	| "product"
	| "solutions"
	| "blog"
	| "about"
	| "contact"
	| "documentation"
	| "other";

/**
 * Scoring dimension names for the 5-dimension system
 */
export type ScoringDimension = "schema" | "metadata" | "faq" | "content";

/**
 * Status classification based on total score
 */
export type ScoreStatus = "excellent" | "good" | "needs_improvement" | "poor";

/**
 * Issue severity levels
 */
export type IssueSeverity = "high" | "medium" | "low";

/**
 * Intervention priority levels
 */
export type InterventionPriority = "high" | "medium" | "low";

// ============================================================================
// METADATA EXTRACTION TYPES
// ============================================================================

export interface TitleExtraction {
	present: boolean;
	content: string | null;
	length: number;
}

export interface MetaDescriptionExtraction {
	present: boolean;
	content: string | null;
	length: number;
}

export interface CanonicalExtraction {
	present: boolean;
	href: string | null;
}

export interface OpenGraphTag {
	property: string;
	content: string;
}

export interface OpenGraphExtraction {
	present: boolean;
	tags: OpenGraphTag[];
	count: number;
}

export interface TwitterCardTag {
	name: string;
	content: string;
}

export interface TwitterCardsExtraction {
	present: boolean;
	tags: TwitterCardTag[];
	count: number;
}

export interface MetadataExtraction {
	title: TitleExtraction;
	meta_description: MetaDescriptionExtraction;
	canonical: CanonicalExtraction;
	open_graph: OpenGraphExtraction;
	twitter_cards: TwitterCardsExtraction;
}

// ============================================================================
// HEADINGS EXTRACTION TYPES
// ============================================================================

export interface HeadingItem {
	level: number;
	tag: string;
	text: string;
	text_length: number;
	index: number;
}

export interface HeadingCounts {
	h1: number;
	h2: number;
	h3: number;
	h4: number;
	h5: number;
	h6: number;
	total: number;
}

export interface HeadingsAnalysis {
	has_h1: boolean;
	h1_count: number;
	h1_is_unique: boolean;
	skipped_levels: string[];
	violations: string[];
}

export interface HeadingsExtraction {
	hierarchy: HeadingItem[];
	counts: HeadingCounts;
	analysis: HeadingsAnalysis;
}

// ============================================================================
// SEMANTIC HTML EXTRACTION TYPES
// ============================================================================

export interface SemanticElementInstance {
	index: number;
	text_length?: number;
	child_count?: number;
	dom_position?: string;
	type?: string;
	has_header?: boolean;
	has_footer?: boolean;
}

export interface SemanticElementInfo {
	count: number;
	instances: SemanticElementInstance[];
}

export interface SemanticElements {
	main: SemanticElementInfo;
	article: SemanticElementInfo;
	section: SemanticElementInfo;
	nav: SemanticElementInfo;
	aside: SemanticElementInfo;
	header: SemanticElementInfo;
	footer: SemanticElementInfo;
}

export interface SemanticAnalysis {
	has_main: boolean;
	has_article: boolean;
	has_sections: boolean;
	has_nav: boolean;
	is_div_heavy: boolean;
	semantic_quality: "excellent" | "good" | "fair" | "poor";
}

export interface SemanticHTMLExtraction {
	elements: SemanticElements;
	div_count: number;
	semantic_element_count: number;
	semantic_richness_ratio: number;
	analysis: SemanticAnalysis;
}

// ============================================================================
// SCHEMA / JSON-LD EXTRACTION TYPES
// ============================================================================

/**
 * Relevant schema types for Answer Engine Optimization
 */
export type RelevantSchemaType =
	| "Organization"
	| "WebSite"
	| "Product"
	| "Service"
	| "Article"
	| "BlogPosting"
	| "FAQPage"
	| "BreadcrumbList"
	| "HowTo"
	| "SoftwareApplication"
	| "WebApplication"
	| "OfferCatalog"
	| "VideoObject"
	| "ItemList"
	| "Review"
	| "Person";

export interface JsonLdBlock {
	index: number;
	type: string;
	valid: boolean;
	data: Record<string, unknown>;
}

export interface SchemaAnalysis {
	has_article_schema: boolean;
	has_faq_schema: boolean;
	has_howto_schema: boolean;
	has_product_schema: boolean;
	has_breadcrumb_schema: boolean;
	has_organization_schema: boolean;
	has_software_application_schema: boolean;
	has_website_schema: boolean;
	has_service_schema: boolean;
	has_blog_posting_schema: boolean;
	has_video_schema: boolean;
	has_review_schema: boolean;
	has_person_schema: boolean;
	has_offer_catalog_schema: boolean;
	has_item_list_schema: boolean;
	has_web_application_schema: boolean;
}

export interface SchemaExtraction {
	jsonld_blocks: JsonLdBlock[];
	schema_types: string[];
	schema_count: number;
	has_schema: boolean;
	analysis: SchemaAnalysis;
}

// ============================================================================
// FAQ EXTRACTION TYPES
// ============================================================================

export interface FAQItem {
	question: string;
	answer: string;
	question_length: number;
	answer_length: number;
	source: "jsonld" | "details_summary" | "pattern";
}

export interface FAQSourceResult {
	present: boolean;
	faqs: FAQItem[];
}

export interface FAQSources {
	jsonld_faq_schema: FAQSourceResult;
	details_summary_elements: FAQSourceResult;
	pattern_matching: FAQSourceResult;
}

export interface FAQAnalysis {
	faq_content_exists: boolean;
	faq_schema_implemented: boolean;
	uses_semantic_html: boolean;
	average_answer_length: number;
	schema_gap: boolean;
}

export interface FAQExtraction {
	sources: FAQSources;
	combined_faqs: FAQItem[];
	total_faq_count: number;
	has_faq_content: boolean;
	has_faq_schema: boolean;
	analysis: FAQAnalysis;
}

// ============================================================================
// CONTENT SNAPSHOT TYPES
// ============================================================================

export interface LinkCounts {
	internal: number;
	external: number;
}

export interface ParagraphContent {
	index: number;
	text: string;
	char_count: number;
}

export interface ContentSnapshot {
	total_text_length: number;
	word_count: number;
	paragraph_count: number;
	list_count: number;
	image_count: number;
	link_count: LinkCounts;
	paragraphs: ParagraphContent[];
}

// ============================================================================
// DOM EXTRACTION (COMBINED)
// ============================================================================

export interface DOMExtractionData {
	metadata: MetadataExtraction;
	headings: HeadingsExtraction;
	semantic_html: SemanticHTMLExtraction;
	schema: SchemaExtraction;
	faqs: FAQExtraction;
	content_snapshot: ContentSnapshot;
	has_video_content: boolean;
	has_testimonial_content: boolean;
}

export interface DOMExtraction {
	page_url: string;
	page_type: PageType;
	crawled_at: string;
	extraction: DOMExtractionData;
	raw_html_hash: string;
	html_size_bytes: number;
	recommendedSchemas?: string[];
}

// ============================================================================
// SCORING TYPES
// ============================================================================

/**
 * Individual check result within a dimension
 */
export interface CheckResult {
	passed: boolean;
	points: number;
	max_points: number;
	rationale: string;
}

/**
 * Result for a single scoring dimension
 */
export interface DimensionScore {
	dimension: ScoringDimension;
	score: number;
	max_score: number;
	checks: Record<string, CheckResult>;
	passed_count: number;
	total_count: number;
}

/**
 * Issue detected during scoring
 */
export interface Issue {
	check: string;
	dimension: ScoringDimension;
	severity: IssueSeverity;
	message: string;
	page_url: string;
}

/**
 * Intervention for future agent fixes
 */
export interface Intervention {
	check: string;
	priority: InterventionPriority;
	action: string;
	target: string;
	estimated_impact: string;
	code_hint?: string;
}

/**
 * Complete page score result
 */
export interface FullPageScore {
	page_url: string;
	page_type: PageType;
	scores: {
		schema: number;
		metadata: number;
		faq: number;
		content: number;
		total: number;
	};
	dimension_details: {
		schema: DimensionScore;
		metadata: DimensionScore;
		faq: DimensionScore;
		content: DimensionScore;
	};
	status: ScoreStatus;
	issues: Issue[];
	interventions: Intervention[];
}

/**
 * Site-wide aggregated score
 */
export interface SiteStructureScoreResult {
	site_score: number;
	pages_analyzed: number;
	pages_successful: number;
	pages_failed: number;
	page_scores: FullPageScore[];
	top_issues: Issue[];
	recommendations: Intervention[];
	policy_files: {
		robots_txt: boolean;
		llms_txt: boolean;
		llms_full_txt: boolean;
	};
}

// ============================================================================
// PHASE 2: SITEMAP DISCOVERY & MULTI-PAGE SCRAPING TYPES
// ============================================================================

/**
 * Page priority for URL selection during sitemap discovery
 */
export const PAGE_PRIORITY: Record<PageType, number> = {
	home: 1, // Always include
	pricing: 2, // Always include if exists
	features: 3, // Always include if exists
	product: 4, // Include up to 5
	solutions: 5, // Include up to 3
	about: 6, // Include if exists
	contact: 7, // Include if exists
	blog: 8, // Include up to 10 (most recent preferred)
	documentation: 9, // Include if available
	other: 10, // Fill remaining slots
};

/**
 * Limits for each page type during discovery
 */
export const PAGE_TYPE_LIMITS: Partial<Record<PageType, number>> = {
	product: 5,
	solutions: 3,
	blog: 10,
};

/**
 * Options for sitemap discovery
 */
export interface DiscoveryOptions {
	/** Maximum total pages to discover (default: 20) */
	maxPages?: number;
	/** Maximum blog posts to include (default: 10) */
	maxBlogs?: number;
	/** Include sitemap in discovery (default: 'include') */
	sitemap?: "include" | "only" | "skip";
	/** Search filter for specific URL patterns */
	search?: string;
}

/**
 * Extended options for AI-powered discovery
 */
export interface AIDiscoveryOptions extends DiscoveryOptions {
	/** Enable AI-powered page categorization (default: true) */
	useAI?: boolean;
	/** OpenAI model to use for analysis (default: 'gpt-5.2') */
	aiModel?: string;
	/** Maximum URLs to send to AI for analysis (default: 100) */
	maxUrlsForAI?: number;
}

/**
 * Discovered page information from Firecrawl /map endpoint
 */
export interface DiscoveredPage {
	url: string;
	title?: string;
	description?: string;
	pageType: PageType;
	priority: number;
}

/**
 * AI-enhanced discovered page with additional metadata
 */
export interface AIDiscoveredPage extends DiscoveredPage {
	/** AI-generated descriptive title */
	title: string;
	/** AI-generated reason for page importance */
	reason: string;
	/** AI-assigned importance score (1-10) */
	importance: number;
}

/**
 * Result of sitemap discovery
 */
export interface DiscoveryResult {
	success: boolean;
	domain: string;
	totalDiscovered: number;
	selectedCount: number;
	pages: DiscoveredPage[];
	byType: Record<PageType, number>;
	error?: string;
}

/**
 * Timing information for discovery phases
 */
export interface DiscoveryTimings {
	/** Time spent on Firecrawl map call (ms) */
	map: number;
	/** Time spent on pre-filtering (ms) */
	filter: number;
	/** Time spent on AI analysis (ms) */
	analysis: number;
	/** Total discovery time (ms) */
	total: number;
}

/**
 * AI-enhanced discovery result with timing and AI metadata
 */
export interface AIDiscoveryResult extends DiscoveryResult {
	/** Whether AI analysis was used */
	aiAnalyzed: boolean;
	/** Discovery phase timings */
	timings: DiscoveryTimings;
	/** AI-analyzed pages with enhanced metadata */
	aiPages?: AIDiscoveredPage[];
}

/**
 * OpenAI structured output response for page analysis
 */
export interface OpenAIPageAnalysisResponse {
	pages: Array<{
		url: string;
		pageType: PageType | "customers";
		title: string;
		reason: string;
		importance: number;
	}>;
}

/**
 * Options for multi-page scraping
 */
export interface MultiPageScrapeOptions {
	/** Maximum concurrent scraping requests (default: 4) */
	concurrency?: number;
	/** Timeout per page in milliseconds (default: 30000) */
	timeoutMs?: number;
	/** Whether to bypass cache (default: true for analysis) */
	bypassCache?: boolean;
}

/**
 * Result of scraping a single page
 */
export interface PageScrapeResult {
	url: string;
	success: boolean;
	rawHtml?: string;
	htmlSizeBytes?: number;
	metadata?: {
		title?: string;
		description?: string;
		sourceURL?: string;
		statusCode?: number;
	};
	error?: string;
	scrapedAt: string;
}

/**
 * Result of multi-page scraping batch
 */
export interface MultiPageScrapeResult {
	totalUrls: number;
	successCount: number;
	failureCount: number;
	results: PageScrapeResult[];
	errors: Array<{ url: string; error: string }>;
	startedAt: string;
	completedAt: string;
	durationMs: number;
}

// ============================================================================
// LEGACY TYPES (preserved for backward compatibility)
// ============================================================================

export interface ScrapeSnapshot {
	url: string;
	crawledAt?: string; // ISO timestamp when the snapshot was created
	metadata: {
		title?: string;
		description?: string;
		language?: string;
		favicon?: string;
	};
	htmlStructure: {
		headings: {
			h1?: string[];
			h2?: string[];
			h3?: string[];
			h4?: string[];
			h5?: string[];
			h6?: string[];
			[key: string]: string[] | undefined;
		};
		htmlLength?: number;
		rawHtmlLength?: number;
		hasProperStructure?: boolean;
	};
	schema: {
		all: unknown[];
		faqSchema: unknown[];
		summary: {
			jsonLdCount: number;
			microdataCount: number;
			rdfaCount: number;
			faqSchemaCount: number;
		};
	};
	faqs: {
		fromSchema: { question: string; answer: string }[];
		fromDom: { question: string; answer: string }[];
		merged: { question: string; answer: string }[];
		summary: {
			totalUnique: number;
			schemaCount: number;
			domCount: number;
			llmCount: number;
		};
	};
	txtFiles: {
		robots: { url: string; exists: boolean; size?: number; status?: number };
		llms: { url: string; exists: boolean; size?: number; status?: number };
		llmsFull?: { url: string; exists: boolean; size?: number; status?: number };
		summary: {
			hasRobotsTxt: boolean;
			hasLlmsTxt: boolean;
			hasLlmsFullTxt: boolean;
			totalFound: number;
		};
	};
	synthesizedJsonLd?: unknown[];
}

export interface EvidenceRef {
	path: string; // e.g., "txtFiles.summary.hasRobotsTxt"
	value?: unknown;
	snippet?: string; // optional supporting snippet
}

export interface ScoreComponent {
	key: string; // e.g., "robots_txt"
	label: string; // human-readable label
	max: number; // weight
	score: number; // 0..max
	category: TaskCategory;
	rationale: string;
	evidence: EvidenceRef[];
}

export interface TechnicalFinding {
	key: string; // e.g., "missing_robots_txt"
	message: string;
	severity: "low" | "medium" | "high";
	category: TaskCategory;
	evidence: EvidenceRef[];
}

export interface ScoreResult {
	total: number; // 0..100
	components: ScoreComponent[];
	findings: TechnicalFinding[];
}

export interface TaskTemplate {
	key: string;
	category: TaskCategory;
	title: (snapshot: ScrapeSnapshot) => string;
	impact: TaskImpact;
	preconditions: (snapshot: ScrapeSnapshot) => boolean;
	generateInputs: (snapshot: ScrapeSnapshot) => Record<string, unknown>;
	verificationCheck: {
		key: string; // e.g., "robots_txt_exists"
		description: string;
		predicate: (snapshot: ScrapeSnapshot) => boolean;
	};
	kbTopics: string[]; // e.g., ["robots.txt", "AI crawlers"]
}

export interface TaskInstance {
	templateKey: string;
	title: string;
	whyItMatters: string;
	impact: TaskImpact;
	steps: string[];
	tags: TaskCategory[];
	evidence: EvidenceRef[];
	suggestedOwner?: "Developer" | "Marketer" | "SEO" | "Founder";
	confidence: number; // 0..1
	verificationCheck: TaskTemplate["verificationCheck"];
}


