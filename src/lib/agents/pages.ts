import "server-only";
import { db } from "@/lib/db/prisma";
import { generatePageContent } from "@/lib/ai";
import { normalizePageBlocks } from "@/lib/ai/schemas";
import { withAgentRun, type AgentRunResult } from "./run";
import { assertPermission } from "./permissions";
import { audienceOf, loadSiteBundle } from "./context";

export type PagesAgentInput = {
  siteId: string;
  taskId?: string | undefined;
};

export type PagesAgentOutput = {
  pages: number;
  isDemo: boolean;
};

/**
 * Pages Agent — allowed: read_site, read_content, update_content.
 * Fills every static page of the site with real generated content.
 */
export async function runPagesAgent(
  input: PagesAgentInput,
): Promise<AgentRunResult<PagesAgentOutput>> {
  assertPermission("pages", "read_site");
  assertPermission("pages", "update_content");

  return withAgentRun<PagesAgentOutput>(
    {
      agent: "pages",
      siteId: input.siteId,
      taskId: input.taskId,
      input: { action: "generate_site_pages" },
      output: (o) => `generated content for ${o.pages} page(s)`,
    },
    async (ctx) => {
      const bundle = await loadSiteBundle("pages", input.siteId);
      const site = bundle.site;

      const pages = await db.page.findMany({
        where: { siteId: input.siteId },
        orderBy: [{ order: "asc" }, { title: "asc" }],
      });
      if (pages.length === 0) return { pages: 0, isDemo: false };

      const keywords = (bundle.brand?.keywords ?? []).slice(0, 6);
      let isDemo = false;
      let done = 0;

      for (const page of pages) {
        // The provisioner stores the declared purpose in the placeholder copy —
        // reusing it keeps the generated text aligned with the blueprint.
        const blocks = Array.isArray(page.content) ? (page.content as Array<Record<string, unknown>>) : [];
        const purposeBlock = blocks.find((b) => b.type === "paragraph" && typeof b.text === "string");
        const pagePurpose = typeof purposeBlock?.text === "string" ? purposeBlock.text : "";

        const outcome = await generatePageContent({
          siteName: site.name,
          siteDescription: site.description,
          pageTitle: page.title,
          pagePurpose,
          pageType: page.type,
          language: site.language,
          audience: audienceOf(bundle),
          tone: site.tone || bundle.brand?.tone || "",
          keywords,
        });
        ctx.recordUsage(outcome.usage);
        if (outcome.isDemo) isDemo = true;

        const generated = outcome.data;
        await db.page.update({
          where: { id: page.id },
          data: {
            content: normalizePageBlocks(generated.blocks, pagePurpose || page.title) as any,
            seoTitle: generated.seoTitle || page.title.slice(0, 60),
            seoDescription: generated.seoDescription || site.description.slice(0, 155),
          },
        });
        done += 1;
      }

      ctx.setDemo(isDemo);
      return { pages: done, isDemo };
    },
  );
}
