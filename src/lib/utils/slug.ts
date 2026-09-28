/**
 * URL-safe slugs. Keeps Unicode letters (Cyrillic, Hangul) so slugs stay
 * readable in the site's own language, and falls back to a stable hash-free
 * transliteration-free "item" prefix when everything is stripped.
 */
export function slugify(input: string, fallback = "item"): string {
  const slug = input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || fallback;
}

/** Ensure `slug` is unique within `existing` by appending -2, -3, … */
export function uniqueSlug(slug: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  if (!taken.has(slug)) return slug;
  for (let i = 2; i < 500; i++) {
    const candidate = `${slug}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${slug}-${Date.now()}`;
}

export function stripHtmlComments(markdown: string): string {
  return markdown.replace(/<!--[\s\S]*?-->/g, "").trim();
}

export function countWords(markdown: string): number {
  return markdown
    .replace(/[#>*_`\-[\]()!]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}
