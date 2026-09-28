import { describe, expect, it } from "vitest";
import {
  buttonAccent,
  contrastRatio,
  darken,
  ensureContrast,
  isDark,
  lighten,
  luminance,
  mix,
  parseHex,
  toHex,
} from "@/lib/preview/color";
import { normalizeDesign, DEFAULT_PREVIEW_DESIGN } from "@/lib/preview/data";

describe("parseHex / toHex", () => {
  it("parses 6-digit hex with or without the hash", () => {
    expect(parseHex("#2563eb")).toEqual({ r: 37, g: 99, b: 235 });
    expect(parseHex("2563eb")).toEqual({ r: 37, g: 99, b: 235 });
  });

  it("expands 3-digit shorthand", () => {
    expect(parseHex("#fff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("rejects anything that is not a hex colour", () => {
    expect(parseHex("rebeccapurple")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
    expect(parseHex("")).toBeNull();
  });

  it("round-trips through toHex", () => {
    expect(toHex(parseHex("#0f172a")!)).toBe("#0f172a");
  });
});

describe("luminance / contrast", () => {
  it("orders colours by luminance", () => {
    expect(luminance("#ffffff")).toBeCloseTo(1, 3);
    expect(luminance("#000000")).toBeCloseTo(0, 3);
    expect(luminance("#f7f8fa")).toBeGreaterThan(luminance("#0f172a"));
  });

  it("matches the WCAG maximum contrast ratio", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("flags dark backgrounds", () => {
    expect(isDark("#0f172a")).toBe(true);
    expect(isDark("#ffffff")).toBe(false);
  });
});

describe("mix / lighten / darken", () => {
  it("keeps the base at amount 0 and the target at amount 1", () => {
    expect(mix("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mix("#000000", "#ffffff", 1)).toBe("#ffffff");
  });

  it("lightens and darkens symmetrically", () => {
    expect(lighten("#808080", 0.5)).toBe("#c0c0c0");
    expect(darken("#808080", 0.5)).toBe("#404040");
  });

  it("returns the input when a colour cannot be parsed", () => {
    expect(mix("nope", "#ffffff", 0.5)).toBe("nope");
  });
});

describe("ensureContrast", () => {
  it("leaves an already readable colour untouched", () => {
    expect(ensureContrast("#0f172a", "#ffffff", 4.5)).toBe("#0f172a");
  });

  it("darkens pale text until it is readable on white", () => {
    const fixed = ensureContrast("#ffee00", "#ffffff", 4.5);
    expect(fixed).not.toBe("#ffee00");
    expect(contrastRatio(fixed, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps dark text readable on a dark surface", () => {
    const fixed = ensureContrast("#111827", "#0f172a", 4.5);
    expect(contrastRatio(fixed, "#0f172a")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("buttonAccent", () => {
  it("keeps a brand colour that already reads on the surface", () => {
    const { bg, fg } = buttonAccent("#1d4ed8", "#ffffff");
    expect(bg).toBe("#1d4ed8");
    expect(fg).toBe("#ffffff");
  });

  it("keeps a light brand colour and switches the label to dark ink", () => {
    const { bg, fg } = buttonAccent("#fde047", "#ffffff");
    expect(bg).toBe("#fde047");
    expect(fg).toBe("#0b1220");
    expect(contrastRatio(bg, fg)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps a dark brand colour on a light surface", () => {
    const { bg, fg } = buttonAccent("#111827", "#ffffff");
    expect(bg).toBe("#111827");
    expect(fg).toBe("#ffffff");
  });

  it("stays in the brand family on a dark surface instead of turning white", () => {
    const { bg, fg } = buttonAccent("#ff0066", "#121212");
    expect(bg).not.toBe("#ffffff");
    expect(contrastRatio(bg, fg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(bg, "#121212")).toBeGreaterThanOrEqual(3);
  });
});

describe("normalizeDesign", () => {
  it("falls back to the default design when the row is missing", () => {
    expect(normalizeDesign(null)).toEqual(DEFAULT_PREVIEW_DESIGN);
  });

  it("migrates a legacy light row: page gets a soft background, cards stay white", () => {
    const design = normalizeDesign({
      primaryColor: "#1d4ed8",
      secondaryColor: "#0f172a",
      backgroundColor: "#ffffff",
      textColor: "#0f172a",
      fontStyle: "editorial",
      layoutStyle: "wide",
      cardStyle: "soft",
      borderRadius: 14,
    });

    expect(design.surfaceColor).toBe("#ffffff");
    expect(design.backgroundColor).toBe("#f7f8fa");
    expect(design.headerStyle).toBe("plain");
    expect(design.heroStyle).toBe("banded");
    expect(design.cardDensity).toBe("comfortable");
    expect(design.borderRadius).toBe(14);
  });

  it("migrates a legacy dark row without turning it light", () => {
    const design = normalizeDesign({
      primaryColor: "#38bdf8",
      backgroundColor: "#0f172a",
      textColor: "#f8fafc",
    });

    expect(design.surfaceColor).toBe("#0f172a");
    expect(luminance(design.backgroundColor)).toBeLessThan(0.2);
    expect(luminance(design.mutedColor)).toBeGreaterThan(0.2);
  });

  it("never rewrites a row that already has the new palette", () => {
    const design = normalizeDesign({
      primaryColor: "#2563eb",
      surfaceColor: "#101820",
      backgroundColor: "#070b14",
      textColor: "#e8ecf6",
      mutedColor: "#9aa6bd",
    });

    expect(design.surfaceColor).toBe("#101820");
    expect(design.backgroundColor).toBe("#070b14");
    expect(design.mutedColor).toBe("#9aa6bd");
  });

  it("replaces unknown enum values and clamps the radius", () => {
    const design = normalizeDesign({
      fontStyle: "comic",
      layoutStyle: "huge",
      cardStyle: "neon",
      headerStyle: "neon",
      heroStyle: "neon",
      cardDensity: "neon",
      borderRadius: 900,
    });

    expect(design.fontStyle).toBe("modern");
    expect(design.layoutStyle).toBe("centered");
    expect(design.cardStyle).toBe("soft");
    expect(design.headerStyle).toBe("plain");
    expect(design.heroStyle).toBe("banded");
    expect(design.cardDensity).toBe("comfortable");
    expect(design.borderRadius).toBe(32);
  });

  it("keeps a negative or missing radius inside the supported range", () => {
    expect(normalizeDesign({ borderRadius: -5 }).borderRadius).toBe(0);
    expect(normalizeDesign({}).borderRadius).toBe(DEFAULT_PREVIEW_DESIGN.borderRadius);
  });
});
