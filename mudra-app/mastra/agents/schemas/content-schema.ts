import { z } from "zod";

export const sourceReferenceSchema = z.object({
  title: z.string(),
  url: z.string(),
});

export const contentMetadataSchema = z.object({
  title: z.string(),
  wordCount: z.number(),
  sections: z.array(z.string()),
  author: z.object({
    name: z.string(),
    title: z.string(),
  }),
  sources: z.array(sourceReferenceSchema).optional().describe("Sources cited in the article"),
});

export const contentOutputSchema = z.object({
  content: z.string().describe("The full markdown article with source citations"),
  metadata: contentMetadataSchema,
});

export type ContentOutput = z.infer<typeof contentOutputSchema>;

