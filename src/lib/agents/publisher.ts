import "server-only";
import { db } from "@/lib/db/prisma";
import { withAgentRun, type AgentRunResult } from "./run";
import { assertPermission } from "./permissions";

export type PublisherAgentInput = {
  siteId: string;
  taskId?: string | undefined;
  articleId: string;
  action?: "publish" | "unpublish" | "approve";
};

export type PublisherAgentOutput = {
  articleId: string;
  status: string;
  publishedAt: string | null;
};

/**
 * Publisher Agent — allowed: publish, read_site, read_content.
 * Not allowed: billing, account or site deletion, auth changes.
 *
 * In MANUAL mode the pipeline never reaches this agent; in REVIEW mode the
 * orchestrator only calls it after explicit user approval.
 */
export async function runPublisherAgent(
  input: PublisherAgentInput,
): Promise<AgentRunResult<PublisherAgentOutput>> {
  const action = input.action ?? "publish";
  assertPermission("publisher", "publish");

  return withAgentRun<PublisherAgentOutput>(
    {
      agent: "publisher",
      siteId: input.siteId,
      taskId: input.taskId,
      input: { articleId: input.articleId, action },
      output: (o) => `status=${o.status}`,
    },
    async () => {
      const article = await db.article.findUnique({ where: { id: input.articleId } });
      if (!article) throw new Error("Article not found");
      if (article.siteId !== input.siteId) throw new Error("Article does not belong to this site");
      if (article.status === "ARCHIVED") throw new Error("Archived articles cannot be published");

      const now = new Date();
      let status: "DRAFT" | "APPROVED" | "PUBLISHED" = "PUBLISHED";
      let publishedAt: Date | null = article.publishedAt;

      if (action === "unpublish") {
        status = "DRAFT";
        publishedAt = null;
      } else if (action === "approve") {
        status = "APPROVED";
      } else {
        status = "PUBLISHED";
        publishedAt = article.publishedAt ?? now;
      }

      const updated = await db.article.update({
        where: { id: article.id },
        data: { status, publishedAt },
      });

      await db.site.update({
        where: { id: input.siteId },
        data: { status: "LIVE", updatedAt: now },
      });

      return {
        articleId: updated.id,
        status: updated.status,
        publishedAt: updated.publishedAt?.toISOString() ?? null,
      };
    },
  );
}
