-- Opt-in strict language filter for Conversation Radar.
-- When true, Spanish-country scans drop English-only subreddits so results
-- stop skewing English for LATAM brands.
ALTER TABLE "BrandProfile"
  ADD COLUMN "strictLanguageFilter" BOOLEAN NOT NULL DEFAULT false;
