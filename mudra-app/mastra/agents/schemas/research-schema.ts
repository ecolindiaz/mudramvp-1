import { z } from "zod";

export const additionalSourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  relevance: z.string(),
  keyInsight: z.string(),
  datePublished: z.string().optional(),
});

export const researchOutputSchema = z.object({
  additionalSources: z.array(additionalSourceSchema),
  statistics: z.array(z.string()),
  expertQuotes: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export type ResearchOutput = z.infer<typeof researchOutputSchema>;

