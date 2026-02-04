/**
 * Five-Dimension Scoring Utilities
 * 
 * Provides scoring grade calculations and dimension display names
 * for the five-dimension technical structure scoring system:
 * 1. Structured Data
 * 2. Semantic HTML
 * 3. Citability
 * 4. Accessibility
 * 5. Answer Engine Optimization
 */

export interface ScoreGrade {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  label: string;
  color: string;
}

/**
 * Convert a numeric score (0-100) to a letter grade
 */
export function getScoreGrade(score: number): ScoreGrade {
  if (score >= 90) {
    return { grade: 'A', label: 'Excellent', color: 'green' };
  } else if (score >= 80) {
    return { grade: 'B', label: 'Good', color: 'blue' };
  } else if (score >= 70) {
    return { grade: 'C', label: 'Fair', color: 'yellow' };
  } else if (score >= 60) {
    return { grade: 'D', label: 'Poor', color: 'orange' };
  } else {
    return { grade: 'F', label: 'Critical', color: 'red' };
  }
}

/**
 * Get display name for a dimension key
 */
export function getDimensionDisplayName(
  dimension: 'structuredData' | 'semanticHtml' | 'citability' | 'accessibility' | 'answerEngine'
): string {
  const displayNames: Record<string, string> = {
    structuredData: 'Structured Data',
    semanticHtml: 'Semantic HTML',
    citability: 'Citability',
    accessibility: 'Accessibility',
    answerEngine: 'Answer Engine Optimization',
  };
  
  return displayNames[dimension] || dimension;
}

/**
 * Calculate overall score from dimension scores
 */
export function calculateOverallScore(dimensions: {
  structuredData: number;
  semanticHtml: number;
  citability: number;
  accessibility: number;
  answerEngine: number;
}): number {
  const weights = {
    structuredData: 0.25,
    semanticHtml: 0.20,
    citability: 0.25,
    accessibility: 0.15,
    answerEngine: 0.15,
  };
  
  return Math.round(
    dimensions.structuredData * weights.structuredData +
    dimensions.semanticHtml * weights.semanticHtml +
    dimensions.citability * weights.citability +
    dimensions.accessibility * weights.accessibility +
    dimensions.answerEngine * weights.answerEngine
  );
}
