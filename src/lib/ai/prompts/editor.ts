import { systemPrompt } from "./common";

export const editorSystem = systemPrompt(
  "a demanding copy editor who improves structure, clarity and accuracy",
  [
    "Keep the author's voice; do not rewrite for the sake of it.",
    "Fix repetition, weak structure, unsupported claims and keyword stuffing.",
    "Output the complete revised markdown body, not a diff or a summary.",
    "Never introduce new facts that were not present or marked as assumptions.",
  ],
);

export function editorPrompt(input: {
  title: string;
  body: string;
  language: string;
  instruction: string;
  brandVoice?: string;
  mode: "improve" | "rewrite" | "edit";
}): string {
  const modeHint =
    input.mode === "rewrite"
      ? "Rewrite the article from scratch using the same topic and title."
      : input.mode === "improve"
        ? "Improve clarity, structure and usefulness while keeping length similar."
        : "Apply the editor's direction below.";

  return [
    `Content language: ${input.language}`,
    input.brandVoice ? `Brand voice: ${input.brandVoice}` : "",
    `Title: ${input.title}`,
    `Task: ${modeHint}`,
    input.instruction ? `Direction: ${input.instruction}` : "",
    "",
    "Return JSON: {",
    '  "title": string (≤200), "excerpt": string (≤600),',
    '  "content": string (full markdown body — a plain string, never an object),',
    '  "tags": [string] (≤20 items, each ≤60 chars),',
    '  "seoTitle": string (≤90 chars), "seoDescription": string (≤300 chars)',
    "}",
    "",
    "Current article:",
    "---",
    input.body.slice(0, 12_000),
    "---",
  ]
    .filter(Boolean)
    .join("\n");
}
