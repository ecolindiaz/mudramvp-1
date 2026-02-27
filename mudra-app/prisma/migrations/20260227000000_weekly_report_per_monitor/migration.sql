-- Migration: WeeklyReport per-monitor (per-BrandProfile)
-- Previously: one report per company per week (companyId, weekStartUtc)
-- After:      one report per monitor per week (brandProfileId, weekStartUtc)

-- 1. Add brand_profile_id column (nullable initially)
ALTER TABLE "weekly_reports" ADD COLUMN "brand_profile_id" INTEGER;

-- 2. Backfill: companyId → Company.domain → Site.domain → BrandProfile.companyWebsite
--    Pick the BrandProfile with the lowest monitorOrder for each matching domain.
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
    LOWER(REPLACE(bp."companyWebsite", 'https://', ''))  = LOWER(s.domain)
    OR LOWER(REPLACE(REPLACE(bp."companyWebsite", 'https://', ''), 'http://', ''))  = LOWER(s.domain)
    OR LOWER(REPLACE(REPLACE(REPLACE(bp."companyWebsite", 'https://', ''), 'http://', ''), 'www.', ''))  = LOWER(REPLACE(s.domain, 'www.', ''))
    OR LOWER(REPLACE(REPLACE(REPLACE(REPLACE(bp."companyWebsite", 'https://', ''), 'http://', ''), 'www.', ''), '/', ''))  = LOWER(REPLACE(REPLACE(s.domain, 'www.', ''), '/', ''))
  )
  ORDER BY wr2.id, bp."monitorOrder" ASC, bp.id ASC
) sub
WHERE wr.id = sub.report_id;

-- 3. Delete orphan reports that couldn't be matched to any BrandProfile
DELETE FROM "weekly_reports" WHERE "brand_profile_id" IS NULL;

-- 4. Make brand_profile_id NOT NULL
ALTER TABLE "weekly_reports" ALTER COLUMN "brand_profile_id" SET NOT NULL;

-- 5. Make org_id (companyId) nullable
ALTER TABLE "weekly_reports" ALTER COLUMN "org_id" DROP NOT NULL;

-- 6. Drop old unique constraint and index
DROP INDEX IF EXISTS "weekly_reports_org_id_week_start_utc_key";

-- 7. Add new unique constraint: one report per monitor per week
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_brand_profile_id_week_start_utc_key" UNIQUE ("brand_profile_id", "week_start_utc");

-- 8. Add FK to BrandProfile
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 9. Add index on brand_profile_id
CREATE INDEX "weekly_reports_brand_profile_id_idx" ON "weekly_reports"("brand_profile_id");

-- 10. Update company FK to SET NULL on delete (was CASCADE)
ALTER TABLE "weekly_reports" DROP CONSTRAINT IF EXISTS "weekly_reports_org_id_fkey";
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
