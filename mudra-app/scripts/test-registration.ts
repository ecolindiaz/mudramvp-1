// Test file for Mastra Registration
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { mastra } from "../mastra";

async function testRegistration() {
  console.log("=== Testing Mastra Registration ===\n");

  // Test agents
  const gapAgent = mastra.getAgent("gapAnalysisAgent");
  const researchAgentObj = mastra.getAgent("researchAgent");
  const contentAgent = mastra.getAgent("contentGeneratorAgent");

  console.log("Agents registered:");
  console.log("  - gapAnalysisAgent:", !!gapAgent);
  console.log("  - researchAgent:", !!researchAgentObj);
  console.log("  - contentGeneratorAgent:", !!contentAgent);

  // Test workflow
  const workflow = mastra.getWorkflow("aiContentWorkflow");

  console.log("\nWorkflows registered:");
  console.log("  - aiContentWorkflow:", !!workflow);

  if (gapAgent && researchAgentObj && contentAgent && workflow) {
    console.log("\n✅ All components registered successfully!");
  } else {
    console.log("\n❌ Some components failed to register");
  }
}

testRegistration().catch(console.error);

