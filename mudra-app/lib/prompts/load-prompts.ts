import fs from "fs";
import path from "path";

const PROMPTS_DIR = path.join(process.cwd(), "lib", "prompts");

export function loadPrompt(filename: string): string {
  const filepath = path.join(PROMPTS_DIR, filename);

  if (!fs.existsSync(filepath)) {
    throw new Error(`Prompt file not found: ${filepath}`);
  }

  return fs.readFileSync(filepath, "utf-8");
}

export function getContentQualityPrompt(): string {
  return loadPrompt("content-quality.txt");
}

export function getContentStructurePrompt(): string {
  return loadPrompt("content-structure.txt");
}

export function getPromptGenerationPrompt(): string {
  // PromptGeneration.txt lives in the original Mudra Prompts directory
  const legacyDir = path.join(process.cwd(), "lib", "Mudra Prompts");
  const filepath = path.join(legacyDir, "PromptGeneration.txt");

  if (!fs.existsSync(filepath)) {
    throw new Error(`Prompt file not found: ${filepath}`);
  }

  return fs.readFileSync(filepath, "utf-8");
}