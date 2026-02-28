import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import {
	estimateAICost,
	logAIModelCall,
} from "@/lib/services/ai-model-logging.service";
import { computeContentLabSchemaSourceHash } from "@/lib/content-lab/schema-hash";

type ContentLabSchemaType = "BlogPosting" | "TechArticle" | "HowTo";
type OptionalSchemaField = "articleSection" | "keywords" | "about";

const MODEL_NAME = "gpt-5.2";
const MODEL = openai(MODEL_NAME);

const TECHNICAL_KEYWORDS = [
	"api",
	"sdk",
	"javascript",
	"typescript",
	"python",
	"java",
	"go",
	"rust",
	"node",
	"react",
	"next.js",
	"docker",
	"kubernetes",
	"deployment",
	"implementation",
	"integration",
	"code",
	"repository",
	"github",
	"cli",
	"debug",
	"architecture",
	"endpoint",
	"framework",
	"library",
	"devops",
	"stack",
];

const HOWTO_ACTION_WORDS = [
	"install",
	"configure",
	"create",
	"set up",
	"setup",
	"run",
	"deploy",
	"connect",
	"build",
	"update",
	"verify",
	"test",
	"use",
];

const STOP_WORDS = new Set([
	"a",
	"an",
	"and",
	"are",
	"as",
	"at",
	"be",
	"by",
	"for",
	"from",
	"how",
	"in",
	"is",
	"it",
	"of",
	"on",
	"or",
	"that",
	"the",
	"this",
	"to",
	"was",
	"we",
	"what",
	"when",
	"where",
	"which",
	"with",
	"you",
	"your",
]);

const CLASSIFIER_SYSTEM_PROMPT = `You classify blog posts into one schema type and suggest optional JSON-LD fields.

Return JSON only with this exact shape:
{
  "schemaType": "BlogPosting" | "TechArticle" | "HowTo",
  "confidence": 0.0-1.0,
  "articleSection": string | null,
  "keywords": string[],
  "about": string[],
  "signals": string[]
}

Rules:
- BlogPosting: editorial/company/thought leadership/non-technical blog content.
- TechArticle: technical/developer-focused tutorials, implementation guides, engineering deep dives.
- HowTo: ONLY if content is truly step-by-step task completion with explicit steps and concrete end outcome.
- If unsure between BlogPosting and TechArticle, choose TechArticle when the content is clearly technical/developer oriented.
- Do not return markdown, explanations, or extra keys.`;

interface LLMClassificationResult {
	schemaType: ContentLabSchemaType;
	confidence: number;
	articleSection: string | null;
	keywords: string[];
	about: string[];
	signals: string[];
}

interface PublisherInfo {
	name: string;
	website?: string | null;
}

interface AuthorInfo {
	name: string;
	title?: string | null;
}

export interface ContentLabSchemaInput {
	title: string;
	body: string;
	slug?: string | null;
	createdAt: Date;
	updatedAt: Date;
	author: AuthorInfo;
	publisher: PublisherInfo;
	userId?: string | null;
	brandProfileId?: number | null;
}

export interface ContentLabGeneratedSchema {
	schemaType: ContentLabSchemaType;
	jsonLd: Record<string, unknown>;
	scriptTag: string;
	confidence: number;
	generatedAt: string;
	model: "gpt-5.2";
	version: "v1";
	signals: string[];
	optionalFieldsIncluded: OptionalSchemaField[];
	sourceHash: string;
}

interface ClassificationDecision {
	schemaType: ContentLabSchemaType;
	confidence: number;
	signals: string[];
	articleSection?: string;
	keywords: string[];
	about: string[];
}

function clampConfidence(value: number): number {
	if (!Number.isFinite(value)) return 0.5;
	if (value < 0) return 0;
	if (value > 1) return 1;
	return Number(value.toFixed(2));
}

function normalizeWebsiteUrl(raw: string | null | undefined): string | null {
	if (!raw || typeof raw !== "string") return null;
	const trimmed = raw.trim();
	if (!trimmed) return null;
	const prefixed = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
	try {
		const url = new URL(prefixed);
		return `${url.protocol}//${url.host}`;
	} catch {
		return null;
	}
}

function normalizeSlug(slug: string | null | undefined, title: string): string {
	const candidate = (slug || title)
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s/-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^\/+|\/+$/g, "");
	return candidate || "untitled";
}

function toIsoDate(date: Date): string {
	return date.toISOString().split("T")[0];
}

function extractHeadings(markdown: string): string[] {
	return markdown
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => /^#{1,6}\s+/.test(line))
		.map((line) => line.replace(/^#{1,6}\s+/, "").trim());
}

function extractLLMJson(text: string): LLMClassificationResult | null {
	try {
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (!jsonMatch) return null;
		const parsed = JSON.parse(jsonMatch[0]) as Partial<LLMClassificationResult>;

		const validTypes: ContentLabSchemaType[] = [
			"BlogPosting",
			"TechArticle",
			"HowTo",
		];
		if (!parsed.schemaType || !validTypes.includes(parsed.schemaType)) return null;

		const articleSection =
			typeof parsed.articleSection === "string" && parsed.articleSection.trim()
				? parsed.articleSection.trim().slice(0, 60)
				: null;

		const keywords = Array.isArray(parsed.keywords)
			? parsed.keywords
					.filter((item): item is string => typeof item === "string")
					.map((item) => item.trim())
					.filter(Boolean)
					.slice(0, 8)
			: [];

		const about = Array.isArray(parsed.about)
			? parsed.about
					.filter((item): item is string => typeof item === "string")
					.map((item) => item.trim())
					.filter(Boolean)
					.slice(0, 6)
			: [];

		const signals = Array.isArray(parsed.signals)
			? parsed.signals
					.filter((item): item is string => typeof item === "string")
					.map((item) => item.trim())
					.filter(Boolean)
					.slice(0, 6)
			: [];

		return {
			schemaType: parsed.schemaType,
			confidence: clampConfidence(parsed.confidence ?? 0.5),
			articleSection,
			keywords,
			about,
			signals,
		};
	} catch {
		return null;
	}
}

function countMatches(corpus: string, keywords: string[]): number {
	let count = 0;
	const lower = corpus.toLowerCase();
	for (const keyword of keywords) {
		if (lower.includes(keyword.toLowerCase())) count++;
	}
	return count;
}

function isTechnicalContent(title: string, body: string): boolean {
	const headingText = extractHeadings(body).join(" ");
	const corpus = `${title}\n${headingText}\n${body.slice(0, 6000)}`;
	let score = countMatches(corpus, TECHNICAL_KEYWORDS);
	if (/```[\s\S]*?```/.test(body)) score += 2;
	return score >= 4;
}

function isHowToContent(title: string, body: string): boolean {
	const headings = extractHeadings(body);
	const headingCorpus = `${title}\n${headings.join("\n")}`.toLowerCase();
	const bodyLower = body.toLowerCase();

	const hasHowToIntent =
		/\bhow to\b/.test(headingCorpus) ||
		/\bstep[-\s]?by[-\s]?step\b/.test(headingCorpus) ||
		/\bwalkthrough\b/.test(headingCorpus) ||
		/\bguide\b/.test(headingCorpus);

	const stepHeadingCount = headings.filter((heading) =>
		/^(step|phase|part)\s*\d+[\s:.-]?/i.test(heading) ||
		/^\d+[\).:-]\s+/.test(heading)
	).length;

	const numberedListStepCount = body
		.split("\n")
		.filter((line) => /^\s*\d+[\).:-]\s+/.test(line.trim())).length;

	const hasOutcomeSignal =
		/\bby the end\b/.test(bodyLower) ||
		/\bend result\b/.test(bodyLower) ||
		/\bfinal result\b/.test(bodyLower) ||
		/\byou will\b/.test(bodyLower);

	const actionWordCount = countMatches(bodyLower, HOWTO_ACTION_WORDS);
	const hasEnoughSteps = stepHeadingCount >= 2 || numberedListStepCount >= 3;

	return hasHowToIntent && hasEnoughSteps && hasOutcomeSignal && actionWordCount >= 3;
}

function dedupeStrings(values: string[]): string[] {
	const seen = new Set<string>();
	const output: string[] = [];
	for (const value of values) {
		const key = value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		output.push(value);
	}
	return output;
}

function fallbackKeywords(title: string, body: string): string[] {
	const headings = extractHeadings(body).slice(0, 5).join(" ");
	const corpus = `${title} ${headings}`
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.split(/\s+/)
		.filter((token) => token.length > 2 && !STOP_WORDS.has(token));

	return dedupeStrings(corpus).slice(0, 6);
}

function titleCase(input: string): string {
	return input
		.split(" ")
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

async function classifyWithLLM(
	input: ContentLabSchemaInput
): Promise<LLMClassificationResult | null> {
	const headings = extractHeadings(input.body).slice(0, 12);
	const excerpt = input.body.slice(0, 8000);
	const prompt = `Classify this post.

Title: ${input.title}
Slug: ${input.slug || ""}
Headings:
${headings.join("\n") || "(none)"}

Body excerpt:
${excerpt}`;

	const startTime = Date.now();
	try {
		const response = await generateText({
			model: MODEL as any,
			system: CLASSIFIER_SYSTEM_PROMPT,
			prompt,
		});

		const latencyMs = Date.now() - startTime;
		const tokensIn = Math.ceil(
			(CLASSIFIER_SYSTEM_PROMPT.length + prompt.length) / 4
		);
		const tokensOut = Math.ceil(response.text.length / 4);
		const costCents = Math.round(
			estimateAICost(MODEL_NAME, tokensIn, tokensOut)
		);

		logAIModelCall({
			feature: "content-lab",
			endpoint: "/api/content-lab/schema",
			model: MODEL_NAME,
			provider: "openai",
			status: "success",
			latencyMs,
			tokensIn,
			tokensOut,
			costCents,
			userId: input.userId ?? null,
			brandProfileId: input.brandProfileId ?? null,
		}).catch(() => {});

		return extractLLMJson(response.text);
	} catch (error: any) {
		const latencyMs = Date.now() - startTime;
		logAIModelCall({
			feature: "content-lab",
			endpoint: "/api/content-lab/schema",
			model: MODEL_NAME,
			provider: "openai",
			status: "error",
			latencyMs,
			errorMessage: error?.message || "Schema classification failed",
			userId: input.userId ?? null,
			brandProfileId: input.brandProfileId ?? null,
		}).catch(() => {});
		return null;
	}
}

function resolveClassification(
	input: ContentLabSchemaInput,
	llmResult: LLMClassificationResult | null
): ClassificationDecision {
	const howToEligible = isHowToContent(input.title, input.body);
	const technical = isTechnicalContent(input.title, input.body);

	let schemaType: ContentLabSchemaType =
		llmResult?.schemaType ??
		(howToEligible ? "HowTo" : technical ? "TechArticle" : "BlogPosting");
	let confidence = llmResult?.confidence ?? (howToEligible ? 0.8 : technical ? 0.75 : 0.7);
	const signals: string[] = [...(llmResult?.signals || [])];

	if (schemaType === "HowTo" && !howToEligible) {
		schemaType = technical ? "TechArticle" : "BlogPosting";
		confidence = Math.min(confidence, 0.74);
		signals.push("HowTo removed: post is not an explicit step-by-step task flow.");
	}

	if (schemaType === "BlogPosting" && technical && !howToEligible && confidence < 0.8) {
		schemaType = "TechArticle";
		confidence = Math.max(confidence, 0.76);
		signals.push("Upgraded to TechArticle due to strong technical/developer signals.");
	}

	if (schemaType === "TechArticle" && !technical && !howToEligible && confidence < 0.55) {
		schemaType = "BlogPosting";
		signals.push("Downgraded to BlogPosting due to weak technical specificity.");
	}

	const keywords = dedupeStrings([
		...(llmResult?.keywords || []),
		...fallbackKeywords(input.title, input.body),
	]).slice(0, 8);

	const about = dedupeStrings(llmResult?.about || []).slice(0, 6);

	let articleSection = llmResult?.articleSection || undefined;
	if (!articleSection) {
		if (schemaType === "HowTo") articleSection = "Guides";
		else if (schemaType === "TechArticle") articleSection = "Engineering";
		else articleSection = "Blog";
	}

	return {
		schemaType,
		confidence: clampConfidence(confidence),
		signals: dedupeStrings(signals).slice(0, 8),
		articleSection,
		keywords,
		about,
	};
}

function buildPageUrl(baseUrl: string | null, slug: string): string {
	const pagePath = slug.startsWith("blog/") ? `/${slug}` : `/blog/${slug}`;
	if (!baseUrl) return pagePath;
	return `${baseUrl}${pagePath}`;
}

function buildSchemaJsonLd(
	input: ContentLabSchemaInput,
	decision: ClassificationDecision
): { jsonLd: Record<string, unknown>; optionalFieldsIncluded: OptionalSchemaField[] } {
	const website = normalizeWebsiteUrl(input.publisher.website);
	const normalizedSlug = normalizeSlug(input.slug, input.title);
	const pageUrl = buildPageUrl(website, normalizedSlug);
	const typeId = decision.schemaType.toLowerCase();

	const jsonLd: Record<string, unknown> = {
		"@context": "https://schema.org",
		"@type": decision.schemaType,
		"@id": `${pageUrl}#${typeId}`,
		mainEntityOfPage: {
			"@type": "WebPage",
			"@id": pageUrl,
		},
		headline: input.title,
		author: {
			"@type": "Person",
			name: input.author.name,
		},
		publisher: {
			"@type": "Organization",
			name: input.publisher.name,
		},
		datePublished: toIsoDate(input.createdAt),
		dateModified: toIsoDate(input.updatedAt),
		url: pageUrl,
	};

	if (input.author.title) {
		(jsonLd.author as Record<string, unknown>).jobTitle = input.author.title;
	}

	if (website) {
		(jsonLd.publisher as Record<string, unknown>).url = website;
		(jsonLd.publisher as Record<string, unknown>).logo = {
			"@type": "ImageObject",
			url: `${website}/favicon.ico`,
		};
	}

	const optionalFieldsIncluded: OptionalSchemaField[] = [];

	if (decision.articleSection && decision.articleSection.trim()) {
		jsonLd.articleSection = decision.articleSection.trim();
		optionalFieldsIncluded.push("articleSection");
	}

	if (decision.keywords.length > 0) {
		jsonLd.keywords = decision.keywords;
		optionalFieldsIncluded.push("keywords");
	}

	if (decision.about.length > 0) {
		jsonLd.about = decision.about.map((topic) => ({
			"@type": "Thing",
			name: titleCase(topic),
		}));
		optionalFieldsIncluded.push("about");
	}

	return { jsonLd, optionalFieldsIncluded };
}

export async function generateContentLabSchema(
	input: ContentLabSchemaInput
): Promise<ContentLabGeneratedSchema> {
	const llmResult = await classifyWithLLM(input);
	const decision = resolveClassification(input, llmResult);
	const { jsonLd, optionalFieldsIncluded } = buildSchemaJsonLd(input, decision);
	const scriptTag = `<script type="application/ld+json">\n${JSON.stringify(
		jsonLd,
		null,
		2
	)}\n</script>`;

	return {
		schemaType: decision.schemaType,
		jsonLd,
		scriptTag,
		confidence: decision.confidence,
		generatedAt: new Date().toISOString(),
		model: "gpt-5.2",
		version: "v1",
		signals: decision.signals,
		optionalFieldsIncluded,
		sourceHash: computeContentLabSchemaSourceHash({
			title: input.title,
			body: input.body,
			slug: normalizeSlug(input.slug, input.title),
		}),
	};
}
