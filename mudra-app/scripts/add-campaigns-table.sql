-- Run this manually: sqlite3 prisma/dev.db < scripts/add-campaigns-table.sql

CREATE TABLE IF NOT EXISTS "campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "brandProfileId" INTEGER,
    "userId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME
);

CREATE INDEX IF NOT EXISTS "campaigns_userId_idx" ON "campaigns"("userId");
CREATE INDEX IF NOT EXISTS "campaigns_status_idx" ON "campaigns"("status");
CREATE INDEX IF NOT EXISTS "campaigns_brandProfileId_idx" ON "campaigns"("brandProfileId");
CREATE INDEX IF NOT EXISTS "campaigns_createdAt_idx" ON "campaigns"("createdAt");

SELECT 'Campaigns table setup complete!' as message;

