// Test file for Firecrawl Search Tool
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { firecrawlSearchTool } from "../mastra/tools/firecrawl-search";
import { RuntimeContext } from "@mastra/core/runtime-context";

async function testSearch() {
  console.log("=== Testing Firecrawl Search Tool ===\n");

  const runtimeContext = new RuntimeContext();

  const result = await firecrawlSearchTool.execute({
    context: {
      query: "best data labeling companies 2024",
      limit: 3,
    },
    runtimeContext,
  });

  console.log("Success:", result.success);
  console.log("Results count:", result.results.length);

  result.results.forEach((r, i) => {
    console.log(`\nResult ${i + 1}:`);
    console.log("  Title:", r.title);
    console.log("  URL:", r.url);
    console.log("  Has markdown:", !!r.markdown);
  });

  if (result.success && result.results.length > 0) {
    console.log("\n✅ Search tool working!");
  } else {
    console.log("\n❌ Search failed:", result.error);
  }
}

testSearch().catch(console.error);

