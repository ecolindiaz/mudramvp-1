// Utility to build an LLM prompt for tweet generation, injecting tweet examples from the vector store
import { BrandProfile } from "./build-llm-prompt";

export interface BuildTwitterPromptArgs {
  brandProfile: BrandProfile;
  tweetExamples: { text: string; url?: string }[];
}

export function buildLLMTwitterPrompt({ brandProfile, tweetExamples }: BuildTwitterPromptArgs): string {
  console.log("Injected tweet examples:", tweetExamples);
  const { companyName, companyDescription, companyIndustry, companyICP } = brandProfile;
  const tweetSection = tweetExamples.length
    ? tweetExamples.map((t: { text: string; url?: string }, i: number) => `  ${i + 1}. ${t.text}${t.url ? `\n     (${t.url})` : ""}`).join("\n")
    : "None found";

  return `You are a social media strategist for early-stage startups.\n\nStartup Profile:\n  Name: ${companyName}\n  Description: ${companyDescription}\n  Industry: ${companyIndustry}\n  Target Audience: ${companyICP}\n\nHere are 5 successful tweet strategies from similar startups:\n${tweetSection}\n\n Using these strategies, write 3 new, creative tweets for this startup, inspired by the above examples. Limit use of emojis. This brand is currently part of the Delta program by @_TheResidency only mention this in tags or hashtags. Only respond with a JSON array of tweet objects, e.g. [{"tweet": "..."}].`;
}
