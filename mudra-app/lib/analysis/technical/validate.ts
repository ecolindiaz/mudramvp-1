import { z } from "zod";
import type { ScrapeSnapshot } from "@/lib/analysis/technical/types";

// Reusable schemas
const QAPairSchema = z.object({
	question: z.string(),
	answer: z.string(),
});

const HeadingsSchema = z
	.object({
		h1: z.array(z.string()).optional().default([]),
		h2: z.array(z.string()).optional().default([]),
		h3: z.array(z.string()).optional().default([]),
		h4: z.array(z.string()).optional().default([]),
		h5: z.array(z.string()).optional().default([]),
		h6: z.array(z.string()).optional().default([]),
	})
	.catchall(z.array(z.string()).optional())
	.passthrough();

const TxtFileEntrySchema = z
	.object({
		url: z.string(),
		exists: z.boolean(),
		size: z.number().int().nonnegative().optional(),
		status: z.number().int().optional(),
	})
	.passthrough();

export const ScrapeSnapshotSchema = z
	.object({
		url: z.string(),
		crawledAt: z.string().optional(),
		metadata: z
			.object({
				title: z.string().optional(),
				description: z.string().optional(),
				language: z.string().optional(),
				favicon: z.string().optional(),
			})
			.passthrough(),
		htmlStructure: z
			.object({
				headings: HeadingsSchema,
				htmlLength: z.number().int().optional(),
				rawHtmlLength: z.number().int().optional(),
				hasProperStructure: z.boolean().optional(),
			})
			.passthrough(),
		schema: z
			.object({
				all: z.array(z.unknown()),
				faqSchema: z.array(z.unknown()),
				summary: z.object({
					jsonLdCount: z.number().int(),
					microdataCount: z.number().int(),
					rdfaCount: z.number().int(),
					faqSchemaCount: z.number().int(),
				}),
			})
			.passthrough(),
		faqs: z
			.object({
				fromSchema: z.array(QAPairSchema),
				fromDom: z.array(QAPairSchema),
				merged: z.array(QAPairSchema),
				summary: z.object({
					totalUnique: z.number().int(),
					schemaCount: z.number().int(),
					domCount: z.number().int(),
					llmCount: z.number().int(),
				}),
			})
			.passthrough(),
		txtFiles: z
			.object({
				robots: TxtFileEntrySchema,
				llms: TxtFileEntrySchema,
				llmsFull: TxtFileEntrySchema.optional(),
				summary: z.object({
					hasRobotsTxt: z.boolean(),
					hasLlmsTxt: z.boolean(),
					hasLlmsFullTxt: z.boolean(),
					totalFound: z.number().int(),
				}),
			})
			.passthrough(),
		synthesizedJsonLd: z.array(z.unknown()).optional(),
	})
	.passthrough();

export type ScrapeSnapshotInput = z.infer<typeof ScrapeSnapshotSchema>;

function formatZodIssues(issues: z.ZodIssue[]): string[] {
	return issues.map((i) => {
		const path = i.path.length ? i.path.join(".") : "<root>";
		return `${path}: ${i.message}`;
	});
}

export function validateScrapeSnapshot(input: unknown): {
	ok: boolean;
	data?: ScrapeSnapshot;
	errors?: string[];
} {
	const result = ScrapeSnapshotSchema.safeParse(input);
	if (result.success) {
		return { ok: true, data: result.data as ScrapeSnapshot };
	}
	return { ok: false, errors: formatZodIssues(result.error.issues) };
}


