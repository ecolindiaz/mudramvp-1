-- CreateTable
CREATE TABLE "weekly_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "org_id" TEXT NOT NULL,
    "week_start_utc" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "model" TEXT,
    "summary_markdown" TEXT,
    "summary_json" JSONB,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "cost_cents" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "weekly_reports_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "weekly_report_sections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "report_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "body_markdown" TEXT,
    "body_json" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "weekly_report_sections_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "weekly_reports" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "weekly_report_source_refs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "section_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "ref_table" TEXT,
    "ref_id" TEXT,
    "url" TEXT,
    "label" TEXT,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "weekly_report_source_refs_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "weekly_report_sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
