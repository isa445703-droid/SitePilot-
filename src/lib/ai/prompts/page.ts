import { systemPrompt } from "./common";

export const pageSystem = systemPrompt(
  "a website copywriter who writes complete, ready-to-publish static pages (home, about, contact, resources) for a generated site",
  [
    "Write the page in the site's content language, matching its tone and audience.",
    "Produce 6-14 content blocks: short headings, 2-5 sentence paragraphs, lists for features or steps, at most one quote (a mission or positioning statement).",
    "Never invent URLs, e-mail addresses, phone numbers, statistics or company history facts. For a contact page, describe how visitors reach the team (contact form, social channels, response time) without fabricating addresses.",
    "Every block is data: no HTML, no markdown links, no scripts.",
  ],
);

export function pagePrompt(input: {
  siteName: string;
  siteDescription: string;
  pageTitle: string;
  pagePurpose: string;
  pageType: string;
  language: string;
  audience?: string;
  tone?: string;
  keywords?: string[];
}): string {
  const typeHints: Record<string, string> = {
    HOME: "This is the home page: introduce the site, explain what visitors will find, and point to the latest content and categories.",
    ABOUT: "This is the about page: tell the story and mission of the site, who is behind it and why it exists — without inventing fake history, dates or names.",
    CONTACT: "This is the contact page: explain how visitors can reach the team, what to expect after reaching out, and how to follow updates.",
  };
  return [
    `Site: ${input.siteName}`,
    `What the site is about: ${input.siteDescription}`,
    input.audience ? `Audience: ${input.audience}` : "",
    input.tone ? `Tone of voice: ${input.tone}` : "",
    input.keywords?.length ? `Site keywords: ${input.keywords.join(", ")}` : "",
    "",
    `Page to write: "${input.pageTitle}"`,
    `Purpose of the page: ${input.pagePurpose || "Support the site's goals"}`,
    `Page kind: ${input.pageType}`,
    typeHints[input.pageType] ?? "Write a complete, useful page that fits the site.",
    "",
    `Content language: ${input.language}`,
    "",
    "Return JSON with this exact shape:",
    "{",
    '  "seoTitle": string,        // max ~60 characters',
    '  "seoDescription": string,  // max ~155 characters',
    '  "blocks": [',
    '    { "type": "heading", "level": 2, "text": string },',
    '    { "type": "paragraph", "text": string },',
    '    { "type": "list", "items": [string] },',
    '    { "type": "quote", "text": string }',
    "  ]",
    "}",
    'Block "type" must be exactly "heading" | "paragraph" | "list" | "quote". For non-heading blocks still include "level": 2 and "items": [].',
  ].filter(Boolean).join("\n");
}
