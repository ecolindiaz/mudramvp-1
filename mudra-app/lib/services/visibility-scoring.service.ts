/**
 * Visibility Scoring Service
 *
 * Implements consistent Firegeo-style scoring methodology everywhere:
 * 1. Aggregate Score: Overall brand visibility across all prompts
 * 2. Per-Prompt Score: Individual prompt performance (now also uses Firegeo formula)
 * 3. Weighted Score: Intent-based scoring with category weights
 *
 * Firegeo Formula:
 * - Base 50 points for being mentioned
 * - Position bonus: 0-45 points (Position 1 = 45, Position 10 = 0)
 * - Not mentioned = 0 points
 *
 * Intent Weights (as per spec):
 * - Organic: 50%
 * - Competitor: 20%
 * - How-to: 20%
 * - Brand-Specific: 10%
 */

export interface PromptTestResult {
  prompt: string;
  promptCategory?: string; // Category for weighted scoring
  brandMentioned: boolean;
  brandPosition?: number | null;
  sentiment?: 'positive' | 'neutral' | 'negative' | null;
  confidence?: number;
  provider?: string;
  model?: string;
  competitors?: string[]; // Competitors mentioned in response
}

export interface AggregateVisibilityScore {
  overallScore: number;           // 0-100 (Firegeo formula)
  weightedScore: number;          // 0-100 (Intent-weighted score)
  mentionRate: number;            // 0-1 (percentage of prompts where brand mentioned)
  averagePosition: number;        // Average ranking across all mentions
  totalPrompts: number;
  totalMentions: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
    dominant: 'positive' | 'neutral' | 'negative';
  };
  categoryBreakdown?: {
    organic: { score: number; mentions: number; total: number };
    competitor: { score: number; mentions: number; total: number };
    howTo: { score: number; mentions: number; total: number };
    brandSpecific: { score: number; mentions: number; total: number };
  };
}

export interface PerPromptScore {
  promptId: string | number;
  promptText: string;
  visibilityScore: number;        // 0-100 (Mudra formula)
  position: number | null;
  brandMentioned: boolean;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  model: string | null;
  confidence: number;
}

/**
 * Intent category weights based on specification
 */
const INTENT_WEIGHTS = {
  'Organic': 0.50,           // 50%
  'Competitor': 0.20,        // 20%
  'How-to Guides': 0.20,     // 20%
  'Brand-Specific': 0.10,    // 10%
} as const;

/**
 * Calculate weighted score by intent category
 */
function calculateWeightedScore(tests: PromptTestResult[]): {
  weightedScore: number;
  categoryBreakdown: {
    organic: { score: number; mentions: number; total: number };
    competitor: { score: number; mentions: number; total: number };
    howTo: { score: number; mentions: number; total: number };
    brandSpecific: { score: number; mentions: number; total: number };
  };
} {
  // Group tests by category (case-insensitive)
  const categories = {
    organic: tests.filter(t => t.promptCategory?.toLowerCase() === 'organic'),
    competitor: tests.filter(t => t.promptCategory?.toLowerCase() === 'competitor'),
    howTo: tests.filter(t => {
      const cat = t.promptCategory?.toLowerCase();
      return cat === 'how-to guides' || cat === 'faq';
    }),
    brandSpecific: tests.filter(t => t.promptCategory?.toLowerCase() === 'brand-specific'),
  };

  // Calculate score for each category
  const categoryScores = {
    organic: calculateCategoryScore(categories.organic),
    competitor: calculateCategoryScore(categories.competitor),
    howTo: calculateCategoryScore(categories.howTo),
    brandSpecific: calculateCategoryScore(categories.brandSpecific),
  };

  // Apply weights and calculate overall weighted score
  const weightedScore = 
    categoryScores.organic.score * INTENT_WEIGHTS['Organic'] +
    categoryScores.competitor.score * INTENT_WEIGHTS['Competitor'] +
    categoryScores.howTo.score * INTENT_WEIGHTS['How-to Guides'] +
    categoryScores.brandSpecific.score * INTENT_WEIGHTS['Brand-Specific'];

  return {
    weightedScore: Math.round(weightedScore),
    categoryBreakdown: categoryScores,
  };
}

/**
 * Calculate score for a specific category
 * NEW: If brand is mentioned with NO competitors, score is 100% (ranking irrelevant)
 */
function calculateCategoryScore(categoryTests: PromptTestResult[]): {
  score: number;
  mentions: number;
  total: number;
} {
  if (categoryTests.length === 0) {
    return { score: 0, mentions: 0, total: 0 };
  }

  const mentions = categoryTests.filter(t => t.brandMentioned).length;
  const mentionRate = mentions / categoryTests.length;

  // NEW: Check for brand-only mentions (no competitors)
  // If brand mentioned with no competitors → 100% visibility for that test
  const brandOnlyTests = categoryTests.filter(t => 
    t.brandMentioned && 
    (!t.competitors || t.competitors.length === 0)
  );
  
  // Tests where brand competes with others
  const competitiveTests = categoryTests.filter(t =>
    t.brandMentioned && 
    t.competitors && 
    t.competitors.length > 0
  );
  
  // Calculate weighted average:
  // - Brand-only mentions get 100 points each
  // - Competitive mentions use position-based scoring
  
  let totalScore = 0;
  const mentionedTests = categoryTests.filter(t => t.brandMentioned);
  
  if (mentionedTests.length > 0) {
    // Brand-only tests: 100% each
    totalScore += brandOnlyTests.length * 100;
    
    // Competitive tests: position-based scoring
    if (competitiveTests.length > 0) {
      for (const test of competitiveTests) {
        if (test.brandPosition != null && test.brandPosition > 0) {
          // Position-based score: #1 = 100, #2 = 90, #3 = 80, etc.
          const positionScore = Math.max(0, 110 - (test.brandPosition * 10));
          totalScore += positionScore;
        } else {
          // Mentioned but no position → 50 points (mentioned, not ranked)
          totalScore += 50;
        }
      }
    }
    
    // Calculate final score as average across all mentioned tests
    // Also factor in non-mentions (they get 0)
    const avgMentionScore = totalScore / mentionedTests.length;
    const score = mentionRate * avgMentionScore;
    
    return {
      score: Math.round(score),
      mentions,
      total: categoryTests.length,
    };
  }

  // No mentions at all
  return {
    score: 0,
    mentions,
    total: categoryTests.length,
  };
}

/**
 * Calculate aggregate visibility score using Firegeo methodology
 * Formula: avg(per-test Firegeo scores) where each test = 0 or 50 + positionBonus
 * 
 * Also calculates weighted score using intent category weights
 * 
 * @param tests - Array of prompt test results
 * @returns Aggregate visibility metrics
 */
export function calculateAggregateScore(tests: PromptTestResult[]): AggregateVisibilityScore {
  const totalPrompts = tests.length;
  
  if (totalPrompts === 0) {
    return {
      overallScore: 0,
      weightedScore: 0,
      mentionRate: 0,
      averagePosition: 0,
      totalPrompts: 0,
      totalMentions: 0,
      sentiment: {
        positive: 0,
        neutral: 0,
        negative: 0,
        dominant: 'neutral',
      },
    };
  }

  // Calculate mention metrics
  const mentionedTests = tests.filter(t => t.brandMentioned);
  const totalMentions = mentionedTests.length;
  const mentionRate = totalMentions / totalPrompts;

  // Calculate average position (only for tests with position data)
  const rankedTests = mentionedTests.filter(t =>
    t.brandPosition !== undefined &&
    t.brandPosition !== null &&
    t.brandPosition > 0
  );

  const averagePosition = rankedTests.length > 0
    ? Math.round((rankedTests.reduce((sum, t) => sum + (t.brandPosition ?? 0), 0) / rankedTests.length) * 10) / 10
    : 0;

  // Calculate visibility score using per-test Firegeo average
  // Each test gets: 0 if not mentioned, 50 + positionBonus if mentioned
  // Then average across ALL tests (properly weights both mention rate and position)
  const firegeoScores = tests.map(t => {
    if (!t.brandMentioned) return 0;
    let score = 50;
    if (t.brandPosition !== undefined && t.brandPosition !== null && t.brandPosition > 0) {
      score += Math.max(0, (10 - t.brandPosition) / 10) * 50;
    }
    return Math.round(score);
  });
  const overallScore = firegeoScores.length > 0
    ? firegeoScores.reduce((a, b) => a + b, 0) / firegeoScores.length
    : 0;

  // Calculate weighted score by intent category
  const { weightedScore, categoryBreakdown } = calculateWeightedScore(tests);

  // Calculate sentiment distribution
  const sentimentCounts = {
    positive: tests.filter(t => t.sentiment === 'positive').length,
    neutral: tests.filter(t => t.sentiment === 'neutral').length,
    negative: tests.filter(t => t.sentiment === 'negative').length,
  };

  const dominantSentiment = Object.entries(sentimentCounts)
    .sort(([, a], [, b]) => b - a)[0][0] as 'positive' | 'neutral' | 'negative';

  return {
    overallScore: Math.round(overallScore),
    weightedScore,
    mentionRate,
    averagePosition: Math.round(averagePosition * 10) / 10, // Round to 1 decimal
    totalPrompts,
    totalMentions,
    sentiment: {
      ...sentimentCounts,
      dominant: dominantSentiment,
    },
    categoryBreakdown,
  };
}

/**
 * Calculate per-prompt visibility score using Firegeo methodology
 * Formula: Base 50 points for mention + position bonus (0-45 points based on position)
 *
 * Score Examples:
 * - Position 1, mentioned → 50 + 45 = 95
 * - Position 2, mentioned → 50 + 40 = 90
 * - Position 3, mentioned → 50 + 35 = 85
 * - Position 5, mentioned → 50 + 25 = 75
 * - Mentioned, no position → 50
 * - Not mentioned → 0
 *
 * @param test - Single prompt test result
 * @returns Per-prompt visibility score
 */
export function calculatePerPromptScore(test: PromptTestResult): PerPromptScore {
  let visibilityScore = 0;
  let position: number | null = null;

  if (test.brandMentioned) {
    // Base score: 50 points for being mentioned
    visibilityScore = 50;

    const pos = test.brandPosition;
    if (pos !== undefined && pos !== null && pos > 0) {
      position = pos;
      // Position bonus: 0-45 points based on position (Firegeo formula)
      // Position 1 = 45 points, Position 10 = 0 points
      const positionBonus = Math.max(0, (10 - pos) / 10) * 50;
      visibilityScore += positionBonus;
    }
    // If mentioned but no position: just the 50 points (same as before)
  }
  // Not mentioned: 0 points

  return {
    promptId: '', // Will be set by caller
    promptText: test.prompt,
    visibilityScore: Math.round(visibilityScore),
    position,
    brandMentioned: test.brandMentioned,
    sentiment: test.sentiment || null,
    model: test.provider || test.model || null,
    confidence: test.confidence || 0,
  };
}

/**
 * Calculate both aggregate and per-prompt scores from analysis results
 * 
 * @param tests - Array of prompt test results
 * @returns Object containing both scoring methodologies
 */
export function calculateAllScores(tests: PromptTestResult[]): {
  aggregate: AggregateVisibilityScore;
  perPrompt: PerPromptScore[];
} {
  const aggregate = calculateAggregateScore(tests);
  const perPrompt = tests.map(test => calculatePerPromptScore(test));

  return {
    aggregate,
    perPrompt,
  };
}

/**
 * Get visibility score tier/label for display
 */
export function getScoreTier(score: number): {
  label: string;
  color: string;
  description: string;
} {
  if (score >= 80) {
    return {
      label: 'Excellent',
      color: 'green',
      description: 'Strong AI visibility with top rankings',
    };
  } else if (score >= 60) {
    return {
      label: 'Good',
      color: 'blue',
      description: 'Solid AI visibility with competitive rankings',
    };
  } else if (score >= 40) {
    return {
      label: 'Fair',
      color: 'yellow',
      description: 'Moderate AI visibility, room for improvement',
    };
  } else if (score >= 20) {
    return {
      label: 'Poor',
      color: 'orange',
      description: 'Low AI visibility, needs optimization',
    };
  } else {
    return {
      label: 'Very Poor',
      color: 'red',
      description: 'Minimal AI visibility, urgent action needed',
    };
  }
}
