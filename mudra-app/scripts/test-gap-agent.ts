// Test file for Gap Analysis Agent
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import {
  gapAnalysisAgent,
  gapAnalysisOutputSchema,
} from "../mastra/agents/gap-analysis-agent";

async function testGapAgent() {
  console.log("=== Testing Gap Analysis Agent ===\n");

  const mockScrapedContent = `
## Source 1: Scale AI
Scale AI provides data labeling services for AI companies.
They offer image annotation and text labeling.
Focus on quality and accuracy.

## Source 2: Labelbox  
Labelbox is a data labeling platform.
They have a collaborative interface for teams.
Enterprise features available.
  `;

  console.log("Analyzing mock content...\n");

  const response = await gapAnalysisAgent.generate(
    `Analyze the following scraped content for a tracked prompt about "best data labeling providers for frontier AI research labs":

${mockScrapedContent}

Identify all gaps and suggest search queries to fill them.`,
    {
      output: gapAnalysisOutputSchema,
    }
  );

  console.log("Gap Analysis Result:");
  console.log(JSON.stringify(response.object, null, 2));

  if (response.object?.contentGaps?.length > 0) {
    console.log("\n✅ Gap analysis agent working!");
  } else {
    console.log("\n❌ Gap analysis failed - no gaps identified");
  }
}

testGapAgent().catch(console.error);

