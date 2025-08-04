// Helper to fetch relevant case studies from FAISS API
export async function fetchRelevantCaseStudies(query: string, n_results: number = 5): Promise<CaseStudy[]> {
  const res = await fetch("http://localhost:8000/query-case-studies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, n_results: 20 })
  });
  const json = await res.json();
  return json.results || [];
}
// 3. LLM Prompt Construction
// This utility builds the system prompt for the LLM, inserting user context and retrieved case studies.

export type BrandProfile = {
  companyName?: string;
  companyWebsite?: string;
  companyLinkedIn?: string;
  companyTwitter?: string;
  userName?: string;
  userRole?: string;
  companyDescription?: string;
  companyIndustry?: string;
  companyServices?: string;
  companyICP?: string;
  competitors?: string[];
  monthlySearchVolume?: string;
  aiRecommendations?: string;
  [key: string]: any;
};

export type CaseStudy = {
  summary?: string;
  text?: string;
  [key: string]: any;
};

export type Constraints = Record<string, any>;

interface BuildPromptArgs {
  brandProfile: BrandProfile;
  caseStudies?: CaseStudy[];
  constraints?: Constraints;
  campaignObjective?: string;
}

/**
 * Builds a system prompt for the LLM using brand profile and optional RAG context.
 */
export function buildLLMPrompt({ brandProfile, caseStudies = [], constraints = {}, campaignObjective }: BuildPromptArgs): string {
  // Destructure and format the brand profile, provide sensible defaults for missing fields
  const {
    companyName = "(Not provided)",
    companyWebsite = "(Not provided)",
    companyLinkedIn = "(Not provided)",
    companyTwitter = "(Not provided)",
    userName = "(Not provided)",
    userRole = "(Not provided)",
    companyDescription = "(Not provided)",
    companyIndustry = "(Not provided)",
    companyServices = "(Not provided)",
    companyICP = "(Not provided)",
    competitors = [],
    monthlySearchVolume = "(Not provided)",
    aiRecommendations = "(Not provided)"
  } = brandProfile || {};

  // Format competitors
  const competitorsList = competitors.length
    ? competitors.map((c: string, i: number) => `  ${i + 1}. ${c}`).join("\n")
    : "None provided";

  // Format case studies
  const caseStudySection = caseStudies.length
    ? caseStudies.map((cs: CaseStudy, i: number) => `  ${i + 1}. ${cs.summary || cs.text || JSON.stringify(cs)}`).join("\n")
    : "None found";

  // Format constraints
  const constraintSection = Object.keys(constraints).length
    ? Object.entries(constraints).map(([k, v]) => `  - ${k}: ${v}`).join("\n")
    : "None specified";
  return `You are a growth strategist for early-stage startups.\n\nStartup Profile:\n  Name: ${companyName}\n  Website: ${companyWebsite}\n  LinkedIn: ${companyLinkedIn}\n  Twitter: ${companyTwitter}\n  Contact: ${userName} (${userRole})\n  Description: ${companyDescription}\n  Industry: ${companyIndustry}\n  Services/Products: ${companyServices}\n  Target Audience: ${companyICP}\n  Competitors:\n${competitorsList}\n  Monthly Search Volume: ${monthlySearchVolume}\n  AI Recommendations: ${aiRecommendations}\n\nRelevant Case Studies:\n${caseStudySection}\n\nCampaign Constraints:\n${constraintSection}\n\nCampaign Objective/Goal: ${campaignObjective || "None specified"}\n\nIf any profile fields above are missing or incomplete, use reasonable assumptions and still generate 3 tailored campaign strategies. Do not ask for more information.\n\nSuggest 3 tailored campaign strategies for this startup. For each, include:\n- Campaign Name\n- Objective\n- Primary Channel\n- Key Tactics\n- KPIs / Metrics\n- Suggested tools or AI integrations. Only respond with a JSON array of campaign objects, e.g. [{"title":"Campaign 1","objective":"...","channel":"SEO","tactics":"...","kpis":"...","tools":"..."}].`;                                                          
}
