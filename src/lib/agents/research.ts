import "server-only";
import { db } from "@/lib/db/prisma";
import { researchTopic } from "@/lib/ai";
import { withAgentRun, type AgentRunResult } from "./run";
import { assertPermission } from "./permissions";
import { audienceOf, brandVoiceOf, loadSiteBundle } from "./context";
import { getResearchProvider } from "./research-provider";

export type ResearchAgentInput = {
  siteId: string;
  taskId?: string | undefined;
  topic: string;
  articleId?: string | undefined;
};

export type ResearchAgentOutput = {
  researchId: string;
  notes: number;
  isMock: boolean;
  suggestedTopics: string[];
};

/**
 * Research Agent — allowed: research, read_site, read_content, log_activity.
 * Not allowed: publish, billing, deletion.
 */
export async function runResearchAgent(
  input: ResearchAgentInput,
): Promise<AgentRunResult<ResearchAgentOutput>> {
  assertPermission("research", "research");

  return withAgentRun<ResearchAgentOutput>(
    {
      agent: "research",
      siteId: input.siteId,
      taskId: input.taskId,
      input: { topic: input.topic },
      output: (o) => `${o.notes} notes (mock=${o.isMock})`,
    },
    async (ctx) => {
      const bundle = await loadSiteBundle("research", input.siteId);
      const provider = getResearchProvider();
      const raw = await provider.search(input.topic);
      ctx.setDemo(provider.isMock);

      const outcome = await researchTopic({
        topic: input.topic,
        siteName: bundle.site.name,
        language: bundle.site.language,
        audience: audienceOf(bundle),
        brandVoice: brandVoiceOf(bundle),
        existingNotes: raw.map((r) => ({
          title: r.title,
          detail: r.snippet,
          provider: r.provider,
        })),
      });
      ctx.recordUsage(outcome.usage);
      ctx.setDemo(provider.isMock || outcome.isDemo);

      const item = await db.researchItem.create({
        data: {
          siteId: input.siteId,
          articleId: input.articleId ?? null,
          topic: input.topic,
          query: input.topic,
          notes: outcome.data.notes as any,
          provider: provider.name,
          isMock: provider.isMock || outcome.isDemo,
        },
      });

      for (const source of raw.slice(0, 5)) {
        await db.contentSource
          .create({
            data: {
              siteId: input.siteId,
              articleId: input.articleId ?? null,
              title: source.title,
              url: source.url,
              snippet: source.snippet.slice(0, 500),
              provider: source.provider,
              isMock: provider.isMock,
            },
          })
          .catch(() => undefined);
      }

      return {
        researchId: item.id,
        notes: outcome.data.notes.length,
        isMock: provider.isMock || outcome.isDemo,
        suggestedTopics: outcome.data.suggestedTopics,
      };
    },
  );
}

/** Format research notes for the writer prompt. */
export async function researchToPromptText(researchId: string): Promise<string> {
  const item = await db.researchItem.findUnique({ where: { id: researchId } });
  if (!item) return "";
  const notes = (item.notes as Array<{ title: string; detail: string; isFact?: boolean }>) ?? [];
  return notes
    .map((n) => `- ${n.title}: ${n.detail}${n.isFact ? " (fact)" : " (assumption)"}`)
    .join("\n");
}
