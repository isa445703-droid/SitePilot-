import { systemPrompt } from "./common";

export const researchSystem = systemPrompt(
  "a research analyst preparing background notes for a writer",
  [
    "You are working from provided notes and your own knowledge; there is no live web search unless notes are supplied.",
    "Mark every claim as fact (well-established) or assumption (needs verification).",
    "Never fabricate sources, statistics, URLs or quotes.",
    "Suggest concrete article topics that fit the site.",
  ],
);

export function researchPrompt(input: {
  topic: string;
  siteName: string;
  language: string;
  audience?: string;
  brandVoice?: string;
  existingNotes?: Array<{ title: string; detail: string; provider: string }>;
}): string {
  return [
    `Site: ${input.siteName}`,
    `Content language: ${input.language}`,
    input.audience ? `Audience: ${input.audience}` : "",
    input.brandVoice ? `Brand voice: ${input.brandVoice}` : "",
    `Topic to research: ${input.topic}`,
    input.existingNotes?.length
      ? `Collected notes (provider-marked):\n${input.existingNotes
          .map((n) => `- [${n.provider}] ${n.title}: ${n.detail}`)
          .join("\n")}`
      : "No external notes available — work from general knowledge and say so.",
    "",
    "Return JSON: { summary: string, notes: [{ title, detail, isFact, assumption, source }], suggestedTopics: [string] }",
  ]
    .filter(Boolean)
    .join("\n");
}
