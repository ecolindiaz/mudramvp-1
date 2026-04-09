import { z } from "zod";

export const enabledToolsSchema = z.object({
  queryAiModels: z.boolean().default(true),
  scrapeCitations: z.boolean().default(true),
  freshResearch: z.boolean().default(true),
  competitorAnalysis: z.boolean().default(false),
  internalLinks: z.boolean().default(false),
  schemaMarkup: z.boolean().default(false),
});

export const optimizerBrandContextSchema = z.object({
  brandName: z.string(),
  brandWebsite: z.string().optional(),
  brandDescription: z.string().optional(),
  brandIndustry: z.string().optional(),
  competitors: z.array(z.string()).optional(),
  userName: z.string(),
  userRole: z.string(),
});

export const optimizerInputSchema = z.object({
  pageUrl: z.string().url(),
  promptText: z.string(),
  promptId: z.number().optional(),
  brandProfileId: z.number(),
  depthLevel: z.enum(["light", "moderate", "deep"]),
  voiceTone: z.string().optional(),
  icpDescription: z.string().optional(),
  enabledTools: enabledToolsSchema,
  brandContext: optimizerBrandContextSchema,
});

export const optimizerOutputSchema = z.object({
  optimizedContent: z.string(),
  originalContent: z.string(),
  diffSections: z.array(z.object({
    heading: z.string().optional(),
    isNew: z.boolean().optional(),
    paragraphs: z.array(z.array(z.object({
      type: z.enum(["added", "removed", "text"]),
      content: z.string(),
    }))),
  })),
  diffStats: z.object({
    wordsAdded: z.number(),
    wordsRemoved: z.number(),
    sectionsNew: z.number(),
    sectionsModified: z.number(),
  }),
  metadata: z.object({
    title: z.string(),
    metaDescription: z.string(),
    wordCount: z.number(),
    originalWordCount: z.number(),
    sections: z.array(z.string()),
    sources: z.array(z.object({
      title: z.string(),
      url: z.string(),
      type: z.enum(["original", "ai-cited", "research"]),
    })),
  }),
  schemaMarkup: z.array(z.object({
    type: z.string(),
    jsonLd: z.string(),
  })).optional(),
});

export type OptimizerInput = z.infer<typeof optimizerInputSchema>;
export type OptimizerOutput = z.infer<typeof optimizerOutputSchema>;
export type EnabledTools = z.infer<typeof enabledToolsSchema>;
