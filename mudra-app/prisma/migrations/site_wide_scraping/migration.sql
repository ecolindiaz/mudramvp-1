-- Site-Wide Scraping & Scoring Schema
-- Enables full sitemap discovery, per-page HTML snapshots, DOM extraction, and five-dimension scoring

-- ============================
-- Policy File Detection
-- ============================

CREATE TABLE "policy_files" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "brand_profile_id" INTEGER NOT NULL,
  "domain" TEXT NOT NULL,
  "robots_txt_exists" BOOLEAN NOT NULL DEFAULT false,
  "robots_txt_content" TEXT,
  "sitemap_xml_exists" BOOLEAN NOT NULL DEFAULT false,
  "sitemap_xml_url" TEXT,
  "llms_txt_exists" BOOLEAN NOT NULL DEFAULT false,
  "llms_txt_content" TEXT,
  "llms_full_txt_exists" BOOLEAN NOT NULL DEFAULT false,
  "llms_full_txt_content" TEXT,
  "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "policy_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "policy_files_brand_profile_id_idx" ON "policy_files"("brand_profile_id");
CREATE INDEX "policy_files_domain_idx" ON "policy_files"("domain");

-- ============================
-- Sitemap Pages
-- ============================

CREATE TABLE "sitemap_pages" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "brand_profile_id" INTEGER NOT NULL,
  "domain" TEXT NOT NULL,
  "page_url" TEXT NOT NULL,
  "page_type" TEXT, -- main, features, product, service, solutions, blog, pricing, use-cases, other
  "last_modified" TIMESTAMP(3),
  "change_frequency" TEXT, -- always, hourly, daily, weekly, monthly, yearly, never
  "priority" DOUBLE PRECISION,
  "discovered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_scraped_at" TIMESTAMP(3),
  "scrape_status" TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, failed, skipped
  "scrape_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sitemap_pages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sitemap_pages_brand_profile_id_idx" ON "sitemap_pages"("brand_profile_id");
CREATE INDEX "sitemap_pages_domain_idx" ON "sitemap_pages"("domain");
CREATE INDEX "sitemap_pages_page_url_idx" ON "sitemap_pages"("page_url");
CREATE INDEX "sitemap_pages_scrape_status_idx" ON "sitemap_pages"("scrape_status");
CREATE UNIQUE INDEX "sitemap_pages_brand_domain_url_unique" ON "sitemap_pages"("brand_profile_id", "domain", "page_url");

-- ============================
-- Page Snapshots (Versioned HTML Storage)
-- ============================

CREATE TABLE "page_snapshots" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "brand_profile_id" INTEGER NOT NULL,
  "sitemap_page_id" TEXT NOT NULL,
  "page_url" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_current" BOOLEAN NOT NULL DEFAULT true,
  
  -- Full HTML content
  "html_content" TEXT NOT NULL,
  "html_length" INTEGER NOT NULL,
  
  -- Extracted metadata (from meta tags)
  "metadata_json" JSONB NOT NULL DEFAULT '{}',
  
  -- Structured data (JSON-LD, Microdata, RDFa)
  "structured_data_json" JSONB NOT NULL DEFAULT '{}',
  
  -- Semantic structure (element counts, hierarchy)
  "semantic_structure_json" JSONB NOT NULL DEFAULT '{}',
  
  -- FAQ content (extracted Q&A pairs)
  "faq_content_json" JSONB NOT NULL DEFAULT '{}',
  
  -- Schema validation results
  "validation_results_json" JSONB NOT NULL DEFAULT '{}',
  
  -- Scrape metadata
  "scraped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scrape_duration_ms" INTEGER,
  "http_status_code" INTEGER,
  "content_type" TEXT,
  
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "page_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "page_snapshots_brand_profile_id_idx" ON "page_snapshots"("brand_profile_id");
CREATE INDEX "page_snapshots_sitemap_page_id_idx" ON "page_snapshots"("sitemap_page_id");
CREATE INDEX "page_snapshots_page_url_idx" ON "page_snapshots"("page_url");
CREATE INDEX "page_snapshots_is_current_idx" ON "page_snapshots"("is_current");
CREATE INDEX "page_snapshots_scraped_at_idx" ON "page_snapshots"("scraped_at");

-- ============================
-- Page Scores (Five-Dimension Scoring)
-- ============================

CREATE TABLE "page_scores" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "brand_profile_id" INTEGER NOT NULL,
  "page_snapshot_id" TEXT NOT NULL,
  "sitemap_page_id" TEXT NOT NULL,
  "page_url" TEXT NOT NULL,
  
  -- Five-Dimension Scores (0-100 each)
  "overall_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  
  -- Dimension 1: Structured Data Compliance
  "structured_data_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "structured_data_details" JSONB NOT NULL DEFAULT '{}',
  
  -- Dimension 2: Semantic HTML Quality
  "semantic_html_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "semantic_html_details" JSONB NOT NULL DEFAULT '{}',
  
  -- Dimension 3: Content Citability
  "citability_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "citability_details" JSONB NOT NULL DEFAULT '{}',
  
  -- Dimension 4: Technical Accessibility
  "accessibility_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "accessibility_details" JSONB NOT NULL DEFAULT '{}',
  
  -- Dimension 5: Answer Engine Readiness
  "answer_engine_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "answer_engine_details" JSONB NOT NULL DEFAULT '{}',
  
  -- Issues and Recommendations
  "issues" JSONB NOT NULL DEFAULT '[]',
  "recommendations" JSONB NOT NULL DEFAULT '[]',
  
  "scored_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "page_scores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "page_scores_brand_profile_id_idx" ON "page_scores"("brand_profile_id");
CREATE INDEX "page_scores_page_snapshot_id_idx" ON "page_scores"("page_snapshot_id");
CREATE INDEX "page_scores_sitemap_page_id_idx" ON "page_scores"("sitemap_page_id");
CREATE INDEX "page_scores_overall_score_idx" ON "page_scores"("overall_score");
CREATE UNIQUE INDEX "page_scores_snapshot_unique" ON "page_scores"("page_snapshot_id");

-- ============================
-- Site-Wide Technical Structure Score
-- ============================

CREATE TABLE "site_structure_scores" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "brand_profile_id" INTEGER NOT NULL,
  "domain" TEXT NOT NULL,
  
  -- Aggregated Site-Wide Scores
  "overall_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "structured_data_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "semantic_html_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "citability_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "accessibility_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "answer_engine_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  
  -- Page Statistics
  "total_pages" INTEGER NOT NULL DEFAULT 0,
  "pages_scraped" INTEGER NOT NULL DEFAULT 0,
  "pages_scored" INTEGER NOT NULL DEFAULT 0,
  "pages_with_issues" INTEGER NOT NULL DEFAULT 0,
  
  -- Schema Coverage
  "schema_coverage" JSONB NOT NULL DEFAULT '{}',
  
  -- Top Issues Across Site
  "top_issues" JSONB NOT NULL DEFAULT '[]',
  
  -- Score Breakdown by Page Type
  "score_by_page_type" JSONB NOT NULL DEFAULT '{}',
  
  -- Historical Change
  "previous_score" DOUBLE PRECISION,
  "score_change" DOUBLE PRECISION,
  
  "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "site_structure_scores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "site_structure_scores_brand_profile_id_idx" ON "site_structure_scores"("brand_profile_id");
CREATE INDEX "site_structure_scores_domain_idx" ON "site_structure_scores"("domain");
CREATE INDEX "site_structure_scores_computed_at_idx" ON "site_structure_scores"("computed_at");

-- ============================
-- Scrape Jobs (Orchestration)
-- ============================

CREATE TABLE "scrape_jobs" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "brand_profile_id" INTEGER NOT NULL,
  "domain" TEXT NOT NULL,
  "job_type" TEXT NOT NULL DEFAULT 'full_site', -- full_site, single_page, incremental
  "status" TEXT NOT NULL DEFAULT 'pending', -- pending, policy_check, sitemap_discovery, scraping, scoring, completed, failed
  
  -- Progress Tracking
  "total_pages" INTEGER NOT NULL DEFAULT 0,
  "pages_scraped" INTEGER NOT NULL DEFAULT 0,
  "pages_scored" INTEGER NOT NULL DEFAULT 0,
  "pages_failed" INTEGER NOT NULL DEFAULT 0,
  
  -- Job Configuration
  "config" JSONB NOT NULL DEFAULT '{}',
  
  -- Error Tracking
  "error_message" TEXT,
  "errors" JSONB NOT NULL DEFAULT '[]',
  
  -- Timing
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "duration_ms" INTEGER,
  
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "scrape_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scrape_jobs_brand_profile_id_idx" ON "scrape_jobs"("brand_profile_id");
CREATE INDEX "scrape_jobs_status_idx" ON "scrape_jobs"("status");
CREATE INDEX "scrape_jobs_created_at_idx" ON "scrape_jobs"("created_at");

-- ============================
-- Foreign Key Constraints
-- ============================

ALTER TABLE "policy_files" ADD CONSTRAINT "policy_files_brand_profile_id_fkey" 
  FOREIGN KEY ("brand_profile_id") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sitemap_pages" ADD CONSTRAINT "sitemap_pages_brand_profile_id_fkey" 
  FOREIGN KEY ("brand_profile_id") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "page_snapshots" ADD CONSTRAINT "page_snapshots_brand_profile_id_fkey" 
  FOREIGN KEY ("brand_profile_id") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "page_snapshots" ADD CONSTRAINT "page_snapshots_sitemap_page_id_fkey" 
  FOREIGN KEY ("sitemap_page_id") REFERENCES "sitemap_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "page_scores" ADD CONSTRAINT "page_scores_brand_profile_id_fkey" 
  FOREIGN KEY ("brand_profile_id") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "page_scores" ADD CONSTRAINT "page_scores_page_snapshot_id_fkey" 
  FOREIGN KEY ("page_snapshot_id") REFERENCES "page_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "page_scores" ADD CONSTRAINT "page_scores_sitemap_page_id_fkey" 
  FOREIGN KEY ("sitemap_page_id") REFERENCES "sitemap_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "site_structure_scores" ADD CONSTRAINT "site_structure_scores_brand_profile_id_fkey" 
  FOREIGN KEY ("brand_profile_id") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scrape_jobs" ADD CONSTRAINT "scrape_jobs_brand_profile_id_fkey" 
  FOREIGN KEY ("brand_profile_id") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
