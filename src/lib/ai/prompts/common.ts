/** Rules appended to every prompt. Keep them short, explicit and consistent. */
export const AI_RULES = `- Return data, never executable code (no <script>, no shell, no SQL, no function bodies).
- Never invent URLs, statistics, citations or sources. If you are unsure, write an assumption explicitly.
- Distinguish facts from assumptions in anything you claim.
- Follow the requested content language exactly.
- Preserve the site's brand voice and tone.
- You have no authority to take actions: no publishing, no billing, no account or database changes.
- Keep a helpful, professional, non-generic tone. No filler like "In conclusion".`;

export function systemPrompt(role: string, extraRules: string[] = []): string {
  return [`You are ${role} inside SitePilot, an AI website operating system.`, ...extraRules, AI_RULES]
    .join("\n")
    .trim();
}
