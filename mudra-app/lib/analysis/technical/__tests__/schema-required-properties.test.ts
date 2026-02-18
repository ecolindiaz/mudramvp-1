import { describe, expect, it } from "vitest";
import { validateRequiredProperties } from "../schema-required-properties";

describe("validateRequiredProperties", () => {
	it("validates required properties for single-string @type", () => {
		const result = validateRequiredProperties({
			"@context": "https://schema.org",
			"@type": "Product",
		});

		expect(result.type).toBe("Product");
		expect(result.missing.map((item) => item.property)).toEqual(["name"]);
	});

	it("uses a known type from @type arrays", () => {
		const result = validateRequiredProperties({
			"@context": "https://schema.org",
			"@type": ["Thing", "Product"],
		});

		expect(result.type).toBe("Product");
		expect(result.missing.map((item) => item.property)).toEqual(["name"]);
	});

	it("returns unknown when @type array has no known string types", () => {
		const result = validateRequiredProperties({
			"@context": "https://schema.org",
			"@type": [123, "Thing"],
		});

		expect(result.type).toBe("Thing");
		expect(result.missing).toEqual([]);
	});
});
