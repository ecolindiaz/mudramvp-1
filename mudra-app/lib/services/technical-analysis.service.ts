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

