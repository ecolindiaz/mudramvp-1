/**
 * Schema Verification Module
 *
 * Post-injection verification that checks:
 * 1. Valid object with @context
 * 2. All required properties present
 * 3. Semantic consistency (no placeholders, fabricated data, etc.)
 */

import { validateRequiredProperties } from "./schema-required-properties";
import type { DOMExtractionData } from "./types";

export type VerificationSeverity = "error" | "warning";
export type VerificationType =
	| "missing_property"
	| "fabricated_data"
	| "semantic_inconsistency"
	| "invalid_json";

export interface VerificationWarning {
	severity: VerificationSeverity;
	type: VerificationType;
	schemaType: string;
	message: string;
}

export interface VerificationResult {
	valid: boolean;
	warnings: VerificationWarning[];
	schemasVerified: number;
}

const PLACEHOLDER_NAMES = new Set([
	"brand",
	"untitled",
	"todo",
	"company",
	"example",
	"test",
	"placeholder",
	"your company",
	"your brand",
	"my company",
]);

const GENERIC_AUTHORS = new Set([
	"customer",
	"anonymous",
	"user",
	"guest",
	"unknown",
	"admin",
	"author",
]);

/**
 * Unwrap a JSON-LD structure into individual schema items.
 * Handles @graph wrappers and array-root JSON-LD.
 */
function unwrapSchemas(
	schemas: unknown[]
): Record<string, unknown>[] {
	const items: Record<string, unknown>[] = [];

	for (const schema of schemas) {
		if (schema == null || typeof schema !== "object") continue;
		const obj = schema as Record<string, unknown>;

		// Handle @graph wrapper
		if (Array.isArray(obj["@graph"])) {
			for (const graphItem of obj["@graph"]) {
				if (graphItem && typeof graphItem === "object") {
					// Inherit @context from parent
					const item = graphItem as Record<string, unknown>;
					if (!item["@context"] && obj["@context"]) {
						item["@context"] = obj["@context"];
					}
					items.push(item);
				}
			}
		} else {
			items.push(obj);
		}
	}

	return items;
}

/**
 * Verify injected schemas against extraction data and semantic rules.
 */
export function verifyInjectedSchemas(
	schemas: unknown[],
	extractionData: DOMExtractionData,
	_pageUrl: string
): VerificationResult {
	const warnings: VerificationWarning[] = [];
	const items = unwrapSchemas(schemas);

	for (const item of items) {
		const type = (item["@type"] as string) || "Unknown";

		// Check 1: Valid object with @context
		if (!item["@context"]) {
			warnings.push({
				severity: "error",
				type: "invalid_json",
				schemaType: type,
				message: `Missing @context on ${type} schema`,
			});
			continue; // Skip further checks for invalid schema
		}

		if (!item["@type"]) {
			warnings.push({
				severity: "error",
				type: "invalid_json",
				schemaType: "Unknown",
				message: "Missing @type on schema object",
			});
			continue;
		}

		// Check 2: Required properties
		const validation = validateRequiredProperties(item);
		for (const missing of validation.missing) {
			warnings.push({
				severity: "error",
				type: "missing_property",
				schemaType: type,
				message: `${type} missing required property: ${missing.property}`,
			});
		}

		// Check 3: Semantic consistency
		// 3a: Name/headline not a placeholder
		const name = (item.name as string) || (item.headline as string) || "";
		if (name && PLACEHOLDER_NAMES.has(name.toLowerCase().trim())) {
			warnings.push({
				severity: "warning",
				type: "fabricated_data",
				schemaType: type,
				message: `${type} has placeholder name: "${name}"`,
			});
		}

		// 3b: FAQPage questions should exist in page's FAQ content
		if (type === "FAQPage" && Array.isArray(item.mainEntity)) {
			const pageFaqQuestions = new Set(
				extractionData.faqs.combined_faqs.map((f) =>
					f.question.toLowerCase().trim()
				)
			);
			for (const entity of item.mainEntity as Record<string, unknown>[]) {
				const questionName = (entity.name as string) || "";
				if (
					questionName &&
					pageFaqQuestions.size > 0 &&
					!pageFaqQuestions.has(questionName.toLowerCase().trim())
				) {
					warnings.push({
						severity: "warning",
						type: "fabricated_data",
						schemaType: type,
						message: `FAQPage question not found in page content: "${questionName.slice(0, 60)}"`,
					});
				}
			}
		}

		// 3c: VideoObject uploadDate not in the future
		if (type === "VideoObject" && item.uploadDate) {
			const uploadDate = new Date(item.uploadDate as string);
			if (!isNaN(uploadDate.getTime()) && uploadDate > new Date()) {
				warnings.push({
					severity: "warning",
					type: "semantic_inconsistency",
					schemaType: type,
					message: `VideoObject uploadDate is in the future: ${item.uploadDate}`,
				});
			}
		}

		// 3d: Review author not generic
		if (type === "Review" && item.author) {
			const author = item.author as Record<string, unknown>;
			const authorName = (author.name as string) || "";
			if (authorName && GENERIC_AUTHORS.has(authorName.toLowerCase().trim())) {
				warnings.push({
					severity: "warning",
					type: "fabricated_data",
					schemaType: type,
					message: `Review has generic author name: "${authorName}"`,
				});
			}
		}

		// 3e: BreadcrumbList last item should not have `item` URL
		if (type === "BreadcrumbList" && Array.isArray(item.itemListElement)) {
			const listItems = item.itemListElement as Record<string, unknown>[];
			if (listItems.length > 1) {
				const lastItem = listItems[listItems.length - 1];
				if (lastItem && lastItem.item) {
					warnings.push({
						severity: "warning",
						type: "semantic_inconsistency",
						schemaType: type,
						message: "BreadcrumbList last item should not have 'item' URL (it represents the current page)",
					});
				}
			}
		}
	}

	const hasErrors = warnings.some((w) => w.severity === "error");

	return {
		valid: !hasErrors,
		warnings,
		schemasVerified: items.length,
	};
}
