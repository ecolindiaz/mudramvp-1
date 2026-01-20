/**
 * Unified Analysis Service
 * Provides consistent analysis functionality for both:
 * 1. Onboarding pipeline
 * 2. Dashboard "Analyze Website" button
 * 
 * Ensures both flows use the same logic for:
 * - DirectGEO AI Visibility Analysis
 * - Technical Structure Analysis
 * - Natural Language Report Generation
 */

import type { AnalysisPipelineConfig, AnalysisPipelineResult } from './analysis-pipeline.service';
import { prisma } from '@/lib/prisma';

export interface UnifiedAnalysisConfig {
  brandProfileId: number;
  brandName: string;
  website: string;
  description?: string;
  industry?: string;
  competitors?: string[];
  skipCooldown?: boolean; // For dashboard re-runs
  generateReport?: boolean; // Generate natural language report
}

export interface UnifiedAnalysisResult {
  success: boolean;
  geoAnalysisId?: number;
  technicalAnalysisId?: number;
  reportId?: number;
  error?: string;
  errorCode?: string;
  scores: {
    aiVisibility?: number;
    technical?: number;
    seo?: number;
    geo?: number;
  };
}

/**
 * Run complete unified analysis
 * Used by both onboarding and dashboard
 */
export async function runUnifiedAnalysis(
  config: UnifiedAnalysisConfig
): Promise<UnifiedAnalysisResult> {
  const result: UnifiedAnalysisResult = {
    success: false,
    scores: {},
  };

  try {
    console.log('[Unified Analysis] Starting for:', config.brandName);

    // Run GEO and Technical analyses in PARALLEL
    const [geoResult, technicalResult] = await Promise.allSettled([
      runGeoAnalysisCore(config),
      runTechnicalAnalysisCore(config),
    ]);

    // Process results and capture errors
    const errors: string[] = [];

    // Handle GEO analysis result
    if (geoResult.status === 'fulfilled' && geoResult.value.success) {
      result.geoAnalysisId = geoResult.value.id;
      result.scores.aiVisibility = geoResult.value.score;
      console.log('[Unified Analysis] GEO completed:', geoResult.value.score);
    } else if (geoResult.status === 'rejected') {
      const errorMsg = geoResult.reason instanceof Error 
        ? geoResult.reason.message 
        : String(geoResult.reason || 'GEO analysis failed');
      errors.push(`GEO Analysis: ${errorMsg}`);
      console.error('[Unified Analysis] GEO failed:', errorMsg);
    } else if (geoResult.status === 'fulfilled' && !geoResult.value.success) {
      const errorMsg = geoResult.value.error || 'GEO analysis returned unsuccessful';
      errors.push(`GEO Analysis: ${errorMsg}`);
      console.error('[Unified Analysis] GEO unsuccessful:', errorMsg);
    }

    // Handle Technical analysis result
    if (technicalResult.status === 'fulfilled' && technicalResult.value.success) {
      result.technicalAnalysisId = technicalResult.value.id;
      result.scores.technical = technicalResult.value.overallScore;
      result.scores.seo = technicalResult.value.seoScore;
      result.scores.geo = technicalResult.value.geoScore;
      console.log('[Unified Analysis] Technical completed:', technicalResult.value.overallScore);
    } else if (technicalResult.status === 'rejected') {
      const errorMsg = technicalResult.reason instanceof Error 
        ? technicalResult.reason.message 
        : String(technicalResult.reason || 'Technical analysis failed');
      errors.push(`Technical Analysis: ${errorMsg}`);
      console.error('[Unified Analysis] Technical failed:', errorMsg);
    } else if (technicalResult.status === 'fulfilled' && !technicalResult.value.success) {
      const errorMsg = technicalResult.value.error || 'Technical analysis returned unsuccessful';
      errors.push(`Technical Analysis: ${errorMsg}`);
      console.error('[Unified Analysis] Technical unsuccessful:', errorMsg);
    }

    // Generate report if requested (typically for onboarding)
    if (config.generateReport) {
      const reportResult = await generateReport({
        brandProfileId: config.brandProfileId,
        geoAnalysisId: result.geoAnalysisId,
        technicalAnalysisId: result.technicalAnalysisId,
      });

      if (reportResult.success) {
        result.reportId = reportResult.id;
        console.log('[Unified Analysis] Report generated:', reportResult.id);
      } else if (reportResult.error) {
        errors.push(`Report Generation: ${reportResult.error}`);
        console.error('[Unified Analysis] Report generation failed:', reportResult.error);
      }
    }

    // Set success status and error message
    result.success = !!(result.geoAnalysisId || result.technicalAnalysisId);
    
    if (errors.length > 0) {
      result.error = errors.join('; ');
      
      // If both analyses failed completely, mark as unsuccessful
      if (!result.geoAnalysisId && !result.technicalAnalysisId) {
        result.success = false;
      }
    }
    
    return result;

  } catch (error) {
    console.error('[Unified Analysis] Fatal error:', error);
    result.error = error instanceof Error ? error.message : 'Unknown fatal error occurred';
    result.errorCode = 'ANALYSIS_FATAL_ERROR';
    result.success = false;
    return result;
  }
}

/**
 * Core GEO Analysis Logic
 * Shared by onboarding and dashboard
 */
async function runGeoAnalysisCore(config: UnifiedAnalysisConfig) {
  try {
    const { generateAndSaveInitialPrompts, getActivePrompts } = await import('./prompt-storage.service');
    const { canRunAnalysis, updateLastAnalysisTime, createAnalysisRun, updateAnalysisRun } = await import('./analysis-run.service');
    
    // Check cooldown (unless skipCooldown is true OR DEVELOPMENT_MODE is true)
    const isDevelopmentMode = process.env.DEVELOPMENT_MODE === 'true';
    const shouldSkipCooldown = config.skipCooldown || isDevelopmentMode;
    
    if (!shouldSkipCooldown) {
      const eligibility = await canRunAnalysis(config.brandProfileId);
      if (!eligibility.allowed) {
        throw new Error(`Analysis cooldown active. Next available in ${Math.ceil(eligibility.timeUntilNext! / 1000 / 60)} minutes`);
      }
    } else if (isDevelopmentMode) {
      console.log('[GEO Core] ⚡ Development mode enabled - skipping cooldown');
    }
    
    // Get or generate prompts
    let prompts = await getActivePrompts(config.brandProfileId);
    if (prompts.length === 0) {
      console.log('[GEO Core] Generating initial prompts...');
      prompts = await generateAndSaveInitialPrompts(config.brandProfileId);
    }
    
    // Create analysis run
    const analysisRun = await createAnalysisRun({
      brandProfileId: config.brandProfileId,
      promptsUsed: prompts.map(p => p.id),
      results: {},
      overallScore: 0,
      status: 'running'
    });
    
    // Call DirectGEO API with prompt categories for weighted scoring
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/geo/direct-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandName: config.brandName,
        website: config.website,
        industry: config.industry || '',
        description: config.description || '',
        competitors: config.competitors || [],
        customPrompts: prompts.map(p => ({
          text: p.text,
          category: p.category, // Pass category for intent weighting
        })),
      }),
    });

    if (!response.ok) {
      await updateAnalysisRun(analysisRun.id, {
        status: 'failed',
        errorMessage: `DirectGEO API failed: ${response.statusText}`
      });
      throw new Error(`DirectGEO API failed: ${response.statusText}`);
    }

    const apiResponse = await response.json();
    const data = apiResponse.success ? apiResponse.data : apiResponse;
    
    // Update analysis run
    await updateAnalysisRun(analysisRun.id, {
      status: 'completed',
      results: data,
      overallScore: data.overallScore || 0,
      competitorData: data.competitorComparison || []
    });
    
    // Update last analysis timestamp
    await updateLastAnalysisTime(config.brandProfileId);

    // DEBUG: Log what we're saving
    console.log('[GEO Core] Saving analyses with test count:', data.analyses?.length);
    if (data.analyses && data.analyses.length > 0) {
      const firstAnalysis = data.analyses[0];
      console.log('[GEO Core] First analysis structure:', {
        prompt: firstAnalysis.prompt?.substring(0, 50),
        testsCount: firstAnalysis.tests?.length,
        firstTestHasCompetitors: firstAnalysis.tests?.[0]?.competitorsMentioned?.length || 0
      });
    }

    // Save to database
    const geoAnalysis = await prisma.geoAnalysisResult.create({
      data: {
        brandProfileId: config.brandProfileId,
        overallScore: data.overallScore || 0,
        analyses: JSON.stringify(data.analyses || []),
        summary: JSON.stringify({
          brandName: config.brandName,
          competitorData: data.competitorComparison || {},
          recommendations: data.recommendations || [],
          status: 'completed',
        }),
      },
    });

    return { 
      success: true, 
      id: geoAnalysis.id, 
      score: data.overallScore || 0 
    };

  } catch (error) {
    console.error('[GEO Core] Error:', error);
    console.error('[GEO Core] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Core Technical Analysis Logic
 * Shared by onboarding and dashboard
 */
async function runTechnicalAnalysisCore(config: UnifiedAnalysisConfig) {
  try {
    const { scrapeCompanyPage } = await import('@/lib/scrapers/enhanced-geo-scraper');
    const { toScrapeSnapshot } = await import('@/lib/analysis/technical/adapter');
    const { computeTechnicalScore } = await import('@/lib/analysis/technical/score');
    const { saveSnapshot, saveScore, ensureSiteByUrl } = await import('@/lib/analysis/technical/repo');
    
    // Scrape website
    console.log('[Technical Core] Scraping:', config.website);
    const scrapeResult = await scrapeCompanyPage(config.website, {
      fresh: true,
      useLlmJsonMode: false
    });
    
    // Convert and score
    const snapshot = toScrapeSnapshot(scrapeResult);
    const scoreResult = computeTechnicalScore(snapshot);
    
    console.log('[Technical Core] Score:', scoreResult.total);
    
    // Save to database
    try {
      const site = await ensureSiteByUrl(config.website);
      const savedSnapshot = await saveSnapshot(site.id, snapshot);
      await saveScore(savedSnapshot.id, scoreResult);
    } catch (dbError) {
      console.error('[Technical Core] DB save error:', dbError);
    }
    
    // Calculate category scores
    const seoComponents = scoreResult.components.filter(c => c.category === 'SEO');
    const seoScore = seoComponents.length > 0
      ? Math.round((seoComponents.reduce((sum, c) => sum + c.score, 0) / 
                    seoComponents.reduce((sum, c) => sum + c.max, 0)) * 100)
      : 0;
    
    const geoComponents = scoreResult.components.filter(c => c.category === 'GEO');
    const geoScore = geoComponents.length > 0
      ? Math.round((geoComponents.reduce((sum, c) => sum + c.score, 0) / 
                    geoComponents.reduce((sum, c) => sum + c.max, 0)) * 100)
      : 0;
    
    // Generate recommendations
    const recommendations = scoreResult.findings.map(finding => ({
      severity: finding.severity,
      message: finding.message,
      category: finding.category,
      action: generateActionFromFinding(finding)
    }));
    
    // Create analysis record
    const technicalAnalysis = await prisma.technicalStructureAnalysis.create({
      data: {
        brandProfileId: config.brandProfileId,
        websiteUrl: config.website,
        overallScore: scoreResult.total,
        seoScore: seoScore,
        performanceScore: 0,
        accessibilityScore: 0,
        insights: JSON.stringify(scoreResult.findings.map(f => ({
          type: f.severity,
          message: f.message,
          category: f.category
        }))),
        recommendations: JSON.stringify(recommendations),
        metadata: JSON.stringify({
          components: scoreResult.components,
          structuredData: {
            hasJsonLd: snapshot.schema?.summary?.jsonLdCount ?? 0 > 0,
            jsonLdCount: snapshot.schema?.summary?.jsonLdCount ?? 0,
            hasFaqSchema: snapshot.schema?.summary?.faqSchemaCount ?? 0 > 0
          },
          metaTags: {
            hasTitle: Boolean(snapshot.metadata?.title),
            hasDescription: Boolean(snapshot.metadata?.description),
            hasFavicon: Boolean(snapshot.metadata?.favicon)
          },
          headingStructure: {
            h1Count: snapshot.htmlStructure?.headings?.h1?.length ?? 0,
            h2Count: snapshot.htmlStructure?.headings?.h2?.length ?? 0,
            h3Count: snapshot.htmlStructure?.headings?.h3?.length ?? 0,
            hasProperStructure: snapshot.htmlStructure?.hasProperStructure ?? false
          },
          llmFiles: {
            hasRobotsTxt: snapshot.txtFiles?.summary?.hasRobotsTxt ?? false,
            hasLlmsTxt: snapshot.txtFiles?.summary?.hasLlmsTxt ?? false,
            hasLlmsFullTxt: snapshot.txtFiles?.summary?.hasLlmsFullTxt ?? false
          },
          criticalIssues: scoreResult.findings.filter(f => f.severity === 'high').map(f => f.message),
          warnings: scoreResult.findings.filter(f => f.severity === 'medium').map(f => f.message),
          suggestions: scoreResult.findings.filter(f => f.severity === 'low').map(f => f.message),
        }),
      },
    });

    return { 
      success: true, 
      id: technicalAnalysis.id,
      overallScore: scoreResult.total,
      seoScore,
      geoScore
    };

  } catch (error) {
    console.error('[Technical Core] Error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Generate Natural Language Report
 * Used by onboarding pipeline
 */
async function generateReport(data: {
  brandProfileId: number;
  geoAnalysisId?: number;
  technicalAnalysisId?: number;
}) {
  try {
    const geoAnalysis = data.geoAnalysisId 
      ? await prisma.geoAnalysisResult.findUnique({ where: { id: data.geoAnalysisId } })
      : null;

    const technicalAnalysis = data.technicalAnalysisId
      ? await prisma.technicalStructureAnalysis.findUnique({ where: { id: data.technicalAnalysisId } })
      : null;

    const report = await generateReportContent({
      geoAnalysis,
      technicalAnalysis,
    });

    const savedReport = await prisma.naturalLanguageReport.create({
      data: {
        brandProfileId: data.brandProfileId,
        reportText: report.fullReport || report.summary || 'Analysis report generated',
        insights: JSON.stringify(report.insights || []),
        recommendations: JSON.stringify(report.recommendations || []),
        metadata: JSON.stringify({
          reportType: 'analysis',
          title: 'Brand Analysis Report',
          summary: report.summary,
          sections: report.sections,
          model: 'gpt-4',
        }),
      },
    });

    return { success: true, id: savedReport.id };
  } catch (error) {
    console.error('[Report] Error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Generate report content from analysis data
 */
async function generateReportContent(data: {
  geoAnalysis: any;
  technicalAnalysis: any;
}) {
  const sections = [];
  const insights: any[] = [];
  const recommendations: any[] = [];

  if (data.geoAnalysis) {
    sections.push({
      title: 'AI Visibility Analysis',
      content: `Your brand has an overall AI visibility score of ${data.geoAnalysis.overallScore.toFixed(1)}/100.`,
    });
    
    if (data.geoAnalysis.recommendations && Array.isArray(data.geoAnalysis.recommendations)) {
      recommendations.push(...data.geoAnalysis.recommendations);
    }
  }

  if (data.technicalAnalysis) {
    sections.push({
      title: 'Technical Structure',
      content: `Your website has a technical score of ${data.technicalAnalysis.overallScore}/100.`,
    });
  }

  const summary = `This report provides an overview of your brand's online presence across AI visibility and technical SEO. ${sections.length} analysis sections have been completed.`;
  const fullReport = sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n');

  return {
    summary,
    fullReport,
    sections,
    insights,
    recommendations,
  };
}

/**
 * Generate action from finding
 */
function generateActionFromFinding(finding: any): string {
  const actionMap: Record<string, string> = {
    'missing_robots_txt': 'Add a robots.txt file to your website root directory',
    'missing_llms_txt': 'Create an llms.txt file to tell AI models how to cite your content',
    'missing_h1': 'Add a clear H1 heading to your page',
    'missing_meta_description': 'Add a meta description tag to improve search results',
  };
  
  return actionMap[finding.key] || 'Review and fix this issue';
}
