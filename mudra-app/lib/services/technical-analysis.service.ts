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
      })

      return analysis
    } catch (error) {
      throw new Error(`Failed to save analysis: ${error}`)
    }
  }