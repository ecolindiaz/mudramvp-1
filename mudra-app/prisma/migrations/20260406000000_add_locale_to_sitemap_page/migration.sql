-- AlterTable
ALTER TABLE "sitemap_pages" ADD COLUMN "locale" TEXT;

-- Backfill locale from page_url for existing rows.
-- Extract the 2-letter locale prefix, then validate against known ISO 639-1 codes
-- to avoid false positives on 2-letter slugs like /qr or /us.
UPDATE "sitemap_pages"
SET "locale" = extracted.code
FROM (
  SELECT id, LOWER((regexp_match(
    regexp_replace(page_url, '^https?://[^/]+', ''),
    '^/([a-z]{2})(?:-[a-z]{2})?(?:/|$)'
  ))[1]) AS code
  FROM "sitemap_pages"
) AS extracted
WHERE "sitemap_pages".id = extracted.id
  AND extracted.code IN (
    'en','es','fr','de','pt','it','nl','ja','ko','zh',
    'ru','ar','hi','pl','sv','da','no','fi','cs','tr',
    'th','vi','id','ms','he','uk','ro','hu','el','bg',
    'hr','sk','sl','lt','lv','et','ca','eu','gl','sr'
  );

-- CreateIndex
CREATE INDEX "sitemap_pages_brand_profile_id_locale_idx" ON "sitemap_pages"("brand_profile_id", "locale");
