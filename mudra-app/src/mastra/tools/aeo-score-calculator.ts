import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * AEO Score Calculator Tool
 * Calculates comprehensive AEO/GEO score (0-100) based on multiple factors
 * Scoring breakdown:
 * - Schema markup: 20 points
 * - FAQ sections: 15 points
 * - Header structure: 15 points
 * - Lists/tables: 20 points
 * - Citations: 10 points
 * - Meta descriptions: 10 points
 * - Author info: 10 points
 */
export const calculateAeoScoreTool = createTool({
  id: 'calculate_aeo_score',
  description: `
    Calculates a comprehensive AEO (Answer Engine Optimization) score from 0-100.
    Takes analysis results and weights each factor according to AI citation importance.
    Returns detailed scoring breakdown with specific recommendations to improve score.
  `,
  inputSchema: z.object({
    analysisData: z.object({
      schemaScore: z.number().min(0).max(20),
      headerScore: z.number().min(0).max(15),
      faqScore: z.number().min(0).max(15),
      contentStructureScore: z.number().min(0).max(20),
      citationsScore: z.number().min(0).max(10),
      metaScore: z.number().min(0).max(10),
      authorityScore: z.number().min(0).max(10),
    }),
  }),
  outputSchema: z.object({
    totalScore: z.number().min(0).max(100),
    grade: z.enum(['A+', 'A', 'B', 'C', 'D', 'F']),
    categoryScores: z.array(z.object({
      category: z.string(),
      score: z.number(),
      maxScore: z.number(),
      percentage: z.number(),
      status: z.enum(['excellent', 'good', 'needs-improvement', 'critical']),
    })),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    priorityActions: z.array(z.object({
      action: z.string(),
      impact: z.string(),
      effort: z.enum(['low', 'medium', 'high']),
      scoreGain: z.number(),
    })),
    citationProbability: z.number().min(0).max(100).describe('Estimated probability of AI citation'),
    benchmarkComparison: z.object({
      industryAverage: z.number(),
      topPerformers: z.number(),
      yourScore: z.number(),
      percentile: z.number(),
    }),
  }),
  execute: async (inputData) => {
    const { analysisData } = inputData;
    
    // Calculate total score
    const totalScore = 
      analysisData.schemaScore +
      analysisData.headerScore +
      analysisData.faqScore +
      analysisData.contentStructureScore +               
      analysisData.citationsScore +
      analysisData.metaScore +
      analysisData.authorityScore;
    
    // Determine grade
    let grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
    if (totalScore >= 95) grade = 'A+';
    else if (totalScore >= 85) grade = 'A';
    else if (totalScore >= 70) grade = 'B';
    else if (totalScore >= 55) grade = 'C';
    else if (totalScore >= 40) grade = 'D';
    else grade = 'F';
    
    // Build category scores
    const categories = [
      { name: 'Schema Markup', score: analysisData.schemaScore, max: 20 },
      { name: 'FAQ Sections', score: analysisData.faqScore, max: 15 },
      { name: 'Header Structure', score: analysisData.headerScore, max: 15 },
      { name: 'Content Structure (Lists/Tables)', score: analysisData.contentStructureScore, max: 20 },
      { name: 'Citations & Statistics', score: analysisData.citationsScore, max: 10 },
      { name: 'Meta Descriptions', score: analysisData.metaScore, max: 10 },
      { name: 'Author Authority', score: analysisData.authorityScore, max: 10 },
    ];
    
    const categoryScores = categories.map(cat => {
      const percentage = (cat.score / cat.max) * 100;
      let status: 'excellent' | 'good' | 'needs-improvement' | 'critical';
      
      if (percentage >= 90) status = 'excellent';
      else if (percentage >= 70) status = 'good';
      else if (percentage >= 50) status = 'needs-improvement';
      else status = 'critical';
      
      return {
        category: cat.name,
        score: cat.score,
        maxScore: cat.max,
        percentage: Math.round(percentage),
        status,
      };
    });
    
    // Identify strengths (>80%)
    const strengths = categoryScores
      .filter(cat => cat.percentage >= 80)
      .map(cat => `${cat.category}: ${cat.percentage}% complete - Strong foundation for AI citations`);
    
    // Identify weaknesses (<60%)
    const weaknesses = categoryScores
      .filter(cat => cat.percentage < 60)
      .map(cat => `${cat.category}: Only ${cat.percentage}% - Missing critical optimization opportunities`);
    
    // Generate priority actions based on lowest scores
    const priorityActions = [];
    
    if (analysisData.schemaScore < 15) {
      priorityActions.push({
        action: 'Add FAQ, Article, and HowTo schema markup',
        impact: 'Schema is the #1 factor for AI citations. Can increase visibility by 300%',
        effort: 'medium' as const,
        scoreGain: 15,
      });
    }
    
    if (analysisData.faqScore < 10) {
      priorityActions.push({
        action: 'Create dedicated FAQ section with 8-10 common questions',
        impact: 'FAQ content is cited 3x more often by ChatGPT and Claude',
        effort: 'low' as const,
        scoreGain: 12,
      });
    }
    
    if (analysisData.headerScore < 10) {
      priorityActions.push({
        action: 'Convert headers to question format (What/How/Why)',
        impact: 'Question-based headers match user search intent directly',
        effort: 'low' as const,
        scoreGain: 10,
      });
    }
    
    if (analysisData.contentStructureScore < 15) {
      priorityActions.push({
        action: 'Add bulleted lists and comparison tables',
        impact: 'Lists are 40% more likely to be cited. Tables double citation rate.',
        effort: 'low' as const,
        scoreGain: 15,
      });
    }
    
    if (analysisData.citationsScore < 7) {
      priorityActions.push({
        action: 'Add 5-7 statistics with authoritative sources',
        impact: 'AI systems prioritize content with verifiable data',
        effort: 'medium' as const,
        scoreGain: 8,
      });
    }
    
    if (analysisData.authorityScore < 7) {
      priorityActions.push({
        action: 'Add author bio with credentials and expertise',
        impact: 'Content with author credentials is 50% more likely to be cited',
        effort: 'low' as const,
        scoreGain: 7,
      });
    }
    
    // Sort by impact (score gain)
    priorityActions.sort((a, b) => b.scoreGain - a.scoreGain);
    
    // Calculate citation probability (non-linear relationship)
    // Score of 90+ = 85% probability
    // Score of 70-89 = 60% probability
    // Score of 50-69 = 35% probability
    // Score <50 = 15% probability
    let citationProbability: number;
    if (totalScore >= 90) citationProbability = 85;
    else if (totalScore >= 70) citationProbability = 60;
    else if (totalScore >= 50) citationProbability = 35;
    else citationProbability = 15;
    
    // Benchmark comparison (simulated industry data)
    const benchmarkComparison = {
      industryAverage: 58,
      topPerformers: 87,
      yourScore: totalScore,
      percentile: Math.min(100, Math.round((totalScore / 100) * 100)),
    };
    
    return {
      totalScore,
      grade,
      categoryScores,
      strengths,
      weaknesses,
      priorityActions: priorityActions.slice(0, 5), // Top 5 actions
      citationProbability,
      benchmarkComparison,
    };
  },
});
