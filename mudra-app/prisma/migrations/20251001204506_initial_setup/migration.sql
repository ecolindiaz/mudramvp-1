-- CreateEnum
CREATE TYPE "RecommendationSeverity" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "RecommendationImpact" AS ENUM ('SEO', 'PERFORMANCE', 'ACCESSIBILITY', 'USER_EXPERIENCE');

-- CreateEnum
CREATE TYPE "RecommendationCategory" AS ENUM ('STRUCTURED_DATA', 'CONTENT_AUTHORITY', 'TECHNICAL_ACCESSIBILITY', 'FAQ_OPTIMIZATION', 'CONTENT_FRESHNESS', 'ENTITY_RECOGNITION');

-- CreateTable
CREATE TABLE "BrandProfile" (
    "id" SERIAL NOT NULL,
    "userId" TEXT,
    "companyName" TEXT,
    "companyWebsite" TEXT,
    "companyLinkedIn" TEXT,
    "companyTwitter" TEXT,
    "userName" TEXT,
    "userRole" TEXT,
    "userAvatar" TEXT,
    "companyDescription" TEXT,
    "companyIndustry" TEXT,
    "companyServices" TEXT,
    "companyICP" TEXT,
    "competitors" TEXT,
    "monthlySearchVolume" TEXT,
    "aiRecommendations" TEXT,
    "stage" TEXT,
    "resources" TEXT,
    "lastAnalysisRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_analysis_results" (
    "id" TEXT NOT NULL,
    "brandProfileId" INTEGER NOT NULL,
    "brandName" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "analyses" JSONB NOT NULL,
    "competitorData" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "errorMessage" TEXT,

    CONSTRAINT "geo_analysis_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organic_traffic_metrics" (
    "id" TEXT NOT NULL,
    "brandProfileId" INTEGER NOT NULL,
    "monthlyVisitors" INTEGER NOT NULL DEFAULT 0,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "avgSessionDuration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "organicTrafficShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "topKeywords" JSONB NOT NULL,
    "weekOverWeekGrowth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthOverMonthGrowth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organic_traffic_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_structure_analyses" (
    "id" TEXT NOT NULL,
    "brandProfileId" INTEGER NOT NULL,
    "overallHealth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "seoScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "performanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accessibilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "structuredData" JSONB NOT NULL,
    "metaTags" JSONB NOT NULL,
    "headingStructure" JSONB NOT NULL,
    "internalLinks" JSONB NOT NULL,
    "pageLoadTime" DOUBLE PRECISION,
    "mobileScore" DOUBLE PRECISION,
    "criticalIssues" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "suggestions" JSONB NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "websiteUrl" TEXT NOT NULL,

    CONSTRAINT "technical_structure_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "natural_language_reports" (
    "id" TEXT NOT NULL,
    "brandProfileId" INTEGER NOT NULL,
    "reportType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "fullReport" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "insights" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "model" TEXT,

    CONSTRAINT "natural_language_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompts" (
    "id" TEXT NOT NULL,
    "brandProfileId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_runs" (
    "id" TEXT NOT NULL,
    "brandProfileId" INTEGER NOT NULL,
    "promptsUsed" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "competitorData" JSONB,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "analysis_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "websites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "websites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_analyses" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contentAuthority" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "technicalAccessibility" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "structuredData" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "entityRecognition" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "faqOptimization" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contentFreshness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technical_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structured_data" (
    "id" TEXT NOT NULL,
    "technicalAnalysisId" TEXT NOT NULL,
    "jsonLdData" JSONB NOT NULL,
    "microdataData" JSONB NOT NULL,
    "rdfaData" JSONB NOT NULL,
    "schemaTypes" JSONB NOT NULL,
    "faqSchemas" JSONB NOT NULL,
    "organizationSchema" JSONB,
    "websiteSchema" JSONB,
    "breadcrumbSchema" JSONB,
    "hasOrganizationSchema" BOOLEAN NOT NULL DEFAULT false,
    "hasWebsiteSchema" BOOLEAN NOT NULL DEFAULT false,
    "hasBreadcrumbSchema" BOOLEAN NOT NULL DEFAULT false,
    "hasFAQSchema" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "structured_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_recognition" (
    "id" TEXT NOT NULL,
    "technicalAnalysisId" TEXT NOT NULL,
    "organizations" JSONB NOT NULL,
    "people" JSONB NOT NULL,
    "technologies" JSONB NOT NULL,
    "products" JSONB NOT NULL,
    "locations" JSONB NOT NULL,
    "organizationsCount" INTEGER NOT NULL DEFAULT 0,
    "peopleCount" INTEGER NOT NULL DEFAULT 0,
    "technologiesCount" INTEGER NOT NULL DEFAULT 0,
    "productsCount" INTEGER NOT NULL DEFAULT 0,
    "locationsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_recognition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_analyses" (
    "id" TEXT NOT NULL,
    "technicalAnalysisId" TEXT NOT NULL,
    "questionAnswerPairs" INTEGER NOT NULL DEFAULT 0,
    "faqStructuredData" BOOLEAN NOT NULL DEFAULT false,
    "faqSchemaPresent" BOOLEAN NOT NULL DEFAULT false,
    "faqSections" JSONB NOT NULL,
    "faqSectionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faq_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_freshness" (
    "id" TEXT NOT NULL,
    "technicalAnalysisId" TEXT NOT NULL,
    "publishDate" TEXT,
    "lastModified" TEXT,
    "updateFrequency" TEXT,
    "freshnessSignals" JSONB NOT NULL,
    "freshnessSignalsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_freshness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_structures" (
    "id" TEXT NOT NULL,
    "technicalAnalysisId" TEXT NOT NULL,
    "headingsHierarchy" JSONB NOT NULL,
    "h1Count" INTEGER NOT NULL DEFAULT 0,
    "h2Count" INTEGER NOT NULL DEFAULT 0,
    "h3Count" INTEGER NOT NULL DEFAULT 0,
    "h4Count" INTEGER NOT NULL DEFAULT 0,
    "h5Count" INTEGER NOT NULL DEFAULT 0,
    "h6Count" INTEGER NOT NULL DEFAULT 0,
    "authoritySignals" JSONB NOT NULL,
    "statisticsCount" INTEGER NOT NULL DEFAULT 0,
    "expertQuotesCount" INTEGER NOT NULL DEFAULT 0,
    "citationsCount" INTEGER NOT NULL DEFAULT 0,
    "testimonialsCount" INTEGER NOT NULL DEFAULT 0,
    "wordCount" INTEGER,
    "paragraphCount" INTEGER,
    "listCount" INTEGER,
    "tableCount" INTEGER,
    "imageCount" INTEGER,
    "readingLevel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_accessibility" (
    "id" TEXT NOT NULL,
    "technicalAnalysisId" TEXT NOT NULL,
    "metaTags" JSONB NOT NULL,
    "hasTitle" BOOLEAN NOT NULL DEFAULT false,
    "hasDescription" BOOLEAN NOT NULL DEFAULT false,
    "hasCanonical" BOOLEAN NOT NULL DEFAULT false,
    "hasRobots" BOOLEAN NOT NULL DEFAULT false,
    "hreflangCount" INTEGER NOT NULL DEFAULT 0,
    "openGraphData" JSONB NOT NULL,
    "twitterCardData" JSONB NOT NULL,
    "hasOgTitle" BOOLEAN NOT NULL DEFAULT false,
    "hasOgDescription" BOOLEAN NOT NULL DEFAULT false,
    "hasOgImage" BOOLEAN NOT NULL DEFAULT false,
    "hasTwitterCard" BOOLEAN NOT NULL DEFAULT false,
    "technicalElements" JSONB NOT NULL,
    "httpsStatus" BOOLEAN NOT NULL DEFAULT false,
    "statusCode" INTEGER,
    "contentType" TEXT,
    "responseTime" DOUBLE PRECISION,
    "mobileFriendly" BOOLEAN,
    "internalLinksCount" INTEGER NOT NULL DEFAULT 0,
    "lcp" DOUBLE PRECISION,
    "fid" DOUBLE PRECISION,
    "cls" DOUBLE PRECISION,
    "accessibilityData" JSONB NOT NULL,
    "altTextCount" INTEGER NOT NULL DEFAULT 0,
    "ariaLabelsCount" INTEGER NOT NULL DEFAULT 0,
    "semanticElementsCount" INTEGER NOT NULL DEFAULT 0,
    "skipLinks" BOOLEAN NOT NULL DEFAULT false,
    "headingStructureValid" BOOLEAN NOT NULL DEFAULT false,
    "landmarkRolesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technical_accessibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_recommendations" (
    "id" TEXT NOT NULL,
    "technicalAnalysisId" TEXT NOT NULL,
    "category" "RecommendationCategory" NOT NULL,
    "severity" "RecommendationSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actionRequired" TEXT NOT NULL,
    "impact" "RecommendationImpact" NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_snapshots" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "crawledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,

    CONSTRAINT "crawl_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_scores" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "components" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technical_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "tags" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "suggestedOwner" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_verifications" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_reports" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "week_start_utc" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "model" TEXT,
    "summary_markdown" TEXT,
    "summary_json" JSONB,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "cost_cents" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_report_sections" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "body_markdown" TEXT,
    "body_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_report_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_report_source_refs" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "ref_table" TEXT,
    "ref_id" TEXT,
    "url" TEXT,
    "label" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_report_source_refs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_userId_key" ON "BrandProfile"("userId");

-- CreateIndex
CREATE INDEX "geo_analysis_results_brandProfileId_idx" ON "geo_analysis_results"("brandProfileId");

-- CreateIndex
CREATE INDEX "geo_analysis_results_timestamp_idx" ON "geo_analysis_results"("timestamp");

-- CreateIndex
CREATE INDEX "geo_analysis_results_overallScore_idx" ON "geo_analysis_results"("overallScore");

-- CreateIndex
CREATE INDEX "organic_traffic_metrics_brandProfileId_idx" ON "organic_traffic_metrics"("brandProfileId");

-- CreateIndex
CREATE INDEX "organic_traffic_metrics_periodStart_idx" ON "organic_traffic_metrics"("periodStart");

-- CreateIndex
CREATE INDEX "technical_structure_analyses_brandProfileId_idx" ON "technical_structure_analyses"("brandProfileId");

-- CreateIndex
CREATE INDEX "technical_structure_analyses_analyzedAt_idx" ON "technical_structure_analyses"("analyzedAt");

-- CreateIndex
CREATE INDEX "technical_structure_analyses_overallHealth_idx" ON "technical_structure_analyses"("overallHealth");

-- CreateIndex
CREATE INDEX "natural_language_reports_brandProfileId_idx" ON "natural_language_reports"("brandProfileId");

-- CreateIndex
CREATE INDEX "natural_language_reports_generatedAt_idx" ON "natural_language_reports"("generatedAt");

-- CreateIndex
CREATE INDEX "natural_language_reports_reportType_idx" ON "natural_language_reports"("reportType");

-- CreateIndex
CREATE INDEX "prompts_brandProfileId_idx" ON "prompts"("brandProfileId");

-- CreateIndex
CREATE INDEX "prompts_category_idx" ON "prompts"("category");

-- CreateIndex
CREATE INDEX "prompts_isActive_idx" ON "prompts"("isActive");

-- CreateIndex
CREATE INDEX "analysis_runs_brandProfileId_idx" ON "analysis_runs"("brandProfileId");

-- CreateIndex
CREATE INDEX "analysis_runs_startedAt_idx" ON "analysis_runs"("startedAt");

-- CreateIndex
CREATE INDEX "analysis_runs_overallScore_idx" ON "analysis_runs"("overallScore");

-- CreateIndex
CREATE INDEX "websites_userId_idx" ON "websites"("userId");

-- CreateIndex
CREATE INDEX "websites_domain_idx" ON "websites"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "websites_userId_url_key" ON "websites"("userId", "url");

-- CreateIndex
CREATE INDEX "technical_analyses_websiteId_idx" ON "technical_analyses"("websiteId");

-- CreateIndex
CREATE INDEX "technical_analyses_timestamp_idx" ON "technical_analyses"("timestamp");

-- CreateIndex
CREATE INDEX "technical_analyses_websiteId_timestamp_idx" ON "technical_analyses"("websiteId", "timestamp");

-- CreateIndex
CREATE INDEX "technical_analyses_websiteId_overallScore_idx" ON "technical_analyses"("websiteId", "overallScore");

-- CreateIndex
CREATE INDEX "technical_analyses_timestamp_overallScore_idx" ON "technical_analyses"("timestamp", "overallScore");

-- CreateIndex
CREATE UNIQUE INDEX "structured_data_technicalAnalysisId_key" ON "structured_data"("technicalAnalysisId");

-- CreateIndex
CREATE INDEX "structured_data_hasOrganizationSchema_idx" ON "structured_data"("hasOrganizationSchema");

-- CreateIndex
CREATE INDEX "structured_data_hasFAQSchema_idx" ON "structured_data"("hasFAQSchema");

-- CreateIndex
CREATE UNIQUE INDEX "entity_recognition_technicalAnalysisId_key" ON "entity_recognition"("technicalAnalysisId");

-- CreateIndex
CREATE INDEX "entity_recognition_organizationsCount_idx" ON "entity_recognition"("organizationsCount");

-- CreateIndex
CREATE INDEX "entity_recognition_technologiesCount_idx" ON "entity_recognition"("technologiesCount");

-- CreateIndex
CREATE UNIQUE INDEX "faq_analyses_technicalAnalysisId_key" ON "faq_analyses"("technicalAnalysisId");

-- CreateIndex
CREATE INDEX "faq_analyses_questionAnswerPairs_idx" ON "faq_analyses"("questionAnswerPairs");

-- CreateIndex
CREATE INDEX "faq_analyses_faqSchemaPresent_idx" ON "faq_analyses"("faqSchemaPresent");

-- CreateIndex
CREATE UNIQUE INDEX "content_freshness_technicalAnalysisId_key" ON "content_freshness"("technicalAnalysisId");

-- CreateIndex
CREATE UNIQUE INDEX "content_structures_technicalAnalysisId_key" ON "content_structures"("technicalAnalysisId");

-- CreateIndex
CREATE INDEX "content_structures_wordCount_idx" ON "content_structures"("wordCount");

-- CreateIndex
CREATE UNIQUE INDEX "technical_accessibility_technicalAnalysisId_key" ON "technical_accessibility"("technicalAnalysisId");

-- CreateIndex
CREATE INDEX "technical_accessibility_httpsStatus_idx" ON "technical_accessibility"("httpsStatus");

-- CreateIndex
CREATE INDEX "technical_accessibility_statusCode_idx" ON "technical_accessibility"("statusCode");

-- CreateIndex
CREATE INDEX "technical_accessibility_mobileFriendly_idx" ON "technical_accessibility"("mobileFriendly");

-- CreateIndex
CREATE INDEX "analysis_recommendations_technicalAnalysisId_idx" ON "analysis_recommendations"("technicalAnalysisId");

-- CreateIndex
CREATE INDEX "analysis_recommendations_severity_idx" ON "analysis_recommendations"("severity");

-- CreateIndex
CREATE INDEX "analysis_recommendations_isCompleted_idx" ON "analysis_recommendations"("isCompleted");

-- CreateIndex
CREATE INDEX "analysis_recommendations_category_severity_idx" ON "analysis_recommendations"("category", "severity");

-- CreateIndex
CREATE INDEX "analysis_recommendations_technicalAnalysisId_isCompleted_idx" ON "analysis_recommendations"("technicalAnalysisId", "isCompleted");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "companies_domain_key" ON "companies"("domain");

-- CreateIndex
CREATE INDEX "sites_companyId_idx" ON "sites"("companyId");

-- CreateIndex
CREATE INDEX "sites_domain_idx" ON "sites"("domain");

-- CreateIndex
CREATE INDEX "crawl_snapshots_siteId_crawledAt_idx" ON "crawl_snapshots"("siteId", "crawledAt");

-- CreateIndex
CREATE UNIQUE INDEX "technical_scores_snapshotId_key" ON "technical_scores"("snapshotId");

-- CreateIndex
CREATE INDEX "tasks_siteId_status_idx" ON "tasks"("siteId", "status");

-- CreateIndex
CREATE INDEX "tasks_templateKey_idx" ON "tasks"("templateKey");

-- CreateIndex
CREATE INDEX "task_verifications_taskId_createdAt_idx" ON "task_verifications"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "task_verifications_snapshotId_idx" ON "task_verifications"("snapshotId");

-- CreateIndex
CREATE INDEX "weekly_reports_org_id_idx" ON "weekly_reports"("org_id");

-- CreateIndex
CREATE INDEX "weekly_reports_week_start_utc_idx" ON "weekly_reports"("week_start_utc");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_reports_org_id_week_start_utc_key" ON "weekly_reports"("org_id", "week_start_utc");

-- CreateIndex
CREATE INDEX "weekly_report_sections_report_id_idx" ON "weekly_report_sections"("report_id");

-- CreateIndex
CREATE INDEX "weekly_report_sections_key_idx" ON "weekly_report_sections"("key");

-- CreateIndex
CREATE INDEX "weekly_report_source_refs_section_id_idx" ON "weekly_report_source_refs"("section_id");

-- CreateIndex
CREATE INDEX "weekly_report_source_refs_source_type_idx" ON "weekly_report_source_refs"("source_type");

-- AddForeignKey
ALTER TABLE "geo_analysis_results" ADD CONSTRAINT "geo_analysis_results_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organic_traffic_metrics" ADD CONSTRAINT "organic_traffic_metrics_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_structure_analyses" ADD CONSTRAINT "technical_structure_analyses_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "natural_language_reports" ADD CONSTRAINT "natural_language_reports_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "websites" ADD CONSTRAINT "websites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_analyses" ADD CONSTRAINT "technical_analyses_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structured_data" ADD CONSTRAINT "structured_data_technicalAnalysisId_fkey" FOREIGN KEY ("technicalAnalysisId") REFERENCES "technical_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_recognition" ADD CONSTRAINT "entity_recognition_technicalAnalysisId_fkey" FOREIGN KEY ("technicalAnalysisId") REFERENCES "technical_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_analyses" ADD CONSTRAINT "faq_analyses_technicalAnalysisId_fkey" FOREIGN KEY ("technicalAnalysisId") REFERENCES "technical_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_freshness" ADD CONSTRAINT "content_freshness_technicalAnalysisId_fkey" FOREIGN KEY ("technicalAnalysisId") REFERENCES "technical_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_structures" ADD CONSTRAINT "content_structures_technicalAnalysisId_fkey" FOREIGN KEY ("technicalAnalysisId") REFERENCES "technical_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_accessibility" ADD CONSTRAINT "technical_accessibility_technicalAnalysisId_fkey" FOREIGN KEY ("technicalAnalysisId") REFERENCES "technical_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_recommendations" ADD CONSTRAINT "analysis_recommendations_technicalAnalysisId_fkey" FOREIGN KEY ("technicalAnalysisId") REFERENCES "technical_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_snapshots" ADD CONSTRAINT "crawl_snapshots_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_scores" ADD CONSTRAINT "technical_scores_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "crawl_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_verifications" ADD CONSTRAINT "task_verifications_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_verifications" ADD CONSTRAINT "task_verifications_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "crawl_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_report_sections" ADD CONSTRAINT "weekly_report_sections_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "weekly_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_report_source_refs" ADD CONSTRAINT "weekly_report_source_refs_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "weekly_report_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
