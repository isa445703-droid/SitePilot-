import "server-only";
import { db } from "@/lib/db/prisma";
import { analyzeSite } from "@/lib/ai";
import { withAgentRun, type AgentRunResult } from "./run";
import { assertPermission } from "./permissions";
import { loadSiteBundle } from "./context";
import { ensureDemoAnalytics } from "@/lib/analytics";

export type AnalyticsAgentOutput = {
  health: "good" | "warn" | "bad";
  summary: string;
  suggestions: string[];
  isDemo: boolean;
  stats: { articles: number; published: number; queued: number; seoIssues: number };
};

/**
 * Analytics Agent — allowed: read_site, read_content, read_analytics, create_tasks.
 * It reports; it never publishes or touches billing.
 */
export async function runAnalyticsAgent(input: {
  siteId: string;
  taskId?: string | undefined;
}): Promise<AgentRunResult<AnalyticsAgentOutput>> {
  assertPermission("analytics", "read_analytics");

  return withAgentRun<AnalyticsAgentOutput>(
    {
      agent: "analytics",
      siteId: input.siteId,
      taskId: input.taskId,
      input: { action: "analyze_site" },
      output: (o) => `${o.health}: ${o.summary}`,
    },
    async (ctx) => {
      const bundle = await loadSiteBundle("analytics", input.siteId);

      // In development with no real provider, make the demo series available.
      await ensureDemoAnalytics(input.siteId, bundle.stats.published);

      const lastRun = await db.agentRun.findFirst({
        where: { siteId: input.siteId, status: "SUCCESS" },
        orderBy: { createdAt: "desc" },
      });

      const outcome = await analyzeSite({
        siteName: bundle.site.name,
        language: bundle.site.language,
        autopilot: bundle.site.autopilot,
        frequency: bundle.site.frequency,
        stats: bundle.stats,
        lastActivity: lastRun
          ? `${lastRun.agent}: ${lastRun.outputSummary || lastRun.status} (${lastRun.createdAt.toISOString()})`
          : undefined,
      });
      ctx.recordUsage(outcome.usage);
      ctx.setDemo(outcome.isDemo);

      return {
        health: outcome.data.health,
        summary: outcome.data.summary,
        suggestions: outcome.data.suggestions,
        isDemo: outcome.isDemo,
        stats: bundle.stats,
      };
    },
  );
}
