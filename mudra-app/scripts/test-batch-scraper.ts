// Test file for Batch Scraper
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import {
  scrapeInBatches,
  validateMinimumScrapes,
} from "../mastra/tools/batch-scraper";

async function testBatchScraper() {
  console.log("=== Testing Batch Scraper ===\n");

  const urls = [
    "https://scale.com",
    "https://labelbox.com",
    "https://invalid-url-that-should-fail-12345.xyz",
  ];

  console.log("Testing batch scraper with", urls.length, "URLs...\n");

  const result = await scrapeInBatches(urls, 2);

  console.log("\nResults:");
  console.log("  Attempted:", result.totalAttempted);
  console.log("  Succeeded:", result.totalSucceeded);
  console.log("  Failed:", result.failed.length);

  result.successful.forEach((s) => {
    console.log(`  ✓ ${s.url} (${s.markdown.length} chars)`);
  });

  result.failed.forEach((f) => {
    console.log(`  ✗ ${f.url}: ${f.error}`);
  });

  try {
    validateMinimumScrapes(result, 2);
    console.log("\n✅ Batch scraper working! Minimum threshold met.");
  } catch (error: any) {
    console.log("\n❌ Minimum threshold not met:", error.message);
  }
}

testBatchScraper().catch(console.error);

