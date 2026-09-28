-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "SiteStatus" AS ENUM ('DRAFT', 'BUILDING', 'LIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AutopilotMode" AS ENUM ('MANUAL', 'REVIEW', 'FULL');

-- CreateEnum
CREATE TYPE "PublishingFrequency" AS ENUM ('ONCE_A_WEEK', 'TWICE_A_WEEK', 'THREE_A_WEEK', 'FIVE_A_WEEK', 'DAILY');

-- CreateEnum
CREATE TYPE "PageType" AS ENUM ('HOME', 'ABOUT', 'CONTACT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('GENERATE_BLUEPRINT', 'GENERATE_CONTENT_PLAN', 'RESEARCH_TOPIC', 'GENERATE_ARTICLE', 'EDIT_ARTICLE', 'SEO_AUDIT', 'UPDATE_ARTICLE', 'PUBLISH_ARTICLE', 'ANALYZE_SITE');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "siteId" TEXT,
    "agent" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "taskType" TEXT,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "brief" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "targetAudience" TEXT NOT NULL DEFAULT '',
    "primaryGoal" TEXT NOT NULL DEFAULT '',
    "tone" TEXT NOT NULL DEFAULT '',
    "status" "SiteStatus" NOT NULL DEFAULT 'DRAFT',
    "autopilot" "AutopilotMode" NOT NULL DEFAULT 'MANUAL',
    "frequency" "PublishingFrequency" NOT NULL DEFAULT 'THREE_A_WEEK',
    "publishHour" INTEGER NOT NULL DEFAULT 9,
    "blueprint" JSONB,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteBrand" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "brandVoice" TEXT NOT NULL DEFAULT '',
    "tone" TEXT NOT NULL DEFAULT '',
    "guidelines" TEXT NOT NULL DEFAULT '',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audienceNotes" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteDesign" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#2563eb',
    "secondaryColor" TEXT NOT NULL DEFAULT '#0f172a',
    "backgroundColor" TEXT NOT NULL DEFAULT '#ffffff',
    "textColor" TEXT NOT NULL DEFAULT '#0f172a',
    "fontStyle" TEXT NOT NULL DEFAULT 'modern',
    "borderRadius" INTEGER NOT NULL DEFAULT 12,
    "layoutStyle" TEXT NOT NULL DEFAULT 'centered',
    "cardStyle" TEXT NOT NULL DEFAULT 'soft',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteDesign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "siteTitle" TEXT NOT NULL DEFAULT '',
    "metaDescription" TEXT NOT NULL DEFAULT '',
    "ogImage" TEXT NOT NULL DEFAULT '',
    "indexable" BOOLEAN NOT NULL DEFAULT true,
    "robotsTxt" TEXT NOT NULL DEFAULT 'User-agent: *
Allow: /
Sitemap: {sitemap}',
    "analyticsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "postsPerPage" INTEGER NOT NULL DEFAULT 9,
    "footerText" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishingSchedule" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "frequency" "PublishingFrequency" NOT NULL DEFAULT 'THREE_A_WEEK',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "publishHour" INTEGER NOT NULL DEFAULT 9,
    "publishDays" TEXT[] DEFAULT ARRAY['monday', 'wednesday', 'friday']::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "PageType" NOT NULL DEFAULT 'CUSTOM',
    "status" "PageStatus" NOT NULL DEFAULT 'PUBLISHED',
    "content" JSONB NOT NULL DEFAULT '[]',
    "seoTitle" TEXT NOT NULL DEFAULT '',
    "seoDescription" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "author" TEXT NOT NULL DEFAULT 'SitePilot AI',
    "language" TEXT NOT NULL DEFAULT 'en',
    "seoTitle" TEXT NOT NULL DEFAULT '',
    "seoDescription" TEXT NOT NULL DEFAULT '',
    "canonicalUrl" TEXT NOT NULL DEFAULT '',
    "featuredImage" TEXT NOT NULL DEFAULT '',
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentSource" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "articleId" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "snippet" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "isMock" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchItem" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "articleId" TEXT,
    "topic" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "notes" JSONB NOT NULL DEFAULT '[]',
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "isMock" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'image',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTask" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "input" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB,
    "error" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "taskId" TEXT,
    "agent" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT '',
    "status" "RunStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "inputSummary" TEXT NOT NULL DEFAULT '',
    "outputSummary" TEXT NOT NULL DEFAULT '',
    "error" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsDaily" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "articleId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "visits" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'internal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SEOIssue" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "articleId" TEXT,
    "pageId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SEOIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "OrgMember_userId_idx" ON "OrgMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMember_organizationId_userId_key" ON "OrgMember"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");

-- CreateIndex
CREATE INDEX "UsageEvent_siteId_createdAt_idx" ON "UsageEvent"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_organizationId_createdAt_idx" ON "UsageEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Site_slug_key" ON "Site"("slug");

-- CreateIndex
CREATE INDEX "Site_organizationId_idx" ON "Site"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteBrand_siteId_key" ON "SiteBrand"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteDesign_siteId_key" ON "SiteDesign"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteSettings_siteId_key" ON "SiteSettings"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishingSchedule_siteId_key" ON "PublishingSchedule"("siteId");

-- CreateIndex
CREATE INDEX "Page_siteId_idx" ON "Page"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Page_siteId_slug_key" ON "Page"("siteId", "slug");

-- CreateIndex
CREATE INDEX "Category_siteId_idx" ON "Category"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_siteId_slug_key" ON "Category"("siteId", "slug");

-- CreateIndex
CREATE INDEX "Article_siteId_status_idx" ON "Article"("siteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Article_siteId_slug_key" ON "Article"("siteId", "slug");

-- CreateIndex
CREATE INDEX "ContentSource_articleId_idx" ON "ContentSource"("articleId");

-- CreateIndex
CREATE INDEX "ContentSource_siteId_idx" ON "ContentSource"("siteId");

-- CreateIndex
CREATE INDEX "ResearchItem_siteId_idx" ON "ResearchItem"("siteId");

-- CreateIndex
CREATE INDEX "Media_siteId_idx" ON "Media"("siteId");

-- CreateIndex
CREATE INDEX "AgentTask_status_scheduledAt_idx" ON "AgentTask"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "AgentTask_siteId_createdAt_idx" ON "AgentTask"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_siteId_createdAt_idx" ON "AgentRun"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_taskId_idx" ON "AgentRun"("taskId");

-- CreateIndex
CREATE INDEX "AnalyticsDaily_siteId_date_idx" ON "AnalyticsDaily"("siteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsDaily_siteId_articleId_date_key" ON "AnalyticsDaily"("siteId", "articleId", "date");

-- CreateIndex
CREATE INDEX "SEOIssue_siteId_resolved_idx" ON "SEOIssue"("siteId", "resolved");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteBrand" ADD CONSTRAINT "SiteBrand_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDesign" ADD CONSTRAINT "SiteDesign_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSettings" ADD CONSTRAINT "SiteSettings_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishingSchedule" ADD CONSTRAINT "PublishingSchedule_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSource" ADD CONSTRAINT "ContentSource_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSource" ADD CONSTRAINT "ContentSource_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchItem" ADD CONSTRAINT "ResearchItem_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchItem" ADD CONSTRAINT "ResearchItem_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AgentTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsDaily" ADD CONSTRAINT "AnalyticsDaily_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsDaily" ADD CONSTRAINT "AnalyticsDaily_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SEOIssue" ADD CONSTRAINT "SEOIssue_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SEOIssue" ADD CONSTRAINT "SEOIssue_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
