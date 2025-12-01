import { Agent } from "@mastra/core/agent";
// Import your tools
// import { exampleTool } from "../tools/example-tool";

/**
 * Example Mastra Agent
 * 
 * This is a placeholder agent. Replace with your own implementation.
 * See: https://mastra.ai/docs/agents
 */
export const exampleAgent = new Agent({
  name: "Example Agent",
  instructions: `
    You are a helpful assistant for Mudra, a Generative Engine Optimization (GEO) platform.
    
    Your role is to assist users with:
    - Understanding their AI visibility scores
    - Analyzing how their brand appears across AI models
    - Providing recommendations to improve AI mentions
    
    Be concise, professional, and data-driven in your responses.
  `,
  // Choose your model - options include:
  // "openai/gpt-4o", "anthropic/claude-3-5-sonnet-latest", "google/gemini-2.5-pro"
  model: "openai/gpt-4o",
  tools: {
    // Add your tools here
    // exampleTool,
  },
});

