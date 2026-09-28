/**
 * Colour maths for generated sites.
 *
 * The AI picks four raw hex colours per site. That is not enough to render a
 * page that stays readable: hover states, muted text, borders, code blocks and
 * shadows all need tints and shades of the palette, and a site can be light or
 * dark. Deriving those roles here (instead of hand-writing `color-mix()` for
 * every component) keeps one source of truth and makes the result testable.
 *
 * Everything is pure and framework-free so it can run in the server component
 * that renders a site and in unit tests.
 */

export type Rgb = { r: number; g: number; b: number };

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function parseHex(value: string): Rgb | null {
  const match = HEX_RE.exec(value.trim());
  if (!match) return null;
  const hex = match[1];
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => char + char)
          .join("")
      : hex;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function channel(value: number): number {
  const clamped = Math.min(255, Math.max(0, value));
  return Math.round(clamped);
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (value: number) => channel(value).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function linearise(channel8bit: number): number {
  const ratio = channel8bit / 255;
  return ratio <= 0.04045 ? ratio / 12.92 : Math.pow((ratio + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  return 0.2126 * linearise(rgb.r) + 0.7152 * linearise(rgb.g) + 0.0722 * linearise(rgb.b);
}

/** WCAG contrast ratio between two colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isDark(hex: string): boolean {
  return luminance(hex) < 0.45;
}

/** Blends `toward` into `base`; `amount` 0 keeps base, 1 returns `toward`. */
export function mix(base: string, toward: string, amount: number): string {
  const from = parseHex(base);
  const to = parseHex(toward);
  if (!from || !to) return base;
  const ratio = clamp01(amount);
  return toHex({
    r: from.r + (to.r - from.r) * ratio,
    g: from.g + (to.g - from.g) * ratio,
    b: from.b + (to.b - from.b) * ratio,
  });
}

/** Lightens a colour (towards white). */
export function lighten(hex: string, amount: number): string {
  return mix(hex, "#ffffff", amount);
}

/** Darkens a colour (towards black). */
export function darken(hex: string, amount: number): string {
  return mix(hex, "#000000", amount);
}

/**
 * Nudges a colour until it keeps `minRatio` against `background`. Used for
 * links and accent text, which the AI may pick too close to the background.
 * Returns the original colour when even pure black/white cannot reach the
 * target, so the caller always gets a usable string.
 */
export function ensureContrast(color: string, background: string, minRatio = 4.5): string {
  if (contrastRatio(color, background) >= minRatio) return color;

  const darkenCandidate = darken(color, 0.5);
  if (contrastRatio(darkenCandidate, background) >= minRatio) return darkenCandidate;

  const black = "#000000";
  if (contrastRatio(black, background) >= minRatio) return black;

  return contrastRatio("#ffffff", background) >= contrastRatio(black, background) ? "#ffffff" : black;
}

/**
 * Accent colour for buttons: the brand colour, darkened when it is too light to
 * carry white text. Keeps generated CTAs readable whatever the AI picked, and
 * falls back to the link colour when the brand colour fails on the site
 * background.
 */
const BUTTON_INK_LIGHT = "#ffffff";
const BUTTON_INK_DARK = "#0b1220";

/** The label colour that reads best on a given button fill. */
export function buttonInk(background: string): string {
  return contrastRatio(background, BUTTON_INK_LIGHT) >= contrastRatio(background, BUTTON_INK_DARK)
    ? BUTTON_INK_LIGHT
    : BUTTON_INK_DARK;
}

export function buttonAccent(primary: string, background: string): { bg: string; fg: string } {
  // Keep the brand colour whenever a readable label fits on it; otherwise walk a
  // short ladder of darker and lighter variants. Jumping straight to black/white
  // would throw the brand away, so black and white are only reached as a last
  // resort for the label colour, never for the fill.
  const ladder = [
    primary,
    darken(primary, 0.2),
    darken(primary, 0.4),
    darken(primary, 0.6),
    lighten(primary, 0.3),
    lighten(primary, 0.55),
    lighten(primary, 0.75),
  ];
  const readable = (color: string) => contrastRatio(color, buttonInk(color)) >= 4.5;
  const bg = ladder.find(readable) ?? ladder.find((color) => contrastRatio(color, background) >= 3) ?? primary;
  return { bg, fg: buttonInk(bg) };
}
