-- Revert WeeklyReport from per-BrandProfile back to per-Company keying.
-- Previous migrations (20260227*) added brand_profile_id. This PR reverts to
-- using org_id (companyId) as the primary key for reports.

-- 1. Backfill org_id for any rows where it is NULL (use brand_profile_id → BrandProfile → companyWebsite → Site → Company)
UPDATE "weekly_reports" wr
SET "org_id" = sub.company_id
FROM (
  SELECT DISTINCT ON (wr2.id)
    wr2.id AS report_id,
    c.id   AS company_id
  FROM "weekly_reports" wr2
  JOIN "BrandProfile" bp ON bp.id = wr2."brand_profile_id"
  JOIN "sites" s ON (
    LOWER(REPLACE(REPLACE(REPLACE(REPLACE(bp."companyWebsite", 'https://', ''), 'http://', ''), 'www.', ''), '/', ''))
    = LOWER(REPLACE(REPLACE(s.domain, 'www.', ''), '/', ''))
  )
  JOIN "companies" c ON c.id = s."companyId"
  WHERE wr2."org_id" IS NULL
  ORDER BY wr2.id, c.id ASC
) sub
WHERE wr.id = sub.report_id;

-- 2. Delete orphan reports that still have no org_id (no matching company)
DELETE FROM "weekly_reports" WHERE "org_id" IS NULL;

-- 3. Deduplicate: when reverting from per-monitor to per-company, multiple rows
--    may share the same (org_id, week_start_utc). Keep the newest.
DELETE FROM "weekly_reports"
WHERE id NOT IN (
  SELECT DISTINCT ON ("org_id", "week_start_utc") id
  FROM "weekly_reports"
  ORDER BY "org_id", "week_start_utc", "created_at" DESC
);

-- 4. Make org_id NOT NULL
ALTER TABLE "weekly_reports" ALTER COLUMN "org_id" SET NOT NULL;

-- 5. Drop per-monitor constraints and indexes
DROP INDEX IF EXISTS "weekly_reports_brand_profile_id_week_start_utc_key";
DROP INDEX IF EXISTS "weekly_reports_brand_profile_id_idx";
ALTER TABLE "weekly_reports" DROP CONSTRAINT IF EXISTS "weekly_reports_brand_profile_id_fkey";

-- 6. Drop the brand_profile_id column
ALTER TABLE "weekly_reports" DROP COLUMN IF EXISTS "brand_profile_id";

-- 7. Add new unique constraint: one report per company per week
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.conname = 'weekly_reports_org_id_week_start_utc_key'
      AND t.relname = 'weekly_reports'
  ) THEN
    ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_org_id_week_start_utc_key"
      UNIQUE ("org_id", "week_start_utc");
  END IF;
END
$$;

-- 8. Fix org_id FK: CASCADE on delete (company deletion cascades to reports)
ALTER TABLE "weekly_reports" DROP CONSTRAINT IF EXISTS "weekly_reports_org_id_fkey";
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 9. Ensure org_id index exists
CREATE INDEX IF NOT EXISTS "weekly_reports_org_id_idx" ON "weekly_reports"("org_id");
