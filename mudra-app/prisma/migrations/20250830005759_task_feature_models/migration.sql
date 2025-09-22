-- CreateTable
CREATE TABLE "websites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "websites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "technical_analyses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "websiteId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overallScore" REAL NOT NULL DEFAULT 0,
    "contentAuthority" REAL NOT NULL DEFAULT 0,
    "technicalAccessibility" REAL NOT NULL DEFAULT 0,
    "structuredData" REAL NOT NULL DEFAULT 0,
    "entityRecognition" REAL NOT NULL DEFAULT 0,
    "faqOptimization" REAL NOT NULL DEFAULT 0,
    "contentFreshness" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "technical_analyses_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "structured_data" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "structured_data_technicalAnalysisId_fkey" FOREIGN KEY ("technicalAnalysisId") REFERENCES "technical_analyses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "entity_recognition" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "entity_recognition_technicalAnalysisId_fkey" FOREIGN KEY ("technicalAnalysisId") REFERENCES "technical_analyses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "faq_analyses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "technicalAnalysisId" TEXT NOT NULL,
    "questionAnswerPairs" INTEGER NOT NULL DEFAULT 0,
    "faqStructuredData" BOOLEAN NOT NULL DEFAULT false,
    "faqSchemaPresent" BOOLEAN NOT NULL DEFAULT false,
    "faqSections" JSONB NOT NULL,
    "faqSectionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "faq_analyses_technicalAnalysisId_fkey" FOREIGN KEY ("technicalAnalysisId") REFERENCES "technical_analyses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "content_freshness" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "technicalAnalysisId" TEXT NOT NULL,
    "publishDate" TEXT,
    "lastModified" TEXT,
    "updateFrequency" TEXT,
    "freshnessSignals" JSONB NOT NULL,
    "freshnessSignalsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_freshness_technicalAnalysisId_fkey" FOREIGN KEY ("technicalAnalysisId") REFERENCES "technical_analyses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "content_structures" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_structures_technicalAnalysisId_fkey" FOREIGN KEY ("technicalAnalysisId") REFERENCES "technical_analyses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "technical_accessibility" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "responseTime" REAL,
    "mobileFriendly" BOOLEAN,
    "internalLinksCount" INTEGER NOT NULL DEFAULT 0,
    "lcp" REAL,
    "fid" REAL,
    "cls" REAL,
    "accessibilityData" JSONB NOT NULL,
    "altTextCount" INTEGER NOT NULL DEFAULT 0,
    "ariaLabelsCount" INTEGER NOT NULL DEFAULT 0,
    "semanticElementsCount" INTEGER NOT NULL DEFAULT 0,
    "skipLinks" BOOLEAN NOT NULL DEFAULT false,
    "headingStructureValid" BOOLEAN NOT NULL DEFAULT false,
    "landmarkRolesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "technical_accessibility_technicalAnalysisId_fkey" FOREIGN KEY ("technicalAnalysisId") REFERENCES "technical_analyses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "analysis_recommendations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "technicalAnalysisId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actionRequired" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "analysis_recommendations_technicalAnalysisId_fkey" FOREIGN KEY ("technicalAnalysisId") REFERENCES "technical_analyses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domain" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sites_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "crawl_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "crawledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,
    CONSTRAINT "crawl_snapshots_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "technical_scores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "components" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "technical_scores_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "crawl_snapshots" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "tags" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "suggestedOwner" TEXT,
    "confidence" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tasks_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "task_verifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_verifications_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "task_verifications_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "crawl_snapshots" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
