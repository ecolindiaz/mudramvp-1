-- AlterTable
ALTER TABLE "BrandProfile" ADD COLUMN "websitePlatform" TEXT;

-- CreateIndex
CREATE INDEX "issues_agentTaskId_idx" ON "issues"("agentTaskId");

-- CreateIndex
CREATE INDEX "issues_deployedAgentId_idx" ON "issues"("deployedAgentId");

-- CreateIndex
CREATE INDEX "notifications_brandProfileId_idx" ON "notifications"("brandProfileId");

-- DropTable
DROP TABLE IF EXISTS "OrganicTrafficMetrics";
