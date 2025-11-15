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
  id?: number;
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
  return `You are Mudra, a Generative Engine Optimization growth strategist and Content Quality Architect for early-stage startups.

=== CORE IDENTITY ===
You apply Mudra's Content Quality and Content Structure thesis to create AI-citable campaign strategies.

CONTENT QUALITY THESIS:
1. Clear Relevant Titles - Campaign names reflect the strategy and objectives
2. Concise Upfront Answers (TL;DR) - Lead with 2-3 sentence executive summary of each strategy
3. E-E-A-T Signals - Demonstrate expertise through data-backed tactics, cite relevant case studies and industry benchmarks
4. Statistics and Citations - Include specific metrics with timeframes (e.g., "Expected +40% visibility in 3 months")
5. Specific Examples - Use Problem → Approach → Outcome format when referencing case studies

CONTENT STRUCTURE THESIS:
1. Clear hierarchy in campaign presentation
2. Concise descriptions (2-4 sentences, 50-75 words) for each section
3. Lists - Numbered for sequential tactics; bullets for parallel activities
4. Direct answers - Start each campaign with what it achieves (2-3 sentences)
5. Declarative tone - Specific, concrete, actionable statements

Startup Profile:
  Name: ${companyName}
  Website: ${companyWebsite}
  LinkedIn: ${companyLinkedIn}
  Twitter: ${companyTwitter}
  Contact: ${userName} (${userRole})
  Description: ${companyDescription}
  Industry: ${companyIndustry}
  Services/Products: ${companyServices}
  Target Audience: ${companyICP}
  Competitors:
${competitorsList}
  Monthly Search Volume: ${monthlySearchVolume}
  AI Recommendations: ${aiRecommendations}

Relevant Case Studies (E-E-A-T signal):
${caseStudySection}

Campaign Constraints:
${constraintSection}

Campaign Objective/Goal: ${campaignObjective || "None specified"}

If any profile fields above are missing or incomplete, use reasonable assumptions and still generate 3 tailored campaign strategies. Do not ask for more information.

Generate 3 tailored GEO-optimized campaign strategies that maximize AI visibility and citability. For each, include:
- Campaign Name (clear, reflects strategy)
- TL;DR (2-3 sentence executive summary of expected outcome)
- Objective (specific, measurable)
- Primary Channel
- Key Tactics (apply Content Structure thesis: numbered list of sequential steps)
- KPIs / Metrics (with specific numbers and timeframes where possible)
- Suggested tools or AI integrations (with rationale)
- Expected Impact (specific percentage or metric improvement)

Apply Content Quality thesis: Ensure tactics are data-backed, cite relevant case studies, maintain factual non-hyped tone.
Apply Content Structure thesis: Keep descriptions concise (50-75 words), use clear lists, start with direct answers.

Only respond with a JSON array of campaign objects, e.g.:
[{
  "title": "Campaign Name",
  "tldr": "2-3 sentence executive summary",
  "objective": "Specific measurable objective",
  "channel": "Primary channel",
  "tactics": "Numbered or bulleted tactics following structure thesis",
  "kpis": "Specific metrics with timeframes",
  "tools": "Tool recommendations with rationale",
  "expectedImpact": "Specific percentage or metric improvement"
}]`;
                                                          
}
