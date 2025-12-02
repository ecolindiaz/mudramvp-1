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
});

// Workflow input schema
export const workflowInputSchema = z.object({
  trackedPrompt: z.string(),
  sources: z.array(sourceSchema).min(1).max(10),
  brandContext: brandContextSchema,
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
  }),
});

export type WorkflowInput = z.infer<typeof workflowInputSchema>;
export type WorkflowOutput = z.infer<typeof workflowOutputSchema>;

