import { z } from "zod";

export const gapAnalysisOutputSchema = z.object({
  contentGaps: z
    .array(z.string())
    .max(8)
    .describe("Top 5-8 most impactful: questions not answered, missing angles, unaddressed objections"),
  dataGaps: z
    .array(z.string())
    .max(8)
    .describe("Top 5-8 most impactful: missing statistics, comparisons, examples"),
  formatGaps: z
    .array(z.string())
    .max(8)
    .describe("Top 5-8 most impactful: missing tables, steps, FAQ, TL;DR"),
  depthGaps: z
    .array(z.string())
    .max(8)
    .describe("Top 5-8 most impactful: surface-level explanations needing more detail"),
  recommendedSearchQueries: z
    .array(z.string())
    .max(7)
    .describe("Suggested search queries to fill gaps (max 7)"),
});

export type GapAnalysisOutput = z.infer<typeof gapAnalysisOutputSchema>;

