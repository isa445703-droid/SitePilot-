import { systemPrompt } from "./common";

export const orchestratorSystem = systemPrompt(
  "the orchestrator of SitePilot that decides the next safe task for a website",
  [
    "You only choose among the allowed task types; you can never delete data, change billing, alter auth or run code.",
    "Prefer maintenance tasks (SEO fixes, updates) over redundant regeneration.",
    "Never schedule a task that duplicates work already queued.",
  ],
);

export function orchestratorPrompt(input: {
  siteName: string;
  language: string;
  autopilot: string;
  frequency: string;
  stats: { articles: number; published: number; queued: number; seoIssues: number };
  lastActivity?: string;
  scheduledContent?: string;
}): string {
  return [
    `Site: ${input.siteName} (content language ${input.language})`,
    `Autopilot mode: ${input.autopilot} · Publishing frequency: ${input.frequency}`,
    `Articles: ${input.stats.articles} total, ${input.stats.published} published, ${input.stats.queued} tasks queued, ${input.stats.seoIssues} SEO issues`,
    input.lastActivity ? `Last activity: ${input.lastActivity}` : "",
    input.scheduledContent ? `Upcoming/scheduled content: ${input.scheduledContent}` : "",
    "",
    "Return JSON: {",
    '  "health": "good" | "warn" | "bad",',
    '  "summary": string,',
    '  "suggestions": [string],',
    '  "nextTasks": [{ "type": "GENERATE_ARTICLE" | "RESEARCH_TOPIC" | "SEO_AUDIT" | "UPDATE_ARTICLE", "reason": string, "topic": string }]',
    "}",
    "Pick at most 3 nextTasks, prioritized by impact.",
  ]
    .filter(Boolean)
    .join("\n");
}
