-- CreateIndex
CREATE INDEX "AgentTask_siteId_type_status_idx" ON "AgentTask"("siteId", "type", "status");
