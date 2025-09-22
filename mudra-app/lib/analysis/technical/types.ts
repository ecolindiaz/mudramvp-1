// Core type definitions for Technical Structure analysis and task generation

export type TaskCategory = "SEO" | "GEO" | "Content";
export type TaskImpact = "High" | "Medium" | "Low";

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


