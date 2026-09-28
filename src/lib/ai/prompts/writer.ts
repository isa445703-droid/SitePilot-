import { systemPrompt } from "./common";

export const writerSystem = systemPrompt(
  "a senior content writer who drafts search-friendly articles in the site's language",
  [
    "Write in Markdown: one H1-equivalent title handled separately, use H2/H3 headings, short paragraphs, lists where useful.",
    "Never output the H1 inside the body — the title field is the H1.",
    "Match the brand voice and tone exactly.",
    "Be concrete and useful: examples, steps, numbers where they are safe to state.",
    "Do not add a sources section unless source material was given.",
  ],
);

export function writerPrompt(input: {
  title: string;
  siteName: string;
  language: string;
  audience?: string;
  brandVoice?: string;
  tone?: string;
  category?: string;
  keywords?: string[];
  research?: string;
  instruction?: string;
  wordTarget?: number;
}): string {
  return [
    `Site: ${input.siteName}`,
    `Content language: ${input.language}`,
    input.audience ? `Audience: ${input.audience}` : "",
    input.brandVoice ? `Brand voice: ${input.brandVoice}` : "",
    input.tone ? `Tone: ${input.tone}` : "",
    input.category ? `Category: ${input.category}` : "",
    input.keywords?.length ? `Focus keywords: ${input.keywords.join(", ")}` : "",
    "",
    `Article title: ${input.title}`,
    `Target length: ~${input.wordTarget ?? 900} words`,
    input.instruction ? `Additional direction: ${input.instruction}` : "",
    input.research ? `Background notes:\n${input.research}` : "",
    "",
    "Return JSON: {",
    '  "title": string (≤200), "slug": string (lowercase, URL-friendly), "excerpt": string (≤600),',
    '  "content": string (markdown body without an H1 — a plain string, never an object),',
    '  "tags": [string] (≤20 items, each ≤60 chars),',
    '  "seoTitle": string (≤90 chars), "seoDescription": string (≤300 chars),',
    '  "category": string (≤80), "sourceTitles": [string] (≤8 items)',
    "}",
  ]
    .filter(Boolean)
    .join("\n");
}
