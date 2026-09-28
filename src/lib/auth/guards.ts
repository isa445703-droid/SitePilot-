import "server-only";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/prisma";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

export class AccessError extends Error {
  status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "AccessError";
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** A site together with the organization members allowed to touch it. */
export type OwnedSite = Prisma.SiteGetPayload<{
  include: { organization: { include: { members: true } } };
}>;

export type OwnedArticle = Prisma.ArticleGetPayload<{
  include: { site: { include: { organization: { include: { members: true } } } } };
}>;

/** Narrow persistence seam so unit tests can inject a stub without a database. */
export type SiteClient = {
  site: {
    findUnique: (args: Prisma.SiteFindUniqueArgs) => Promise<OwnedSite | null>;
  };
};

function isMember(
  members: Array<{ userId: string }>,
  userId: string,
): boolean {
  return members.some((m) => m.userId === userId);
}

/**
 * Ownership check: a user may only touch a site when they are a member of the
 * organization that owns it. Every site-scoped server action/route must call this.
 */
export async function getOwnedSite(
  siteId: string,
  userId: string,
  client: SiteClient = db as unknown as SiteClient,
): Promise<OwnedSite | null> {
  const site = await client.site.findUnique({
    where: { id: siteId },
    include: { organization: { include: { members: true } } },
  });
  if (!site) return null;
  if (!isMember(site.organization.members, userId)) {
    logger.warn("site_access_denied", { siteId, userId });
    return null;
  }
  return site;
}

export async function requireOwnedSite(siteId: string, userId: string): Promise<OwnedSite> {
  const site = await getOwnedSite(siteId, userId);
  if (!site) throw new AccessError("You don't have access to this site.");
  return site;
}

export async function getOwnedArticle(articleId: string, userId: string): Promise<OwnedArticle | null> {
  const article = await db.article.findUnique({
    where: { id: articleId },
    include: { site: { include: { organization: { include: { members: true } } } } },
  });
  if (!article) return null;
  if (!isMember(article.site.organization.members, userId)) {
    logger.warn("article_access_denied", { articleId, userId });
    return null;
  }
  return article;
}
