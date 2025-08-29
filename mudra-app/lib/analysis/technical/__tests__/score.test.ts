import { computeTechnicalScore } from "@/lib/analysis/technical/score";
import type { ScrapeSnapshot, ScoreComponent } from "@/lib/analysis/technical/types";

function assert(condition: unknown, message: string): void {
	if (!condition) {
		throw new Error(message);
	}
}

function getComponent(components: ScoreComponent[], key: string): ScoreComponent | undefined {
	return components.find((c) => c.key === key);
}

function makeBaseSnapshot(): ScrapeSnapshot {
	return {
		url: "https://example.com",
		crawledAt: new Date().toISOString(),
		metadata: {
			title: "Example",
			description: "Example description",
			language: "en",
			favicon: "https://example.com/favicon.ico",
		},
		htmlStructure: {
			headings: { h1: ["Welcome"], h2: [], h3: [], h4: [], h5: [], h6: [] },
			htmlLength: 1000,
			rawHtmlLength: 1000,
			hasProperStructure: true,
		},
		schema: {
			all: [],
			faqSchema: [],
			summary: { jsonLdCount: 1, microdataCount: 0, rdfaCount: 0, faqSchemaCount: 0 },
		},
		faqs: {
			fromSchema: [],
			fromDom: [],
			merged: [],
			summary: { totalUnique: 0, schemaCount: 0, domCount: 0, llmCount: 0 },
		},
		txtFiles: {
			robots: { url: "https://example.com/robots.txt", exists: true, status: 200 },
			llms: { url: "https://example.com/llms.txt", exists: true, status: 200 },
			llmsFull: { url: "https://example.com/llms-full.txt", exists: true, status: 200 },
			summary: { hasRobotsTxt: true, hasLlmsTxt: true, hasLlmsFullTxt: true, totalFound: 3 },
		},
	};
}

function run() {
	let passed = 0;
	let failed = 0;

	function test(name: string, fn: () => void) {
		try {
			fn();
			console.log(`✅ ${name}`);
			passed++;
		} catch (err) {
			console.error(`❌ ${name}`);
			console.error((err as Error).message);
			failed++;
		}
	}

	// Test: robots.txt missing
	test("scores robots.txt missing as 0 and emits finding", () => {
		const s = makeBaseSnapshot();
		s.txtFiles.robots.exists = false;
		s.txtFiles.summary.hasRobotsTxt = false;
		const result = computeTechnicalScore(s);
		const comp = getComponent(result.components, "robots_txt");
		assert(comp && comp.score === 0, "robots_txt component should be 0");
		assert(result.findings.some((f) => f.key === "missing_robots_txt"), "should include missing_robots_txt finding");
	});

	// Test: llms.txt missing
	test("scores llms.txt missing as 0 and emits finding", () => {
		const s = makeBaseSnapshot();
		s.txtFiles.llms.exists = false;
		s.txtFiles.summary.hasLlmsTxt = false;
		const result = computeTechnicalScore(s);
		const comp = getComponent(result.components, "llms_txt");
		assert(comp && comp.score === 0, "llms_txt component should be 0");
		assert(result.findings.some((f) => f.key === "missing_llms_txt"), "should include missing_llms_txt finding");
	});

	// Test: H1 missing
	test("scores missing H1 as 0 and emits finding", () => {
		const s = makeBaseSnapshot();
		s.htmlStructure.headings.h1 = [];
		const result = computeTechnicalScore(s);
		const comp = getComponent(result.components, "h1_present");
		assert(comp && comp.score === 0, "h1_present component should be 0");
		assert(result.findings.some((f) => f.key === "missing_h1"), "should include missing_h1 finding");
	});

	// Summary
	console.log(`\nTests: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
	if (failed > 0) process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run();


