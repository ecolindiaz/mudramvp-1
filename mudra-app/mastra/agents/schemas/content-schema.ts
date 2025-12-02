import { z } from "zod";

export const contentMetadataSchema = z.object({
  title: z.string(),
  wordCount: z.number(),
  sections: z.array(z.string()),
  author: z.object({
    name: z.string(),
    title: z.string(),
  }),
});

export const contentOutputSchema = z.object({
  content: z.string().describe("The full markdown article"),
  metadata: contentMetadataSchema,
});

export type ContentOutput = z.infer<typeof contentOutputSchema>;

