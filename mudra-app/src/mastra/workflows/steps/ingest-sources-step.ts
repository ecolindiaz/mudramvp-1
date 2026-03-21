import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { isDomainBlocked } from "@/lib/utils/domain-utils";

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

    // Validate, filter unscrappable domains, and deduplicate URLs
    const validatedUrls = sources
      .map((s) => s.url)
      .filter((url) => url.startsWith("http://") || url.startsWith("https://"))
      .filter((url) => {
        try {
          const hostname = new URL(url).hostname.replace(/^www\./, '');
          return !isDomainBlocked(hostname);
        } catch { return true; }
      })
      .filter((url, index, self) => self.indexOf(url) === index) // dedupe
      .slice(0, 10); // max 10

    console.log(`[IngestSources] Validated ${validatedUrls.length} URLs`);

    return {
      validatedUrls,
      totalSources: validatedUrls.length,
    };
  },
});

