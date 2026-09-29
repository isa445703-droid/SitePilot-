import "server-only";
import { db } from "@/lib/db/prisma";
import { reviseArticle } from "@/lib/ai";
import { countWords } from "@/lib/utils/slug";
import { withAgentRun, type AgentRunResult } from "./run";
import { assertPermission } from "./permissions";
import { brandVoiceOf, loadSiteBundle } from "./context";
import { PermanentTaskError } from "./task-policy";

export type EditorAgentInput = {
  siteId: string;
  taskId?: string | undefined;
  articleId: string;
  mode: "improve" | "rewrite" | "edit";
  instruction?: string;
};

export type EditorAgentOutput = {
  articleId: string;
  words: number;
  changed: boolean;
  isDemo: boolean;
};

/**
 * Editor Agent — allowed: update_content, read_content, read_site.
 * Not allowed to publish or change metadata outside the article body.
 */
export async function runEditorAgent(
  input: EditorAgentInput,
): Promise<AgentRunResult<EditorAgentOutput>> {
  assertPermission("editor", "update_content");

  return withAgentRun<EditorAgentOutput>(
    {
      agent: "editor",
      siteId: input.siteId,
      taskId: input.taskId,
      input: { articleId: input.articleId, mode: input.mode, instruction: input.instruction ?? "" },
      output: (o) => `${o.words} words, changed=${o.changed}`,
    },
    async (ctx) => {
      const bundle = await loadSiteBundle("editor", input.siteId);
      const article = await db.article.findUnique({ where: { id: input.articleId } });
      if (!article) throw new PermanentTaskError("Article not found", 404);
      if (article.siteId !== input.siteId) {
        throw new PermanentTaskError("Article does not belong to this site", 403);
      }

      const outcome = await reviseArticle({
        title: article.title,
        body: article.content,
        language: article.language || bundle.site.language,
        brandVoice: brandVoiceOf(bundle),
        instruction: input.instruction,
        mode: input.mode,
      });
      ctx.recordUsage(outcome.usage);
      ctx.setDemo(outcome.isDemo);

      const content = outcome.data.content || article.content;
      const changed = content !== article.content;

      const updated = await db.article.update({
        where: { id: article.id },
        data: {
          content,
          excerpt: outcome.data.excerpt || article.excerpt,
          tags: outcome.data.tags?.length ? outcome.data.tags : article.tags,
          wordCount: countWords(content),
          // Never silently overwrite user-authored SEO fields in demo mode.
          seoTitle: outcome.data.seoTitle && !outcome.isDemo ? outcome.data.seoTitle : article.seoTitle,
          seoDescription:
            outcome.data.seoDescription && !outcome.isDemo
              ? outcome.data.seoDescription
              : article.seoDescription,
          updatedAt: new Date(),
        },
      });

      return {
        articleId: article.id,
        words: updated.wordCount,
        changed,
        isDemo: outcome.isDemo,
      };
    },
  );
}
