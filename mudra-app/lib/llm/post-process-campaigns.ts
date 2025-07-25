// 5. Post-Processing (Optional Enhancements)
// This utility can classify, score, and prioritize campaign ideas from the LLM.

export type Campaign = {
  title?: string;
  objective?: string;
  description?: string;
  channel?: string;
  [key: string]: any;
};

type Effort = 'light' | 'medium' | 'heavy';
type Priority = 'short-term' | 'medium-term' | 'long-term';
type CampaignType = 'SEO' | 'Social' | 'AI Visibility' | 'Content' | 'General';

/**
 * Classifies campaign type based on keywords in the campaign object.
 */
function classifyType(campaign: Campaign): CampaignType {
  const text = `${campaign.title || ''} ${campaign.objective || ''} ${campaign.description || ''}`.toLowerCase();
  if (text.includes('seo')) return 'SEO';
  if (text.includes('social') || text.includes('twitter') || text.includes('linkedin')) return 'Social';
  if (text.includes('ai')) return 'AI Visibility';
  if (text.includes('content')) return 'Content';
  return 'General';
}

/**
 * Scores effort based on presence of certain words or length of description.
 */
function scoreEffort(campaign: Campaign): Effort {
  const desc = campaign.description || '';
  if (desc.length < 100) return 'light';
  if (desc.length < 250) return 'medium';
  return 'heavy';
}

/**
 * Suggests priority based on effort and type.
 */
function suggestPriority(type: CampaignType, effort: Effort): Priority {
  if (type === 'SEO' && effort === 'heavy') return 'long-term';
  if (type === 'Social' && effort === 'light') return 'short-term';
  if (effort === 'light') return 'short-term';
  return 'medium-term';
}

export function postProcessCampaigns(campaigns: Campaign[]): (Campaign & { type: CampaignType; effort: Effort; priority: Priority })[] {
  return campaigns.map((c) => {
    const type = classifyType(c);
    const effort = scoreEffort(c);
    const priority = suggestPriority(type, effort);
    return { ...c, type, effort, priority };
  });
}
