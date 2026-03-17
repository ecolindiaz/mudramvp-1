/**
 * Visibility Scoring Service
 *
 * Implements mention rate scoring methodology:
 * 1. Aggregate Score: Overall brand mention rate across all prompts (0-100%)
 * 2. Per-Prompt Score: Individual prompt mention (100 if mentioned, 0 if not)
 * 3. Weighted Score: Intent-based scoring with category weights
 *
 * Mention Rate Formula:
 * - Mentioned = 100, Not mentioned = 0
 * - Average = mention rate × 100 (i.e., percentage of chats mentioning the brand)
 * - Position is tracked as a separate metric
 *
 * Intent Weights (as per spec):
 * - Organic: 40%
 * - Generic: 10%
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
  overallScore: number;           // 0-100 (mention rate percentage)
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
  visibilityScore: number;        // 0 or 100 (mention rate: 100 if mentioned, 0 if not)
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
  'Organic': 0.40,           // 40%
  'Generic': 0.10,           // 10%
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
    generic: tests.filter(t => t.promptCategory?.toLowerCase() === 'generic'),
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
    generic: calculateCategoryScore(categories.generic),
    competitor: calculateCategoryScore(categories.competitor),
    howTo: calculateCategoryScore(categories.howTo),
    brandSpecific: calculateCategoryScore(categories.brandSpecific),
  };

  // Apply weights and calculate overall weighted score
  const weightedScore =
    categoryScores.organic.score * INTENT_WEIGHTS['Organic'] +
    categoryScores.generic.score * INTENT_WEIGHTS['Generic'] +
    categoryScores.competitor.score * INTENT_WEIGHTS['Competitor'] +
    categoryScores.howTo.score * INTENT_WEIGHTS['How-to Guides'] +
    categoryScores.brandSpecific.score * INTENT_WEIGHTS['Brand-Specific'];

  // Merge generic into organic breakdown for backward compatibility
  const organicTotal = categoryScores.organic.total + categoryScores.generic.total;
  const organicMentions = categoryScores.organic.mentions + categoryScores.generic.mentions;
  const organicCombinedScore = organicTotal > 0
    ? Math.round(
        (categoryScores.organic.score * categoryScores.organic.total +
         categoryScores.generic.score * categoryScores.generic.total) / organicTotal
      )
    : 0;

  return {
    weightedScore: Math.round(weightedScore),
    categoryBreakdown: {
      organic: { score: organicCombinedScore, mentions: organicMentions, total: organicTotal },
      competitor: categoryScores.competitor,
      howTo: categoryScores.howTo,
      brandSpecific: categoryScores.brandSpecific,
    },
  };
}

/**
 * Calculate score for a specific category using mention rate.
 * Score = (mentions / total) * 100
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
  const score = Math.round((mentions / categoryTests.length) * 100);

  return { score, mentions, total: categoryTests.length };
}

/**
 * Calculate aggregate visibility score using mention rate methodology.
 * Formula: avg(per-test mention scores) where each test = 100 if mentioned, 0 if not.
 * Result equals mentionRate × 100 (i.e., percentage of chats mentioning the brand).
 *
 * Also calculates weighted score using intent category weights.
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

  // Calculate visibility score using mention rate
  // Each test: 100 if mentioned, 0 if not → average = mentionRate × 100
  const mentionScores = tests.map(t => t.brandMentioned ? 100 : 0);
  const overallScore = mentionScores.length > 0
    ? mentionScores.reduce((a, b) => a + b, 0) / mentionScores.length
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
 * Calculate per-prompt visibility score using mention rate.
 * Score: 100 if mentioned, 0 if not. Position is tracked separately.
 *
 * @param test - Single prompt test result
 * @returns Per-prompt visibility score
 */
export function calculatePerPromptScore(test: PromptTestResult): PerPromptScore {
  const visibilityScore = test.brandMentioned ? 100 : 0;

  const pos = test.brandPosition;
  const position = (pos !== undefined && pos !== null && pos > 0) ? pos : null;

  return {
    promptId: '', // Will be set by caller
    promptText: test.prompt,
    visibilityScore,
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
 * Get visibility score tier/label for display.
 * Thresholds calibrated for mention rate scale (0-100%).
 */
export function getScoreTier(score: number): {
  label: string;
  color: string;
  description: string;
} {
  if (score >= 60) {
    return {
      label: 'Excellent',
      color: 'green',
      description: 'Strong AI mention rate across platforms',
    };
  } else if (score >= 40) {
    return {
      label: 'Good',
      color: 'blue',
      description: 'Solid AI mention rate, competitive presence',
    };
  } else if (score >= 20) {
    return {
      label: 'Fair',
      color: 'yellow',
      description: 'Moderate AI mention rate, room for improvement',
    };
  } else if (score >= 10) {
    return {
      label: 'Poor',
      color: 'orange',
      description: 'Low AI mention rate, needs optimization',
    };
  } else {
    return {
      label: 'Very Poor',
      color: 'red',
      description: 'Minimal AI mention rate, urgent action needed',
    };
  }
}
