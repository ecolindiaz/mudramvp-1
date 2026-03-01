-- Fix-up migration #2: complete per-monitor WeeklyReport migration
-- Current state: brand_profile_id exists (nullable), all values NULL,
-- wrong 3-col unique, FKs need fixing.

-- 1. Backfill brand_profile_id
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

-- 3. Deduplicate: for each (brand_profile_id, week_start_utc) group, keep the newest
DELETE FROM "weekly_reports"
WHERE id NOT IN (
  SELECT DISTINCT ON (brand_profile_id, week_start_utc) id
  FROM "weekly_reports"
  ORDER BY brand_profile_id, week_start_utc, created_at DESC
);

-- 4. Make brand_profile_id NOT NULL
ALTER TABLE "weekly_reports" ALTER COLUMN "brand_profile_id" SET NOT NULL;

-- 5. Make org_id nullable
ALTER TABLE "weekly_reports" ALTER COLUMN "org_id" DROP NOT NULL;

-- 6. Drop the wrong 3-column unique constraint
DROP INDEX IF EXISTS "weekly_reports_org_id_week_start_utc_brand_profile_id_key";
DROP INDEX IF EXISTS "weekly_reports_org_id_week_start_utc_key";

-- 7. Add the correct unique: one report per monitor per week
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.conname = 'weekly_reports_brand_profile_id_week_start_utc_key'
      AND t.relname = 'weekly_reports'
  ) THEN
    ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_brand_profile_id_week_start_utc_key"
      UNIQUE ("brand_profile_id", "week_start_utc");
  END IF;
END
$$;

-- 8. Fix brand_profile_id FK: CASCADE (not SET NULL)
ALTER TABLE "weekly_reports" DROP CONSTRAINT IF EXISTS "weekly_reports_brand_profile_id_fkey";
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_brand_profile_id_fkey"
  FOREIGN KEY ("brand_profile_id") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 9. Fix org_id FK: SET NULL (not CASCADE)
ALTER TABLE "weekly_reports" DROP CONSTRAINT IF EXISTS "weekly_reports_org_id_fkey";
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
