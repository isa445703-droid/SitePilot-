import type {
  Blueprint,
  ContentPlan,
  GeneratedArticle,
  PageContent,
  ResearchResult,
  SeoSuggestion,
  SiteAnalysis,
} from "./schemas";

/**
 * Development/demo generators.
 *
 * They are used ONLY when MISTRAL_API_KEY is missing and the app is not in
 * production (see lib/ai/index.ts). Every artefact they produce is marked with
 * the `<!-- sitepilot:demo -->` marker and stored as `isDemo` so the UI can
 * label it honestly — demo output is never passed off as real AI output.
 */

export const DEMO_MARKER = "<!-- sitepilot:demo -->";

export function isDemoContent(value: string): boolean {
  return value.includes(DEMO_MARKER);
}

const DEMO_CATEGORIES = ["Guides", "Destinations", "Practical tips", "Inspiration"];

/** Coherent demo identities — one is chosen per brief so demo sites don't
 *  all look alike while real generation is unavailable. */
const DEMO_DESIGNS: Blueprint["design"][] = [
  {
    primaryColor: "#0e7490",
    secondaryColor: "#164e63",
    surfaceColor: "#ffffff",
    backgroundColor: "#f2f8f9",
    textColor: "#0f172a",
    mutedColor: "#47606b",
    fontStyle: "modern",
    layoutStyle: "centered",
    cardStyle: "soft",
    borderRadius: 16,
    headerStyle: "plain",
    heroStyle: "banded",
    cardDensity: "comfortable",
  },
  {
    primaryColor: "#15803d",
    secondaryColor: "#14532d",
    surfaceColor: "#ffffff",
    backgroundColor: "#f3f8f2",
    textColor: "#1c1917",
    mutedColor: "#4b5750",
    fontStyle: "modern",
    layoutStyle: "wide",
    cardStyle: "flat",
    borderRadius: 10,
    headerStyle: "brand",
    heroStyle: "simple",
    cardDensity: "compact",
  },
  {
    primaryColor: "#c2410c",
    secondaryColor: "#7c2d12",
    surfaceColor: "#fffdf8",
    backgroundColor: "#fdf6ec",
    textColor: "#292524",
    mutedColor: "#6b5443",
    fontStyle: "classic",
    layoutStyle: "centered",
    cardStyle: "soft",
    borderRadius: 20,
    headerStyle: "plain",
    heroStyle: "centered",
    cardDensity: "comfortable",
  },
  {
    primaryColor: "#38bdf8",
    secondaryColor: "#0ea5e9",
    surfaceColor: "#0f172a",
    backgroundColor: "#080d18",
    textColor: "#f8fafc",
    mutedColor: "#9fb3c8",
    fontStyle: "editorial",
    layoutStyle: "magazine",
    cardStyle: "flat",
    borderRadius: 8,
    headerStyle: "gradient",
    heroStyle: "simple",
    cardDensity: "comfortable",
  },
  {
    primaryColor: "#7e22ce",
    secondaryColor: "#3b0764",
    surfaceColor: "#ffffff",
    backgroundColor: "#f8f5ff",
    textColor: "#1e1b4b",
    mutedColor: "#585080",
    fontStyle: "editorial",
    layoutStyle: "centered",
    cardStyle: "outlined",
    borderRadius: 24,
    headerStyle: "plain",
    heroStyle: "banded",
    cardDensity: "comfortable",
  },
];

function pickDemoDesign(brief: string): Blueprint["design"] {
  let hash = 0;
  for (const ch of brief) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return DEMO_DESIGNS[Math.abs(hash) % DEMO_DESIGNS.length];
}

function detectFrequency(brief: string): Blueprint["publishingFrequency"] {
  const b = brief.toLowerCase();
  if (/\bdaily|every day|ежедневн|매일\b/.test(b)) return "DAILY";
  if (/five|5 times|пять раз|다섯/.test(b)) return "FIVE_A_WEEK";
  if (/three|3 times|три раза|세 번/.test(b)) return "THREE_A_WEEK";
  if (/twice|2 times|дважды|두 번/.test(b)) return "TWICE_A_WEEK";
  if (/once|раз в неделю|주 1회/.test(b)) return "ONCE_A_WEEK";
  return "THREE_A_WEEK";
}

function detectLanguage(brief: string, fallback: string): string {
  if (/[а-яё]/i.test(brief)) return "ru";
  if (/[가-힣]/.test(brief)) return "ko";
  return fallback;
}

function titleFromBrief(brief: string, provided?: string): string {
  if (provided?.trim()) return provided.trim().slice(0, 120);
  const words = brief.trim().split(/\s+/).slice(0, 5).join(" ").replace(/[.,;:!?]+$/, "");
  return (words || "My new website").replace(/^./, (c) => c.toUpperCase());
}

export function demoBlueprint(input: {
  brief: string;
  siteName?: string;
  language: string;
}): Blueprint {
  const language = detectLanguage(input.brief, input.language);
  const siteName = titleFromBrief(input.brief, input.siteName);
  const brief = input.brief.trim();

  return {
    siteName,
    description: brief.slice(0, 400) || "A website generated in demo mode.",
    targetAudience: "Readers looking for clear, practical and trustworthy information.",
    primaryGoal: "Grow a loyal readership through useful, regularly updated content.",
    language,
    tone: "Modern, trustworthy and friendly.",
    categories: DEMO_CATEGORIES.slice(0, 4).map((name) => ({
      name,
      description: `Everything about ${name.toLowerCase()} for ${siteName}.`,
    })),
    pages: [
      { title: "Home", slug: "", purpose: "Landing page with the latest content" },
      { title: "About", slug: "about", purpose: "Who we are and what we offer" },
      { title: "Contact", slug: "contact", purpose: "How to reach us" },
      { title: "Resources", slug: "resources", purpose: "Curated links and downloads" },
    ],
    contentTypes: ["Article", "Guide", "Listicle", "FAQ"],
    publishingFrequency: detectFrequency(brief),
    monetization: [],
    seoStrategy: {
      approach:
        "Publish category-focused long-form articles, interlink them tightly and keep metadata complete.",
      keywords: ["guide", "how to", "best practices"],
    },
    design: pickDemoDesign(brief),
  };
}

export function demoContentPlan(input: { siteName: string; count: number }): ContentPlan {
  const seeds = [
    "Getting started: the essentials you actually need",
    "A practical checklist for your first week",
    "Common mistakes and how to avoid them",
    "The complete beginner's guide",
    "How to plan the next 90 days",
    "Expert answers to the 10 most asked questions",
    "What changed this year, and what it means for you",
    "A step-by-step walkthrough with examples",
    "Budget, time and effort: what to expect",
    "Quick wins you can apply today",
  ];
  return {
    items: seeds.slice(0, Math.max(3, Math.min(input.count, 10))).map((title, i) => ({
      title: `${title}`,
      topic: `${title} — for readers of ${input.siteName}`,
      category: DEMO_CATEGORIES[i % DEMO_CATEGORIES.length],
      intent: i % 4 === 1 ? "commercial" : "informational",
      keywords: ["guide", "how to", input.siteName.toLowerCase()].slice(0, 3),
    })),
  };
}

export function demoArticle(input: {
  title: string;
  siteName: string;
  language: string;
  category?: string;
}): GeneratedArticle {
  const { title, siteName } = input;
  const body = [
    DEMO_MARKER,
    `> This article was produced in **demo mode** because no AI provider is configured. Set \`MISTRAL_API_KEY\` to generate real content.`,
    "",
    `## Why this matters`,
    "",
    `${title} is one of the questions readers of ${siteName} ask most often. This preview shows how a finished article will look inside SitePilot — structure, headings, lists and metadata — without pretending that a language model wrote it.`,
    "",
    `## What you will find here`,
    "",
    `- A clear explanation of the topic, written for ${input.category ? `the ${input.category} category` : "the main audience"}`,
    "- Practical steps you can apply immediately",
    "- Common pitfalls and how to avoid them",
    "- A short checklist at the end",
    "",
    `## Practical steps`,
    "",
    "1. **Start with the goal.** Decide what a reader should be able to do after reading.",
    "2. **Keep it concrete.** Examples beat abstract advice every time.",
    "3. **Review before publishing.** Use the editor, improve or rewrite actions above.",
    "",
    `## Checklist`,
    "",
    "- [ ] Title and excerpt are clear",
    "- [ ] SEO title and description are filled in",
    "- [ ] Category and tags are set",
    "- [ ] At least one internal link points to a related article",
    "",
    `_Demo content for ${siteName}. The rendering engine above is production-ready — only the writing is simulated._`,
  ].join("\n");

  return {
    title,
    slug: "",
    excerpt: `${title} — a demo article generated locally because the AI provider is not configured.`,
    content: body,
    tags: ["demo", "guide"],
    seoTitle: title.slice(0, 60),
    seoDescription: `Demo article: ${title}`.slice(0, 155),
    category: input.category ?? "",
    sourceTitles: [],
  };
}

export function demoPageContent(input: {
  pageTitle: string;
  pagePurpose: string;
  siteName: string;
  language: string;
}): PageContent {
  const { pageTitle, siteName } = input;
  const purpose = input.pagePurpose || "support the site's goals";
  return {
    seoTitle: `${pageTitle} — ${siteName}`.slice(0, 60),
    seoDescription:
      `Demo page "${pageTitle}" for ${siteName}: real content appears once the AI provider is configured.`.slice(
        0,
        155,
      ),
    blocks: [
      {
        type: "paragraph",
        level: 2,
        text: `${DEMO_MARKER} This page was produced in demo mode because no AI provider is configured. Set MISTRAL_API_KEY to generate real content.`,
        items: [],
      },
      { type: "heading", level: 2, text: pageTitle, items: [] },
      {
        type: "paragraph",
        level: 2,
        text: `${siteName} uses this page to ${purpose}. The structure, headings and layout below show how the finished page will look once a language model writes the copy.`,
        items: [],
      },
      { type: "heading", level: 2, text: "What you will find here", items: [] },
      {
        type: "list",
        level: 2,
        text: "",
        items: [
          "A clear introduction to this page and why it exists",
          "Key information grouped under short headings",
          "Practical next steps for visitors",
        ],
      },
      {
        type: "paragraph",
        level: 2,
        text: "Demo content keeps the layout production-ready: only the writing is simulated until an AI provider is connected.",
        items: [],
      },
    ],
  };
}

export function demoSeo(input: { title: string }): SeoSuggestion {
  const slug = input.title
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return {
    seoTitle: input.title.slice(0, 60),
    seoDescription: `Read this demo article: ${input.title}`.slice(0, 155),
    slug,
    tags: ["demo", "guide"],
    internalLinkIdeas: ["Related guide", "Frequently asked questions"],
  };
}

export function demoResearch(topic: string): ResearchResult {
  return {
    summary: `Demo research pass for “${topic}”. No search provider is configured, so these are placeholders, not real web research.`,
    notes: [
      {
        title: "Placeholder note",
        detail:
          "Configure a search provider (SEARCH_PROVIDER) to collect real sources. Until then research is explicitly mocked.",
        isFact: false,
        assumption: true,
        source: "",
      },
      {
        title: "Angle to explore",
        detail: `Readers searching for “${topic}” usually want a step-by-step answer first, then examples.`,
        isFact: false,
        assumption: true,
        source: "",
      },
    ],
    suggestedTopics: [
      `How to approach ${topic}`,
      `${topic}: a practical checklist`,
      `Frequently asked questions about ${topic}`,
    ],
  };
}

export function demoAnalysis(stats: { articles: number; published: number; seoIssues: number }): SiteAnalysis {
  return {
    health: stats.seoIssues > 5 ? "warn" : "good",
    summary: `Demo analysis: ${stats.articles} articles, ${stats.published} published, ${stats.seoIssues} SEO issues.`,
    suggestions: [
      "Run an SEO audit and fix missing descriptions.",
      "Add one internal link between related articles.",
      "Keep the publishing schedule consistent.",
    ],
    nextTasks:
      stats.published < 3
        ? [{ type: "GENERATE_ARTICLE", reason: "The site needs more published content.", topic: "" }]
        : [],
  };
}
