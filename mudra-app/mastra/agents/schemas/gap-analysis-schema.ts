import { z } from "zod";

export const gapAnalysisOutputSchema = z.object({
  contentGaps: z
    .array(z.string())
    .describe("Questions not answered, missing angles, unaddressed objections"),
  dataGaps: z
    .array(z.string())
    .describe("Missing statistics, comparisons, examples"),
  formatGaps: z
    .array(z.string())
    .describe("Missing tables, steps, FAQ, TL;DR"),
  depthGaps: z
    .array(z.string())
    .describe("Surface-level explanations needing more detail"),
  recommendedSearchQueries: z
    .array(z.string())
    .max(5)
    .describe("Suggested search queries to fill gaps (max 5)"),
});

export type GapAnalysisOutput = z.infer<typeof gapAnalysisOutputSchema>;

