import { describe, expect, it } from "vitest";

import {
  SEO_LIMITS,
  buildMeta,
  buildRobots,
  buildSitemap,
  canonicalSlug,
  checkDescription,
  checkTitle,
  escapeXml,
  excerptFromBody,
} from "@/lib/seo";

describe("buildRobots", () => {
  it("lets crawlers in and points them at the sitemap", () => {
    const body = buildRobots("https://example.com/");

    expect(body).toBe(
      ["User-agent: *", "Allow: /", "", "Sitemap: https://example.com/sitemap.xml", ""].join("\n"),
    );
  });

  it("closes a site that opted out of indexing completely", () => {
    const body = buildRobots("https://example.com", { indexable: false });

    expect(body).toBe(["User-agent: *", "Disallow: /", ""].join("\n"));
    expect(body).not.toContain("Sitemap:");
    expect(body).not.toContain("Allow:");
  });

  it("normalises a trailing slash so the sitemap URL never doubles up", () => {
    expect(buildRobots("https://example.com/")).not.toContain(".com//sitemap");
    expect(buildRobots("https://example.com")).toContain(
      "Sitemap: https://example.com/sitemap.xml",
    );
  });
});

describe("buildMeta", () => {
  const input = {
    title: "A very long title that keeps going and going well past the soft limit",
    description: "Short.",
    siteName: "Nordic Explorer",
    url: "https://example.com/norway",
    indexable: true,
  };

  it("emits index/follow for an indexable page", () => {
    const meta = buildMeta(input);

    expect(meta.robots).toBe("index, follow");
    expect(meta.canonical).toBe("https://example.com/norway");
    expect(meta.openGraph).toEqual({
      title: input.title.slice(0, 160),
      description: "Short.",
      url: input.url,
      type: "article",
      siteName: "Nordic Explorer",
    });
  });

  it("emits noindex for a draft", () => {
    expect(buildMeta({ ...input, indexable: false }).robots).toBe("noindex, nofollow");
  });

  it("caps the title and the description instead of shipping a wall of text", () => {
    const meta = buildMeta({ ...input, title: "x".repeat(500), description: "y".repeat(900) });

    expect(meta.title).toHaveLength(160);
    expect(meta.description).toHaveLength(300);
  });
});

describe("truncation flags", () => {
  it("flags titles over the 60 character search limit", () => {
    expect(checkTitle("short")).toMatchObject({ over: false, limit: SEO_LIMITS.title });
    expect(checkTitle("x".repeat(SEO_LIMITS.title + 1))).toMatchObject({ over: true, length: 61 });
    expect(checkDescription("x".repeat(SEO_LIMITS.description + 1))).toMatchObject({ over: true });
  });
});

describe("buildSitemap", () => {
  it("renders one url per entry and skips lastmod when unknown", () => {
    const xml = buildSitemap([
      { path: "https://example.com/", lastmod: new Date("2026-01-02T00:00:00Z") },
      { path: "https://example.com/about", lastmod: null },
      { path: "https://example.com/about" },
    ]);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<urlset xmlns=");
    expect(xml.match(/<url>/g)).toHaveLength(3);
    expect(xml).toContain("<loc>https://example.com/</loc>");
    expect(xml).toContain("<lastmod>2026-01-02</lastmod>");
    expect(xml).toContain("<loc>https://example.com/about</loc>");
    expect(xml.split("<loc>https://example.com/about</loc>")).toHaveLength(3);
    expect(xml.endsWith("</urlset>\n")).toBe(true);
  });

  it("escapes markup inside a url", () => {
    expect(escapeXml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&apos;");
    expect(buildSitemap([{ path: "https://example.com/?a=1&b=2" }])).toContain(
      "&amp;b=2</loc>",
    );
  });
});

describe("excerptFromBody", () => {
  /** The default excerpt limit — asserted so a change in the helper is caught. */
  const SOFT_LIMIT = 155;

  it("flattens markdown into plain text", () => {
    expect(excerptFromBody("# Title\n\nSome **bold** text with a [link](https://x.com).")).toBe(
      "Title Some bold text with a link.",
    );
  });

  it("drops images, comments and code fences", () => {
    expect(excerptFromBody("<!-- hidden --> ![](img.png) `code`")).toBe("code");
  });

  it("truncates on the limit with a single ellipsis", () => {
    const out = excerptFromBody("word ".repeat(200));

    expect(out.length).toBeLessThanOrEqual(SOFT_LIMIT);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toContain("  ");
    // The limit is the caller's contract: the meta tag must fit its slot.
    expect(excerptFromBody("a".repeat(SOFT_LIMIT))).toHaveLength(SOFT_LIMIT);
    expect(excerptFromBody("a".repeat(SOFT_LIMIT + 1))).toHaveLength(SOFT_LIMIT);
  });
});

describe("canonicalSlug", () => {
  it("falls back when the title yields nothing usable", () => {
    expect(canonicalSlug("")).toBe("page");
    expect(canonicalSlug("!!!")).toBe("page");
    expect(canonicalSlug("Northern Lights Guide")).toBe("northern-lights-guide");
  });
});
