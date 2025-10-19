-- Fix prompts table id column to ensure it has proper serial/autoincrement
-- Run this in your Supabase SQL Editor

-- Drop the prompts table and recreate it with correct structure
DROP TABLE IF EXISTS "prompts" CASCADE;

CREATE TABLE "prompts" (
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
CREATE INDEX "prompts_brandProfileId_idx" ON "prompts"("brandProfileId");
CREATE INDEX "prompts_brandProfileId_isActive_idx" ON "prompts"("brandProfileId", "isActive");

-- Recreate the trigger
DROP TRIGGER IF EXISTS prompts_updated_at_trigger ON "prompts";
CREATE TRIGGER prompts_updated_at_trigger
  BEFORE UPDATE ON "prompts"
  FOR EACH ROW
  EXECUTE FUNCTION update_prompts_updated_at();

-- Migration complete!
