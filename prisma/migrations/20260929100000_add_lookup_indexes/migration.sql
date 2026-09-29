-- DropIndex
DROP INDEX "Article_siteId_status_idx";

-- CreateIndex
CREATE INDEX "Article_siteId_status_publishedAt_idx" ON "Article"("siteId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "Article_siteId_categoryId_idx" ON "Article"("siteId", "categoryId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
