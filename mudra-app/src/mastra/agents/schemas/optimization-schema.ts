import { z } from "zod";

export const optimizationSourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  type: z.enum(["original", "ai-cited", "research"]),
  confidence: z.enum(["A", "B", "C", "D"]).describe("A=research-found, B=AI-cited+verified, C=AI-only, D=original"),
});

export const optimizationOutputSchema = z.object({
  optimizedContent: z.string().describe("The full optimized markdown article"),
  metadata: z.object({
    title: z.string(),
    metaDescription: z.string().describe("SEO meta description, 150-160 characters"),
    wordCount: z.number(),
    sections: z.array(z.string()),
    author: z.object({
      name: z.string(),
      title: z.string(),
    }),
    lastUpdated: z.string().optional().describe("YYYY-MM-DD format"),
    sources: z.array(optimizationSourceSchema).optional(),
  }),
  diffManifest: z.object({
    sectionsAdded: z.array(z.string()),
    sectionsModified: z.array(z.string()),
    sectionsRemoved: z.array(z.string()),
    statsAdded: z.number(),
    quotesAdded: z.number(),
    internalLinksAdded: z.number(),
    faqsAdded: z.number(),
    wordsAdded: z.number(),
    wordsRemoved: z.number(),
  }),
});

export type OptimizationOutput = z.infer<typeof optimizationOutputSchema>;
