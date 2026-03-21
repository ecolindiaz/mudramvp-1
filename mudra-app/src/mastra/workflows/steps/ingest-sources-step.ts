import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

const inputSchema = z.object({
  sources: z.array(
    z.object({
      url: z.string(),
      title: z.string().optional(),
    })
  ),
});

const outputSchema = z.object({
  validatedUrls: z.array(z.string()),
  totalSources: z.number(),
});

export const ingestSourcesStep = createStep({
  id: "ingest-sources",
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => {
    const { sources } = inputData;

    // Validate and deduplicate URLs
    const validatedUrls = sources
      .map((s) => s.url)
      .filter((url) => url.startsWith("http://") || url.startsWith("https://"))
      .filter((url, index, self) => self.indexOf(url) === index) // dedupe
      .slice(0, 10); // max 10

    console.log(`[IngestSources] Validated ${validatedUrls.length} URLs`);

    return {
      validatedUrls,
      totalSources: validatedUrls.length,
    };
  },
});

