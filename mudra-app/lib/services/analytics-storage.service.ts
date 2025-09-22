import type { DirectGEOResult } from './direct-geo-analysis.service';

// Simple in-memory storage for GEO analysis results
// In production, this would be saved to a database
class AnalyticsStorage {
  private results: Map<string, DirectGEOResult[]> = new Map();

  saveAnalysis(brandName: string, result: DirectGEOResult) {
    const existing = this.results.get(brandName) || [];
    existing.push(result);
    
    // Keep only the last 10 analyses per brand
    if (existing.length > 10) {
      existing.splice(0, existing.length - 10);
    }
    
    this.results.set(brandName, existing);
    
    // Also save to localStorage for persistence across sessions
    try {
      localStorage.setItem(`geo_analysis_${brandName}`, JSON.stringify(existing));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  getLatestAnalysis(brandName: string): DirectGEOResult | null {
    // Try to load from localStorage first
    try {
      const stored = localStorage.getItem(`geo_analysis_${brandName}`);
      if (stored) {
        const parsed = JSON.parse(stored) as DirectGEOResult[];
        if (parsed.length > 0) {
          this.results.set(brandName, parsed);
          return parsed[parsed.length - 1];
        }
      }
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
    }

    const analyses = this.results.get(brandName);
    return analyses && analyses.length > 0 ? analyses[analyses.length - 1] : null;
  }

  getAllAnalyses(brandName: string): DirectGEOResult[] {
    // Try to load from localStorage first
    try {
      const stored = localStorage.getItem(`geo_analysis_${brandName}`);
      if (stored) {
        const parsed = JSON.parse(stored) as DirectGEOResult[];
        this.results.set(brandName, parsed);
        return parsed;
      }
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
    }

    return this.results.get(brandName) || [];
  }

  getAnalysisHistory(brandName: string, limit: number = 5): DirectGEOResult[] {
    const analyses = this.getAllAnalyses(brandName);
    return analyses.slice(-limit).reverse(); // Latest first
  }

  // Get analytics summary for dashboard
  getAnalyticsSummary(brandName: string) {
    const analyses = this.getAllAnalyses(brandName);
    
    if (analyses.length === 0) {
      return null;
    }

    const latest = analyses[analyses.length - 1];
    const previous = analyses.length > 1 ? analyses[analyses.length - 2] : null;
    
    // Calculate trends
    const scoreChange = previous ? latest.overallScore - previous.overallScore : 0;
    const avgMentionRate = latest.analyses.reduce((sum, a) => sum + a.mentionRate, 0) / latest.analyses.length;
    
    return {
      latestScore: latest.overallScore,
      scoreChange,
      mentionRate: Math.round(avgMentionRate * 100),
      providersCount: latest.analyses.length,
      lastUpdated: latest.timestamp,
      trend: scoreChange > 0 ? 'up' : scoreChange < 0 ? 'down' : 'stable',
    };
  }
}

// Export singleton instance
export const analyticsStorage = new AnalyticsStorage();
