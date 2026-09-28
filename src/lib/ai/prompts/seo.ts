import { systemPrompt } from "./common";

export const seoSystem = systemPrompt(
  "an SEO specialist who writes metadata that is accurate and not clickbait",
  [
    "Titles ≤ 60 characters, descriptions ≤ 155 characters, written for humans.",
    "Use the primary keyword naturally; never keyword-stuff.",
    "The slug must be lowercase, hyphenated, in the content language unless the language uses another script.",
    "Do not promise what the article does not deliver.",
  ],
);

export function seoPrompt(input: {
  title: string;
  excerpt?: string;
  body: string;
  language: string;
  keywords?: string[];
  siteName?: string;
  mode: "optimize" | "initial";
}): string {
  return [
    `Site: ${input.siteName ?? ""}`,
    `Content language: ${input.language}`,
    input.keywords?.length ? `Site keywords: ${input.keywords.join(", ")}` : "",
    `Task: ${input.mode === "optimize" ? "Optimize existing metadata" : "Create initial metadata"}`,
    "",
    `Title: ${input.title}`,
    input.excerpt ? `Excerpt: ${input.excerpt}` : "",
    "",
    "Article body:",
    "---",
    input.body.slice(0, 8_000),
    "---",
    "",
    "Return JSON: {",
    '  "seoTitle": string (≤60), "seoDescription": string (≤155),',
    '  "slug": string, "tags": [string], "internalLinkIdeas": [string]',
    "}",
  ]
    .filter(Boolean)
    .join("\n");
}
