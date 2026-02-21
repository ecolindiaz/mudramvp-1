-- DropIndex
DROP INDEX "conversation_opportunities_brandProfileId_postUrl_key";

-- AlterTable
ALTER TABLE "conversation_opportunities" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en';

-- CreateIndex
CREATE INDEX "conversation_opportunities_brandProfileId_language_status_idx" ON "conversation_opportunities"("brandProfileId", "language", "status");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_opportunities_brandProfileId_postUrl_language_key" ON "conversation_opportunities"("brandProfileId", "postUrl", "language");
