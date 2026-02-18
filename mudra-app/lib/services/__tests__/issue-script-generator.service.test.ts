/**
 * Issue Script Generator Tests
 *
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import {
	generateScriptForIssue,
	isScriptGenerationSupported,
} from "../issue-script-generator.service";
import { detectFrameworkFromContext } from "../issue-agent-executor.service";

describe("issue-script-generator", () => {
	it("supports schema/meta/faq issue types", () => {
		expect(isScriptGenerationSupported("schema_markup")).toBe(true);
		expect(isScriptGenerationSupported("meta_optimization")).toBe(true);
		expect(isScriptGenerationSupported("faq_sections")).toBe(true);
		expect(isScriptGenerationSupported("content_quality")).toBe(false);
	});

	it("generates schema scripts from issue recommendations", () => {
		const result = generateScriptForIssue(
			{
				id: 101,
				title: "Add Organization + WebSite Schema (Homepage)",
				description:
					"This page has no JSON-LD schema markup.\n\nRecommended schemas: Organization + WebSite.",
				agentType: "schema_markup",
				checkCode: "J1_present",
				affectedUrl: "https://acme.com/",
			},
			{
				companyName: "Acme",
				companyWebsite: "https://acme.com",
				companyDescription: "Acme builds AI sales tools.",
			}
		);

		expect(result.outputType).toBe("code");
		expect(result.generatedOutput).toContain("<script type=\"application/ld+json\">");
		expect(result.generatedOutput).toContain("\"@type\": \"Organization\"");
		expect(result.generatedOutput).toContain("\"@type\": \"WebSite\"");
	});

	it("generates canonical snippet for metadata issues", () => {
		const result = generateScriptForIssue(
			{
				id: 102,
				title: "Add Canonical URL (Pricing)",
				description: "This page is missing a canonical URL.",
				agentType: "meta_optimization",
				checkCode: "M3_canonical",
				affectedUrl: "https://acme.com/pricing",
			},
			{
				companyName: "Acme",
				companyWebsite: "https://acme.com",
				companyDescription: "Acme builds AI sales tools.",
			}
		);

		expect(result.outputType).toBe("code");
		expect(result.generatedOutput).toContain("<link rel=\"canonical\" href=\"https://acme.com/pricing\">");
	});

	it("generates faq section and schema for faq issues", () => {
		const result = generateScriptForIssue(
			{
				id: 103,
				title: "Add FAQ Content",
				description: "This page has no FAQ content.",
				agentType: "faq_sections",
				checkCode: "FAQ_count",
				affectedUrl: "https://acme.com/features",
			},
			{
				companyName: "Acme",
				companyWebsite: "https://acme.com",
				companyDescription: "Acme builds AI sales tools.",
			}
		);

		expect(result.outputType).toBe("code");
		expect(result.generatedOutput).toContain("<section class=\"faq-section\">");
		expect(result.generatedOutput).toContain("\"@type\": \"FAQPage\"");
	});

	it("uses real FAQ data from issue description instead of fabricating", () => {
		const faqData = JSON.stringify([
			{ question: "What is your refund policy?", answer: "We offer full refunds within 30 days of purchase." },
			{ question: "How do I contact support?", answer: "Email support@acme.com or use our live chat." },
		]);
		const result = generateScriptForIssue(
			{
				id: 104,
				title: "Add Organization + FAQPage Schema (Homepage)",
				description: `This page has no JSON-LD schema markup.\n\nRecommended schemas: Organization + FAQPage.\n<!-- FAQ_DATA: ${faqData} -->`,
				agentType: "schema_markup",
				checkCode: "J1_present",
				affectedUrl: "https://acme.com/",
			},
			{
				companyName: "Acme",
				companyWebsite: "https://acme.com",
				companyDescription: "Acme builds AI sales tools.",
			}
		);

		expect(result.outputType).toBe("code");
		expect(result.generatedOutput).toContain("\"@type\": \"FAQPage\"");
		// Should contain real FAQ content, not fabricated questions
		expect(result.generatedOutput).toContain("What is your refund policy?");
		expect(result.generatedOutput).toContain("We offer full refunds within 30 days of purchase.");
		expect(result.generatedOutput).toContain("How do I contact support?");
		// Should NOT contain fabricated placeholder questions
		expect(result.generatedOutput).not.toContain("What is Acme?");
		expect(result.generatedOutput).not.toContain("How does Acme help");
	});

	it("generates placeholder instructions when no FAQ data is embedded", () => {
		const result = generateScriptForIssue(
			{
				id: 105,
				title: "Add Organization + FAQPage Schema (Homepage)",
				description: "This page has no JSON-LD schema markup.\n\nRecommended schemas: Organization + FAQPage.",
				agentType: "schema_markup",
				checkCode: "J1_present",
				affectedUrl: "https://acme.com/",
			},
			{
				companyName: "Acme",
				companyWebsite: "https://acme.com",
				companyDescription: "Acme builds AI sales tools.",
			}
		);

		expect(result.outputType).toBe("code");
		expect(result.generatedOutput).toContain("\"@type\": \"FAQPage\"");
		// Should contain placeholder instructions, not fabricated brand-specific questions
		expect(result.generatedOutput).toContain("Replace with your");
		expect(result.generatedOutput).not.toContain("What is Acme?");
	});

	it("generates pricing-page-specific FAQ placeholders when PAGE_TYPE is pricing", () => {
		const result = generateScriptForIssue(
			{
				id: 110,
				title: "Add FAQ Content",
				description: "No FAQ content found\n<!-- PAGE_TYPE: pricing -->",
				agentType: "faq_sections",
				checkCode: "FAQ_count",
				affectedUrl: "https://acme.com/pricing",
			},
			{
				companyName: "Acme",
				companyWebsite: "https://acme.com",
				companyDescription: "Acme builds AI sales tools.",
			}
		);

		expect(result.outputType).toBe("code");
		expect(result.generatedOutput).toContain("<section class=\"faq-section\">");
		// Should contain pricing-specific placeholder questions
		expect(result.generatedOutput).toContain("How much does [Product] cost?");
		expect(result.generatedOutput).toContain("Is there a free trial or free plan?");
		// Should NOT contain generic placeholders
		expect(result.generatedOutput).not.toContain("Your first question here?");
		expect(result.generatedOutput).not.toContain("Your second question here?");
	});

	it("generates home-page-specific FAQ placeholders when PAGE_TYPE is home", () => {
		const result = generateScriptForIssue(
			{
				id: 111,
				title: "Add FAQ Content",
				description: "No FAQ content found\n<!-- PAGE_TYPE: home -->",
				agentType: "faq_sections",
				checkCode: "FAQ_count",
				affectedUrl: "https://acme.com/",
			},
			{
				companyName: "Acme",
				companyWebsite: "https://acme.com",
				companyDescription: "Acme builds AI sales tools.",
			}
		);

		expect(result.outputType).toBe("code");
		// Should contain home-specific placeholder questions
		expect(result.generatedOutput).toContain("What does [Company] do?");
		expect(result.generatedOutput).toContain("Who is [Product] built for?");
		// Should NOT contain pricing-specific or generic placeholders
		expect(result.generatedOutput).not.toContain("How much does [Product] cost?");
		expect(result.generatedOutput).not.toContain("Your first question here?");
	});

	it("generates features-page-specific FAQ placeholders when PAGE_TYPE is features", () => {
		const result = generateScriptForIssue(
			{
				id: 112,
				title: "Add FAQ Content",
				description: "No FAQ content found\n<!-- PAGE_TYPE: features -->",
				agentType: "faq_sections",
				checkCode: "FAQ_count",
				affectedUrl: "https://acme.com/features",
			},
			{
				companyName: "Acme",
				companyWebsite: "https://acme.com",
				companyDescription: "Acme builds AI sales tools.",
			}
		);

		expect(result.outputType).toBe("code");
		expect(result.generatedOutput).toContain("What are the key features of [Product]?");
		expect(result.generatedOutput).not.toContain("Your first question here?");
	});

	it("falls back to generic placeholders when no PAGE_TYPE is present", () => {
		const result = generateScriptForIssue(
			{
				id: 113,
				title: "Add FAQ Content",
				description: "No FAQ content found",
				agentType: "faq_sections",
				checkCode: "FAQ_count",
				affectedUrl: "https://acme.com/features",
			},
			{
				companyName: "Acme",
				companyWebsite: "https://acme.com",
				companyDescription: "Acme builds AI sales tools.",
			}
		);

		expect(result.outputType).toBe("code");
		// Should fall back to generic placeholders
		expect(result.generatedOutput).toContain("Your first question here?");
		expect(result.generatedOutput).toContain("Your second question here?");
	});

	it("uses real FAQ data in faq_sections agent type", () => {
		const faqData = JSON.stringify([
			{ question: "Is there a free trial?", answer: "Yes, we offer a 14-day free trial." },
		]);
		const result = generateScriptForIssue(
			{
				id: 106,
				title: "Add FAQ Content",
				description: `This page has FAQ content.\n<!-- FAQ_DATA: ${faqData} -->`,
				agentType: "faq_sections",
				checkCode: "FAQ_count",
				affectedUrl: "https://acme.com/pricing",
			},
			{
				companyName: "Acme",
				companyWebsite: "https://acme.com",
				companyDescription: "Acme builds AI sales tools.",
			}
		);

		expect(result.outputType).toBe("code");
		expect(result.generatedOutput).toContain("Is there a free trial?");
		expect(result.generatedOutput).toContain("Yes, we offer a 14-day free trial.");
	});
});

describe("detectFrameworkFromContext", () => {
	it("returns Next.js for .tsx with next/ import", () => {
		expect(
			detectFrameworkFromContext("app/pricing/page.tsx", 'import Link from "next/link"')
		).toBe("Next.js (React/JSX)");
	});

	it("returns Next.js for .tsx in app/ directory", () => {
		expect(
			detectFrameworkFromContext("app/page.tsx", "<div>Hello</div>")
		).toBe("Next.js (React/JSX)");
	});

	it("returns React for .jsx without next/ imports", () => {
		expect(
			detectFrameworkFromContext("src/components/FAQ.jsx", 'import React from "react"')
		).toBe("React (JSX)");
	});

	it("returns Astro for .astro files", () => {
		expect(
			detectFrameworkFromContext("src/pages/index.astro", "---\nconst title = 'Home'\n---")
		).toBe("Astro");
	});

	it("returns Vue for .vue files", () => {
		expect(
			detectFrameworkFromContext("src/pages/Home.vue", "<template><div></div></template>")
		).toBe("Vue");
	});

	it("returns HTML for .html files", () => {
		expect(
			detectFrameworkFromContext("public/index.html", "<html><body></body></html>")
		).toBe("HTML");
	});

	it("returns HTML when filePath is null", () => {
		expect(detectFrameworkFromContext(null, null)).toBe("HTML");
	});
});
