/**
 * Prompt Generator
 * Generates 100 AI visibility prompts based on brand information
 */

interface BrandInfo {
  name: string;
  description: string;
  industry: string;
  mainProducts?: string[];
  icp?: string; // Ideal Customer Profile
  competitors: string[];
}

interface GeneratedPrompt {
  text: string;
  category: string;
}

/**
 * Extract key value propositions from description
 */
function extractValueProps(description: string): string[] {
  const keywords = [];
  
  // Common patterns to extract
  if (description.toLowerCase().includes('funding')) keywords.push('funding');
  if (description.toLowerCase().includes('mentor')) keywords.push('mentorship');
  if (description.toLowerCase().includes('network')) keywords.push('networking');
  if (description.toLowerCase().includes('invest')) keywords.push('investment');
  if (description.toLowerCase().includes('accelerat')) keywords.push('acceleration');
  if (description.toLowerCase().includes('incubat')) keywords.push('incubation');
  if (description.toLowerCase().includes('startup')) keywords.push('startups');
  if (description.toLowerCase().includes('early-stage')) keywords.push('early-stage companies');
  if (description.toLowerCase().includes('scale')) keywords.push('scaling');
  if (description.toLowerCase().includes('growth')) keywords.push('growth');
  
  return keywords;
}

/**
 * Generate 100 prompts for AI visibility analysis
 */
export function generate100Prompts(brand: BrandInfo): GeneratedPrompt[] {
  const prompts: GeneratedPrompt[] = [];
  const { name, description, industry, mainProducts = [], icp, competitors } = brand;
  
  // Extract value propositions from description
  const valueProps = extractValueProps(description);

  // Category 1: Direct Brand Questions (10 prompts) - ONLY category mentioning brand name
  prompts.push(
    { text: `What is ${name}?`, category: 'direct-brand' },
    { text: `Tell me about ${name}`, category: 'direct-brand' },
    { text: `What does ${name} do?`, category: 'direct-brand' },
    { text: `Who is ${name}?`, category: 'direct-brand' },
    { text: `${name} overview`, category: 'direct-brand' },
    { text: `${name} reviews`, category: 'direct-brand' },
    { text: `Is ${name} good?`, category: 'direct-brand' },
    { text: `${name} alternatives`, category: 'direct-brand' },
    { text: `How does ${name} work?`, category: 'direct-brand' },
    { text: `${name} pricing`, category: 'direct-brand' }
  );

  // Category 2: Value Proposition Discovery (20 prompts) - Based on description
  // Extract needs from description and create prompts around them
  if (valueProps.includes('funding')) {
    prompts.push(
      { text: 'Where to get seed funding for startups', category: 'value-prop' },
      { text: 'Best seed funding options', category: 'value-prop' },
      { text: 'How to find startup funding', category: 'value-prop' },
      { text: 'Seed funding for tech companies', category: 'value-prop' }
    );
  }
  
  if (valueProps.includes('mentorship')) {
    prompts.push(
      { text: 'Where to find startup mentorship', category: 'value-prop' },
      { text: 'Best mentorship programs for startups', category: 'value-prop' },
      { text: 'Startup mentor network', category: 'value-prop' },
      { text: 'How to get business mentorship', category: 'value-prop' }
    );
  }
  
  if (valueProps.includes('networking')) {
    prompts.push(
      { text: 'Best networking opportunities for startups', category: 'value-prop' },
      { text: 'Startup networking events', category: 'value-prop' },
      { text: 'How to network with investors', category: 'value-prop' }
    );
  }
  
  if (valueProps.includes('acceleration')) {
    prompts.push(
      { text: 'Best startup accelerators', category: 'value-prop' },
      { text: 'Top accelerator programs', category: 'value-prop' },
      { text: 'Startup acceleration programs', category: 'value-prop' }
    );
  }
  
  // Generic value proposition prompts based on industry
  prompts.push(
    { text: `Best ${industry} solutions`, category: 'value-prop' },
    { text: `Top ${industry} providers`, category: 'value-prop' },
    { text: `How to find ${industry} services`, category: 'value-prop' },
    { text: `${industry} options for startups`, category: 'value-prop' },
    { text: `Where to get ${industry} help`, category: 'value-prop' }
  );
  
  // Product/Service Discovery (if products exist)
  if (mainProducts.length > 0) {
    mainProducts.slice(0, 3).forEach(product => {
      prompts.push(
        { text: `Best ${product} in ${new Date().getFullYear()}`, category: 'product-discovery' },
        { text: `Top ${product} providers`, category: 'product-discovery' },
        { text: `Where to find ${product}`, category: 'product-discovery' }
      );
    });
  }

  // Category 3: Industry Leadership (15 prompts) - NO brand name
  prompts.push(
    { text: `Best ${industry} companies in ${new Date().getFullYear()}`, category: 'industry' },
    { text: `Top ${industry} organizations`, category: 'industry' },
    { text: `Leading ${industry} providers`, category: 'industry' },
    { text: `Most innovative ${industry} companies`, category: 'industry' },
    { text: `${industry} industry leaders`, category: 'industry' },
    { text: `Best ${industry} programs`, category: 'industry' },
    { text: `Top rated ${industry} companies`, category: 'industry' },
    { text: `${industry} market leaders`, category: 'industry' },
    { text: `Who are the top ${industry} companies?`, category: 'industry' },
    { text: `Most trusted ${industry} organizations`, category: 'industry' },
    { text: `Best ${industry} services`, category: 'industry' },
    { text: `Top ${industry} platforms`, category: 'industry' },
    { text: `Leading ${industry} in ${new Date().getFullYear()}`, category: 'industry' },
    { text: `${industry} comparison`, category: 'industry' },
    { text: `Most reputable ${industry}`, category: 'industry' }
  );

  // Category 4: Competitor Context (10 prompts) - NO brand name, just competitors
  competitors.slice(0, 5).forEach(competitor => {
    prompts.push(
      { text: `${competitor} alternatives`, category: 'competitor' },
      { text: `Companies similar to ${competitor}`, category: 'competitor' }
    );
  });

  // Category 5: Problem Solving & Needs (15 prompts) - NO brand name
  prompts.push(
    { text: `How to ${description.toLowerCase().split(' ').slice(0, 5).join(' ')}`, category: 'problem-solving' },
    { text: `Where to find ${industry} support`, category: 'problem-solving' },
    { text: `Best way to ${industry.includes('startup') ? 'launch a startup' : 'grow business'}`, category: 'problem-solving' },
    { text: `${industry} resources`, category: 'problem-solving' },
    { text: `${industry} help for beginners`, category: 'problem-solving' },
    { text: `${industry} guidance`, category: 'problem-solving' },
    { text: `Getting started with ${industry}`, category: 'problem-solving' },
    { text: `${industry} support programs`, category: 'problem-solving' },
    { text: `${industry} assistance`, category: 'problem-solving' },
    { text: `How to access ${industry} resources`, category: 'problem-solving' },
    { text: `${industry} for beginners`, category: 'problem-solving' },
    { text: `${industry} step by step guide`, category: 'problem-solving' },
    { text: `Best ${industry} resources`, category: 'problem-solving' },
    { text: `${industry} recommendations`, category: 'problem-solving' },
    { text: `Where to start with ${industry}`, category: 'problem-solving' }
  );

  // Category 6: Target Audience Specific (15 prompts) - NO brand name
  if (icp) {
    prompts.push(
      { text: `Best ${industry} for ${icp}`, category: 'target-audience' },
      { text: `${industry} options for ${icp}`, category: 'target-audience' },
      { text: `Top ${industry} for ${icp}`, category: 'target-audience' },
      { text: `${icp} ${industry} recommendations`, category: 'target-audience' },
      { text: `${industry} programs for ${icp}`, category: 'target-audience' },
      { text: `${icp} guide to ${industry}`, category: 'target-audience' },
      { text: `${industry} resources for ${icp}`, category: 'target-audience' },
      { text: `What ${industry} should ${icp} choose?`, category: 'target-audience' },
      { text: `${icp} ${industry} guide`, category: 'target-audience' },
      { text: `Best ${industry} for ${icp}`, category: 'target-audience' },
      { text: `${icp} ${industry} options`, category: 'target-audience' },
      { text: `${industry} tailored for ${icp}`, category: 'target-audience' },
      { text: `${icp} looking for ${industry}`, category: 'target-audience' },
      { text: `${industry} specifically for ${icp}`, category: 'target-audience' },
      { text: `Top ${industry} choices for ${icp}`, category: 'target-audience' }
    );
  } else {
    // Generic audience prompts if no ICP provided
    prompts.push(
      { text: `${industry} for small businesses`, category: 'target-audience' },
      { text: `${industry} for enterprises`, category: 'target-audience' },
      { text: `${industry} for individuals`, category: 'target-audience' },
      { text: `${industry} for teams`, category: 'target-audience' },
      { text: `Best ${industry} for professionals`, category: 'target-audience' }
    );
  }

  // Category 7: Buying Intent & Evaluation (10 prompts) - NO brand name
  prompts.push(
    { text: `Where to find ${industry} services`, category: 'buying-intent' },
    { text: `${industry} pricing comparison`, category: 'buying-intent' },
    { text: `How much does ${industry} cost?`, category: 'buying-intent' },
    { text: `${industry} pricing guide`, category: 'buying-intent' },
    { text: `Is ${industry} worth it?`, category: 'buying-intent' },
    { text: `${industry} reviews and ratings`, category: 'buying-intent' },
    { text: `Best ${industry} value`, category: 'buying-intent' },
    { text: `Should I invest in ${industry}?`, category: 'buying-intent' },
    { text: `${industry} cost comparison`, category: 'buying-intent' },
    { text: `Affordable ${industry} options`, category: 'buying-intent' }
  );

  // Category 8: Features & Benefits (10 prompts) - NO brand name
  prompts.push(
    { text: `What to look for in ${industry}`, category: 'features' },
    { text: `${industry} features to consider`, category: 'features' },
    { text: `Key ${industry} capabilities`, category: 'features' },
    { text: `${industry} must-have features`, category: 'features' },
    { text: `How does ${industry} work?`, category: 'features' },
    { text: `${industry} benefits`, category: 'features' },
    { text: `What makes good ${industry}`, category: 'features' },
    { text: `${industry} advantages`, category: 'features' },
    { text: `Benefits of ${industry}`, category: 'features' },
    { text: `Why use ${industry}`, category: 'features' }
  );

  // Category 9: Quality & Trust Signals (10 prompts) - NO brand name
  prompts.push(
    { text: `Most reliable ${industry}`, category: 'trust' },
    { text: `Trustworthy ${industry} providers`, category: 'trust' },
    { text: `${industry} reputation rankings`, category: 'trust' },
    { text: `Best quality ${industry}`, category: 'trust' },
    { text: `Top rated ${industry}`, category: 'trust' },
    { text: `${industry} user reviews`, category: 'trust' },
    { text: `Highest quality ${industry}`, category: 'trust' },
    { text: `Most trusted ${industry}`, category: 'trust' },
    { text: `${industry} credibility`, category: 'trust' },
    { text: `${industry} satisfaction ratings`, category: 'trust' }
  );

  // Category 10: Contextual & Trending (10 prompts)
  const currentYear = new Date().getFullYear();
  prompts.push(
    { text: `Best ${industry} in ${currentYear}`, category: 'trending' },
    { text: `Top ${industry} companies ${currentYear}`, category: 'trending' },
    { text: `${industry} trends ${currentYear}`, category: 'trending' },
    { text: `Best ${industry} solutions ${currentYear}`, category: 'trending' },
    { text: `${industry} recommendations ${currentYear}`, category: 'trending' },
    { text: `Most popular ${industry} in ${currentYear}`, category: 'trending' },
    { text: `${currentYear} ${industry} guide`, category: 'trending' },
    { text: `Best new ${industry} companies`, category: 'trending' },
    { text: `Emerging ${industry} leaders`, category: 'trending' },
    { text: `${industry} innovations ${currentYear}`, category: 'trending' }
  );

  // Fill remaining slots to reach 100 prompts with variations
  while (prompts.length < 100) {
    const variations = [
      { text: `${name} vs competitors`, category: 'comparison' },
      { text: `Why use ${name}?`, category: 'value-prop' },
      { text: `${name} for businesses`, category: 'b2b' },
      { text: `${name} success stories`, category: 'social-proof' },
      { text: `Companies using ${name}`, category: 'social-proof' },
      { text: `${name} case studies`, category: 'social-proof' },
      { text: `${industry} best practices`, category: 'educational' },
      { text: `How to choose ${industry} solution`, category: 'educational' },
      { text: `${industry} buying guide`, category: 'educational' },
      { text: `${name} getting started`, category: 'onboarding' }
    ];
    
    const remaining = 100 - prompts.length;
    prompts.push(...variations.slice(0, remaining));
  }

  return prompts.slice(0, 100); // Ensure exactly 100 prompts
}

/**
 * Get prompts grouped by category
 */
export function getPromptsGroupedByCategory(brand: BrandInfo): Record<string, GeneratedPrompt[]> {
  const prompts = generate100Prompts(brand);
  
  return prompts.reduce((acc, prompt) => {
    if (!acc[prompt.category]) {
      acc[prompt.category] = [];
    }
    acc[prompt.category].push(prompt);
    return acc;
  }, {} as Record<string, GeneratedPrompt[]>);
}

/**
 * Get just the prompt texts (for backward compatibility)
 */
export function getPromptTexts(brand: BrandInfo): string[] {
  return generate100Prompts(brand).map(p => p.text);
}
