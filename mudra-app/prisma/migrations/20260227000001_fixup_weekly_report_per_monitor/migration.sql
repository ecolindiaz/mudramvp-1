-- Fix-up migration: complete the per-monitor WeeklyReport migration
-- Previous migration was partially applied. Current state:
--   - brand_profile_id column exists (nullable)
--   - FK weekly_reports_brand_profile_id_fkey exists (SET NULL — needs CASCADE)
--   - org_id is NOT NULL, FK is CASCADE (needs nullable, SET NULL)
--   - Unique is (org_id, week_start_utc, brand_profile_id) — wrong
--   - Need unique on (brand_profile_id, week_start_utc)
--   - 10 rows exist with brand_profile_id = NULL

-- 1. Backfill brand_profile_id from org_id → Company.domain → Site.domain → BrandProfile
UPDATE "weekly_reports" wr
SET "brand_profile_id" = sub.bp_id
FROM (
  SELECT DISTINCT ON (wr2.id)
    wr2.id AS report_id,
    bp.id  AS bp_id
  FROM "weekly_reports" wr2
  JOIN "companies" c ON c.id = wr2."org_id"
  JOIN "sites" s ON s."companyId" = c.id
  JOIN "BrandProfile" bp ON (
    LOWER(REPLACE(REPLACE(REPLACE(REPLACE(bp."companyWebsite", 'https://', ''), 'http://', ''), 'www.', ''), '/', ''))
    = LOWER(REPLACE(REPLACE(s.domain, 'www.', ''), '/', ''))
  )
  WHERE wr2."brand_profile_id" IS NULL
  ORDER BY wr2.id, bp."monitorOrder" ASC, bp.id ASC
) sub
WHERE wr.id = sub.report_id;

-- 2. Delete orphan reports that couldn't be matched
DELETE FROM "weekly_reports" WHERE "brand_profile_id" IS NULL;

-- 3. Make brand_profile_id NOT NULL
ALTER TABLE "weekly_reports" ALTER COLUMN "brand_profile_id" SET NOT NULL;

-- 4. Make org_id nullable
ALTER TABLE "weekly_reports" ALTER COLUMN "org_id" DROP NOT NULL;

-- 5. Drop the wrong 3-column unique constraint
DROP INDEX IF EXISTS "weekly_reports_org_id_week_start_utc_brand_profile_id_key";

-- 6. Also drop the old 2-column unique if it still exists
DROP INDEX IF EXISTS "weekly_reports_org_id_week_start_utc_key";

-- 7. Add the correct unique constraint: one report per monitor per week
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_brand_profile_id_week_start_utc_key"
  UNIQUE ("brand_profile_id", "week_start_utc");

-- 8. Fix the brand_profile_id FK: should be CASCADE, not SET NULL
ALTER TABLE "weekly_reports" DROP CONSTRAINT IF EXISTS "weekly_reports_brand_profile_id_fkey";
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_brand_profile_id_fkey"
  FOREIGN KEY ("brand_profile_id") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 9. Fix the org_id FK: should be SET NULL, not CASCADE
ALTER TABLE "weekly_reports" DROP CONSTRAINT IF EXISTS "weekly_reports_org_id_fkey";
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
