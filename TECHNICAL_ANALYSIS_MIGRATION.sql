-- Technical Structure Analysis Table Migration
-- Run this in your Supabase SQL Editor

-- Create TechnicalStructureAnalysis table
CREATE TABLE IF NOT EXISTS "TechnicalStructureAnalysis" (
  "id" SERIAL PRIMARY KEY,
  "brandProfileId" INTEGER NOT NULL,
  "websiteUrl" TEXT NOT NULL,
  "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "performanceScore" DOUBLE PRECISION,
  "seoScore" DOUBLE PRECISION,
  "accessibilityScore" DOUBLE PRECISION,
  "securityScore" DOUBLE PRECISION,
  "structureScore" DOUBLE PRECISION,
  "insights" JSONB DEFAULT '[]'::jsonb,
  "recommendations" JSONB DEFAULT '[]'::jsonb,
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TechnicalStructureAnalysis_brandProfileId_fkey" 
    FOREIGN KEY ("brandProfileId") 
    REFERENCES "BrandProfile"("id") 
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "TechnicalStructureAnalysis_brandProfileId_idx" 
  ON "TechnicalStructureAnalysis"("brandProfileId");
CREATE INDEX IF NOT EXISTS "TechnicalStructureAnalysis_brandProfileId_createdAt_idx" 
  ON "TechnicalStructureAnalysis"("brandProfileId", "createdAt");

-- Create GeoAnalysisResult table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS "GeoAnalysisResult" (
  "id" SERIAL PRIMARY KEY,
  "brandProfileId" INTEGER NOT NULL,
  "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "analyses" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "summary" JSONB DEFAULT '{}'::jsonb,
  "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeoAnalysisResult_brandProfileId_fkey" 
    FOREIGN KEY ("brandProfileId") 
    REFERENCES "BrandProfile"("id") 
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Create indexes for GeoAnalysisResult
CREATE INDEX IF NOT EXISTS "GeoAnalysisResult_brandProfileId_idx" 
  ON "GeoAnalysisResult"("brandProfileId");
CREATE INDEX IF NOT EXISTS "GeoAnalysisResult_brandProfileId_timestamp_idx" 
  ON "GeoAnalysisResult"("brandProfileId", "timestamp");

-- Create OrganicTrafficMetrics table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS "OrganicTrafficMetrics" (
  "id" SERIAL PRIMARY KEY,
  "brandProfileId" INTEGER NOT NULL,
  "monthlyVisitors" INTEGER NOT NULL DEFAULT 0,
  "monthOverMonthGrowth" DOUBLE PRECISION DEFAULT 0,
  "topPages" JSONB DEFAULT '[]'::jsonb,
  "topKeywords" JSONB DEFAULT '[]'::jsonb,
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganicTrafficMetrics_brandProfileId_fkey" 
    FOREIGN KEY ("brandProfileId") 
    REFERENCES "BrandProfile"("id") 
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Create indexes for OrganicTrafficMetrics
CREATE INDEX IF NOT EXISTS "OrganicTrafficMetrics_brandProfileId_idx" 
  ON "OrganicTrafficMetrics"("brandProfileId");

-- Create NaturalLanguageReport table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS "NaturalLanguageReport" (
  "id" SERIAL PRIMARY KEY,
  "brandProfileId" INTEGER NOT NULL,
  "reportText" TEXT NOT NULL,
  "insights" JSONB DEFAULT '[]'::jsonb,
  "recommendations" JSONB DEFAULT '[]'::jsonb,
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NaturalLanguageReport_brandProfileId_fkey" 
    FOREIGN KEY ("brandProfileId") 
    REFERENCES "BrandProfile"("id") 
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Create indexes for NaturalLanguageReport
CREATE INDEX IF NOT EXISTS "NaturalLanguageReport_brandProfileId_idx" 
  ON "NaturalLanguageReport"("brandProfileId");
CREATE INDEX IF NOT EXISTS "NaturalLanguageReport_brandProfileId_createdAt_idx" 
  ON "NaturalLanguageReport"("brandProfileId", "createdAt");

-- Migration complete!
