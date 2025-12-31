// Test file for Firecrawl Scraper Tool
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { firecrawlScraperTool } from "../mastra/tools/firecrawl-scraper";
import { RuntimeContext } from "@mastra/core/runtime-context";

async function testScraper() {
  console.log("=== Testing Firecrawl Scraper Tool ===\n");

  const runtimeContext = new RuntimeContext();

  const result = await firecrawlScraperTool.execute({
    context: { url: "https://mastra.ai" },
    runtimeContext,
  });

  console.log("Success:", result.success);
  console.log("Title:", result.title);
  console.log("Markdown length:", result.markdown?.length);
  console.log("Links count:", result.links?.length);

  if (result.success) {
    console.log("\n✅ Scraper tool working!");
  } else {
    console.log("\n❌ Scraper failed:", result.error);
  }
}

testScraper().catch(console.error);

