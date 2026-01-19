/**
 * Visibility Scoring Service
 * 
 * Implements two scoring methodologies:
 * 1. Aggregate Score (Firegeo-style): Overall brand visibility across all prompts
 * 2. Per-Prompt Score (Mudra-style): Individual prompt performance
 * 3. Weighted Score: Intent-based scoring with category weights
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
    howTo: tests.filter(t => t.promptCategory?.toLowerCase() === 'how-to guides'),
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

  // Position-based scoring for this category
  const rankedTests = categoryTests.filter(t => 
    t.brandMentioned && 
    t.brandPosition !== undefined && 
    t.brandPosition !== null && 
    t.brandPosition > 0
  );

  let positionBonus = 0;
  if (rankedTests.length > 0) {
    const avgPosition = rankedTests.reduce((sum, t) => sum + (t.brandPosition || 0), 0) / rankedTests.length;
    positionBonus = Math.max(0, (10 - avgPosition) / 10) * 50;
  }

  const score = mentionRate * 50 + positionBonus;

  return {
    score: Math.round(score),
    mentions,
    total: categoryTests.length,
  };
}

/**
 * Calculate aggregate visibility score using Firegeo methodology
 * Formula: mentionRate * 50 + positionBonus * 50
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
    ? Math.round((rankedTests.reduce((sum, t) => sum + (t.brandPosition || 0), 0) / rankedTests.length) * 10) / 10
    : 0;

  // Calculate visibility score using Firegeo formula
  let overallScore = mentionRate * 50; // Base score from mention rate (0-50)
  
  if (averagePosition > 0) {
    // Position bonus: better positions = higher score (0-50)
    // Position 1 = 45 points, Position 10 = 0 points
    const positionBonus = Math.max(0, (10 - averagePosition) / 10) * 50;
    overallScore += positionBonus;
  }

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
 * Calculate per-prompt visibility score using Mudra methodology
 * Formula: Position-based scoring with 10% decay per rank
 * 
 * @param test - Single prompt test result
 * @returns Per-prompt visibility score
 */
export function calculatePerPromptScore(test: PromptTestResult): PerPromptScore {
  let visibilityScore = 0;
  let position: number | null = null;

  if (test.brandMentioned) {
    const pos = test.brandPosition;
    
    if (pos !== undefined && pos !== null && pos > 0) {
      position = pos;
      // Position-based scoring: Position 1 = 100%, each rank down = -10%
      // Position 1 = 100%, Position 2 = 90%, Position 10 = 10%, Position 11+ = 0%
      visibilityScore = Math.max(0, 100 - (pos - 1) * 10);
    } else {
      // Mentioned but no position tracked
      visibilityScore = 50;
    }
  } else {
    // Not mentioned
    visibilityScore = 0;
  }

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
