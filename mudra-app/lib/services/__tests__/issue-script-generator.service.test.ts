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
});
