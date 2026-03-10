import { z } from "zod";

// Source schema
const sourceSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
});

// Brand context schema
const brandContextSchema = z.object({
  brandName: z.string(),
  brandDescription: z.string().optional(),
  targetICP: z.string().optional(),
  uniqueValueProp: z.string().optional(),
  userName: z.string(),
  userRole: z.string(),
  brandWebsite: z.string().optional(),
  brandIndustry: z.string().optional(),
  competitors: z.array(z.string()).optional(),
  isComparativeIntent: z.boolean().optional(),
});

// Workflow input schema
export const workflowInputSchema = z.object({
  trackedPrompt: z.string(),
  sources: z.array(sourceSchema).min(1).max(10),
  brandContext: brandContextSchema,
});

// Source reference schema for output metadata
const sourceReferenceSchema = z.object({
  title: z.string(),
  url: z.string(),
  type: z.enum(["primary", "research"]).describe("primary = scraped citation, research = live web search"),
});

// Workflow output schema
export const workflowOutputSchema = z.object({
  content: z.string(),
  metadata: z.object({
    title: z.string(),
    wordCount: z.number(),
    sections: z.array(z.string()),
    trackedPrompt: z.string(),
    author: z.object({
      name: z.string(),
      title: z.string(),
    }),
    sourcesScraped: z.number(),
    researchQueriesRun: z.number(),
    sources: z.array(sourceReferenceSchema).describe("All sources cited in the article"),
  }),
});

export type WorkflowInput = z.infer<typeof workflowInputSchema>;
export type WorkflowOutput = z.infer<typeof workflowOutputSchema>;

