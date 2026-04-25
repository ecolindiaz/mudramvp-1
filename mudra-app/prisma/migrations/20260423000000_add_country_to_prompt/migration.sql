-- Add country column to prompts, backfill from BrandProfile.trackingCountries,
-- and fan out duplicates so e.g. Colombia and Argentina each own their own
-- prompt rows instead of sharing a single 'es' record.

-- 1. Add nullable country column (so backfill can run without a constraint breach)
ALTER TABLE "prompts" ADD COLUMN "country" TEXT;

-- 2. Backfill: prefer primaryCountry when its language matches the prompt's language
UPDATE "prompts" p
SET "country" = bp."primaryCountry"
FROM "BrandProfile" bp
WHERE bp."id" = p."brandProfileId"
  AND p."country" IS NULL
  AND (
    (p."language" = 'en' AND bp."primaryCountry" IN ('US', 'GB'))
    OR (p."language" = 'es' AND bp."primaryCountry" IN ('ES', 'MX', 'CO', 'AR', 'PE'))
  );

-- 3. For rows whose primaryCountry didn't match the language, pick the first
--    trackingCountries entry that does match.
UPDATE "prompts" p
SET "country" = matched.c
FROM (
  SELECT DISTINCT ON (bp."id", lang_key)
    bp."id" AS brand_id,
    lang_key,
    c
  FROM "BrandProfile" bp,
       unnest(bp."trackingCountries") AS c,
       (VALUES ('en'), ('es')) AS langs(lang_key)
  WHERE (
    (lang_key = 'en' AND c IN ('US', 'GB'))
    OR (lang_key = 'es' AND c IN ('ES', 'MX', 'CO', 'AR', 'PE'))
  )
  ORDER BY bp."id", lang_key, c
) matched
WHERE p."brandProfileId" = matched.brand_id
  AND p."language" = matched.lang_key
  AND p."country" IS NULL;

-- 4. Final fallback: primaryCountry regardless of language mismatch
UPDATE "prompts" p
SET "country" = bp."primaryCountry"
FROM "BrandProfile" bp
WHERE bp."id" = p."brandProfileId"
  AND p."country" IS NULL;

-- 5. Ultimate fallback: US (should only hit orphaned rows)
UPDATE "prompts" SET "country" = 'US' WHERE "country" IS NULL;

-- 6. Fan out: for each brand that tracks multiple countries sharing a language,
--    duplicate each existing prompt into every additional country in that language.
--    SELECT DISTINCT inside the lateral guards against duplicate entries in
--    trackingCountries, and the NOT EXISTS clause makes this safe to re-run
--    (no double-insert if the migration gets replayed).
INSERT INTO "prompts" (
  "brandProfileId", "text", "category", "language", "country",
  "isCustom", "isActive", "editedByUser", "editedAt",
  "createdAt", "updatedAt"
)
SELECT
  p."brandProfileId",
  p."text",
  p."category",
  p."language",
  extra.c,
  p."isCustom",
  p."isActive",
  p."editedByUser",
  p."editedAt",
  p."createdAt",
  NOW()
FROM "prompts" p
JOIN "BrandProfile" bp ON bp."id" = p."brandProfileId"
CROSS JOIN LATERAL (
  SELECT DISTINCT c
  FROM unnest(bp."trackingCountries") AS u(c)
) AS extra(c)
WHERE extra.c <> p."country"
  AND (
    (p."language" = 'en' AND extra.c IN ('US', 'GB'))
    OR (p."language" = 'es' AND extra.c IN ('ES', 'MX', 'CO', 'AR', 'PE'))
  )
  AND NOT EXISTS (
    SELECT 1 FROM "prompts" existing
    WHERE existing."brandProfileId" = p."brandProfileId"
      AND existing."text" = p."text"
      AND existing."country" = extra.c
  );

-- 7. Lock the column down
ALTER TABLE "prompts" ALTER COLUMN "country" SET NOT NULL;
ALTER TABLE "prompts" ALTER COLUMN "country" SET DEFAULT 'US';

-- 8. Index for the new country-scoped lookups
CREATE INDEX "prompts_brandProfileId_country_isActive_idx"
  ON "prompts" ("brandProfileId", "country", "isActive");
