// Database - Use the generated Prisma client from the correct path
import { PrismaClient, RecommendationSeverity, RecommendationImpact, RecommendationCategory } from '@/lib/generated/prisma'

// Algorithm - Import from the scrapers directory
import { extractEnhancedGEOData } from '../scrapers/enhanced-geo-scraper'

// Types - Use Prisma generated types
import type { TechnicalAnalysis, Website, User } from '@/lib/generated/prisma'
import type { EnhancedGEOResult } from '../scrapers/enhanced-geo-scraper'

// Validation
import { z } from 'zod'


// Prisma Client Instance
const prisma = new PrismaClient()

export async function saveAnalysisResults(websiteId: string, scraperResults: EnhancedGEOResult): Promise<TechnicalAnalysis> {
    try {
      // Step 1: Create main technical analysis record
      const analysis = await prisma.technicalAnalysis.create({
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
      await prisma.structuredData.create({
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
      await prisma.entityRecognition.create({
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
      await prisma.fAQAnalysis.create({
        data: {
          technicalAnalysisId: analysis.id,
          questionAnswerPairs: scraperResults.faqOptimization.questionAnswerPairs,
          faqStructuredData: scraperResults.faqOptimization.faqStructuredData,
          faqSchemaPresent: scraperResults.faqOptimization.faqSchemaPresent,
          faqSections: scraperResults.faqOptimization.faqSections,
          faqSectionCount: scraperResults.faqOptimization.faqSections.length,
        },
      }) // Step 5: Save content freshness data
      await prisma.contentFreshness.create({
        data: {
          technicalAnalysisId: analysis.id,
          publishDate: scraperResults.contentFreshness.publishDate || null,
          lastModified: scraperResults.contentFreshness.lastModified || null,
          updateFrequency: scraperResults.contentFreshness.updateFrequency || null,
          freshnessSignals: scraperResults.contentFreshness.freshnessSIgnals,
          freshnessSignalsCount: scraperResults.contentFreshness.freshnessSIgnals.length,
        },
      }) // Step 6: Save content structure data
      const authoritySignals = scraperResults.contentStructure.authoritySignals || {}
      const headingsHierarchy = scraperResults.contentStructure.headingsHierarchy || {}
    
      await prisma.contentStructure.create({
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
      const accessibility = scraperResults.technicalAccessibility.accessibility || {}
      await prisma.technicalAccessibility.create({
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

      return analysis
    } catch (error) {
      throw new Error(`Failed to save analysis: ${error}`)
    }
  }
  export async function createWebsiteIfNotExists(userId: string, url: string): Promise<Website> {
    try {
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

export async function getLatestAnalysis(websiteId: string): Promise<TechnicalAnalysis | null> {
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

