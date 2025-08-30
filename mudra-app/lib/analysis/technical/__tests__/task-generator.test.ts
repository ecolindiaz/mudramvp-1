import { generateTasksFromSnapshot } from "@/lib/analysis/technical/task-generator";
import type { ScrapeSnapshot } from "@/lib/analysis/technical/types";

function assert(condition: unknown, message: string): void {
	if (!condition) throw new Error(message);
}

function makeSnapshot(overrides: Partial<ScrapeSnapshot> = {}): ScrapeSnapshot {
	return {
		url: "https://example.com",
		crawledAt: new Date().toISOString(),
		metadata: { title: "Example", description: undefined, language: "en", favicon: undefined },
		htmlStructure: {
			headings: { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] },
			htmlLength: 1000,
			rawHtmlLength: 1000,
			hasProperStructure: false,
		},
		schema: { all: [], faqSchema: [], summary: { jsonLdCount: 0, microdataCount: 0, rdfaCount: 0, faqSchemaCount: 0 } },
		faqs: { fromSchema: [], fromDom: [], merged: [], summary: { totalUnique: 0, schemaCount: 0, domCount: 0, llmCount: 0 } },
		txtFiles: {
			robots: { url: "https://example.com/robots.txt", exists: false },
			llms: { url: "https://example.com/llms.txt", exists: false },
			llmsFull: { url: "https://example.com/llms-full.txt", exists: false },
			summary: { hasRobotsTxt: false, hasLlmsTxt: false, hasLlmsFullTxt: false, totalFound: 0 },
		},
		...overrides,
	};
}

async function run() {
	process.env.MUDRA_DISABLE_LLM = "1"; // ensure deterministic baseline steps
	let passed = 0; let failed = 0;
	function test(name: string, fn: () => Promise<void> | void) {
		Promise.resolve()
			.then(fn)
			.then(() => { console.log(`✅ ${name}`); passed++; })
			.catch(err => { console.error(`❌ ${name}`); console.error((err as Error).message); failed++; })
	}

	// Missing robots and llms should emit both tasks
	test("emits robots.txt and llms.txt tasks when missing", async () => {
		const s = makeSnapshot();
		const tasks = await generateTasksFromSnapshot(s);
		const keys = tasks.map(t => t.templateKey);
		assert(keys.includes("add_robots_txt"), "should include add_robots_txt");
		assert(keys.includes("add_llms_txt"), "should include add_llms_txt");
		const robots = tasks.find(t => t.templateKey === "add_robots_txt")!;
		assert(Array.isArray(robots.evidence) && robots.evidence.length > 0, "robots task should include evidence");
		assert(robots.verificationCheck?.key === "robots_txt_exists", "robots task verification key mismatch");
	});

	// Missing H1 should emit add_h1
	test("emits add_h1 when H1 missing", async () => {
		const s = makeSnapshot();
		const tasks = await generateTasksFromSnapshot(s);
		assert(tasks.some(t => t.templateKey === "add_h1"), "should include add_h1 task");
	});

	// With FAQs present but no schema, emit add_faq_schema
	test("emits add_faq_schema when FAQs exist but schema missing", async () => {
		const s = makeSnapshot({ faqs: { fromSchema: [], fromDom: [], merged: [{ question: "q", answer: "a" }], summary: { totalUnique: 1, schemaCount: 0, domCount: 1, llmCount: 0 } } });
		const tasks = await generateTasksFromSnapshot(s);
		assert(tasks.some(t => t.templateKey === "add_faq_schema"), "should include add_faq_schema");
	});

	// Wait a tick to flush promises, then report
	await new Promise(r => setTimeout(r, 50));
	console.log(`\nTests: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
	if (failed > 0) process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run();


