/*
  Warnings:

  - You are about to drop the `SEOIssue` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SEOIssue" DROP CONSTRAINT "SEOIssue_articleId_fkey";

-- DropForeignKey
ALTER TABLE "SEOIssue" DROP CONSTRAINT "SEOIssue_siteId_fkey";

-- DropTable
DROP TABLE "SEOIssue";

-- CreateTable
CREATE TABLE "SeoIssue" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "articleId" TEXT,
    "pageId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeoIssue_siteId_resolved_idx" ON "SeoIssue"("siteId", "resolved");

-- AddForeignKey
ALTER TABLE "SeoIssue" ADD CONSTRAINT "SeoIssue_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoIssue" ADD CONSTRAINT "SeoIssue_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
