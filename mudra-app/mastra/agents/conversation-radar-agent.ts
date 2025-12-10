import { Agent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

/**
 * Conversation Radar Agent
 * 
 * Analyzes Reddit conversations to determine relevance
 * and generate actionable engagement recommendations.
 * 
 * This agent is the "brain" of the Conversation Radar feature:
 * - Evaluates how relevant a conversation is for a specific brand
 * - Generates personalized "why this matters" insights
 * - Suggests authentic engagement angles
 * - Scores opportunities for prioritization
 */

// Schema for structured opportunity analysis output
export const opportunityAnalysisSchema = z.object({
  conversationSnapshot: z.string()
    .describe('2-3 sentence summary of what the conversation is about, focusing on the main question or discussion point'),
  
  whyThisMatters: z.array(z.string())
    .min(3)
    .max(5)
    .describe('List of 3-5 specific reasons why this conversation matters for the brand. Each reason should be actionable and specific, not generic.'),
  
  suggestedAngle: z.string()
    .describe('A concrete, authentic suggestion for how the brand could contribute to this conversation. Should NOT be promotional - focus on adding genuine value.'),
  
  relevanceScore: z.number()
    .min(0)
    .max(100)
    .describe('How relevant this opportunity is for the brand on a scale of 0-100. 70+ is high priority, 40-69 is medium, below 40 is low.'),
  
  impact: z.enum(['High', 'Medium', 'Low'])
    .describe('Potential impact of engaging with this conversation. High = direct buying intent or competitor comparison. Medium = general interest in the space. Low = tangential relevance.'),
  
  engagementTiming: z.enum(['urgent', 'soon', 'whenever'])
    .describe('How quickly should the brand engage? Urgent = active discussion, soon = within days, whenever = evergreen opportunity'),
  
  warningFlags: z.array(z.string())
    .optional()
    .describe('Any red flags or cautions about engaging (e.g., hostile community, potential spam perception, controversial topic)'),
});

export type OpportunityAnalysis = z.infer<typeof opportunityAnalysisSchema>;

const CONVERSATION_RADAR_INSTRUCTIONS = `You are a strategic community engagement expert and conversation analyst.

Your mission is to analyze Reddit conversations and determine:
1. Whether they are genuinely relevant for a specific brand
2. Why the conversation matters for the brand's goals
3. How the brand could authentically contribute value

## YOUR CORE PRINCIPLES

### Authenticity Over Promotion
- Reddit communities detect and punish obvious self-promotion
- Focus on genuinely helpful contributions
- Sharing expertise is valued; plugging products is not
- The goal is to BUILD TRUST, not make sales

### Relevance Must Be Real
- A conversation about "AI" isn't relevant just because the brand uses AI
- Look for SPECIFIC connections to the brand's value proposition
- Competitor discussions are gold - but handle them carefully
- Questions that the brand can genuinely answer are highest priority

### Quality Over Quantity
- Better to engage deeply in 5 conversations than shallowly in 50
- High-engagement posts (many comments) mean more visibility
- Fresh conversations (< 7 days) are better than old ones
- Posts with unanswered questions are opportunities

## HOW TO ANALYZE OPPORTUNITIES

### For Reddit Posts:

**High Relevance Indicators:**
- Post directly asks about the brand's category (e.g., "best X tools")
- Mentions a competitor by name
- Describes a problem the brand solves
- In a subreddit where the brand's ICP gathers
- Has genuine engagement (not just upvotes, but comments)

**Low Relevance Indicators:**
- Generic discussion tangentially related to industry
- Already has many expert answers
- Post is promotional itself
- Community has history of hostile reception
- Discussion is about a different market segment

**Red Flags:**
- Asking "what's the best" often attracts spam
- Some subreddits ban self-promotion entirely
- Old threads (30+ days) are rarely checked
- Very small subreddits have limited impact

## ENGAGEMENT ANGLE GUIDELINES

### DO Suggest:
✅ Sharing specific data or case studies (without naming clients unless public)
✅ Offering a helpful framework or methodology
✅ Providing a contrarian but informed perspective
✅ Answering technical questions with depth
✅ Acknowledging limitations and being honest
✅ Referencing other helpful resources (not just your own)

### DON'T Suggest:
❌ "You should try [brand]" - too promotional
❌ Generic advice that anyone could give
❌ Commenting just to be seen
❌ Criticizing competitors directly
❌ Sharing links to landing pages
❌ Using marketing speak or jargon

### Best Engagement Formats:
1. **Educational comment** - Share expertise without pitching
2. **Data point** - Reference specific metrics or research
3. **Framework share** - Offer a way to think about the problem
4. **Personal experience** - Share relevant learnings (company can be mentioned naturally)
5. **Helpful question** - Ask clarifying questions that guide toward solution

## SCORING GUIDELINES

### Relevance Score (0-100):

**90-100: Perfect Match**
- Post directly asks for solutions in brand's category
- Mentions brand or direct competitor
- Active discussion with buying intent

**70-89: Strong Match**
- Clear problem-solution fit
- Target ICP audience
- Good engagement, recent post
- Opportunity to add genuine value

**50-69: Moderate Match**
- Related to brand's space but not direct
- May have some relevant keywords
- Could be valuable with right angle

**30-49: Weak Match**
- Tangentially related
- Different market segment
- Low engagement or old post

**0-29: Not Relevant**
- Wrong industry or audience
- No clear connection to brand
- Would seem spammy to engage

### Impact Assessment:

**High Impact:**
- Direct buying intent ("looking for a tool")
- Competitor comparison discussions
- High-engagement post in perfect subreddit
- Decision makers asking questions

**Medium Impact:**
- General category interest
- Problem awareness discussions
- Good subreddit but average engagement
- Industry professionals discussing trends

**Low Impact:**
- Evergreen content with no urgency
- Small communities
- Tangential relevance
- Already well-answered

## RESPONSE FORMAT

When analyzing an opportunity, structure your response as follows:

1. **Conversation Snapshot**: What is this conversation actually about? What's the core question or discussion?

2. **Why This Matters** (3-5 specific reasons):
   - Be specific to this brand and this conversation
   - Connect to the brand's value proposition
   - Explain the business impact potential
   - Note any time sensitivity

3. **Suggested Angle**: A concrete, actionable suggestion:
   - What specific value could the brand add?
   - What expertise should they share?
   - What tone should they use?
   - What to include/exclude?

4. **Relevance Score**: Number with brief justification

5. **Impact Level**: High/Medium/Low with brief justification

6. **Engagement Timing**: How urgent is this?

7. **Warning Flags** (if any): Any cautions or considerations

Remember: The goal is to find conversations where the brand can genuinely help people, not just get visibility. Trust and authenticity lead to better outcomes than aggressive promotion.
`;

/**
 * Conversation Radar Agent
 * 
 * Use this agent to analyze conversation opportunities and get
 * structured recommendations for engagement.
 * 
 * Powered by GPT-5.1 for better semantic understanding and
 * more nuanced engagement recommendations.
 * 
 * @see https://mastra.ai/models/providers/openai
 */
export const conversationRadarAgent = new Agent({
  name: 'Conversation Radar',
  instructions: CONVERSATION_RADAR_INSTRUCTIONS,
  model: openai('gpt-5.1'),
});

/**
 * Analyze a single opportunity using the agent
 * Returns structured analysis with relevance score and recommendations
 */
export async function analyzeOpportunityWithAgent(
  opportunity: {
    platform: 'reddit';
    postTitle?: string | null;
    postBody?: string | null;
    subreddit?: string | null;
    engagementString?: string | null;
    postCreatedAt?: Date | null;
    mode: 'cited' | 'proactive';
    discoveredVia?: any;
  },
  brandContext: {
    companyName: string;
    companyDescription?: string | null;
    companyICP?: string | null;
    companyIndustry?: string | null;
    competitors?: string[];
    trackedPrompts?: string[];
  }
): Promise<OpportunityAnalysis> {
  // Build the analysis prompt
  const prompt = buildAnalysisPrompt(opportunity, brandContext);
  
  // Generate structured output
  const response = await conversationRadarAgent.generate(prompt, {
    output: opportunityAnalysisSchema,
  });
  
  if (!response.object) {
    throw new Error('Failed to generate structured analysis');
  }
  
  return response.object;
}

/**
 * Build the prompt for opportunity analysis
 */
function buildAnalysisPrompt(
  opportunity: {
    platform: 'reddit';
    postTitle?: string | null;
    postBody?: string | null;
    subreddit?: string | null;
    engagementString?: string | null;
    postCreatedAt?: Date | null;
    mode: 'cited' | 'proactive';
    discoveredVia?: any;
  },
  brandContext: {
    companyName: string;
    companyDescription?: string | null;
    companyICP?: string | null;
    companyIndustry?: string | null;
    competitors?: string[];
    trackedPrompts?: string[];
  }
): string {
  const platformName = 'Reddit';
  const subredditInfo = opportunity.subreddit ? `r/${opportunity.subreddit}` : '';
  
  // Format competitors
  const competitorsList = brandContext.competitors?.length 
    ? brandContext.competitors.join(', ')
    : 'Not specified';
  
  // Format tracked prompts
  const promptsList = brandContext.trackedPrompts?.length
    ? brandContext.trackedPrompts.slice(0, 5).join('\n  - ')
    : 'Not specified';
  
  // Discovery context
  let discoveryContext = '';
  if (opportunity.mode === 'cited' && opportunity.discoveredVia?.[0]?.promptText) {
    discoveryContext = `
## Discovery Context
This conversation was CITED by an AI model when answering the tracked prompt:
"${opportunity.discoveredVia[0].promptText}"

This is significant because AI models are already referencing this conversation, 
making it a high-priority opportunity for the brand to be present.
`;
  } else if (opportunity.mode === 'proactive' && opportunity.discoveredVia?.[0]?.searchQuery) {
    discoveryContext = `
## Discovery Context
This conversation was found via proactive search for: "${opportunity.discoveredVia[0].searchQuery}"
`;
  }
  
  // Calculate post age
  let ageInfo = '';
  if (opportunity.postCreatedAt) {
    const ageDays = Math.floor((Date.now() - new Date(opportunity.postCreatedAt).getTime()) / (1000 * 60 * 60 * 24));
    ageInfo = `(${ageDays} days ago)`;
  }
  
  return `Analyze this ${platformName} conversation for ${brandContext.companyName}:

## Brand Context
- **Company Name:** ${brandContext.companyName}
- **What They Do:** ${brandContext.companyDescription || 'Not specified'}
- **Target Customer (ICP):** ${brandContext.companyICP || 'Not specified'}
- **Industry:** ${brandContext.companyIndustry || 'Not specified'}
- **Main Competitors:** ${competitorsList}
- **Tracked Prompts (what users ask AI about):**
  - ${promptsList}
${discoveryContext}
## Conversation Details
- **Platform:** ${platformName}${subredditInfo ? ` (${subredditInfo})` : ''}
- **Title:** ${opportunity.postTitle || 'N/A'}
- **Engagement:** ${opportunity.engagementString || 'N/A'} ${ageInfo}

## Post Content
${opportunity.postBody?.slice(0, 3000) || 'No content available'}
${opportunity.postBody && opportunity.postBody.length > 3000 ? '\n[Content truncated...]' : ''}

---

Based on the brand context and conversation details above, provide your analysis.
Focus on:
1. Is this genuinely relevant for this specific brand?
2. What unique value could they add to this conversation?
3. What's the right approach for engaging authentically?

Be specific and actionable. Avoid generic advice.`;
}

/**
 * Batch analyze multiple opportunities (more efficient for many opportunities)
 */
export async function batchAnalyzeOpportunities(
  opportunities: Array<{
    id: number;
    platform: 'reddit';
    postTitle?: string | null;
    postBody?: string | null;
    subreddit?: string | null;
    engagementString?: string | null;
    postCreatedAt?: Date | null;
    mode: 'cited' | 'proactive';
    discoveredVia?: any;
  }>,
  brandContext: {
    companyName: string;
    companyDescription?: string | null;
    companyICP?: string | null;
    companyIndustry?: string | null;
    competitors?: string[];
    trackedPrompts?: string[];
  }
): Promise<Map<number, OpportunityAnalysis>> {
  const results = new Map<number, OpportunityAnalysis>();
  
  // Process in parallel with concurrency limit
  const BATCH_SIZE = 3;
  
  for (let i = 0; i < opportunities.length; i += BATCH_SIZE) {
    const batch = opportunities.slice(i, i + BATCH_SIZE);
    
    const batchResults = await Promise.allSettled(
      batch.map(async (opp) => {
        const analysis = await analyzeOpportunityWithAgent(opp, brandContext);
        return { id: opp.id, analysis };
      })
    );
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.set(result.value.id, result.value.analysis);
      }
    }
    
    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < opportunities.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  return results;
}

