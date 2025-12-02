import { Mastra } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import { aeoGeoOptimizerAgent } from './agents/aeo-geo-optimizer';
import { growthScoutAgent } from './agents/growth-scout';

/**
 * Mastra AI Agent Configuration
 * 
 * This configuration sets up two specialized AI agents:
 * 1. AEO/GEO Optimizer - Optimizes content for AI citations
 * 2. Growth Scout - Discovers growth opportunities via citation analysis
 * 
 * All agents use GPT-4o and E2B sandboxes for secure code execution
 */
export const mastra = new Mastra({
  agents: [aeoGeoOptimizerAgent, growthScoutAgent],
  llm: {
    provider: 'openai',
    model: 'gpt-4o',
  },
});

export type MastraInstance = typeof mastra;

// Export agents for direct access
export { aeoGeoOptimizerAgent, growthScoutAgent };
