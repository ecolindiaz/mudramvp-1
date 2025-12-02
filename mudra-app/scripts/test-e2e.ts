// End-to-End Test for AI Content Generation Workflow
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { mastra } from "../mastra";

async function e2eTest() {
  console.log("=== END-TO-END TEST: AI Content Generation Workflow ===\n");

  const workflow = mastra.getWorkflow("aiContentWorkflow");

  if (!workflow) {
    console.log("❌ Workflow not found");
    return;
  }

  const input = {
    trackedPrompt:
      "What are the best data labeling providers for frontier AI research labs?",
    sources: [
      { url: "https://scale.com", title: "Scale AI" },
      { url: "https://labelbox.com", title: "Labelbox" },
    ],
    brandContext: {
      brandName: "Scale AI",
      brandDescription: "The data foundation for AI",
      targetICP: "Frontier AI Research Labs",
      uniqueValueProp: "Trusted by leading frontier labs",
      userName: "Alex Wang",
      userRole: "CEO",
    },
  };

  console.log("Input:");
  console.log("  Tracked Prompt:", input.trackedPrompt);
  console.log("  Sources:", input.sources.length);
  console.log("  Brand:", input.brandContext.brandName);
  console.log("\n--- Starting workflow (this may take 2-3 minutes) ---\n");

  const startTime = Date.now();

  try {
    const run = await workflow.createRunAsync();
    const result = await run.start({ inputData: input });

    const duration = (Date.now() - startTime) / 1000;

    console.log("\n=== WORKFLOW RESULT ===");
    console.log("Duration:", duration.toFixed(1), "seconds");
    console.log("Status:", result.status);

    if (result.status === "success" && result.result) {
      const { content, metadata } = result.result;

      console.log("\nMetadata:");
      console.log("  Title:", metadata.title);
      console.log("  Word Count:", metadata.wordCount);
      console.log("  Sections:", metadata.sections?.length);
      console.log("  Sources Scraped:", metadata.sourcesScraped);
      console.log("  Research Queries:", metadata.researchQueriesRun);

      // Validate word count
      const actualWords = content.split(/\s+/).length;
      console.log("\nValidation:");
      console.log("  Actual word count:", actualWords);
      console.log(
        "  Within range (1200-1600):",
        actualWords >= 1000 && actualWords <= 1800 ? "✓" : "⚠️"
      );

      // Check structure
      console.log("  Has H1:", content.match(/^# /m) !== null ? "✓" : "✗");
      console.log(
        "  Has TL;DR:",
        content.toLowerCase().includes("tl;dr") ? "✓" : "✗"
      );
      console.log(
        "  Has FAQ:",
        content.toLowerCase().includes("faq") ? "✓" : "✗"
      );
      console.log(
        "  Has Bottom Line:",
        content.toLowerCase().includes("bottom line") ? "✓" : "✗"
      );
      console.log("  Has table:", content.includes("|---") ? "✓" : "✗");

      console.log("\n--- Content Preview (first 800 chars) ---");
      console.log(content.slice(0, 800));
      console.log("...\n");

      console.log("✅ E2E TEST PASSED!");
    } else {
      console.log("\n❌ E2E TEST FAILED");
      console.log("Result:", JSON.stringify(result, null, 2));
    }
  } catch (error: any) {
    console.log("\n❌ E2E TEST ERROR:");
    console.log(error.message);
  }
}

e2eTest().catch(console.error);

