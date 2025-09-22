import type { ScrapeSnapshot } from "@/lib/analysis/technical/types";

function toStringArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.filter((v) => typeof v === "string");
	}
	if (typeof value === "string") return [value];
	return [];
}

function safeString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function safeNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function safeBoolean(value: unknown): boolean | undefined {
	return typeof value === "boolean" ? value : undefined;
}

function getOrigin(url: string | undefined): string | undefined {
	try {
		return url ? new URL(url).origin : undefined;
	} catch {
		return undefined;
	}
}

function normalizeHeadings(rawHeadings: any): {
	h1: string[]; h2: string[]; h3: string[]; h4: string[]; h5: string[]; h6: string[];
} {
	const h1 = toStringArray(rawHeadings?.h1);
	const h2 = toStringArray(rawHeadings?.h2);
	const h3 = toStringArray(rawHeadings?.h3);
	const h4 = toStringArray(rawHeadings?.h4);
	const h5 = toStringArray(rawHeadings?.h5);
	const h6 = toStringArray(rawHeadings?.h6);
	return { h1, h2, h3, h4, h5, h6 };
}

function normalizeTxtFileEntry(raw: any, fallbackUrl?: string) {
	return {
		url: safeString(raw?.url) ?? (fallbackUrl ?? ""),
		exists: Boolean(raw?.exists),
		size: safeNumber(raw?.size),
		status: safeNumber(raw?.status),
	};
}

export function toScrapeSnapshot(raw: unknown): ScrapeSnapshot {
	const r: any = raw && typeof raw === "object" ? raw : {};
	// Some scrapers may return an array of page results; take the first
	const obj: any = Array.isArray(r) ? (r[0] ?? {}) : r;

	const url = safeString(obj.url) ?? "";
	const origin = getOrigin(url) ?? "";

	const metadata = {
		title: safeString(obj.metadata?.title),
		description: safeString(obj.metadata?.description),
		language: safeString(obj.metadata?.language),
		favicon: safeString(obj.metadata?.favicon),
	};

	// Prefer htmlStructure.headings; fallback to contentStructure.headingsHierarchy
	const rawHeadings = obj.htmlStructure?.headings ?? obj.contentStructure?.headingsHierarchy ?? {};
	const headings = normalizeHeadings(rawHeadings);
	const hasProperStructure = typeof obj.htmlStructure?.hasProperStructure === "boolean"
		? obj.htmlStructure.hasProperStructure
		: (headings.h1.length > 0 && headings.h1.length <= 3);

	const htmlStructure = {
		headings,
		htmlLength: safeNumber(obj.htmlStructure?.htmlLength) ?? safeNumber(obj.html?.length),
		rawHtmlLength: safeNumber(obj.htmlStructure?.rawHtmlLength) ?? safeNumber(obj.rawHtml?.length),
		hasProperStructure,
	};

	// Schema
	const schemaAll = Array.isArray(obj.schema?.all) ? obj.schema.all : [];
	const schemaFaq = Array.isArray(obj.schema?.faqSchema) ? obj.schema.faqSchema : [];
	const schemaSummary = {
		jsonLdCount: safeNumber(obj.schema?.summary?.jsonLdCount) ?? 0,
		microdataCount: safeNumber(obj.schema?.summary?.microdataCount) ?? 0,
		rdfaCount: safeNumber(obj.schema?.summary?.rdfaCount) ?? 0,
		faqSchemaCount: safeNumber(obj.schema?.summary?.faqSchemaCount) ?? 0,
	};

	const schema = {
		all: schemaAll,
		faqSchema: schemaFaq,
		summary: schemaSummary,
	};

	// FAQs (ignore llmExtracted if present; we only need fromSchema/fromDom/merged/summary)
	const faqsFromSchema = Array.isArray(obj.faqs?.fromSchema) ? obj.faqs.fromSchema.map((f: any) => ({
		question: safeString(f?.question) ?? "",
		answer: safeString(f?.answer) ?? "",
	})).filter((f: any) => f.question && f.answer) : [];

	const faqsFromDom = Array.isArray(obj.faqs?.fromDom) ? obj.faqs.fromDom.map((f: any) => ({
		question: safeString(f?.question) ?? "",
		answer: safeString(f?.answer) ?? "",
	})).filter((f: any) => f.question && f.answer) : [];

	const faqsMerged = Array.isArray(obj.faqs?.merged) ? obj.faqs.merged.map((f: any) => ({
		question: safeString(f?.question) ?? "",
		answer: safeString(f?.answer) ?? "",
	})).filter((f: any) => f.question && f.answer) : [];

	const faqsSummary = {
		totalUnique: safeNumber(obj.faqs?.summary?.totalUnique) ?? faqsMerged.length,
		schemaCount: safeNumber(obj.faqs?.summary?.schemaCount) ?? faqsFromSchema.length,
		domCount: safeNumber(obj.faqs?.summary?.domCount) ?? faqsFromDom.length,
		llmCount: safeNumber(obj.faqs?.summary?.llmCount) ?? 0,
	};

	const faqs = {
		fromSchema: faqsFromSchema,
		fromDom: faqsFromDom,
		merged: faqsMerged,
		summary: faqsSummary,
	};

	// txtFiles
	const robotsUrl = obj.txtFiles?.robots?.url ?? `${origin}/robots.txt`;
	const llmsUrl = obj.txtFiles?.llms?.url ?? `${origin}/llms.txt`;
	const llmsFullUrl = obj.txtFiles?.llmsFull?.url ?? `${origin}/llms-full.txt`;

	const robots = normalizeTxtFileEntry(obj.txtFiles?.robots, robotsUrl);
	const llms = normalizeTxtFileEntry(obj.txtFiles?.llms, llmsUrl);
	const llmsFull = normalizeTxtFileEntry(obj.txtFiles?.llmsFull, llmsFullUrl);

	const txtFilesSummary = {
		hasRobotsTxt: safeBoolean(obj.txtFiles?.summary?.hasRobotsTxt) ?? Boolean(robots.exists),
		hasLlmsTxt: safeBoolean(obj.txtFiles?.summary?.hasLlmsTxt) ?? Boolean(llms.exists),
		hasLlmsFullTxt: safeBoolean(obj.txtFiles?.summary?.hasLlmsFullTxt) ?? Boolean(llmsFull.exists),
		totalFound: safeNumber(obj.txtFiles?.summary?.totalFound) ?? [robots, llms, llmsFull].filter((f) => f?.exists).length,
	};

	const txtFiles = {
		robots,
		llms,
		llmsFull,
		summary: txtFilesSummary,
	};

	const synthesizedJsonLd = Array.isArray(obj.synthesizedJsonLd) ? obj.synthesizedJsonLd : undefined;

	const snapshot: ScrapeSnapshot = {
		url,
		crawledAt: safeString(obj.crawledAt) ?? new Date().toISOString(),
		metadata,
		htmlStructure,
		schema,
		faqs,
		txtFiles,
		synthesizedJsonLd,
	};

	return snapshot;
}


