import { describe, expect, it } from "vitest";
import { decodeRouteParam } from "@/lib/utils/params";
import { slugify } from "@/lib/utils/slug";

describe("decodeRouteParam", () => {
  it("decodes a percent-encoded Cyrillic segment", () => {
    expect(decodeRouteParam("%D1%81%D0%B5%D0%BA%D1%81")).toBe("секс");
  });

  it("leaves an already decoded value untouched", () => {
    expect(decodeRouteParam("секс")).toBe("секс");
    expect(decodeRouteParam("nordic-explorer")).toBe("nordic-explorer");
  });

  it("keeps the raw value when it contains a broken escape", () => {
    expect(decodeRouteParam("100%-done")).toBe("100%-done");
  });

  it("returns an empty string for a missing param", () => {
    expect(decodeRouteParam(undefined)).toBe("");
  });

  it("round-trips the slugs slugify() produces", () => {
    for (const name of ["Дом и Сад", "Nordic Explorer", "한국 가이드", "Café Life"]) {
      const slug = slugify(name);
      const encoded = encodeURIComponent(slug);
      expect(decodeRouteParam(encoded)).toBe(slug);
    }
  });
});
