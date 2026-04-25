-- Add country to ConversationOpportunity so the Conversation Radar's
-- cron loop can isolate analysis budget per country (CO and AR scans
-- no longer share the 'es' opportunity pool).
--
-- Unlike prompts, opportunities are not fanned out — each row is a
-- single Reddit observation and gets assigned to ONE country (the one
-- whose scan picked it up). For pre-existing rows we approximate by
-- choosing a sensible country from the brand's tracked set.

-- 1. Add nullable column for backfill
ALTER TABLE "conversation_opportunities" ADD COLUMN "country" TEXT;

-- 2. Prefer primaryCountry when its language matches
UPDATE "conversation_opportunities" o
SET "country" = bp."primaryCountry"
FROM "BrandProfile" bp
WHERE bp."id" = o."brandProfileId"
  AND o."country" IS NULL
  AND (
    (o."language" = 'en' AND bp."primaryCountry" IN ('US', 'GB'))
    OR (o."language" = 'es' AND bp."primaryCountry" IN ('ES', 'MX', 'CO', 'AR', 'PE'))
  );

-- 3. Otherwise pick the first trackingCountries entry whose language matches
UPDATE "conversation_opportunities" o
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
WHERE o."brandProfileId" = matched.brand_id
  AND o."language" = matched.lang_key
  AND o."country" IS NULL;

-- 4. Final fallback: primaryCountry regardless of language
UPDATE "conversation_opportunities" o
SET "country" = bp."primaryCountry"
FROM "BrandProfile" bp
WHERE bp."id" = o."brandProfileId"
  AND o."country" IS NULL;

-- 5. Last-resort default
UPDATE "conversation_opportunities" SET "country" = 'US' WHERE "country" IS NULL;

-- 6. Lock down
ALTER TABLE "conversation_opportunities" ALTER COLUMN "country" SET NOT NULL;
ALTER TABLE "conversation_opportunities" ALTER COLUMN "country" SET DEFAULT 'US';

-- 7. Swap unique constraint from (brandProfileId, postUrl, language) to
--    (brandProfileId, postUrl, country). Same URL can now be tracked
--    once per country a brand monitors.
ALTER TABLE "conversation_opportunities"
  DROP CONSTRAINT IF EXISTS "conversation_opportunities_brandProfileId_postUrl_language_key";
ALTER TABLE "conversation_opportunities"
  ADD CONSTRAINT "conversation_opportunities_brandProfileId_postUrl_country_key"
  UNIQUE ("brandProfileId", "postUrl", "country");

-- 8. Index for country-scoped lookups
CREATE INDEX "conversation_opportunities_brandProfileId_country_status_idx"
  ON "conversation_opportunities" ("brandProfileId", "country", "status");
