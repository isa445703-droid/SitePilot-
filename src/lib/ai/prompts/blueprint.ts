import { systemPrompt } from "./common";

export const blueprintSystem = systemPrompt(
  "a website strategist who turns a plain-language brief into a structured website blueprint",
  [
    "Produce a complete, realistic blueprint: audience, goal, tone, categories, pages, content types, publishing frequency, monetization and SEO strategy.",
    "Categories and pages must be specific to the brief — never generic placeholders.",
    "The design object is a real visual identity, not decoration: derive the palette from the topic's mood (e.g. finance = calm greens/navy, travel = warm earthy or ocean tones, food = appetizing warm colors, tech = cool neutrals with one vivid accent). Do NOT default to generic blue unless the brief asks for it.",
    "Colors must be 6-digit hex codes. textColor on backgroundColor needs contrast ratio of at least 4.5:1 — if the background is dark, the text must be light. primaryColor is the main brand/action color; secondaryColor is used for headings and accents and must harmonize with primaryColor. surfaceColor is the card/header/footer color and must stay readable with textColor; backgroundColor is the page behind the cards, normally a very light or very dark neutral. mutedColor is the softer secondary text and needs at least 4.5:1 on backgroundColor too.",
    "Keep the style fields coherent with each other and with the mood: fontStyle 'editorial' pairs with layoutStyle 'magazine', 'classic' with 'centered'/'flat' cards and a small borderRadius, 'modern' with 'soft' cards and a medium-to-large borderRadius. headerStyle 'brand' or 'gradient' suits confident consumer brands, 'plain' suits corporate and editorial looks. heroStyle 'banded' is the safest default; 'centered' suits minimal brands. cardDensity 'compact' fits content-dense reference sites, 'comfortable' fits blogs and magazines.",
    "The site language must match the requested content language.",
    "When the brief describes a desired look & feel (interface, mood, colors, typography, layout), translate it faithfully into the design object and let it override the mood-based defaults. Never contradict an explicit user wish.",
  ],
);

export function blueprintPrompt(input: {
  brief: string;
  siteName?: string;
  language: string;
  timezone?: string;
  designBrief?: string;
}): string {
  return [
    `Natural-language brief:`,
    `"""${input.brief}"""`,
    "",
    input.siteName ? `Working site name: ${input.siteName}` : "Propose a fitting site name.",
    `Content language code: ${input.language}`,
    input.timezone ? `Timezone: ${input.timezone}` : "",
    input.designBrief
      ? `Desired look & feel described by the user (reflect it in the design object):\n"""${input.designBrief}"""`
      : "",
    "",
    "Return JSON with this exact shape:",
    "{",
    '  "siteName": string,',
    '  "description": string,',
    '  "targetAudience": string,',
    '  "primaryGoal": string,',
    '  "language": string,',
    '  "tone": string,',
    '  "categories": [{ "name": string, "description": string }],',
    '  "pages": [{ "title": string, "slug": string, "purpose": string }],',
    '  "contentTypes": [string],',
    '  "publishingFrequency": "ONCE_A_WEEK" | "TWICE_A_WEEK" | "THREE_A_WEEK" | "FIVE_A_WEEK" | "DAILY",',
    '  "monetization": [string],',
    '  "seoStrategy": { "approach": string, "keywords": [string] },',
    '  "design": {',
    '    "primaryColor": "#rrggbb", "secondaryColor": "#rrggbb",',
    '    "surfaceColor": "#rrggbb", "backgroundColor": "#rrggbb",',
    '    "textColor": "#rrggbb", "mutedColor": "#rrggbb",',
    '    "fontStyle": "modern" | "classic" | "editorial",',
    '    "layoutStyle": "centered" | "wide" | "magazine",',
    '    "cardStyle": "soft" | "flat" | "outlined",',
    '    "headerStyle": "plain" | "brand" | "gradient",',
    '    "heroStyle": "simple" | "banded" | "centered",',
    '    "cardDensity": "compact" | "comfortable",',
    '    "borderRadius": number',
    "  }",
    "}",
    "",
    "Use 3-6 categories, 4-8 pages, and the publishing frequency from the brief.",
    "Field limits: tone max 180 characters; monetization 3-5 entries, each max 70 characters (short phrases, plain strings); description/targetAudience/primaryGoal max 300 characters each.",
    "For design: pick colors that express the site's mood (see the rules above), check the contrast, and choose fontStyle/layoutStyle/cardStyle/headerStyle/heroStyle/cardDensity/borderRadius as one coherent style. borderRadius is 0-32. Always fill every design field.",
  ].filter(Boolean).join("\n");
}
