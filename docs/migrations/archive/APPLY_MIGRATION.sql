-- SQL Migration for Prompts and Analysis Tracking
-- Run this in your Supabase SQL Editor

-- 1. Add userId and lastAnalysisRunAt to BrandProfile
ALTER TABLE "BrandProfile" 
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "lastAnalysisRunAt" TIMESTAMP;

-- Create index on userId
CREATE INDEX IF NOT EXISTS "BrandProfile_userId_idx" ON "BrandProfile"("userId");

-- Add foreign key to users table (if users table exists and constraint doesn't exist)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                     WHERE constraint_name = 'BrandProfile_userId_fkey' 
                     AND table_name = 'BrandProfile') THEN
    ALTER TABLE "BrandProfile" 
      ADD CONSTRAINT "BrandProfile_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") 
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. Create prompts table
CREATE TABLE IF NOT EXISTS "prompts" (
  "id" SERIAL PRIMARY KEY,
  "brandProfileId" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "category" TEXT,
  "isCustom" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prompts_brandProfileId_fkey" 
    FOREIGN KEY ("brandProfileId") 
    REFERENCES "BrandProfile"("id") 
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Create indexes for prompts
CREATE INDEX IF NOT EXISTS "prompts_brandProfileId_idx" ON "prompts"("brandProfileId");
CREATE INDEX IF NOT EXISTS "prompts_brandProfileId_isActive_idx" ON "prompts"("brandProfileId", "isActive");

-- 3. Drop and recreate analysis_runs table (in case it exists with wrong structure)
DROP TABLE IF EXISTS "analysis_runs" CASCADE;

CREATE TABLE "analysis_runs" (
  "id" SERIAL PRIMARY KEY,
  "brandProfileId" INTEGER NOT NULL,
  "promptsUsed" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "results" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "ranAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP,
  CONSTRAINT "analysis_runs_brandProfileId_fkey" 
    FOREIGN KEY ("brandProfileId") 
    REFERENCES "BrandProfile"("id") 
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Create indexes for analysis_runs
CREATE INDEX "analysis_runs_brandProfileId_idx" ON "analysis_runs"("brandProfileId");
CREATE INDEX "analysis_runs_brandProfileId_ranAt_idx" ON "analysis_runs"("brandProfileId", "ranAt");
CREATE INDEX "analysis_runs_status_idx" ON "analysis_runs"("status");

-- 4. Create trigger to update updatedAt timestamp on prompts
CREATE OR REPLACE FUNCTION update_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS prompts_updated_at_trigger ON "prompts";
CREATE TRIGGER prompts_updated_at_trigger
  BEFORE UPDATE ON "prompts"
  FOR EACH ROW
  EXECUTE FUNCTION update_prompts_updated_at();

-- Migration complete!
