// Test file for Content Generator Agent
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import {
  contentGeneratorAgent,
  contentOutputSchema,
} from "../mastra/agents/content-generator-agent";

async function testContentAgent() {
  console.log("=== Testing Content Generator Agent ===\n");

  const mockContext = {
    trackedPrompt:
      "What are the best data labeling providers for frontier AI research labs?",
    gapAnalysis: {
      contentGaps: ["Missing RLHF discussion", "No security info"],
      dataGaps: ["No pricing data", "No accuracy metrics"],
      formatGaps: ["No comparison table"],
      depthGaps: ["Surface-level features"],
    },
    research: {
      statistics: ["Scale AI has powered 5 of top 10 frontier models"],
      expertQuotes: ["High-quality human feedback data is critical"],
    },
    brandContext: {
      brandName: "Scale AI",
      userName: "Alex Wang",
      userRole: "CEO",
    },
  };

  console.log("Generating content... (this may take 30-60 seconds)\n");

  const response = await contentGeneratorAgent.generate(
    `Generate an AI-optimized article for the following:

Tracked Prompt: ${mockContext.trackedPrompt}

Brand Context:
- Brand: ${mockContext.brandContext.brandName}
- Author: ${mockContext.brandContext.userName}, ${mockContext.brandContext.userRole}

Gap Analysis:
${JSON.stringify(mockContext.gapAnalysis, null, 2)}

Research Findings:
${JSON.stringify(mockContext.research, null, 2)}

Generate the complete article following all quality and structure guidelines.
IMPORTANT: Word count must be between 1,200 and 1,600 words.`,
    {
      output: contentOutputSchema,
    }
  );

  console.log("Content Generated!");
  console.log("Title:", response.object?.metadata?.title);
  console.log("Word Count (reported):", response.object?.metadata?.wordCount);
  console.log("Sections:", response.object?.metadata?.sections?.length);

  // Validate word count
  const actualWordCount = response.object?.content?.split(/\s+/).length || 0;
  console.log("Actual word count:", actualWordCount);

  if (actualWordCount >= 1000) {
    console.log("\n✅ Content generator agent working!");
  } else {
    console.log("\n⚠️ Content generated but word count may be low");
  }

  // Show content preview
  console.log("\n--- Content Preview (first 500 chars) ---");
  console.log(response.object?.content?.slice(0, 500));
  console.log("...\n");
}

testContentAgent().catch(console.error);

