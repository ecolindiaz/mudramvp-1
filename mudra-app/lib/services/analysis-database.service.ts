import { prisma } from '@/lib/prisma';
import type { EnhancedGEOResult } from '@/lib/scrapers/enhanced-geo-scraper';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

/**
 * Save enhanced GEO analysis results to the database
 */
export async function saveAnalysisToDatabase(
  analysisData: EnhancedGEOResult,
  userId: string
): Promise<{ analysisId: string; websiteId: string }> {
  try {
    console.log('💾 Saving analysis to database for user:', userId);
    
    return await prisma.$transaction(async (tx) => {
      // Handle anonymous users
      const actualUserId = userId === 'anonymous' ? null : userId;
      
      // 1. Create or get website record
      const website = await tx.website.upsert({
        where: {
          userId_url: {
            userId: actualUserId,
            url: analysisData.url
          }
        },
        update: {
          updatedAt: new Date()
        },
        create: {
          userId: actualUserId,
          url: analysisData.url,
          domain: new URL(analysisData.url).hostname
        }
      });

      console.log('✅ Website record:', website.id);

      // 2. Create technical analysis record
      const technicalAnalysis = await tx.technicalAnalysis.create({
        data: {
          websiteId: website.id,
          sourceUrl: analysisData.url,
          timestamp: new Date(analysisData.timestamp),
          overallScore: analysisData.geoScore.overall,
          contentAuthority: analysisData.geoScore.contentAuthority,
          technicalAccessibility: analysisData.geoScore.technicalAccessibility,
          structuredData: analysisData.geoScore.structuredData,
          entityRecognition: analysisData.geoScore.entityRecognition,
          faqOptimization: analysisData.geoScore.faqOptimization,
          contentFreshness: analysisData.geoScore.contentFreshness
        }
      });

      console.log('✅ Technical analysis record:', technicalAnalysis.id);

      // 3. Save structured data
      if (analysisData.structuredData) {
        await tx.structuredData.create({
          data: {
            technicalAnalysisId: technicalAnalysis.id,
            jsonLdData: analysisData.structuredData.jsonLd || [],
            microdataData: analysisData.structuredData.microdata || [],
            rdfaData: analysisData.structuredData.rdfa || [],
            schemaTypes: analysisData.structuredData.schemaTypes || [],
            faqSchemas: analysisData.structuredData.faqSchemas || [],
            organizationSchema: analysisData.structuredData.organizationSchema || null,
            websiteSchema: analysisData.structuredData.websiteSchema || null,
            breadcrumbSchema: analysisData.structuredData.breadcrumbSchema || null,
            hasOrganizationSchema: !!analysisData.structuredData.organizationSchema,
            hasWebsiteSchema: !!analysisData.structuredData.websiteSchema,
            hasBreadcrumbSchema: !!analysisData.structuredData.breadcrumbSchema,
            hasFAQSchema: (analysisData.structuredData.faqSchemas?.length || 0) > 0
          }
        });
        console.log('✅ Structured data saved');
      }

      // 4. Save entity recognition
      if (analysisData.entityRecognition) {
        await tx.entityRecognition.create({
          data: {
            technicalAnalysisId: technicalAnalysis.id,
            organizations: analysisData.entityRecognition.organizations || [],
            people: analysisData.entityRecognition.people || [],
            technologies: analysisData.entityRecognition.technologies || [],
            products: analysisData.entityRecognition.products || [],
            locations: analysisData.entityRecognition.locations || [],
            organizationsCount: analysisData.entityRecognition.organizations?.length || 0,
            peopleCount: analysisData.entityRecognition.people?.length || 0,
            technologiesCount: analysisData.entityRecognition.technologies?.length || 0,
            productsCount: analysisData.entityRecognition.products?.length || 0,
            locationsCount: analysisData.entityRecognition.locations?.length || 0
          }
        });
        console.log('✅ Entity recognition saved');
      }

      // 5. Save FAQ analysis
      if (analysisData.faqOptimization) {
        await tx.fAQAnalysis.create({
          data: {
            technicalAnalysisId: technicalAnalysis.id,
            questionAnswerPairs: analysisData.faqOptimization.questionAnswerPairs || 0,
            faqStructuredData: analysisData.faqOptimization.faqStructuredData || false,
            faqSchemaPresent: analysisData.faqOptimization.faqSchemaPresent || false,
            faqSections: analysisData.faqOptimization.faqSections || [],
            faqSectionCount: analysisData.faqOptimization.faqSections?.length || 0
          }
        });
        console.log('✅ FAQ analysis saved');
      }

      // 6. Save content freshness
      if (analysisData.contentFreshness) {
        await tx.contentFreshness.create({
          data: {
            technicalAnalysisId: technicalAnalysis.id,
            publishDate: analysisData.contentFreshness.publishDate || null,
            lastModified: analysisData.contentFreshness.lastModified || null,
            updateFrequency: analysisData.contentFreshness.updateFrequency || null,
            freshnessSignals: analysisData.contentFreshness.freshnessSignals || [],
            freshnessSignalsCount: analysisData.contentFreshness.freshnessSignals?.length || 0
          }
        });
        console.log('✅ Content freshness saved');
      }

      // 7. Save content structure
      if (analysisData.contentStructure) {
        await tx.contentStructure.create({
          data: {
            technicalAnalysisId: technicalAnalysis.id,
            headingsHierarchy: analysisData.contentStructure.headingsHierarchy || {},
            h1Count: analysisData.contentStructure.headingsHierarchy?.h1?.length || 0,
            h2Count: analysisData.contentStructure.headingsHierarchy?.h2?.length || 0,
            h3Count: analysisData.contentStructure.headingsHierarchy?.h3?.length || 0,
            h4Count: analysisData.contentStructure.headingsHierarchy?.h4?.length || 0,
            h5Count: analysisData.contentStructure.headingsHierarchy?.h5?.length || 0,
            h6Count: analysisData.contentStructure.headingsHierarchy?.h6?.length || 0,
            authoritySignals: analysisData.contentStructure.authoritySignals || {},
            statisticsCount: analysisData.contentStructure.authoritySignals?.statistics?.length || 0,
            expertQuotesCount: analysisData.contentStructure.authoritySignals?.expertQuotes?.length || 0,
            citationsCount: analysisData.contentStructure.authoritySignals?.citations?.length || 0,
            testimonialsCount: analysisData.contentStructure.authoritySignals?.testimonials?.length || 0,
            wordCount: analysisData.contentStructure.contentQuality?.wordCount || null,
            paragraphCount: analysisData.contentStructure.contentQuality?.paragraphCount || null,
            listCount: analysisData.contentStructure.contentQuality?.listCount || null,
            tableCount: analysisData.contentStructure.contentQuality?.tableCount || null,
            imageCount: analysisData.contentStructure.contentQuality?.imageCount || null,
            readingLevel: analysisData.contentStructure.contentQuality?.readingLevel || null
          }
        });
        console.log('✅ Content structure saved');
      }

      // 8. Save technical accessibility
      if (analysisData.technicalAccessibility) {
        await tx.technicalAccessibility.create({
          data: {
            technicalAnalysisId: technicalAnalysis.id,
            metaTags: analysisData.technicalAccessibility.metaTags || {},
            hasTitle: !!analysisData.technicalAccessibility.metaTags?.title,
            hasDescription: !!analysisData.technicalAccessibility.metaTags?.description,
            hasCanonical: !!analysisData.technicalAccessibility.metaTags?.canonical,
            hasRobots: !!analysisData.technicalAccessibility.metaTags?.robots,
            hreflangCount: analysisData.technicalAccessibility.metaTags?.hreflang?.length || 0,
            openGraphData: analysisData.technicalAccessibility.metaTags?.openGraph || {},
            twitterCardData: analysisData.technicalAccessibility.metaTags?.twitterCard || {},
            hasOgTitle: !!analysisData.technicalAccessibility.metaTags?.openGraph?.['og:title'],
            hasOgDescription: !!analysisData.technicalAccessibility.metaTags?.openGraph?.['og:description'],
            hasOgImage: !!analysisData.technicalAccessibility.metaTags?.openGraph?.['og:image'],
            hasTwitterCard: !!analysisData.technicalAccessibility.metaTags?.twitterCard?.card,
            technicalElements: analysisData.technicalAccessibility.technicalElements || {},
            httpsStatus: analysisData.technicalAccessibility.technicalElements?.httpsStatus || false,
            statusCode: analysisData.technicalAccessibility.technicalElements?.statusCode || null,
            contentType: analysisData.technicalAccessibility.technicalElements?.contentType || null,
            responseTime: analysisData.technicalAccessibility.technicalElements?.responseTime || null,
            mobileFriendly: analysisData.technicalAccessibility.technicalElements?.mobileFriendly || null,
            internalLinksCount: analysisData.technicalAccessibility.technicalElements?.internalLinks?.length || 0,
            lcp: analysisData.technicalAccessibility.technicalElements?.coreWebVitals?.lcp || null,
            fid: analysisData.technicalAccessibility.technicalElements?.coreWebVitals?.fid || null,
            cls: analysisData.technicalAccessibility.technicalElements?.coreWebVitals?.cls || null,
            accessibilityData: analysisData.technicalAccessibility.accessibility || {},
            altTextCount: analysisData.technicalAccessibility.accessibility?.altTextCount || 0,
            ariaLabelsCount: analysisData.technicalAccessibility.accessibility?.ariaLabels?.length || 0,
            semanticElementsCount: analysisData.technicalAccessibility.accessibility?.semanticElements?.length || 0,
            skipLinks: analysisData.technicalAccessibility.accessibility?.skipLinks || false,
            headingStructureValid: analysisData.technicalAccessibility.accessibility?.headingStructureValid || false
          }
        });
        console.log('✅ Technical accessibility saved');
      }

      console.log('🎉 Analysis completely saved to database');
      
      return {
        analysisId: technicalAnalysis.id,
        websiteId: website.id
      };
    });

  } catch (error) {
    console.error('❌ Error saving analysis to database:', error);
    throw new Error(`Failed to save analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get analysis data from database for dashboard display
 */
export async function getAnalysisFromDatabase(
  userId: string,
  websiteId?: string,
  limit: number = 10
) {
  try {
    console.log('📊 Fetching analysis data from database for user:', userId);

    const whereClause = {
      website: {
        userId: userId,
        ...(websiteId && { id: websiteId })
      }
    };

    const analyses = await prisma.technicalAnalysis.findMany({
      where: whereClause,
      include: {
        website: true,
        structuredDataAnalysis: true,
        entityRecognitionAnalysis: true,
        faqAnalysis: true,
        contentFreshnessAnalysis: true,
        contentStructure: true,
        technicalAccessibilityAnalysis: true
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit
    });

    console.log(`✅ Found ${analyses.length} analyses`);
    return analyses;

  } catch (error) {
    console.error('❌ Error fetching analysis from database:', error);
    throw new Error(`Failed to fetch analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get dashboard metrics aggregated from stored analyses
 */
export async function getDashboardMetrics(userId: string, timeframe: '7d' | '30d' | '90d' = '30d') {
  try {
    console.log('📈 Calculating dashboard metrics for user:', userId);

    const daysBack = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get recent analyses
    const analyses = await prisma.technicalAnalysis.findMany({
      where: {
        website: {
          userId: userId
        },
        timestamp: {
          gte: startDate
        }
      },
      include: {
        website: true
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    // Calculate metrics
    const totalAnalyses = analyses.length;
    const avgVisibilityScore = totalAnalyses > 0 
      ? analyses.reduce((sum, a) => sum + a.overallScore, 0) / totalAnalyses 
      : 0;

    // Build trend data
    const visibilityTrend = analyses.map(analysis => ({
      date: analysis.timestamp.toISOString(),
      companyName: new URL(analysis.sourceUrl).hostname,
      visibilityScore: analysis.overallScore,
      shareOfVoice: analysis.contentAuthority, // Using content authority as proxy
      averagePosition: 100 - analysis.overallScore, // Inverse relationship
      competitorCount: 3 // Mock data - could be enhanced with actual competitor tracking
    }));

    console.log(`✅ Calculated metrics for ${totalAnalyses} analyses`);

    return {
      timeframe,
      summary: {
        totalAnalyses,
        totalMessages: totalAnalyses * 5, // Mock data
        totalConversations: totalAnalyses * 2, // Mock data
        totalCreditsUsed: totalAnalyses * 10, // Mock data
        avgVisibilityScore: Math.round(avgVisibilityScore * 10) / 10
      },
      visibilityTrend,
      competitorInsights: [], // To be enhanced
      providerPerformance: [], // To be enhanced
      recentActivity: analyses.slice(0, 5)
    };

  } catch (error) {
    console.error('❌ Error calculating dashboard metrics:', error);
    throw new Error(`Failed to calculate metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
