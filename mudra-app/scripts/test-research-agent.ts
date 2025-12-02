// Test file for Research Agent
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import {
  researchAgent,
  researchOutputSchema,
} from "../mastra/agents/research-agent";

async function testResearchAgent() {
  console.log("=== Testing Research Agent ===\n");

  const mockGapAnalysis = {
    contentGaps: [
      "No discussion of RLHF requirements",
      "Missing security certifications info",
    ],
    dataGaps: ["No pricing comparisons", "No accuracy metrics"],
    formatGaps: ["No comparison table"],
    depthGaps: ["Surface-level feature descriptions"],
    recommendedSearchQueries: [
      "RLHF data labeling frontier AI 2024",
      "data labeling security SOC 2 requirements",
    ],
  };

  console.log("Testing research agent with gap analysis...\n");
  console.log("Note: This will make actual web searches via Firecrawl.\n");

  const response = await researchAgent.generate(
    `Based on this gap analysis for the tracked prompt "best data labeling providers for frontier AI research labs", conduct research to fill the gaps:

Gap Analysis:
${JSON.stringify(mockGapAnalysis, null, 2)}

Use the search tool to find authoritative sources, statistics, and expert quotes. Run max 2 searches.`,
    {
      output: researchOutputSchema,
      maxSteps: 5, // Allow multiple tool calls
    }
  );

  console.log("\nResearch Results:");
  console.log(
    "Additional Sources:",
    response.object?.additionalSources?.length || 0
  );
  console.log("Statistics:", response.object?.statistics?.length || 0);
  console.log("Expert Quotes:", response.object?.expertQuotes?.length || 0);
  console.log("Recommendations:", response.object?.recommendations?.length || 0);

  if (response.object?.additionalSources?.length > 0) {
    console.log("\nSample sources:");
    response.object.additionalSources.slice(0, 2).forEach((s) => {
      console.log(`  - ${s.title}: ${s.keyInsight}`);
    });
  }

  console.log("\n✅ Research agent test complete!");
}

testResearchAgent().catch(console.error);

