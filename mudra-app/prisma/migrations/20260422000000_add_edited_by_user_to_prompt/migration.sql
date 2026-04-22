-- AlterTable
ALTER TABLE "prompts" ADD COLUMN "editedByUser" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "prompts" ADD COLUMN "editedAt" TIMESTAMP(3);
