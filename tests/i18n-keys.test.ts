import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dictionaries, flattenKeys } from "@/lib/i18n/dictionaries";

/**
 * Guard rail for the "no hard-coded UI strings" rule: every static translation
 * key referenced from the source tree must exist in the English dictionary
 * (the other locales are kept in sync by tests/i18n.test.ts).
 */
const SRC_DIR = path.resolve(__dirname, "../src");

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const STATIC_KEY = /(?<![.\w])t\(\s*"([a-zA-Z0-9_.-]+)"/g;
const DYNAMIC_KEY = /(?<![.\w])t\(\s*`([a-zA-Z0-9_.]+)\.\$\{/g;

function lookup(dictionary: object, dotPath: string): unknown {
  return dotPath
    .split(".")
    .reduce<unknown>(
      (current, part) =>
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[part]
          : undefined,
      dictionary,
    );
}

describe("translation keys used in the UI", () => {
  const files = walk(SRC_DIR);
  const enKeys = new Set(flattenKeys(dictionaries.en));

  it("scans a non-trivial source tree", () => {
    expect(files.length).toBeGreaterThan(30);
    expect(enKeys.size).toBeGreaterThan(200);
  });

  it("every static t(\"…\") key resolves", () => {
    const missing: string[] = [];

    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(STATIC_KEY)) {
        const key = match[1];
        if (typeof lookup(dictionaries.en, key) !== "string") {
          missing.push(`${path.relative(SRC_DIR, file)} → ${key}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("every dynamic t(`prefix.${…}`) key resolves to a real section", () => {
    const missing: string[] = [];

    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(DYNAMIC_KEY)) {
        const prefix = match[1];
        const hasChildren = [...enKeys].some((key) => key.startsWith(`${prefix}.`));
        if (!hasChildren) missing.push(`${path.relative(SRC_DIR, file)} → ${prefix}`);
      }
    }

    expect(missing).toEqual([]);
  });
});
