import { Agent } from "@mastra/core/agent";
import { contentOutputSchema } from "./schemas/content-schema";
import {
  getContentQualityPrompt,
  getContentStructurePrompt,
} from "../../lib/prompts/load-prompts";

// Load prompts at module initialization
let QUALITY_PROMPT = "";
let STRUCTURE_PROMPT = "";

try {
  QUALITY_PROMPT = getContentQualityPrompt();
  STRUCTURE_PROMPT = getContentStructurePrompt();
} catch (error) {
  // Prompts will be loaded at runtime if not available at import time
  console.warn("Prompts not loaded at init time, will load at runtime");
}

const CONTENT_GENERATOR_INSTRUCTIONS = `You are an expert content writer specializing in AI-optimized, GEO-optimized content.

## Your Mission
Generate content that AI models will cite when answering user queries.

## Content Quality Guidelines
${QUALITY_PROMPT || "[Content Quality guidelines will be loaded at runtime]"}

## Content Structure Guidelines  
${STRUCTURE_PROMPT || "[Content Structure guidelines will be loaded at runtime]"}

## CRITICAL REQUIREMENTS
1. Word count: MINIMUM 1,200 words, MAXIMUM 1,600 words
2. Every H2 must have a direct-answer paragraph (2-3 sentences)
3. Include TL;DR immediately after the title
4. Include a comparison table if the intent is comparative
5. Include FAQ section with 3-5 Q&As
6. Include Bottom Line section before FAQ
7. Author format: [Name], [Title] - no experience narrative

## Output Format
Return the full markdown article along with metadata including title, word count, sections, and author info.`;

export const contentGeneratorAgent = new Agent({
  name: "content-generator-agent",
  instructions: CONTENT_GENERATOR_INSTRUCTIONS,
  model: "openai/gpt-4o", // Using gpt-4o for content generation
});

export { contentOutputSchema };
