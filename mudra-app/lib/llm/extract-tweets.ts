// Utility to extract tweet suggestions from LLM campaign output
// Call this after LLM generation to find tweet actions for execution

import { Campaign } from "@/lib/llm/post-process-campaigns"

export function extractTweetsFromCampaigns(campaigns: Campaign[]): string[] {
  const tweets: string[] = []
  for (const c of campaigns) {
    // Look for explicit tweet suggestions in description or tactics
    if (c.description && c.description.toLowerCase().includes("tweet")) {
      // Naive extraction: split by lines, look for lines starting with "Tweet" or containing "tweet"
      const lines = c.description.split(/\n|\. /)
      for (const line of lines) {
        if (/tweet/i.test(line)) {
          tweets.push(line.trim())
        }
      }
    }
    if (c.tactics && typeof c.tactics === "string" && c.tactics.toLowerCase().includes("tweet")) {
      const lines = c.tactics.split(/\n|\. /)
      for (const line of lines) {
        if (/tweet/i.test(line)) {
          tweets.push(line.trim())
        }
      }
    }
  }
  return tweets
}
