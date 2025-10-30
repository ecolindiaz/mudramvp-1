// Database - Use the generated Prisma client from the correct path
import type { TechnicalAnalysis, TechnicalStructureAnalysis, Website, Prisma } from "@prisma/client";
import { 
  RecommendationCategory,
  RecommendationSeverity,
  RecommendationImpact
} from "@prisma/client";

// Algorithm - Import from the scrapers directory
import { extractEnhancedGEOData } from '../scrapers/enhanced-geo-scraper'

// Types - Use Prisma generated types
import type { EnhancedGEOResult } from '../scrapers/enhanced-geo-scraper'

// Validation
import { z } from 'zod'

// Input validation schemas
const SaveAnalysisSchema = z.object({
  websiteId: z.string().min(1, "Website ID is required"),
  scraperResults: z.object({
    url: z.string().url("Must be a valid URL"),
    timestamp: z.string().min(1, "Timestamp is required"),
    geoScore: z.object({
      overall: z.number().min(0).max(100),
      contentAuthority: z.number().min(0).max(100),
      technicalAccessibility: z.number().min(0).max(100),
      structuredData: z.number().min(0).max(100),
      entityRecognition: z.number().min(0).max(100),
      faqOptimization: z.number().min(0).max(100),
      contentFreshness: z.number().min(0).max(100),
    }),
    structuredData: z.object({}).passthrough(), // Allow any structure
    entityRecognition: z.object({}).passthrough(),
    faqOptimization: z.object({}).passthrough(),
    contentFreshness: z.object({}).passthrough(),
    contentStructure: z.object({}).passthrough(),
    technicalAccessibility: z.object({}).passthrough(),
  })
})

const CreateWebsiteSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  url: z.string().url("Must be a valid URL")
})

// Prisma Client Instance
import { prisma } from '@/lib/prisma'

export async function saveAnalysisResults(websiteId: string, scraperResults: EnhancedGEOResult): Promise<TechnicalAnalysis> {
    try {
      // Validate input data
      SaveAnalysisSchema.parse({ websiteId, scraperResults })
      
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Step 1: Create main technical analysis record
        const analysis = await tx.technicalAnalysis.create({
        data: {
          websiteId,
          sourceUrl: scraperResults.url,
          timestamp: new Date(scraperResults.timestamp),
          overallScore: scraperResults.geoScore.overall,
          contentAuthority: scraperResults.geoScore.contentAuthority,
          technicalAccessibility: scraperResults.geoScore.technicalAccessibility,
          structuredData: scraperResults.geoScore.structuredData,
          entityRecognition: scraperResults.geoScore.entityRecognition,
          faqOptimization: scraperResults.geoScore.faqOptimization,
          contentFreshness: scraperResults.geoScore.contentFreshness,
        },
      }) // Step 2: Save detailed structured data analysis
      await tx.structuredData.create({
        data: {
          technicalAnalysisId: analysis.id,
          jsonLdData: scraperResults.structuredData.jsonLd,
          microdataData: scraperResults.structuredData.microdata,
          rdfaData: scraperResults.structuredData.rdfa,
          schemaTypes: scraperResults.structuredData.schemaTypes,
          faqSchemas: scraperResults.structuredData.faqSchemas,
          organizationSchema: scraperResults.structuredData.organizationSchema || null,
          websiteSchema: scraperResults.structuredData.websiteSchema || null,
          breadcrumbSchema: scraperResults.structuredData.breadcrumbSchema || null,
          hasOrganizationSchema: !!scraperResults.structuredData.organizationSchema,
          hasWebsiteSchema: !!scraperResults.structuredData.websiteSchema,
          hasBreadcrumbSchema: !!scraperResults.structuredData.breadcrumbSchema,
          hasFAQSchema: scraperResults.structuredData.faqSchemas?.length > 0,
        },
      }) // Step 3: Save entity recognition data
      await tx.entityRecognition.create({
        data: {
          technicalAnalysisId: analysis.id,
          organizations: scraperResults.entityRecognition.organizations,
          people: scraperResults.entityRecognition.people,
          technologies: scraperResults.entityRecognition.technologies,
          products: scraperResults.entityRecognition.products,
          locations: scraperResults.entityRecognition.locations,
          organizationsCount: scraperResults.entityRecognition.organizations.length,
          peopleCount: scraperResults.entityRecognition.people.length,
          technologiesCount: scraperResults.entityRecognition.technologies.length,
          productsCount: scraperResults.entityRecognition.products.length,
          locationsCount: scraperResults.entityRecognition.locations.length,
        },
      }) // Step 4: Save FAQ analysis data
      await tx.fAQAnalysis.create({
        data: {
          technicalAnalysisId: analysis.id,
          questionAnswerPairs: scraperResults.faqOptimization.questionAnswerPairs,
          faqStructuredData: scraperResults.faqOptimization.faqStructuredData,
          faqSchemaPresent: scraperResults.faqOptimization.faqSchemaPresent,
          faqSections: scraperResults.faqOptimization.faqSections,
          faqSectionCount: scraperResults.faqOptimization.faqSections.length,
        },
      }) // Step 5: Save content freshness data
      await tx.contentFreshness.create({
        data: {
          technicalAnalysisId: analysis.id,
          publishDate: scraperResults.contentFreshness.publishDate || null,
          lastModified: scraperResults.contentFreshness.lastModified || null,
          updateFrequency: scraperResults.contentFreshness.updateFrequency || null,
          freshnessSignals: scraperResults.contentFreshness.freshnessSignals,
          freshnessSignalsCount: scraperResults.contentFreshness.freshnessSignals.length,
        },
      }) // Step 6: Save content structure data
      const authoritySignals = scraperResults.contentStructure.authoritySignals || { statistics: [], expertQuotes: [], citations: [], testimonials: [] }
      const headingsHierarchy = scraperResults.contentStructure.headingsHierarchy || { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] }
    
      await tx.contentStructure.create({
        data: {
          technicalAnalysisId: analysis.id,
          headingsHierarchy: scraperResults.contentStructure.headingsHierarchy,
          h1Count: headingsHierarchy.h1?.length || 0,
          h2Count: headingsHierarchy.h2?.length || 0,
          h3Count: headingsHierarchy.h3?.length || 0,
          h4Count: headingsHierarchy.h4?.length || 0,
          h5Count: headingsHierarchy.h5?.length || 0,
          h6Count: headingsHierarchy.h6?.length || 0,
          authoritySignals: scraperResults.contentStructure.authoritySignals,
          statisticsCount: authoritySignals.statistics?.length || 0,
          expertQuotesCount: authoritySignals.expertQuotes?.length || 0,
          citationsCount: authoritySignals.citations?.length || 0,
          testimonialsCount: authoritySignals.testimonials?.length || 0,
          wordCount: scraperResults.contentStructure.contentQuality?.wordCount || null,
          paragraphCount: scraperResults.contentStructure.contentQuality?.paragraphCount || null,
          listCount: scraperResults.contentStructure.contentQuality?.listCount || null,
          tableCount: scraperResults.contentStructure.contentQuality?.tableCount || null,
          imageCount: scraperResults.contentStructure.contentQuality?.imageCount || null,
          readingLevel: scraperResults.contentStructure.contentQuality?.readingLevel || null,
        },
      }) // Step 7: Save technical accessibility data
      const accessibility = scraperResults.technicalAccessibility.accessibility || { 
        altTextCount: 0, 
        ariaLabels: [], 
        semanticElements: [], 
        skipLinks: false, 
        headingStructureValid: false, 
        landmarkRoles: [] 
      }
      await tx.technicalAccessibility.create({
        data: {
          technicalAnalysisId: analysis.id,
          metaTags: scraperResults.technicalAccessibility.metaTags,
          hasTitle: !!scraperResults.technicalAccessibility.metaTags?.title,
          hasDescription: !!scraperResults.technicalAccessibility.metaTags?.description,
          hasCanonical: !!scraperResults.technicalAccessibility.metaTags?.canonical,
          hasRobots: !!scraperResults.technicalAccessibility.metaTags?.robots,
          hreflangCount: scraperResults.technicalAccessibility.metaTags?.hreflang?.length || 0,
          openGraphData: scraperResults.technicalAccessibility.metaTags?.openGraph || {},
          twitterCardData: scraperResults.technicalAccessibility.metaTags?.twitterCard || {},
          hasOgTitle: !!scraperResults.technicalAccessibility.metaTags?.openGraph?.['og:title'],
          hasOgDescription: !!scraperResults.technicalAccessibility.metaTags?.openGraph?.['og:description'],
          hasOgImage: !!scraperResults.technicalAccessibility.metaTags?.openGraph?.['og:image'],
          hasTwitterCard: !!scraperResults.technicalAccessibility.metaTags?.twitterCard?.['twitter:card'],
          technicalElements: scraperResults.technicalAccessibility.technicalElements,
          httpsStatus: scraperResults.technicalAccessibility.technicalElements?.httpsStatus || false,
          statusCode: scraperResults.technicalAccessibility.technicalElements?.statusCode || null,
          contentType: scraperResults.technicalAccessibility.technicalElements?.contentType || null,
          responseTime: scraperResults.technicalAccessibility.technicalElements?.responseTime || null,
          mobileFriendly: scraperResults.technicalAccessibility.technicalElements?.mobileFriendly || null,
          internalLinksCount: scraperResults.technicalAccessibility.technicalElements?.internalLinks?.length || 0,
          lcp: scraperResults.technicalAccessibility.technicalElements?.coreWebVitals?.lcp || null,
          fid: scraperResults.technicalAccessibility.technicalElements?.coreWebVitals?.fid || null,
          cls: scraperResults.technicalAccessibility.technicalElements?.coreWebVitals?.cls || null,
          accessibilityData: scraperResults.technicalAccessibility.accessibility,
          altTextCount: accessibility.altTextCount || 0,
          ariaLabelsCount: accessibility.ariaLabels?.length || 0,
          semanticElementsCount: accessibility.semanticElements?.length || 0,
          skipLinks: accessibility.skipLinks || false,
          headingStructureValid: accessibility.headingStructureValid || false,
          landmarkRolesCount: accessibility.landmarkRoles?.length || 0,
        },
      })

      // Step 8: Generate and save recommendations
      const recommendations = generateRecommendations(scraperResults)
      for (const rec of recommendations) {
        await tx.analysisRecommendation.create({
          data: {
            technicalAnalysisId: analysis.id,
            category: rec.category,
            severity: rec.severity,
            title: rec.title,
            description: rec.description,
            actionRequired: rec.actionRequired,
            impact: rec.impact,
          },
        })
      }

      return analysis
      })

      return result
    } catch (error) {
      throw new Error(`Failed to save analysis: ${error}`)
    }
  }
  export async function createWebsiteIfNotExists(userId: string, url: string): Promise<Website> {
    try {
        // Validate input data
        CreateWebsiteSchema.parse({ userId, url })
        
        const domain = new URL(url).hostname
        const existingWebsite = await prisma.website.findFirst({
            where: {
                userId,
                url,
            },
        })

        if (existingWebsite) {
            return existingWebsite
        }

        return await prisma.website.create({
            data: {
                url,
                domain,
                userId
            }
        })
    } catch (error) {
        throw new Error(`Failed to create website: ${error}`)
    }
}

export async function getLatestAnalysis(websiteId: string): Promise<(TechnicalAnalysis & { recommendations: any[] }) | null> {
    try {
      const analysis = await prisma.technicalAnalysis.findFirst({
        where: { websiteId },
        orderBy: { createdAt: 'desc' },
        include: {
          recommendations: {
            where: { isCompleted: false },
            orderBy: [
              { severity: 'desc' },
              { createdAt: 'desc' }
            ],
            take: 3 // Top 3 priority tasks for dashboard
          }
        }
      })

      return analysis
    } catch (error) {
        throw new Error(`Failed to get latest analysis: ${error}`)
    } 
  }

function generateRecommendations(results: EnhancedGEOResult): Array<{
  category: RecommendationCategory;
  severity: RecommendationSeverity;
  title: string;
  description: string;
  actionRequired: string;
  impact: RecommendationImpact;
}> {
  const recommendations = []

  // Structured Data Recommendations
  if (results.geoScore.structuredData < 70) {
    if (!results.structuredData.organizationSchema) {
      recommendations.push({
        category: RecommendationCategory.STRUCTURED_DATA,
        severity: RecommendationSeverity.HIGH,
        title: 'Add Organization Schema Markup',
        description: 'Your website is missing Organization schema markup, which helps AI understand your business.',
        actionRequired: 'Add JSON-LD Organization schema to your homepage with company details, logo, and contact information.',
        impact: RecommendationImpact.SEO,
      })
    }

    if (!results.structuredData.faqSchemas || results.structuredData.faqSchemas.length === 0) {
      recommendations.push({
        category: RecommendationCategory.FAQ_OPTIMIZATION,
        severity: RecommendationSeverity.MEDIUM,
        title: 'Implement FAQ Schema',
        description: 'FAQ schema helps AI chatbots find and recommend your content for relevant questions.',
        actionRequired: 'Add FAQ schema markup to your frequently asked questions sections.',
        impact: RecommendationImpact.SEO,
      })
    }
  }

  // Technical Accessibility Recommendations
  if (results.geoScore.technicalAccessibility < 70) {
    if (!results.technicalAccessibility.technicalElements?.httpsStatus) {
      recommendations.push({
        category: RecommendationCategory.TECHNICAL_ACCESSIBILITY,
        severity: RecommendationSeverity.HIGH,
        title: 'Enable HTTPS',
        description: 'Your website is not using HTTPS, which is required for security and SEO.',
        actionRequired: 'Install an SSL certificate and redirect all HTTP traffic to HTTPS.',
        impact: RecommendationImpact.SEO,
      })
    }

    if (!results.technicalAccessibility.metaTags?.title) {
      recommendations.push({
        category: RecommendationCategory.TECHNICAL_ACCESSIBILITY,
        severity: RecommendationSeverity.HIGH,
        title: 'Add Page Title',
        description: 'Your page is missing a title tag, which is essential for SEO.',
        actionRequired: 'Add a descriptive, keyword-rich title tag to your page.',
        impact: RecommendationImpact.SEO,
      })
    }

    if (results.technicalAccessibility.technicalElements?.responseTime && results.technicalAccessibility.technicalElements.responseTime > 2000) {
      recommendations.push({
        category: RecommendationCategory.TECHNICAL_ACCESSIBILITY,
        severity: RecommendationSeverity.MEDIUM,
        title: 'Improve Page Load Speed',
        description: `Your page loads in ${Math.round(results.technicalAccessibility.technicalElements.responseTime)}ms, which is slower than recommended.`,
        actionRequired: 'Optimize images, minify CSS/JS, and consider using a CDN to improve load times.',
        impact: RecommendationImpact.PERFORMANCE,
      })
    }
  }

  // Content Authority Recommendations
  if (results.geoScore.contentAuthority < 70) {
    recommendations.push({
      category: RecommendationCategory.CONTENT_AUTHORITY,
      severity: RecommendationSeverity.MEDIUM,
      title: 'Add More Authority Signals',
      description: 'Your content lacks authority signals like statistics, expert quotes, or citations.',
      actionRequired: 'Include relevant statistics, expert quotes, case studies, and citations to build content authority.',
      impact: RecommendationImpact.SEO,
    })
  }

  return recommendations
}

