import { z } from "zod";

export const additionalSourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  relevance: z.string(),
  keyInsight: z.string(),
  datePublished: z.string().optional(),
});

// Statistics with source attribution for proper citation
export const statisticSchema = z.object({
  stat: z.string().describe("The statistic or data point"),
  source: z.string().describe("Name of the source (company, report, or publication)"),
  url: z.string().describe("URL where the statistic was found"),
});

// Expert quotes with attribution
export const expertQuoteSchema = z.object({
  quote: z.string().describe("The exact quote or paraphrased insight"),
  speaker: z.string().describe("Name and title of the person quoted"),
  source: z.string().optional().describe("Publication or company name"),
  url: z.string().optional().describe("URL of the source"),
});

export const researchOutputSchema = z.object({
  additionalSources: z.array(additionalSourceSchema),
  statistics: z.array(statisticSchema).describe("Statistics with source attribution for citation"),
  expertQuotes: z.array(expertQuoteSchema).describe("Expert quotes with speaker attribution"),
  recommendations: z.array(z.string()),
});

export type ResearchOutput = z.infer<typeof researchOutputSchema>;
export type Statistic = z.infer<typeof statisticSchema>;
export type ExpertQuote = z.infer<typeof expertQuoteSchema>;

