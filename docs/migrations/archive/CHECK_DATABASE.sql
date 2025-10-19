-- Query to check all analysis data in database
-- Run this in Supabase SQL Editor to see what's been saved

-- Check GeoAnalysisResult (AI Visibility)
SELECT 
  id, 
  "brandProfileId", 
  "overallScore", 
  "createdAt"
FROM "GeoAnalysisResult" 
ORDER BY "createdAt" DESC 
LIMIT 5;

-- Check NaturalLanguageReport
SELECT 
  id, 
  "brandProfileId", 
  LEFT("reportText", 100) as report_preview,
  "createdAt"
FROM "NaturalLanguageReport" 
ORDER BY "createdAt" DESC 
LIMIT 5;

-- Check Prompts
SELECT 
  COUNT(*) as total_prompts,
  "brandProfileId",
  COUNT(CASE WHEN "isActive" = true THEN 1 END) as active_prompts
FROM "prompts"
GROUP BY "brandProfileId";

-- Check AnalysisRuns
SELECT 
  id,
  "brandProfileId",
  status,
  "overallScore",
  "ranAt",
  "completedAt"
FROM "analysis_runs"
ORDER BY "ranAt" DESC
LIMIT 5;
