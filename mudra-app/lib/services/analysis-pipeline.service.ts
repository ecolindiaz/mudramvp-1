/**
 * Analysis Pipeline Service
 * Orchestrates the complete brand analysis workflow:
 * 1. DirectGEO AI Visibility Analysis
 * 2. Technical Structure Analysis
 * 3. Natural Language Report Generation
 */

import { prisma } from '@/lib/prisma';

export interface AnalysisPipelineConfig {
  brandProfileId: number;
  brandName: string;
  website: string;
  description?: string;
  industry?: string;
  competitors?: string[];
}

export interface AnalysisPipelineResult {
  success: boolean;
  geoAnalysisId?: number;
  technicalAnalysisId?: number;
  reportId?: number;
  error?: string;
  progress: {
    geoAnalysis: 'pending' | 'completed' | 'failed';
    technicalStructure: 'pending' | 'completed' | 'failed';
    report: 'pending' | 'completed' | 'failed';
  };
}

/**
 * Main pipeline orchestrator
 * Now uses unified analysis service for consistency with dashboard
 */
export async function triggerAnalysisPipeline(
  config: AnalysisPipelineConfig
): Promise<AnalysisPipelineResult> {
  const result: AnalysisPipelineResult = {
    success: false,
    progress: {
      geoAnalysis: 'pending',
      technicalStructure: 'pending',
      report: 'pending',
    },
  };

  try {
    console.log('[Pipeline] Starting unified analysis...');
    
    // Use unified analysis service (same as dashboard)
    const { runUnifiedAnalysis } = await import('./unified-analysis.service');
    
    const analysisResult = await runUnifiedAnalysis({
      brandProfileId: config.brandProfileId,
      brandName: config.brandName,
      website: config.website,
      description: config.description,
      industry: config.industry,
      competitors: config.competitors,
      skipCooldown: true, // Skip cooldown - onboarding is first analysis for new users
      generateReport: true, // Generate report for onboarding
    });

    // Update progress based on results
    if (analysisResult.geoAnalysisId) {
      result.geoAnalysisId = analysisResult.geoAnalysisId;
      result.progress.geoAnalysis = 'completed';
    } else {
      result.progress.geoAnalysis = 'failed';
    }

    if (analysisResult.technicalAnalysisId) {
      result.technicalAnalysisId = analysisResult.technicalAnalysisId;
      result.progress.technicalStructure = 'completed';
    } else {
      result.progress.technicalStructure = 'failed';
    }

    if (analysisResult.reportId) {
      result.reportId = analysisResult.reportId;
      result.progress.report = 'completed';
    } else {
      result.progress.report = 'failed';
    }

    result.success = analysisResult.success;
    result.error = analysisResult.error;

    console.log('[Pipeline] Unified analysis completed:', {
      success: result.success,
      geoScore: analysisResult.scores.aiVisibility,
      technicalScore: analysisResult.scores.technical,
    });

    return result;
  } catch (error) {
    console.error('[Pipeline] Fatal error:', error);
    result.error = error instanceof Error ? error.message : 'Unknown error';
    return result;
  }
}

/**
 * Step 2: Run Technical Structure Analysis
 * Integrates with enhanced scraper and scoring system
 */
async function runTechnicalAnalysis(config: AnalysisPipelineConfig) {
  try {
    console.log('[Technical Analysis] Starting analysis for:', config.website);
    
    // Import the scraper, adapter, and scoring functions
    const { scrapeCompanyPage } = await import('@/lib/scrapers/enhanced-geo-scraper');
    const { toScrapeSnapshot } = await import('@/lib/analysis/technical/adapter');
    const { computeTechnicalScore } = await import('@/lib/analysis/technical/score');
    const { saveSnapshot, saveScore, ensureSiteByUrl } = await import('@/lib/analysis/technical/repo');
    
    // 1. Scrape the website
    console.log('[Technical Analysis] Scraping website...');
    const scrapeResult = await scrapeCompanyPage(config.website, {
      fresh: true,
      useLlmJsonMode: false
    });
    
    if (!scrapeResult || !scrapeResult.url) {
      throw new Error('Scraping failed or returned invalid data');
    }
    
    console.log('[Technical Analysis] Scraping completed successfully');
    
    // 2. Convert to snapshot format
    const snapshot = toScrapeSnapshot(scrapeResult);
    
    // 3. Compute technical score
    console.log('[Technical Analysis] Computing technical score...');
    const scoreResult = computeTechnicalScore(snapshot);
    
    console.log('[Technical Analysis] Score computed:', {
      total: scoreResult.total,
      componentsCount: scoreResult.components.length,
      findingsCount: scoreResult.findings.length
    });
    
    // 4. Save to database
    try {
      const site = await ensureSiteByUrl(config.website);
      const savedSnapshot = await saveSnapshot(site.id, snapshot);
      await saveScore(savedSnapshot.id, scoreResult);
      console.log('[Technical Analysis] Results saved to database');
    } catch (dbError) {
      console.error('[Technical Analysis] Database save error:', dbError);
      // Continue anyway - we still have the score
    }
    
    // 5. Calculate category scores
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
    
    // 6. Generate recommendations from findings
    const recommendations = scoreResult.findings.map(finding => ({
      severity: finding.severity,
      message: finding.message,
      category: finding.category,
      action: generateActionFromFinding(finding)
    }));
    
    // 7. Create technical analysis record
    const technicalAnalysis = await prisma.technicalStructureAnalysis.create({
      data: {
        brandProfileId: config.brandProfileId,
        websiteUrl: config.website,
        overallScore: scoreResult.total,
        seoScore: seoScore,
        performanceScore: 0, // Not yet implemented
        accessibilityScore: 0, // Not yet implemented
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

    console.log('[Technical Analysis] Analysis complete, saved with ID:', technicalAnalysis.id);
    return { success: true, id: technicalAnalysis.id };
    
  } catch (error) {
    console.error('[Technical Analysis] Error:', error);
    
    // Save failed analysis with error details
    try {
      const failedAnalysis = await prisma.technicalStructureAnalysis.create({
        data: {
          brandProfileId: config.brandProfileId,
          websiteUrl: config.website,
          overallScore: 0,
          seoScore: 0,
          performanceScore: 0,
          accessibilityScore: 0,
          insights: JSON.stringify([{
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
            category: 'System'
          }]),
          recommendations: JSON.stringify([]),
          metadata: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          }),
        },
      });
      console.log('[Technical Analysis] Failed analysis record saved');
      return { success: false, id: failedAnalysis.id, error: error instanceof Error ? error.message : 'Unknown error' };
    } catch (dbError) {
      console.error('[Technical Analysis] Failed to save error state:', dbError);
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Helper: Generate actionable recommendation from finding
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

/**
 * Step 3: Generate Natural Language Report
 */
async function generateAnalysisReport(data: {
  brandProfileId: number;
  geoAnalysisId?: number;
  technicalAnalysisId?: number;
}) {
  try {
    // Fetch analysis data
    const geoAnalysis = data.geoAnalysisId 
      ? await prisma.geoAnalysisResult.findUnique({ where: { id: data.geoAnalysisId } })
      : null;

    const technicalAnalysis = data.technicalAnalysisId
      ? await prisma.technicalStructureAnalysis.findUnique({ where: { id: data.technicalAnalysisId } })
      : null;

    // Generate report content
    const report = await generateReportContent({
      geoAnalysis,
      technicalAnalysis,
    });

    // Save report to database
    const savedReport = await prisma.naturalLanguageReport.create({
      data: {
        brandProfileId: data.brandProfileId,
        reportText: report.fullReport || report.summary || 'Analysis report generated',
        insights: (report.insights || []) as any,
        recommendations: (report.recommendations || []) as any,
        metadata: {
          reportType: 'onboarding',
          title: 'Brand Analysis Report',
          summary: report.summary,
          sections: report.sections,
          model: 'gpt-4',
        } as any,
      },
    });

    return { success: true, id: savedReport.id };
  } catch (error) {
    console.error('[Report Generation] Error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Helper: Generate report content from analysis data
 */
async function generateReportContent(data: {
  geoAnalysis: any;
  technicalAnalysis: any;
}) {
  // TODO: Use OpenAI/Claude to generate narrative report
  // For now, create structured report from available data
  
  const sections: Array<{ title: string; content: string }> = [];
  const insights: string[] = [];
  const recommendations: unknown[] = [];

  // AI Visibility Section
  if (data.geoAnalysis) {
    sections.push({
      title: 'AI Visibility Analysis',
      content: `Your brand has an overall AI visibility score of ${data.geoAnalysis.overallScore.toFixed(1)}/100.`,
    });
    
    if (data.geoAnalysis.recommendations && Array.isArray(data.geoAnalysis.recommendations)) {
      recommendations.push(...data.geoAnalysis.recommendations);
    }
  }

  // Technical Section
  if (data.technicalAnalysis) {
    sections.push({
      title: 'Technical Structure',
      content: 'Technical analysis is in progress. Results will be available once the crawl is complete.',
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
 * Get latest analysis results for a brand
 */
export async function getLatestAnalysisResults(brandProfileId: number) {
  console.log(`[getLatestAnalysisResults] Fetching results for brandProfileId: ${brandProfileId}`);
  
  // Validate brandProfileId
  if (!brandProfileId || brandProfileId === 0) {
    console.error(`[getLatestAnalysisResults] ❌ Invalid brandProfileId: ${brandProfileId}`);
    throw new Error('Invalid brand profile ID. Please ensure your profile is properly set up.');
  }
  
  const [geoAnalysis, technicalAnalysis, report] = await Promise.all([
    prisma.geoAnalysisResult.findFirst({
      where: { 
        brandProfileId,
        // Exclude invalid records
        id: { not: 0 }
      },
      orderBy: { timestamp: 'desc' },
    }),
    prisma.technicalStructureAnalysis.findFirst({
      where: { 
        brandProfileId,
        id: { not: 0 }
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.naturalLanguageReport.findFirst({
      where: { 
        brandProfileId,
        id: { not: 0 }
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  console.log(`[getLatestAnalysisResults] Found:`, {
    hasGeo: !!geoAnalysis,
    hasTechnical: !!technicalAnalysis,
    hasReport: !!report,
    geoScore: geoAnalysis?.overallScore,
    technicalScore: technicalAnalysis?.overallScore,
  });

  return {
    success: true,
    geoAnalysis,
    technicalAnalysis,
    report,
  };
}
