import fs from "fs";
import path from "path";

const PROMPTS_DIR = path.join(process.cwd(), "lib", "Mudra Prompts");

export function loadPrompt(filename: string): string {
  const filepath = path.join(PROMPTS_DIR, filename);

  if (!fs.existsSync(filepath)) {
    throw new Error(`Prompt file not found: ${filepath}`);
  }

  return fs.readFileSync(filepath, "utf-8");
}

export function getContentQualityPrompt(): string {
  return loadPrompt("ContentQuality.txt");
}

export function getContentStructurePrompt(): string {
  return loadPrompt("ContentStructure.txt");
}

export function getPromptGenerationPrompt(): string {
  return loadPrompt("PromptGeneration.txt");
}