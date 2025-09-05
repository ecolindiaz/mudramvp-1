export const NOTABILITY = {
  maxItems: 6,
  // Default thresholds
  minRelative: 0.05, // 5%
  minAbsolute: 3, // 3 points when relative is not meaningful
  // Per-metric weights (used for ranking)
  weights: {
    visibilityScore: 1.0,
    technicalOverall: 1.0,
    tasksVerificationRate: 0.8,
    externalMentions: 0.6,
  },
  // Optional per-metric overrides
  overrides: {
    tasksVerificationRate: { minRelative: 0.1, minAbsolute: 0.05 }, // 10% rel or 5 points absolute in rate
  } as Record<string, { minRelative?: number; minAbsolute?: number }>,
} as const;


