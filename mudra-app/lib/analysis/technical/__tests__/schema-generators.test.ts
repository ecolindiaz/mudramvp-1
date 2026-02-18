import { describe, expect, it } from "vitest";
import { htmlToExtraction } from "../dom-extractor";
import { buildSchemaForType, isSkipped } from "../schema-generators";

describe("buildSchemaForType", () => {
	it("skips OfferCatalog when no reliable offer items can be extracted", () => {
		const url = "https://example.com/pricing";
		const extraction = htmlToExtraction(
			"<html><head><title>Pricing | Example</title></head><body><h1>Pricing</h1></body></html>",
			url
		).extraction;

		const result = buildSchemaForType("OfferCatalog", url, extraction);

		expect(isSkipped(result)).toBe(true);
		if (isSkipped(result)) {
			expect(result.reason).toContain("itemListElement");
		}
	});

	it("still generates non-placeholder schema for supported types", () => {
		const url = "https://example.com/";
		const extraction = htmlToExtraction(
			"<html><head><title>Example | Home</title></head><body><h1>Welcome</h1></body></html>",
			url
		).extraction;

		const result = buildSchemaForType("Organization", url, extraction);

		expect(isSkipped(result)).toBe(false);
		if (!isSkipped(result)) {
			expect(result.schema["@type"]).toBe("Organization");
			expect(result.schema.name).toBe("Example");
		}
	});
});
